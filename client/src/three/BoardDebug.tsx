import React, { useMemo, useState } from 'react';
import { Canvas, useThree, useLoader } from '@react-three/fiber';
import { OrbitControls, Environment, Lightformer } from '@react-three/drei';
import * as THREE from 'three';
import {
  SPHERE_RADIUS, BOARD_TILT_X, WOOD_TEXTURE_PATH, createSquareGeometry,
} from './ChessSphere';

interface BoardParams {
  lightTint: string;
  darkTint: string;
  innerColor: string;
  roughness: number;
  boardEnv: number;
  emissiveIntensity: number;
  useTexture: boolean;
}
interface LightParams {
  ambient: number;
  hemisphere: number;
  keyIntensity: number;
  envIntensity: number;
  exposure: number;
}

function BoardMesh({ board, light }: { board: BoardParams; light: LightParams }) {
  const woodMap = useLoader(THREE.TextureLoader, WOOD_TEXTURE_PATH);
  useMemo(() => {
    woodMap.colorSpace = THREE.SRGBColorSpace;
    woodMap.anisotropy = 8;
    woodMap.wrapS = woodMap.wrapT = THREE.RepeatWrapping;
  }, [woodMap]);

  const geometries = useMemo(() => {
    const g: THREE.BufferGeometry[][] = [];
    for (let f = 0; f < 8; f++) {
      g[f] = [];
      for (let r = 0; r < 8; r++) g[f][r] = createSquareGeometry(f, r);
    }
    return g;
  }, []);

  return (
    <group rotation={[BOARD_TILT_X, 0, 0]}>
      <mesh>
        <sphereGeometry args={[SPHERE_RADIUS * 0.985, 64, 64]} />
        <meshStandardMaterial color={board.innerColor} emissive={board.innerColor} emissiveIntensity={board.emissiveIntensity * 0.9} roughness={0.9} metalness={0} envMapIntensity={board.boardEnv} />
      </mesh>
      {Array.from({ length: 8 }, (_, f) =>
        Array.from({ length: 8 }, (_, r) => {
          const isLight = (f + r) % 2 === 0;
          return (
            <mesh key={`${f}-${r}`} geometry={geometries[f][r]}>
              <meshStandardMaterial
                map={board.useTexture ? woodMap : null}
                color={isLight ? board.lightTint : board.darkTint}
                emissive={isLight ? board.lightTint : board.darkTint}
                emissiveMap={board.useTexture ? woodMap : null}
                emissiveIntensity={board.emissiveIntensity}
                side={THREE.DoubleSide}
                roughness={board.roughness}
                metalness={0}
                envMapIntensity={board.boardEnv}
              />
            </mesh>
          );
        }),
      )}
    </group>
  );
}

function Exposure({ value }: { value: number }) {
  const { gl } = useThree();
  gl.toneMappingExposure = value;
  return null;
}

function Slider({ label, value, min, max, step, onChange }: {
  label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void;
}) {
  return (
    <label style={{ display: 'block', marginBottom: 10, fontSize: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#cbb' }}>
        <span>{label}</span>
        <span style={{ color: '#f7c948', fontFamily: 'monospace' }}>{value.toFixed(2)}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ width: '100%' }}
      />
    </label>
  );
}

function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, fontSize: 12, color: '#cbb' }}>
      <span>{label}</span>
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} style={{ width: 44, height: 24, border: 'none', background: 'none' }} />
    </label>
  );
}

