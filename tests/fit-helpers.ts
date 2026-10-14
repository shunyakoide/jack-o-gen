// テスト用の計測ヘルパー：出力メッシュを実際に切って寸法を測る。
import { buildBody, EXPORT_RES, PREVIEW_RES } from '../src/geometry/body';
import { buildPumpkin, type BuildResult, type Quality } from '../src/geometry/build';
import type { Manifold, Wasm } from '../src/geometry/manifold';
import { buildStem, FIT } from '../src/geometry/stem';
import type { Params } from '../src/model/params';

type Pt = [number, number];

const builds = new Map<string, BuildResult>();

/** 同じ入力のビルドはファイル内で 1 回だけ行う（結果は読み取り専用で使う） */
export function cachedBuild(wasm: Wasm, p: Params, q: Quality): BuildResult {
  const key = q + JSON.stringify(p);
  let r = builds.get(key);
  if (!r) builds.set(key, (r = buildPumpkin(wasm, p, q)));
  return r;
}

export function solidOf(wasm: Wasm, positions: Float32Array, indices: Uint32Array): Manifold {
  return new wasm.Manifold(new wasm.Mesh({ numProp: 3, vertProperties: positions, triVerts: indices }));
}

function area(poly: Pt[]): number {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const [ax, ay] = poly[i];
    const [bx, by] = poly[(i + 1) % poly.length];
    a += ax * by - bx * ay;
  }
  return Math.abs(a / 2);
}

function edgeDist(poly: Pt[]): number {
  let d = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const [ax, ay] = poly[i];
    const [bx, by] = poly[(i + 1) % poly.length];
    const ex = bx - ax, ey = by - ay;
    const t = Math.max(0, Math.min(1, -(ax * ex + ay * ey) / (ex * ex + ey * ey || 1)));
    d = Math.min(d, Math.hypot(ax + t * ex, ay + t * ey));
  }
  return d;
}

/**
 * ヘタ側の穴まわりの最小肉厚 [mm]。穴 = (座面で切った元のヘタ) − (出力されたヘタ) を 0.1 mm ごとに輪切りにし、
 * 「軸から元のヘタ外形までの最短距離 − 穴の最大半径」の最小値を返す。穴の上 FIT.minWall（天井）も含める
 */
export function stemWall(wasm: Wasm, p: Params, r: BuildResult, fine = false): number {
  const st = r.stem!;
  const zTop = buildBody(p, fine ? EXPORT_RES : PREVIEW_RES).info.zTop;
  const raw = buildStem(p, zTop, fine);
  const full = solidOf(wasm, raw.positions, raw.indices).trimByPlane([0, 0, 1], st.seatZ);
  const hole = full.subtract(solidOf(wasm, st.positions, st.indices));
  const holeTop = hole.boundingBox().max[2];
  let wall = Infinity;
  let rHole = 0;
  for (let z = st.seatZ + 0.05; z <= holeTop + FIT.minWall; z += 0.1) {
    // CSG の数値誤差で外周に出る極薄の破片は除き、面積最大の輪郭を穴とみなす
    const hs = (hole.slice(Math.min(z, holeTop - 0.01)).toPolygons() as Pt[][]).sort((a, b) => area(b) - area(a))[0] ?? [];
    if (z < holeTop) rHole = Math.max(...hs.map(([x, y]) => Math.hypot(x, y)));
    const outer = full.slice(z).toPolygons() as Pt[][];
    if (!outer.length) return -Infinity;
    wall = Math.min(wall, Math.min(...outer.map(edgeDist)) - rHole);
  }
  return wall;
}

/** 天頂まわりの最大の肉の厚さ [mm]：最大径より上を 2 mm 角の柱で区切り、柱ごとの体積÷断面積の最大値（中心の座ぐり付近は除く） */
export function topThickness(wasm: Wasm, r: BuildResult, rSkip: number): number {
  const body = solidOf(wasm, r.positions, r.indices);
  const bb = body.boundingBox();
  const z0 = bb.max[2] * 0.55;
  let worst = 0;
  for (let x = 0; x <= bb.max[0]; x += 2) {
    for (let y = 0; y <= bb.max[1]; y += 2) {
      if (Math.hypot(x, y) < rSkip) continue;
      const col = wasm.Manifold.cube([2, 2, bb.max[2] - z0 + 1]).translate([x - 1, y - 1, z0]);
      worst = Math.max(worst, body.intersect(col).volume() / 4);
    }
  }
  return worst;
}

/** 顔の切り抜きの壁の奥行き（y 方向）の最大値 [mm] */
export function cutDepth(r: BuildResult): number {
  const g = r.groups.find((g) => g.kind === 'cut');
  if (!g) return 0;
  let depth = 0;
  for (let i = g.start; i < g.start + g.count; i += 3) {
    const y = [0, 1, 2].map((k) => r.positions[r.indices[i + k] * 3 + 1]);
    depth = Math.max(depth, Math.max(...y) - Math.min(...y));
  }
  return depth;
}
