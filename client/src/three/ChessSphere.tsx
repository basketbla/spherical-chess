import React, { useMemo, useRef, useState, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Text, useGLTF, Environment, Lightformer } from '@react-three/drei';
import * as THREE from 'three';
import type { GameState, Position, Move, Color, Piece, PieceType } from 'spherical-chess-shared';

export type Quality = 'fast' | 'high';

interface ChessSphereProps {
  gameState: GameState;
  playerColor: Color | null;
  validMoves: Move[];
  selectedSquare: Position | null;
  onSquareClick: (pos: Position) => void;
  quality: Quality;
}

const SPHERE_RADIUS = 3;
const UP = new THREE.Vector3(0, 1, 0);

// Rotate the whole board so white's hemisphere (which sits near the south
// pole in board space) faces the default camera. Players can still orbit.
const BOARD_TILT_X = -1.97;

// ---- "fast" low-poly set (CC-BY, Jarlan Perez — see models/chess/CREDITS.md).
// Positions only, no normals, single colour: we add normals + a colour at load.
const FAST_PATHS: Record<string, string> = {
  K: '/models/chess/king.glb', Q: '/models/chess/queen.glb', R: '/models/chess/rook.glb',
  B: '/models/chess/bishop.glb', N: '/models/chess/knight.glb', P: '/models/chess/pawn.glb',
};
const FAST_SCALE = 2.3;
const WHITE_COLOR = '#efe7d4';
const BLACK_COLOR = '#322e29';

// ---- "high" PBR set (CC0, Poly Haven — see models/chess_hd/CREDITS.md).
// One glb holding all 12 piece meshes with baked white/black wood materials.
const HD_PATH = '/models/chess_hd/chess_set_1k.glb';
const HD_SCALE = 10.7;
const TYPE_NAME: Record<string, string> = {
  K: 'king', Q: 'queen', R: 'rook', B: 'bishop', N: 'knight', P: 'pawn',
};

// Only the small fast set is eagerly preloaded; the 4MB HD set loads on demand
// when the user opts into high quality.
Object.values(FAST_PATHS).forEach((p) => useGLTF.preload(p));

/** Centre point of a board square on the sphere surface. */
function boardToSphere(file: number, rank: number): THREE.Vector3 {
  const phi = ((7 - rank + 0.5) / 8) * Math.PI; // 0 = north pole, PI = south
  const theta = ((file + 0.5) / 8) * Math.PI * 2;
  return new THREE.Vector3(
    SPHERE_RADIUS * Math.sin(phi) * Math.cos(theta),
    SPHERE_RADIUS * Math.cos(phi),
    SPHERE_RADIUS * Math.sin(phi) * Math.sin(theta),
  );
}

// Square centres and surface-aligned orientations are static — precompute them.
const SQUARE_CENTER: THREE.Vector3[][] = [];
const SQUARE_QUAT: THREE.Quaternion[][] = [];
for (let f = 0; f < 8; f++) {
  SQUARE_CENTER[f] = [];
  SQUARE_QUAT[f] = [];
  for (let r = 0; r < 8; r++) {
    const c = boardToSphere(f, r);
    SQUARE_CENTER[f][r] = c;
    SQUARE_QUAT[f][r] = new THREE.Quaternion().setFromUnitVectors(UP, c.clone().normalize());
  }
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

/**
 * Renders a prepared piece object, uniformly scaled and seated so its base
 * sits on the sphere surface and it stands up along the outward normal.
 */
function SeatedPiece({
  object,
  scale,
  file,
  rank,
  onClick,
}: {
  object: THREE.Object3D;
  scale: number;
  file: number;
  rank: number;
  onClick: () => void;
}) {
  const handlers = usePointerClick(onClick);
  const { offset } = useMemo(() => {
    const box = new THREE.Box3().setFromObject(object);
    const cx = (box.min.x + box.max.x) / 2;
    const cz = (box.min.z + box.max.z) / 2;
    return { offset: new THREE.Vector3(-cx * scale, -box.min.y * scale, -cz * scale) };
  }, [object, scale]);

  return (
    <group position={SQUARE_CENTER[file][rank]} quaternion={SQUARE_QUAT[file][rank]}>
      <primitive
        object={object}
        position={offset}
        scale={scale}
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

/** A piece from the fast low-poly set: gets generated normals + a flat colour. */
function FastPiece({ type, color, file, rank, onClick }: {
  type: PieceType; color: Color; file: number; rank: number; onClick: () => void;
}) {
  const { scene } = useGLTF(FAST_PATHS[type]);
  const object = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        if (!mesh.geometry.attributes.normal) mesh.geometry.computeVertexNormals();
        mesh.material = new THREE.MeshPhysicalMaterial({
          color: new THREE.Color(color === 'white' ? WHITE_COLOR : BLACK_COLOR),
          roughness: 0.35, metalness: 0.15, clearcoat: 1, clearcoatRoughness: 0.18, envMapIntensity: 1.3,
        });
      }
    });
    return clone;
  }, [scene, color]);

  return <SeatedPiece object={object} scale={FAST_SCALE} file={file} rank={rank} onClick={onClick} />;
}