export default function BoardDebug() {
  const [board, setBoard] = useState<BoardParams>({
    lightTint: '#ffeecb',
    darkTint: '#b97a44',
    innerColor: '#3a2c1e',
    roughness: 0.75,
    boardEnv: 0,
    emissiveIntensity: 0.55,
    useTexture: true,
  });
  const [light, setLight] = useState<LightParams>({
    ambient: 0.7,
    hemisphere: 0.35,
    keyIntensity: 0,
    envIntensity: 1,
    exposure: 1,
  });

  const setB = (k: keyof BoardParams) => (v: number) => setBoard((s) => ({ ...s, [k]: v }));
  const setBC = (k: keyof BoardParams) => (v: string) => setBoard((s) => ({ ...s, [k]: v }));
  const setL = (k: keyof LightParams) => (v: number) => setLight((s) => ({ ...s, [k]: v }));

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#0f0f1a' }}>
      <Canvas camera={{ position: [0, 2.5, 8], fov: 50 }}>
        <Exposure value={light.exposure} />
        <color attach="background" args={['#0f0f1a']} />
        <ambientLight intensity={light.ambient} />
        <hemisphereLight color="#fff3e0" groundColor="#8a7558" intensity={light.hemisphere} />
        <directionalLight position={[0, 10, 2]} intensity={light.keyIntensity} />
        <Environment resolution={256} frames={1} environmentIntensity={light.envIntensity}>
          <Lightformer intensity={3} position={[0, 4, -6]} scale={[12, 6, 1]} color="#fff6e8" />
          <Lightformer intensity={1.4} position={[-6, 2, 4]} scale={[6, 6, 1]} color="#bcd0ff" />
          <Lightformer intensity={1.4} position={[6, 1, 4]} scale={[6, 6, 1]} color="#ffd9c2" />
          <Lightformer intensity={1} position={[0, -5, 2]} scale={[10, 4, 1]} color="#8892b0" />
        </Environment>
        <BoardMesh board={board} light={light} />
        <OrbitControls enablePan={false} minDistance={4.5} maxDistance={14} rotateSpeed={0.5} enableDamping dampingFactor={0.1} />
      </Canvas>

      <div style={{
        position: 'absolute', top: 0, right: 0, bottom: 0, width: 290, overflowY: 'auto',
        background: 'rgba(20,18,24,0.92)', borderLeft: '1px solid #333', padding: 16, color: '#eee',
        fontFamily: 'system-ui, sans-serif',
      }}>
        <h3 style={{ margin: '0 0 4px' }}>Board Debug</h3>
        <p style={{ margin: '0 0 12px', fontSize: 11, color: '#889' }}>Drag to orbit and check both sides are evenly lit.</p>

        <h4 style={{ margin: '0 0 8px', color: '#9ab' }}>Board colours</h4>
        <ColorRow label="light squares" value={board.lightTint} onChange={setBC('lightTint')} />
        <ColorRow label="dark squares" value={board.darkTint} onChange={setBC('darkTint')} />
        <ColorRow label="inner sphere" value={board.innerColor} onChange={setBC('innerColor')} />
        <Slider label="emissive (self-lit, even)" value={board.emissiveIntensity} min={0} max={1.5} step={0.01} onChange={setB('emissiveIntensity')} />
        <Slider label="roughness" value={board.roughness} min={0} max={1} step={0.01} onChange={setB('roughness')} />
        <Slider label="board envMapIntensity" value={board.boardEnv} min={0} max={2} step={0.02} onChange={setB('boardEnv')} />
        <button
          onClick={() => setBoard((s) => ({ ...s, useTexture: !s.useTexture }))}
          style={{ width: '100%', padding: '8px 0', marginTop: 4, fontSize: 12, cursor: 'pointer',
            background: board.useTexture ? '#e94560' : '#2a2733', color: '#fff', border: 'none', borderRadius: 4 }}>
          wood texture: {board.useTexture ? 'on' : 'off (flat colour)'}
        </button>

        <h4 style={{ margin: '14px 0 8px', color: '#9ab' }}>Lighting</h4>
        <Slider label="ambient (uniform)" value={light.ambient} min={0} max={3} step={0.02} onChange={setL('ambient')} />
        <Slider label="hemisphere (top/bottom)" value={light.hemisphere} min={0} max={2} step={0.02} onChange={setL('hemisphere')} />
        <Slider label="key directional" value={light.keyIntensity} min={0} max={3} step={0.02} onChange={setL('keyIntensity')} />
        <Slider label="env intensity" value={light.envIntensity} min={0} max={3} step={0.05} onChange={setL('envIntensity')} />
        <Slider label="exposure" value={light.exposure} min={0.2} max={2.5} step={0.02} onChange={setL('exposure')} />

        <pre style={{ marginTop: 12, padding: 8, background: '#15131a', borderRadius: 4, fontSize: 10, whiteSpace: 'pre-wrap', color: '#8c8' }}>
{JSON.stringify({ board, light }, null, 1)}
        </pre>
        <a href="?" style={{ color: '#9ab', fontSize: 12 }}>← back to game</a>
      </div>
    </div>
  );
}
