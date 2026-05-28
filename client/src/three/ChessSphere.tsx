import React, { useMemo, useRef, useState, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Text, useGLTF, Environment, Lightformer } from '@react-three/drei';
import * as THREE from 'three';
import type { GameState, Position, Move, Color, Piece, PieceType } from 'spherical-chess-shared';

interface ChessSphereProps {
  gameState: GameState;
  playerColor: Color | null;
  validMoves: Move[];
  selectedSquare: Position | null;
  onSquareClick: (pos: Position) => void;
}

const SPHERE_RADIUS = 3;

// 3D piece models (CC-BY, Jarlan Perez — see public/models/chess/CREDITS.md).
const MODEL_PATHS: Record<string, string> = {
  K: '/models/chess/king.glb',
  Q: '/models/chess/queen.glb',
  R: '/models/chess/rook.glb',
  B: '/models/chess/bishop.glb',
  N: '/models/chess/knight.glb',
  P: '/models/chess/pawn.glb',
};

// Each model is Y-up and centered on X/Z; minY is the local Y of its base,
// used to seat the base exactly on the sphere surface after scaling.
const MODEL_BASE_Y: Record<string, number> = {
  K: -0.22, Q: -0.19, R: -0.09, N: -0.13, B: -0.12, P: -0.10,
};

const PIECE_SCALE = 2.3;
const WHITE_COLOR = '#efe7d4';
const BLACK_COLOR = '#322e29';

// Preload all models so they're ready when the board mounts.
Object.values(MODEL_PATHS).forEach((p) => useGLTF.preload(p));

// Rotate the whole board so white's hemisphere (which sits near the south
// pole in board space) faces the default camera. Players can still orbit.
const BOARD_TILT_X = -1.97;

const UP = new THREE.Vector3(0, 1, 0);

/**
 * Convert board file/rank to the point on the sphere surface at the centre
 * of that square. Files wrap around longitude, ranks run pole-to-pole.
 */
function boardToSphere(file: number, rank: number): THREE.Vector3 {
  const phi = ((7 - rank + 0.5) / 8) * Math.PI; // 0 = north pole, PI = south
  const theta = ((file + 0.5) / 8) * Math.PI * 2;
  return new THREE.Vector3(
    SPHERE_RADIUS * Math.sin(phi) * Math.cos(theta),
    SPHERE_RADIUS * Math.cos(phi),
    SPHERE_RADIUS * Math.sin(phi) * Math.sin(theta),
  );
}

