import React, { useMemo, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Environment, Lightformer, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import type { PieceType, Color } from 'spherical-chess-shared';

const MODEL_PATHS: Record<string, string> = {
  K: '/models/chess/king.glb',
  Q: '/models/chess/queen.glb',
  R: '/models/chess/rook.glb',
  B: '/models/chess/bishop.glb',
  N: '/models/chess/knight.glb',
  P: '/models/chess/pawn.glb',
};
const MODEL_BASE_Y: Record<string, number> = {
  K: -0.22, Q: -0.19, R: -0.09, N: -0.13, B: -0.12, P: -0.10,
};
const PIECE_NAMES: Record<string, string> = {
  K: 'King', Q: 'Queen', R: 'Rook', B: 'Bishop', N: 'Knight', P: 'Pawn',
};

interface MatParams {
  whiteColor: string;
  blackColor: string;
  roughness: number;
  metalness: number;
  clearcoat: number;
  clearcoatRoughness: number;
  envMapIntensity: number;
  flatShading: boolean;
}
interface LightParams {
  ambient: number;
  keyIntensity: number;
  fillIntensity: number;
  envIntensity: number;
  exposure: number;
}

function DebugPiece({ type, color, mat }: { type: PieceType; color: Color; mat: MatParams }) {
  const { scene } = useGLTF(MODEL_PATHS[type]);

  const model = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        // glb meshes ship without normals -> generate them so the surface lights.
        if (!mesh.geometry.attributes.normal) mesh.geometry.computeVertexNormals();
        mesh.material = new THREE.MeshPhysicalMaterial({
          color: new THREE.Color(color === 'white' ? mat.whiteColor : mat.blackColor),
          roughness: mat.roughness,
          metalness: mat.metalness,
          clearcoat: mat.clearcoat,
          clearcoatRoughness: mat.clearcoatRoughness,
          envMapIntensity: mat.envMapIntensity,
          flatShading: mat.flatShading,
        });
      }
    });
    return clone;
  }, [scene, color, mat]);

  const scale = 9;
  return <primitive object={model} position={[0, -MODEL_BASE_Y[type] * scale - 1.4, 0]} scale={scale} />;
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

