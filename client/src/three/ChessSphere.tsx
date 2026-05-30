import React, { useMemo, useRef, useState, useLayoutEffect, Suspense } from 'react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { OrbitControls, Text, useGLTF, Environment, Lightformer, Billboard, Stars } from '@react-three/drei';
import * as THREE from 'three';
import { findKing, GameStatus } from 'spherical-chess-shared';
import type { GameState, Position, Move, Color, Piece, PieceType } from 'spherical-chess-shared';

export const BACKGROUND_COLOR = '#0a0710'; // deep space (replaces the flat navy)

export type Quality = 'fast' | 'high';
export interface AnimatedMove { from: Position; to: Position; id: number; }

interface ChessSphereProps {
  gameState: GameState;
  playerColor: Color | null;
  validMoves: Move[];
  selectedSquare: Position | null;
  onSquareClick: (pos: Position) => void;
  quality: Quality;
  animatedMove: AnimatedMove | null;
  showLabels?: boolean;
}

export const SPHERE_RADIUS = 3;
const UP = new THREE.Vector3(0, 1, 0);
export const BOARD_TILT_X = -1.97;
export const WOOD_TEXTURE_PATH = '/textures/wood_diffuse_1k.jpg';
const MOVE_ANIM_SECONDS = 0.34;
const WOOD_TEXTURE = '/textures/wood_diffuse_1k.jpg';

// ---- "fast" low-poly set (CC-BY, Jarlan Perez — see models/chess/CREDITS.md).
const FAST_PATHS: Record<string, string> = {
  K: '/models/chess/king.glb', Q: '/models/chess/queen.glb', R: '/models/chess/rook.glb',
  B: '/models/chess/bishop.glb', N: '/models/chess/knight.glb', P: '/models/chess/pawn.glb',
};
const FAST_SCALE = 2.3;
const WHITE_COLOR = '#efe7d4';
const BLACK_COLOR = '#322e29';

// ---- "high" PBR set (CC0, Poly Haven — see models/chess_hd/CREDITS.md).
const HD_PATH = '/models/chess_hd/chess_set_1k.glb';
const HD_SCALE = 10.7;
const TYPE_NAME: Record<string, string> = {
  K: 'king', Q: 'queen', R: 'rook', B: 'bishop', N: 'knight', P: 'pawn',
};

Object.values(FAST_PATHS).forEach((p) => useGLTF.preload(p));

function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** Centre point of a board square on the sphere surface. */
function boardToSphere(file: number, rank: number): THREE.Vector3 {
  const phi = ((7 - rank + 0.5) / 8) * Math.PI;
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

/** Subdivided quad on the sphere surface for a single square (with UVs). */
export function createSquareGeometry(file: number, rank: number, subdivisions = 8): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];

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
      // Continuous global UVs (one tile per square) so the seamless wood grain
      // flows unbroken across square borders and closes seamlessly at the wrap.
      uvs.push(file + j / subdivisions, rank + i / subdivisions);
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
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  return geometry;
}