/** A piece from the high-quality PBR set: cloned from the shared HD scene. */
function HdPiece({ type, color, file, rank, onClick }: {
  type: PieceType; color: Color; file: number; rank: number; onClick: () => void;
}) {
  const { nodes } = useGLTF(HD_PATH) as any;
  const object = useMemo(() => {
    const source = nodes[`piece_${TYPE_NAME[type]}_${color}`] as THREE.Object3D;
    return source.clone(true); // materials (with textures) are shared by reference
  }, [nodes, type, color]);

  return <SeatedPiece object={object} scale={HD_SCALE} file={file} rank={rank} onClick={onClick} />;
}

/** All occupied squares' pieces, using the selected quality's source. */
function PieceLayer({ board, quality, onSquareClick }: {
  board: (Piece | null)[][]; quality: Quality; onSquareClick: (pos: Position) => void;
}) {
  const Piece = quality === 'high' ? HdPiece : FastPiece;
  const items: React.ReactNode[] = [];
  for (let file = 0; file < 8; file++) {
    for (let rank = 0; rank < 8; rank++) {
      const piece = board[file][rank];
      if (!piece) continue;
      items.push(
        <Piece
          key={`${file}-${rank}`}
          type={piece.type}
          color={piece.color}
          file={file}
          rank={rank}
          onClick={() => onSquareClick({ file, rank })}
        />,
      );
    }
  }
  return <>{items}</>;
}

/** A board square: the clickable quad plus its highlight and move marker. */
function Square({ file, rank, isLight, isSelected, isValidMove, isLastMove, hasPiece, onClick }: {
  file: number; rank: number; isLight: boolean; isSelected: boolean;
  isValidMove: boolean; isLastMove: boolean; hasPiece: boolean; onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const geometry = useMemo(() => createSquareGeometry(file, rank), [file, rank]);
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
        onPointerOver={(e: any) => { e.stopPropagation(); setHovered(true); }}
        onPointerOut={() => setHovered(false)}
      >
        <meshStandardMaterial color={color} side={THREE.DoubleSide} roughness={0.8} metalness={0.05} />
      </mesh>

      {isValidMove && (
        <group position={SQUARE_CENTER[file][rank].clone().multiplyScalar(1.012)} quaternion={SQUARE_QUAT[file][rank]}>
          {hasPiece ? (
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
function SphereBoardScene({ gameState, validMoves, selectedSquare, onSquareClick, quality }: ChessSphereProps) {
  const lastMove = gameState.moveHistory.length > 0 ? gameState.moveHistory[gameState.moveHistory.length - 1] : null;

  return (
    <>
      <ambientLight intensity={0.35} />
      <directionalLight position={[5, 10, 5]} intensity={0.9} />
      <directionalLight position={[-6, -3, -6]} intensity={0.45} />

      {/* Local studio environment: reflections + soft IBL without any HDRI fetch. */}
      <Environment resolution={256} frames={1}>
        <Lightformer intensity={3} position={[0, 4, -6]} scale={[12, 6, 1]} color="#fff6e8" />
        <Lightformer intensity={1.4} position={[-6, 2, 4]} scale={[6, 6, 1]} color="#bcd0ff" />
        <Lightformer intensity={1.4} position={[6, 1, 4]} scale={[6, 6, 1]} color="#ffd9c2" />
        <Lightformer intensity={1} position={[0, -5, 2]} scale={[10, 4, 1]} color="#8892b0" />
      </Environment>

      <group rotation={[BOARD_TILT_X, 0, 0]}>
        {/* Solid inner sphere so the far side can't be clicked or seen through. */}
        <mesh>
          <sphereGeometry args={[SPHERE_RADIUS * 0.985, 64, 64]} />
          <meshStandardMaterial color="#23233a" roughness={0.9} metalness={0.05} />
        </mesh>

        {Array.from({ length: 8 }, (_, file) =>
          Array.from({ length: 8 }, (_, rank) => {
            const isLight = (file + rank) % 2 === 0;
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
                hasPiece={!!gameState.board[file][rank]}
                onClick={() => onSquareClick({ file, rank })}
              />
            );
          }),
        )}

        <Suspense fallback={null}>
          <PieceLayer board={gameState.board} quality={quality} onSquareClick={onSquareClick} />
        </Suspense>

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