/** Subdivided quad on the sphere surface for a single square. */
function createSquareGeometry(file: number, rank: number, subdivisions = 8): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  const normals: number[] = [];

  for (let i = 0; i <= subdivisions; i++) {
    for (let j = 0; j <= subdivisions; j++) {
      const u = (file + j / subdivisions) / 8;
      const v = (rank + i / subdivisions) / 8;

      const phi = (1 - v) * Math.PI;
      const theta = u * Math.PI * 2;

      const x = SPHERE_RADIUS * Math.sin(phi) * Math.cos(theta);
      const y = SPHERE_RADIUS * Math.cos(phi);
      const z = SPHERE_RADIUS * Math.sin(phi) * Math.sin(theta);

      positions.push(x, y, z);
      const len = Math.sqrt(x * x + y * y + z * z) || 1;
      normals.push(x / len, y / len, z / len);
    }
  }

  for (let i = 0; i < subdivisions; i++) {
    for (let j = 0; j < subdivisions; j++) {
      const a = i * (subdivisions + 1) + j;
      const b = a + 1;
      const c = a + (subdivisions + 1);
      const d = c + 1;
      indices.push(a, b, d, a, d, c);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setIndex(indices);
  return geometry;
}

/**
 * Shared click-vs-drag detection: a pointerdown/up pair only counts as a
 * click if the pointer barely moved (otherwise it was an OrbitControls drag).
 */
function usePointerClick(onClick: () => void) {
  const down = useRef<{ x: number; y: number } | null>(null);
  return {
    onPointerDown: (e: any) => {
      e.stopPropagation();
      down.current = { x: e.clientX, y: e.clientY };
    },
    onPointerUp: (e: any) => {
      e.stopPropagation();
      const start = down.current;
      down.current = null;
      if (!start) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (dx * dx + dy * dy < 36) onClick();
    },
  };
}

/** A single 3D piece, recoloured for its side and seated on the surface. */
function PieceModel({
  type,
  color,
  quaternion,
  center,
  onClick,
}: {
  type: PieceType;
  color: Color;
  quaternion: THREE.Quaternion;
  center: THREE.Vector3;
  onClick: () => void;
}) {
  const { scene } = useGLTF(MODEL_PATHS[type]);
  const handlers = usePointerClick(onClick);

  const model = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        // These glb meshes ship without normals, so the surface can't be lit
        // (it looks like a flat silhouette). Generate smooth normals so the
        // form actually catches the light.
        if (!mesh.geometry.attributes.normal) mesh.geometry.computeVertexNormals();
        // Glossy lacquered look: a polished clear-coat over the base colour.
        // The clear-coat reflects the studio Environment for the sleek sheen.
        const mat = new THREE.MeshPhysicalMaterial({
          color: new THREE.Color(color === 'white' ? WHITE_COLOR : BLACK_COLOR),
          roughness: 0.32,
          metalness: 0.15,
          clearcoat: 1,
          clearcoatRoughness: 0.08,
          envMapIntensity: 1.3,
        });
        mesh.material = mat;
      }
    });
    return clone;
  }, [scene, color]);

  const baseOffset = -MODEL_BASE_Y[type] * PIECE_SCALE;

  return (
    <group position={center} quaternion={quaternion}>
      {/* +Y of the group now points along the outward surface normal, so the
          piece's base sits on the surface and it stands straight up. */}
      <primitive
        object={model}
        position={[0, baseOffset, 0]}
        scale={PIECE_SCALE}
        {...handlers}
        onPointerOver={(e: any) => {
          e.stopPropagation();
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          document.body.style.cursor = 'auto';
        }}
      />
    </group>
  );
}

/** A board square: the clickable quad plus its highlight and any piece. */
function Square({
  file,
  rank,
  isLight,
  isSelected,
  isValidMove,
  isLastMove,
  piece,
  onClick,
}: {
  file: number;
  rank: number;
  isLight: boolean;
  isSelected: boolean;
  isValidMove: boolean;
  isLastMove: boolean;
  piece: Piece | null;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const geometry = useMemo(() => createSquareGeometry(file, rank), [file, rank]);
  const center = useMemo(() => boardToSphere(file, rank), [file, rank]);

  // Orientation that maps local +Y to the outward surface normal.
  const quaternion = useMemo(() => {
    const normal = center.clone().normalize();
    return new THREE.Quaternion().setFromUnitVectors(UP, normal);
  }, [center]);

  const clickHandlers = usePointerClick(onClick);

  let color: string;
  if (isSelected) color = '#f7c948';
  else if (isLastMove) color = isLight ? '#cdd98a' : '#a3a55a';
  else if (hovered) color = isLight ? '#f7e3c0' : '#c2966f';
  else color = isLight ? '#f0d9b5' : '#b58863';

  return (
    <group>
      <mesh
        geometry={geometry}
        {...clickHandlers}
        onPointerOver={(e: any) => {
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => setHovered(false)}
      >
        <meshStandardMaterial color={color} side={THREE.DoubleSide} roughness={0.8} metalness={0.05} />
      </mesh>

      {/* Move markers: a flat disc on an empty target, a ring on a capture. */}
      {isValidMove && (
        <group position={center.clone().multiplyScalar(1.012)} quaternion={quaternion}>
          {piece ? (
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.34, 0.045, 12, 28]} />
              <meshStandardMaterial color="#e94560" emissive="#e94560" emissiveIntensity={0.4} />
            </mesh>
          ) : (
            <mesh>
              <cylinderGeometry args={[0.13, 0.13, 0.03, 20]} />
              <meshStandardMaterial color="#3fa34d" emissive="#3fa34d" emissiveIntensity={0.5} />
            </mesh>
          )}
        </group>
      )}

      {piece && (
        <PieceModel
          type={piece.type}
          color={piece.color}
          quaternion={quaternion}
          center={center}
          onClick={onClick}
        />
      )}
    </group>
  );
}