/** Click-vs-drag detection (a click only registers if the pointer barely moved). */
function usePointerClick(onClick: () => void) {
  const down = useRef<{ x: number; y: number } | null>(null);
  return {
    onPointerDown: (e: any) => { e.stopPropagation(); down.current = { x: e.clientX, y: e.clientY }; },
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
 * Renders a prepared piece object, scaled and seated on the sphere surface.
 * When `from` is supplied, it animates a slide from that square to its own.
 */
function SeatedPiece({ object, scale, file, rank, from, animId, onClick }: {
  object: THREE.Object3D; scale: number; file: number; rank: number;
  from: Position | null; animId: number; onClick: () => void;
}) {
  const handlers = usePointerClick(onClick);
  const groupRef = useRef<THREE.Group>(null);
  const progress = useRef(1);

  const offset = useMemo(() => {
    const box = new THREE.Box3().setFromObject(object);
    return new THREE.Vector3(
      -((box.min.x + box.max.x) / 2) * scale,
      -box.min.y * scale,
      -((box.min.z + box.max.z) / 2) * scale,
    );
  }, [object, scale]);

  const target = SQUARE_CENTER[file][rank];
  const targetQuat = SQUARE_QUAT[file][rank];

  // Begin a slide whenever a new animated move targets this square.
  useLayoutEffect(() => {
    const g = groupRef.current;
    if (!g) return;
    if (from) {
      progress.current = 0;
      g.position.copy(SQUARE_CENTER[from.file][from.rank]);
      g.quaternion.copy(SQUARE_QUAT[from.file][from.rank]);
    } else {
      progress.current = 1;
      g.position.copy(target);
      g.quaternion.copy(targetQuat);
    }
  }, [animId]); // eslint-disable-line react-hooks/exhaustive-deps

  useFrame((_, delta) => {
    const g = groupRef.current;
    if (!g || progress.current >= 1 || !from) return;
    progress.current = Math.min(1, progress.current + delta / MOVE_ANIM_SECONDS);
    const t = easeInOut(progress.current);
    const src = SQUARE_CENTER[from.file][from.rank];
    g.position.copy(src).lerp(target, t).setLength(SPHERE_RADIUS);
    g.quaternion.copy(SQUARE_QUAT[from.file][from.rank]).slerp(targetQuat, t);
  });

  return (
    <group ref={groupRef} position={target} quaternion={targetQuat}>
      <primitive
        object={object}
        position={offset}
        scale={scale}
        {...handlers}
        onPointerOver={(e: any) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { document.body.style.cursor = 'auto'; }}
      />
    </group>
  );
}

function FastPiece(props: PieceRenderProps) {
  const { scene } = useGLTF(FAST_PATHS[props.type]);
  const object = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        if (!mesh.geometry.attributes.normal) mesh.geometry.computeVertexNormals();
        mesh.material = new THREE.MeshPhysicalMaterial({
          color: new THREE.Color(props.color === 'white' ? WHITE_COLOR : BLACK_COLOR),
          roughness: 0.35, metalness: 0.15, clearcoat: 1, clearcoatRoughness: 0.18, envMapIntensity: 1.3,
        });
      }
    });
    return clone;
  }, [scene, props.color]);
  return <SeatedPiece object={object} scale={FAST_SCALE} {...props} />;
}

function HdPiece(props: PieceRenderProps) {
  const { nodes } = useGLTF(HD_PATH) as any;
  const object = useMemo(
    () => (nodes[`piece_${TYPE_NAME[props.type]}_${props.color}`] as THREE.Object3D).clone(true),
    [nodes, props.type, props.color],
  );
  return <SeatedPiece object={object} scale={HD_SCALE} {...props} />;
}

interface PieceRenderProps {
  type: PieceType; color: Color; file: number; rank: number;
  from: Position | null; animId: number; onClick: () => void;
}

/** All occupied squares' pieces, using the selected quality's source. */
function PieceLayer({ board, quality, animatedMove, onSquareClick }: {
  board: (Piece | null)[][]; quality: Quality; animatedMove: AnimatedMove | null;
  onSquareClick: (pos: Position) => void;
}) {
  const Piece = quality === 'high' ? HdPiece : FastPiece;
  const items: React.ReactNode[] = [];
  for (let file = 0; file < 8; file++) {
    for (let rank = 0; rank < 8; rank++) {
      const piece = board[file][rank];
      if (!piece) continue;
      const isAnimTarget = animatedMove && animatedMove.to.file === file && animatedMove.to.rank === rank;
      items.push(
        <Piece
          key={`${file}-${rank}`}
          type={piece.type}
          color={piece.color}
          file={file}
          rank={rank}
          from={isAnimTarget ? animatedMove!.from : null}
          animId={isAnimTarget ? animatedMove!.id : 0}
          onClick={() => onSquareClick({ file, rank })}
        />,
      );
    }
  }
  return <>{items}</>;
}

