// 3D プレビュー（react-three-fiber + drei）。ジオメトリは z 上の mm 座標で届く。
import { Canvas } from '@react-three/fiber';
import { ContactShadows, OrbitControls } from '@react-three/drei';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { BuildResult, PartKindId } from '../geometry/build';
import { useStore } from '../state/store';

const KIND_ORDER: PartKindId[] = ['body', 'stem', 'cut', 'inner'];

function usePumpkinGeometry(r: BuildResult | null) {
  const geom = useMemo(() => {
    if (!r) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(r.positions, 3));
    g.setIndex(new THREE.BufferAttribute(r.indices, 1));
    for (const grp of r.groups) g.addGroup(grp.start, grp.count, KIND_ORDER.indexOf(grp.kind));
    const creased = toCreasedNormals(g, (35 * Math.PI) / 180);
    g.dispose();
    creased.computeBoundingBox();
    return creased;
  }, [r]);
  useEffect(() => () => geom?.dispose(), [geom]);
  return geom;
}

function Pumpkin() {
  const preview = useStore((s) => s.preview);
  const geom = usePumpkinGeometry(preview);
  const materials = useMemo(
    () => [
      new THREE.MeshStandardMaterial({ color: '#f07a1a', roughness: 0.55, metalness: 0 }),
      new THREE.MeshStandardMaterial({ color: '#4d7a2a', roughness: 0.8 }),
      new THREE.MeshStandardMaterial({ color: '#f6b25a', roughness: 0.7 }),
      new THREE.MeshStandardMaterial({ color: '#5a2a0a', roughness: 0.9, side: THREE.DoubleSide }),
    ],
    [],
  );
  if (!geom) return null;
  const bb = geom.boundingBox!;
  const cx = (bb.min.x + bb.max.x) / 2;
  const cy = (bb.min.y + bb.max.y) / 2;
  // z 上（造形座標）→ y 上（three.js）。正面（−y）がカメラ側（+z）を向く
  return (
    <group rotation={[-Math.PI / 2, 0, 0]}>
      <mesh geometry={geom} material={materials} position={[-cx, -cy, -bb.min.z]} castShadow receiveShadow />
    </group>
  );
}

export function Viewer() {
  const building = useStore((s) => s.building);
  const preview = useStore((s) => s.preview);
  const error = useStore((s) => s.error);
  const h = preview?.stats.height ?? 120;
  return (
    <div className="viewer">
      <Canvas camera={{ position: [0, h * 0.9, 260], fov: 35, near: 1, far: 5000 }} dpr={[1, 2]}>
        <color attach="background" args={['#1b1420']} />
        <hemisphereLight args={['#ffe9d0', '#2a1830', 0.9]} />
        <directionalLight position={[120, 220, 160]} intensity={1.6} />
        <directionalLight position={[-160, 80, -120]} intensity={0.5} color="#a8b8ff" />
        <Pumpkin />
        <ContactShadows position={[0, 0, 0]} opacity={0.55} scale={400} blur={2.4} far={200} />
        <gridHelper args={[256, 16, '#4a3a55', '#30263a']} position={[0, -0.05, 0]} />
        <OrbitControls target={[0, h * 0.45, 0]} makeDefault enableDamping minDistance={80} maxDistance={900} />
      </Canvas>
      <div className="viewer-status">
        {error ? <span className="err">Error</span> : building ? <span>…</span> : preview ? (
          <span>
            {preview.stats.width.toFixed(0)}×{preview.stats.depth.toFixed(0)}×{preview.stats.height.toFixed(0)} mm
          </span>
        ) : null}
      </div>
    </div>
  );
}