/** Coordinate labels floating just off the surface. */
function BoardLabels() {
  const labels: React.ReactNode[] = [];
  const files = 'abcdefgh';

  for (let f = 0; f < 8; f++) {
    const pos = boardToSphere(f, -0.6);
    labels.push(
      <Text key={`file-${f}`} position={[pos.x * 1.12, pos.y * 1.12, pos.z * 1.12]} fontSize={0.2} color="#888" anchorX="center" anchorY="middle">
        {files[f]}
      </Text>,
    );
  }
  for (let r = 0; r < 8; r++) {
    const pos = boardToSphere(-0.6, r);
    labels.push(
      <Text key={`rank-${r}`} position={[pos.x * 1.12, pos.y * 1.12, pos.z * 1.12]} fontSize={0.2} color="#888" anchorX="center" anchorY="middle">
        {String(r + 1)}
      </Text>,
    );
  }
  return <>{labels}</>;
}

/** The full 3D sphere board scene. */
function SphereBoardScene({ gameState, validMoves, selectedSquare, onSquareClick }: ChessSphereProps) {
  const lastMove = gameState.moveHistory.length > 0
    ? gameState.moveHistory[gameState.moveHistory.length - 1]
    : null;

  return (
    <>
      <ambientLight intensity={0.18} />
      <directionalLight position={[5, 10, 5]} intensity={1.1} />
      <directionalLight position={[-6, -3, -6]} intensity={0.3} />

      {/* Local studio environment: gives the clear-coat its reflections and
          soft image-based lighting without fetching any HDRI over the network. */}
      <Environment resolution={256} frames={1}>
        <Lightformer intensity={3} position={[0, 4, -6]} scale={[12, 6, 1]} color="#fff6e8" />
        <Lightformer intensity={1.4} position={[-6, 2, 4]} scale={[6, 6, 1]} color="#bcd0ff" />
        <Lightformer intensity={1.4} position={[6, 1, 4]} scale={[6, 6, 1]} color="#ffd9c2" />
        <Lightformer intensity={1} position={[0, -5, 2]} scale={[10, 4, 1]} color="#8892b0" />
      </Environment>

      <group rotation={[BOARD_TILT_X, 0, 0]}>
        {/* Solid inner sphere so the far side doesn't show through. */}
        <mesh>
          <sphereGeometry args={[SPHERE_RADIUS * 0.985, 64, 64]} />
          <meshStandardMaterial color="#23233a" roughness={0.9} metalness={0.05} />
        </mesh>

        {Array.from({ length: 8 }, (_, file) =>
          Array.from({ length: 8 }, (_, rank) => {
            const isLight = (file + rank) % 2 === 0;
            const pos: Position = { file, rank };
            const isSelected = selectedSquare?.file === file && selectedSquare?.rank === rank;
            const isValidMove = validMoves.some((m) => m.to.file === file && m.to.rank === rank);
            const isLastMove = lastMove
              ? (lastMove.from.file === file && lastMove.from.rank === rank) ||
                (lastMove.to.file === file && lastMove.to.rank === rank)
              : false;

            return (
              <Square
                key={`${file}-${rank}`}
                file={file}
                rank={rank}
                isLight={isLight}
                isSelected={isSelected}
                isValidMove={isValidMove}
                isLastMove={isLastMove}
                piece={gameState.board[file][rank]}
                onClick={() => onSquareClick(pos)}
              />
            );
          }),
        )}

        <BoardLabels />
      </group>

      <OrbitControls enablePan={false} minDistance={4.5} maxDistance={14} rotateSpeed={0.5} enableDamping dampingFactor={0.1} />
    </>
  );
}

export default function ChessSphere(props: ChessSphereProps) {
  return (
    <Canvas camera={{ position: [0, 2.5, 8], fov: 50 }} style={{ width: '100%', height: '100%' }}>
      <color attach="background" args={['#0f0f1a']} />
      <Suspense fallback={null}>
        <SphereBoardScene {...props} />
      </Suspense>
    </Canvas>
  );
}