/** A board square: clickable wood quad plus highlight and move marker. */
function Square({ file, rank, isLight, isSelected, isValidMove, isLastMove, hasPiece, woodMap, onClick }: {
  file: number; rank: number; isLight: boolean; isSelected: boolean; isValidMove: boolean;
  isLastMove: boolean; hasPiece: boolean; woodMap: THREE.Texture; onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const geometry = useMemo(() => createSquareGeometry(file, rank), [file, rank]);
  const clickHandlers = usePointerClick(onClick);

  // Tint multiplies the shared wood texture, giving light/dark wood + highlights.
  let color: string;
  if (isSelected) color = '#f0c659';
  else if (isLastMove) color = isLight ? '#d8c878' : '#b09a4e';
  else if (hovered) color = isLight ? '#f3e3bd' : '#b98a5c';
  // Brighter light squares + lighter dark squares for clear contrast all around.
  // Tints multiply the (fairly dim) wood map, so we push them bright.
  else color = isLight ? '#ffeecb' : '#b97a44';

  return (
    <group>
      <mesh
        geometry={geometry}
        {...clickHandlers}
        onPointerOver={(e: any) => { e.stopPropagation(); setHovered(true); }}
        onPointerOut={() => setHovered(false)}
      >
        {/* The board is mostly *emissive*: emissive light doesn't depend on light
            direction, so it's perfectly even across the whole sphere — no lit/dark
            half — and it's independent of the canvas exposure that the pieces need.
            envMapIntensity 0 keeps the one-sided studio env out of the board too. */}
        <meshStandardMaterial
          map={woodMap}
          color={color}
          emissive={color}
          emissiveMap={woodMap}
          emissiveIntensity={0.55}
          side={THREE.DoubleSide}
          roughness={0.75}
          metalness={0}
          envMapIntensity={0}
        />
      </mesh>

      {isValidMove && (
        <group position={SQUARE_CENTER[file][rank].clone().multiplyScalar(1.008)} quaternion={SQUARE_QUAT[file][rank]}>
          {hasPiece ? (
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.3, 0.4, 48]} />
              <meshBasicMaterial color="#e94560" transparent opacity={0.85} side={THREE.DoubleSide} depthWrite={false} />
            </mesh>
          ) : (
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[0.15, 40]} />
              <meshBasicMaterial color="#3fa34d" transparent opacity={0.7} depthWrite={false} />
            </mesh>
          )}
        </group>
      )}
    </group>
  );
}

/** Pulsing red ring on the checked king's square. Anchored to the board, so it
 *  reads correctly no matter where the king sits around the poles. */
function CheckMarker({ pos }: { pos: Position }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const m = ref.current;
    if (!m) return;
    const t = (Math.sin(clock.elapsedTime * 4.5) + 1) / 2;
    (m.material as THREE.MeshBasicMaterial).opacity = 0.45 + t * 0.5;
    const s = 1 + t * 0.14;
    m.scale.set(s, s, s);
  });
  const center = SQUARE_CENTER[pos.file][pos.rank];
  const quat = SQUARE_QUAT[pos.file][pos.rank];
  return (
    <group position={center.clone().multiplyScalar(1.012)} quaternion={quat}>
      <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.34, 0.5, 48]} />
        <meshBasicMaterial color="#ff3b30" transparent opacity={0.8} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  );
}

/** Coordinate labels floating just off the surface. */
function BoardLabels() {
  const labels: React.ReactNode[] = [];
  const files = 'abcdefgh';

  // File letters ring the equator (rank 3.5), where longitudes are spread
  // furthest apart — near the poles they'd bunch into a single point.
  for (let f = 0; f < 8; f++) {
    const pos = boardToSphere(f, 3.5);
    labels.push(
      // Billboard keeps the glyph facing the camera and upright from any angle.
      <Billboard key={`file-${f}`} position={[pos.x * 1.16, pos.y * 1.16, pos.z * 1.16]}>
        <Text fontSize={0.28} color="#f0dcb0" outlineWidth={0.012} outlineColor="#1a1209" anchorX="center" anchorY="middle">
          {files[f]}
        </Text>
      </Billboard>,
    );
  }
  // Rank numbers run pole-to-pole along a single meridian.
  for (let r = 0; r < 8; r++) {
    const pos = boardToSphere(-0.7, r);
    labels.push(
      <Billboard key={`rank-${r}`} position={[pos.x * 1.13, pos.y * 1.13, pos.z * 1.13]}>
        <Text fontSize={0.22} color="#cfc09a" outlineWidth={0.01} outlineColor="#1a1209" anchorX="center" anchorY="middle">
          {String(r + 1)}
        </Text>
      </Billboard>,
    );
  }
  return <>{labels}</>;
}