export default function PieceDebug() {
  const [type, setType] = useState<PieceType>('Q' as PieceType);
  const [color, setColor] = useState<Color>('white' as Color);

  const [mat, setMat] = useState<MatParams>({
    whiteColor: '#efe7d4',
    blackColor: '#322e29',
    roughness: 0.32,
    metalness: 0.15,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
    envMapIntensity: 1.3,
    flatShading: false,
  });
  const [light, setLight] = useState<LightParams>({
    ambient: 0.18,
    keyIntensity: 1.1,
    fillIntensity: 0.3,
    envIntensity: 1,
    exposure: 1,
  });

  const setM = (k: keyof MatParams) => (v: number) => setMat((s) => ({ ...s, [k]: v }));
  const setL = (k: keyof LightParams) => (v: number) => setLight((s) => ({ ...s, [k]: v }));

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#0f0f1a' }}>
      <Canvas camera={{ position: [0, 1, 6], fov: 45 }}>
        <Exposure value={light.exposure} />
        <color attach="background" args={['#0f0f1a']} />
        <ambientLight intensity={light.ambient} />
        <directionalLight position={[5, 10, 5]} intensity={light.keyIntensity} />
        <directionalLight position={[-6, -3, -6]} intensity={light.fillIntensity} />
        <Environment resolution={256} frames={1} environmentIntensity={light.envIntensity}>
          <Lightformer intensity={3} position={[0, 4, -6]} scale={[12, 6, 1]} color="#fff6e8" />
          <Lightformer intensity={1.4} position={[-6, 2, 4]} scale={[6, 6, 1]} color="#bcd0ff" />
          <Lightformer intensity={1.4} position={[6, 1, 4]} scale={[6, 6, 1]} color="#ffd9c2" />
          <Lightformer intensity={1} position={[0, -5, 2]} scale={[10, 4, 1]} color="#8892b0" />
        </Environment>
        <DebugPiece type={type} color={color} mat={mat} />
        <OrbitControls enablePan={false} autoRotate autoRotateSpeed={1.2} minDistance={3} maxDistance={12} />
      </Canvas>

      <div style={{
        position: 'absolute', top: 0, right: 0, bottom: 0, width: 280, overflowY: 'auto',
        background: 'rgba(20,18,24,0.92)', borderLeft: '1px solid #333', padding: 16, color: '#eee',
        fontFamily: 'system-ui, sans-serif',
      }}>
        <h3 style={{ margin: '0 0 12px' }}>Piece Debug</h3>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
          {(Object.keys(PIECE_NAMES) as PieceType[]).map((t) => (
            <button key={t} onClick={() => setType(t)}
              style={{ flex: '1 0 30%', padding: '6px 0', fontSize: 12, cursor: 'pointer',
                background: type === t ? '#e94560' : '#2a2733', color: '#fff', border: 'none', borderRadius: 4 }}>
              {PIECE_NAMES[t]}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
          {(['white', 'black'] as Color[]).map((c) => (
            <button key={c} onClick={() => setColor(c)}
              style={{ flex: 1, padding: '6px 0', fontSize: 12, cursor: 'pointer',
                background: color === c ? '#f7c948' : '#2a2733', color: color === c ? '#222' : '#fff',
                border: 'none', borderRadius: 4, textTransform: 'capitalize' }}>
              {c}
            </button>
          ))}
        </div>

        <h4 style={{ margin: '0 0 8px', color: '#9ab' }}>Material</h4>
        <Slider label="roughness" value={mat.roughness} min={0} max={1} step={0.01} onChange={setM('roughness')} />
        <Slider label="metalness" value={mat.metalness} min={0} max={1} step={0.01} onChange={setM('metalness')} />
        <Slider label="clearcoat" value={mat.clearcoat} min={0} max={1} step={0.01} onChange={setM('clearcoat')} />
        <Slider label="clearcoatRoughness" value={mat.clearcoatRoughness} min={0} max={1} step={0.01} onChange={setM('clearcoatRoughness')} />
        <Slider label="envMapIntensity" value={mat.envMapIntensity} min={0} max={4} step={0.05} onChange={setM('envMapIntensity')} />
        <button
          onClick={() => setMat((s) => ({ ...s, flatShading: !s.flatShading }))}
          style={{ width: '100%', padding: '8px 0', marginTop: 4, fontSize: 12, cursor: 'pointer',
            background: mat.flatShading ? '#e94560' : '#2a2733', color: '#fff', border: 'none', borderRadius: 4 }}>
          shading: {mat.flatShading ? 'flat (faceted)' : 'smooth'}
        </button>

        <h4 style={{ margin: '12px 0 8px', color: '#9ab' }}>Lighting</h4>
        <Slider label="ambient" value={light.ambient} min={0} max={2} step={0.02} onChange={setL('ambient')} />
        <Slider label="key light" value={light.keyIntensity} min={0} max={4} step={0.05} onChange={setL('keyIntensity')} />
        <Slider label="fill light" value={light.fillIntensity} min={0} max={2} step={0.02} onChange={setL('fillIntensity')} />
        <Slider label="env intensity" value={light.envIntensity} min={0} max={3} step={0.05} onChange={setL('envIntensity')} />
        <Slider label="exposure" value={light.exposure} min={0.2} max={2.5} step={0.02} onChange={setL('exposure')} />

        <pre style={{ marginTop: 12, padding: 8, background: '#15131a', borderRadius: 4, fontSize: 10, whiteSpace: 'pre-wrap', color: '#8c8' }}>
{JSON.stringify({ mat, light }, null, 1)}
        </pre>
        <a href="?" style={{ color: '#9ab', fontSize: 12 }}>← back to game</a>
      </div>
    </div>
  );
}

Object.values(MODEL_PATHS).forEach((p) => useGLTF.preload(p));
