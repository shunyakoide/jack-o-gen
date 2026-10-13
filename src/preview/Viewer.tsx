// 3D プレビュー（react-three-fiber + drei）。ジオメトリは z 上の mm 座標で届く。
import { Canvas, useThree } from '@react-three/fiber';
import { ContactShadows, OrbitControls } from '@react-three/drei';
import { Component, useEffect, useMemo, type ReactNode } from 'react';
import * as THREE from 'three';
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { MeshGroup, PartKindId } from '../geometry/build';
import { boxOf, printLayout, type Box } from '../geometry/layout';
import { useT } from '../i18n';
import { useStore } from '../state/store';

const KIND_ORDER: PartKindId[] = ['body', 'stem', 'cut', 'inner'];

function usePumpkinGeometry(r: { positions: Float32Array; indices: Uint32Array; groups?: MeshGroup[] } | null | undefined) {
  const geom = useMemo(() => {
    if (!r) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(r.positions, 3));
    g.setIndex(new THREE.BufferAttribute(r.indices, 1));
    for (const grp of r.groups ?? []) g.addGroup(grp.start, grp.count, KIND_ORDER.indexOf(grp.kind));
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
  const printTab = useStore((s) => s.tab === 'print');
  const geom = usePumpkinGeometry(preview);
  // 差し込み式のヘタは別メッシュ（本体と同じワールド座標）
  const stemGeom = usePumpkinGeometry(preview?.stem);
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
  const box = (g: THREE.BufferGeometry): Box => ({ min: g.boundingBox!.min.toArray(), max: g.boundingBox!.max.toArray() });
  const bodyBox = box(geom);
  // Print タブではダウンロードされるファイルどおりの配置（ヘタはベッドに置いて本体の横）
  const layout = printTab && stemGeom && preview?.stem
    ? printLayout(bodyBox, { box: box(stemGeom), seatZ: preview.stem.seatZ })
    : printLayout(bodyBox, null);
  // z 上（造形座標）→ y 上（three.js）。正面（−y）がカメラ側（+z）を向く
  return (
    <group rotation={[-Math.PI / 2, 0, 0]}>
      <mesh geometry={geom} material={materials} position={layout.body} castShadow receiveShadow />
      {stemGeom && <mesh geometry={stemGeom} material={materials[1]} position={layout.stem ?? layout.body} castShadow receiveShadow />}
    </group>
  );
}

let shadowSeq = 0;

/** 配置（組み立て ↔ Print タブのベッド配置）が切り替わったときだけ、全体が入るようカメラを引く */
function FitCamera({ width, h, layoutKey }: { width: number; h: number; layoutKey: string }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const controls = useThree((s) => s.controls) as unknown as { target: THREE.Vector3; update: () => void } | null;
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    const t = Math.tan((camera.fov * Math.PI) / 360);
    // 縦（高さ）と横（幅・縦長ペインでは aspect で効く）の両方が 1.3 倍の余白で収まる距離
    const dist = Math.max(260, (1.3 * h) / 2 / t, (1.3 * width) / 2 / (t * camera.aspect));
    camera.position.set(0, (h * 0.9 * dist) / 260, dist);
    controls?.target.set(0, h * 0.45, 0);
    controls?.update();
    invalidate();
    // 形状更新では動かさない（スライダー操作中にカメラが跳ねないように）
  }, [layoutKey, controls]);
  return null;
}

/** WebGL が使えない・3D ビューが落ちたときに画面全体を巻き込まず案内を出す */
class CanvasBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(e: unknown) {
    console.error(e);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function Viewer() {
  const t = useT();
  const building = useStore((s) => s.building);
  const preview = useStore((s) => s.preview);
  const error = useStore((s) => s.error);
  const printTab = useStore((s) => s.tab === 'print');
  const h = preview?.stats.height ?? 120;
  const layoutStem = printTab ? preview?.stem : undefined;
  const sb = layoutStem ? boxOf(layoutStem.positions) : null;
  const layoutWidth = (preview?.stats.width ?? 120) + (sb ? 10 + sb.max[0] - sb.min[0] : 0);
  // 形状が届くたび・配置が変わるたびに ContactShadows を作り直して焼き直す
  const shadowKey = useMemo(() => ++shadowSeq, [preview, printTab]);
  return (
    <div className="viewer">
      {/* 操作中だけ描画（demand）。影は形状が変わったときに 1 回だけ焼く */}
      <CanvasBoundary fallback={<p className="viewer-msg err">{t('viewerError')}</p>}>
        <Canvas frameloop="demand" camera={{ position: [0, h * 0.9, 260], fov: 35, near: 1, far: 5000 }} dpr={[1, 1.5]} gl={{ alpha: true }}>
          {/* 背景は .stage の CSS グラデーション（灯り）を透かす */}
          <hemisphereLight args={['#ffe9d0', '#2a1830', 0.9]} />
          <directionalLight position={[120, 220, 160]} intensity={1.6} />
          <directionalLight position={[-160, 80, -120]} intensity={0.5} color="#a8b8ff" />
          <Pumpkin />
          <ContactShadows key={shadowKey} frames={1} position={[0, 0, 0]} opacity={0.55} scale={400} blur={2.4} far={200} />
          <gridHelper args={[256, 16, '#463650', '#2a2033']} position={[0, -0.05, 0]} />
          <OrbitControls target={[0, h * 0.45, 0]} makeDefault enableDamping minDistance={80} maxDistance={900} />
          <FitCamera width={layoutWidth} h={h} layoutKey={`${printTab}-${!!layoutStem}`} />
        </Canvas>
        {/* 初回ビルドが終わるまでは空の画面にせず、計算中（失敗時はその旨）を中央に出す */}
        {!preview && <p className={`viewer-msg ${error ? 'err' : 'pulse'}`}>{t(error ? 'buildError' : 'building')}</p>}
      </CanvasBoundary>
      <div className="viewer-status">
        {/* 形がまだ無いときは中央に同じ文言が出るので、ここでは出さない */}
        {error ? preview && <span className="err" title={error}>{t('buildError')}</span> : building ? <span>…</span> : preview ? (
          <span>
            {preview.stats.width.toFixed(0)}×{preview.stats.depth.toFixed(0)}×{preview.stats.height.toFixed(0)} mm
          </span>
        ) : null}
      </div>
    </div>
  );
}