/** The full 3D sphere board scene. */
function SphereBoardScene({ gameState, validMoves, selectedSquare, onSquareClick, quality, animatedMove, showLabels = true }: ChessSphereProps) {
  const lastMove = gameState.moveHistory.length > 0 ? gameState.moveHistory[gameState.moveHistory.length - 1] : null;

  // When the side to move is in check (or mated), highlight their king.
  const checkSquare = useMemo(() => {
    if (gameState.status !== GameStatus.Check && gameState.status !== GameStatus.Checkmate) return null;
    return findKing(gameState.board, gameState.turn);
  }, [gameState.status, gameState.turn, gameState.board]);

  const woodMap = useLoader(THREE.TextureLoader, WOOD_TEXTURE);
  useMemo(() => {
    woodMap.colorSpace = THREE.SRGBColorSpace;
    woodMap.anisotropy = 8;
    woodMap.wrapS = woodMap.wrapT = THREE.RepeatWrapping;
  }, [woodMap]);

  return (
    <>
      {/* The board carries its own brightness via emissive (see Square). No
          positioned/directional light — on a sphere it only lights one hemisphere
          and reintroduces a lit/dark half. Ambient + hemisphere stay even all
          around, and the pieces get their form and sheen from the Environment IBL. */}
      <ambientLight intensity={0.7} />
      <hemisphereLight color="#fff3e0" groundColor="#8a7558" intensity={0.35} />

      <Environment resolution={256} frames={1}>
        <Lightformer intensity={3} position={[0, 4, -6]} scale={[12, 6, 1]} color="#fff6e8" />
        <Lightformer intensity={1.4} position={[-6, 2, 4]} scale={[6, 6, 1]} color="#bcd0ff" />
        <Lightformer intensity={1.4} position={[6, 1, 4]} scale={[6, 6, 1]} color="#ffd9c2" />
        <Lightformer intensity={1} position={[0, -5, 2]} scale={[10, 4, 1]} color="#8892b0" />
      </Environment>

      <group rotation={[BOARD_TILT_X, 0, 0]}>
        <mesh>
          <sphereGeometry args={[SPHERE_RADIUS * 0.985, 64, 64]} />
          <meshStandardMaterial color="#3a2c1e" emissive="#3a2c1e" emissiveIntensity={0.5} roughness={0.9} metalness={0} envMapIntensity={0} />
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
                woodMap={woodMap}
                onClick={() => onSquareClick({ file, rank })}
              />
            );
          }),
        )}

        <Suspense fallback={null}>
          <PieceLayer board={gameState.board} quality={quality} animatedMove={animatedMove} onSquareClick={onSquareClick} />
        </Suspense>

        {checkSquare && <CheckMarker pos={checkSquare} />}
        {showLabels && <BoardLabels />}
      </group>

      <OrbitControls enablePan={false} minDistance={4.5} maxDistance={14} rotateSpeed={0.5} enableDamping dampingFactor={0.1} />
    </>
  );
}

export default function ChessSphere(props: ChessSphereProps) {
  return (
    <Canvas camera={{ position: [0, 2.5, 8], fov: 50 }} style={{ width: '100%', height: '100%' }}>
      <color attach="background" args={[BACKGROUND_COLOR]} />
      {/* A drifting starfield — a chess planet in deep space. */}
      <Stars radius={120} depth={50} count={2500} factor={4} saturation={0} fade speed={0.4} />
      <Suspense fallback={null}>
        <SphereBoardScene {...props} />
      </Suspense>
    </Canvas>
  );
}
