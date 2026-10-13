// 形状生成の全体：本体＋ヘタの union、顔の切り抜き／彫り込み、中空化、チェック。

import type { Params } from '../model/params';
import { buildBody, DRAFT_RES, EXPORT_RES, FRONT_THETA, offsetInward, PREVIEW_RES, type Body } from './body';
import { runChecks, type CheckItem, type CheckLevel } from './checks';
import { FACE_REF_DIAMETER, layoutFace, subdivide, type FaceCheck } from './face/layout';
import type { Pt } from './face/presets';
import { Scope, type Manifold, type Wasm } from './manifold';
import { boxOf, partSize, PRINT_GAP, type Vec3 } from './layout';
import { buildStem, FIT, stemPin, stemSeatRadius } from './stem';

// draft = スライダー操作中の粗いプレビュー
export type Quality = 'draft' | 'preview' | 'export';
export type PartKindId = 'body' | 'stem' | 'cut' | 'inner';

export interface MeshGroup {
  start: number;
  count: number;
  kind: PartKindId;
}

export interface BuildStats {
  width: number;
  depth: number;
  height: number;
  triangles: number;
  ms: number;
  contactDiameter: number;
  maxDiameter: number;
  /** 展開図の基準：最大径位置の平均半径 [mm] */
  rEq: number;
}

export interface BuildResult {
  positions: Float32Array;
  indices: Uint32Array;
  groups: MeshGroup[];
  checks: CheckItem[];
  level: CheckLevel;
  stats: BuildStats;
  /** 差し込み式のときだけ：ヘタ単体（本体に差した位置の座標）。seatZ は平らな底面の z */
  stem?: { positions: Float32Array; indices: Uint32Array; seatZ: number };
}

export const MIN_HOLE = 2;
export const MIN_LINK = 3;
// ランタン内天井の傾き（tan 20°）。内側は見えないので 70° オーバーハングまで許す（壁厚一定を優先）
export const CEIL_SLOPE = Math.tan((20 * Math.PI) / 180);
// 内天井の中央をブリッジで渡す半径の上限（Ø50 mm。内側なので多少の垂れは許容）。
// 小さい本体では 0.42·rEq に縮める（直径 60 で 25 mm のままだと頂上がほぼ全部ブリッジ高さまで埋まる。直径 120 以上は 25 mm のまま）
export const BRIDGE_R = 25;

/** manifold の頂点配列から xyz だけを取り出す */
function xyz(mesh: { vertProperties: Float32Array; numProp: number }): Float32Array {
  const out = new Float32Array((mesh.vertProperties.length / mesh.numProp) * 3);
  for (let v = 0, n = out.length / 3; v < n; v++) {
    out[v * 3] = mesh.vertProperties[v * mesh.numProp];
    out[v * 3 + 1] = mesh.vertProperties[v * mesh.numProp + 1];
    out[v * 3 + 2] = mesh.vertProperties[v * mesh.numProp + 2];
  }
  return out;
}

function toManifold(wasm: Wasm, scope: Scope, positions: Float32Array, indices: Uint32Array): Manifold {
  const mesh = new wasm.Mesh({ numProp: 3, vertProperties: positions, triVerts: indices });
  return scope.keep(scope.keep(new wasm.Manifold(mesh)).asOriginal());
}

/** 展開図 (x, y) [mm] と半径方向パラメータ w∈[0,1] を、中心からの放射方向の点へ写す */
function radialMap(x: number, y: number, w: number, c: { z: number; rEq: number; rIn: number; rOut: number }) {
  const a = FRONT_THETA + x / c.rEq;
  const b = y / c.rEq;
  const r = c.rIn + (c.rOut - c.rIn) * w;
  const cb = Math.cos(b);
  return [r * cb * Math.cos(a), r * cb * Math.sin(a), c.z + r * Math.sin(b)];
}

/** 2D 形状を中心から外向きの錐台に押し出す */
function radialFrustum(wasm: Wasm, scope: Scope, contours: Pt[][], c: Parameters<typeof radialMap>[3]): Manifold | null {
  const polys = contours.filter((p) => p.length >= 3);
  if (!polys.length) return null;
  const flat: Pt[] = polys.flat();
  const n = flat.length;
  const tris = wasm.triangulate(polys, 1e-6);
  const pos = new Float32Array(n * 2 * 3);
  for (let i = 0; i < n; i++) {
    const [x, y] = flat[i];
    pos.set(radialMap(x, y, 0, c), i * 3);
    pos.set(radialMap(x, y, 1, c), (n + i) * 3);
  }
  const idx: number[] = [];
  for (const [a, b, d] of tris) {
    idx.push(a, d, b); // 内側の蓋（−w 向き）
    idx.push(n + a, n + b, n + d); // 外側の蓋（+w 向き）
  }
  let off = 0;
  for (const poly of polys) {
    const m = poly.length;
    for (let i = 0; i < m; i++) {
      const a0 = off + i;
      const b0 = off + ((i + 1) % m);
      idx.push(a0, b0, n + b0, a0, n + b0, n + a0);
    }
    off += m;
  }
  return toManifold(wasm, scope, pos, new Uint32Array(idx));
}

export function buildPumpkin(wasm: Wasm, p: Params, quality: Quality): BuildResult {
  const t0 = performance.now();
  const scope = new Scope();
  try {
    const fine = quality === 'export';
    const body: Body = buildBody(p, fine ? EXPORT_RES : quality === 'draft' ? DRAFT_RES : PREVIEW_RES);
    const info = body.info;
    const bodyM = toManifold(wasm, scope, body.positions, body.indices);
    const stem = buildStem(p, info.zTop, fine);
    const stemM = toManifold(wasm, scope, stem.positions, stem.indices);
    const rf = p.stemAttach === 'peg' ? stemSeatRadius(p) : null;
    const seg = fine ? 128 : 48;
    // 差し込み式では本体とヘタを分ける（座ぐり・ピンは CSG の最後に加える）
    const solid = rf ? bodyM : scope.keep(bodyM.add(stemM));
    // 中央の内天井の高さ（座ぐりが内天井を突き破らないよう深さを制限する）。draft も同じ値を使う
    let zCeil = -Infinity;
    const ids: Record<number, PartKindId> = { [bodyM.originalID()]: 'body', [stemM.originalID()]: 'stem' };

    // 顔の 2D レイアウト
    const face = layoutFace(wasm, scope, p.face, {
      scale: p.diameter / FACE_REF_DIAMETER,
      arch: p.arch > 0,
      bridge: p.bridge,
      checkScale: (info.rEq - p.wall) / info.rEq,
      minHole: MIN_HOLE,
      minLink: MIN_LINK,
    });
    const contours = ((face.cs?.toPolygons() ?? []) as Pt[][]).map((poly) => subdivide(poly, fine ? 0.8 : quality === 'draft' ? 5 : 2.5));
    const frame = { z: info.zCenter, rEq: info.rEq, rIn: info.rEq * 0.2, rOut: info.rMax * 1.7 };
    const frustum = radialFrustum(wasm, scope, contours, frame);
    if (frustum) ids[frustum.originalID()] = 'cut';

    const inner = offsetInward(body, p.wall);
    // 底面リングと底面中心を下へ延ばし、床は平面カットで作る
    const nt = body.nTheta;
    const firstBottom = 1 + (body.rings - 1) * nt;
    for (let v = firstBottom; v < inner.length / 3; v++) inner[v * 3 + 2] = -1;
    // 内天井の円錐（水平から約 20° = 70° オーバーハング）。経線を赤道から上へたどり、
    // 内面がこの傾きより寝始めた点から上だけを円錐で埋める。それより下は壁厚一定のまま。
    // 中心（ヘタのくぼみ）は半径 bridgeR までの平らな天井にしてブリッジで渡す。
    // 円錐を中心の最低点から始めずに済むので、平たい形でも肩が厚くならない
    const k = CEIL_SLOPE;
    const bridgeR = Math.min(BRIDGE_R, 0.42 * info.rEq);
    const rOf = (v: number) => Math.hypot(inner[v * 3], inner[v * 3 + 1]);
    const zk = (v: number) => inner[v * 3 + 2] + k * rOf(v);
    let zCap = inner[2];
    for (let v = 1; v < inner.length / 3; v++) {
      if (inner[v * 3 + 2] >= info.zCenter && rOf(v) <= bridgeR) zCap = Math.min(zCap, inner[v * 3 + 2]);
    }
    zCeil = zCap;
    let zApex = zCap + k * bridgeR;
    for (let i = 0; i < nt; i++) {
      let flat = false;
      for (let j = body.rings; j >= 1; j--) {
        const v = 1 + (j - 1) * nt + i;
        if (inner[v * 3 + 2] < info.zCenter) continue;
        // 上の点（j=1 は極）へ向かって z + k·r が減る = 円錐より寝ている
        if (!flat) flat = zk(j > 1 ? v - nt : 0) < zk(v);
        if (flat && rOf(v) > bridgeR) zApex = Math.min(zApex, zk(v));
      }
    }
    const innerM = toManifold(wasm, scope, inner, body.indices);
    ids[innerM.originalID()] = 'inner';
    const h = zApex + 10;
    const cone = scope.keep(
      scope.keep(scope.keep(wasm.Manifold.cylinder(h, h / k, 0, fine ? 192 : 64)).translate([0, 0, zApex - h])).asOriginal(),
    );
    // draft では天井の円錐カットを省く（頂上の内側だけなので外からは見えず、ブーリアン 1 回分速い）
    const ceiling = quality === 'draft' ? innerM : scope.keep(scope.keep(innerM.intersect(cone)).trimByPlane([0, 0, -1], -zCap));
    const cavity = scope.keep(ceiling.trimByPlane([0, 0, 1], p.floor));
    const led = scope.keep(
      scope.keep(wasm.Manifold.cylinder(p.floor + 2, p.led / 2, p.led / 2, fine ? 128 : 48)).translate([0, 0, -1]),
    );
    const ledId = led.asOriginal();
    scope.keep(ledId);
    ids[ledId.originalID()] = 'inner';
    ids[cone.originalID()] = 'inner';
    const cutters = [cavity, ledId];
    if (frustum) cutters.push(frustum);
    let result: Manifold = scope.keep(solid.subtract(scope.keep(wasm.Manifold.union(cutters))));

    let stemPart: BuildResult['stem'];
    let peg: ReturnType<typeof stemPin> | null = null;
    if (rf) {
      // 座面：ヘタの足元の範囲で外形がいちばん低い高さ。ランタンでは内天井から壁厚ぶん上までに留める
      let zSeat = Infinity;
      const bp = body.positions;
      for (let v = 0; v < bp.length / 3; v++) {
        if (bp[v * 3 + 2] > info.zCenter && Math.hypot(bp[v * 3], bp[v * 3 + 1]) <= rf) zSeat = Math.min(zSeat, bp[v * 3 + 2]);
      }
      zSeat = Math.max(zSeat, zCeil + p.wall);
      const seat = scope.keep(scope.keep(scope.keep(wasm.Manifold.cylinder(info.zTop + 10, rf, rf, seg)).translate([0, 0, zSeat])).asOriginal());
      peg = stemPin(p, info.zTop, zSeat);
      const { rp, hp } = peg;
      // ピンは座面より 0.5 mm 下から生やして本体と確実に重ねる。先端は面取りして差し込みやすく
      const c = Math.min(1, hp / 2);
      const pinProfile: [number, number][] = [[0, -0.5], [rp, -0.5], [rp, hp - c], [rp - 0.4 * c, hp], [0, hp]];
      const pin = scope.keep(scope.keep(scope.keep(wasm.Manifold.revolve([pinProfile], seg)).translate([0, 0, zSeat])).asOriginal());
      ids[seat.originalID()] = 'body';
      ids[pin.originalID()] = 'body';
      result = scope.keep(scope.keep(result.subtract(seat)).add(pin));

      // ヘタ側：座面で平らに切り、ピン用の穴（すき間・深さの余裕は FIT）をあける。入口は 45° に面取り
      const rh = rp + FIT.pinClear;
      const ch = FIT.chamfer;
      const holeProfile: [number, number][] = [[0, -1], [rh + ch + 1, -1], [rh, ch], [rh, hp + FIT.holeExtra], [0, hp + FIT.holeExtra]];
      const hole = scope.keep(scope.keep(wasm.Manifold.revolve([holeProfile], seg)).translate([0, 0, zSeat]));
      const stemOut = scope.keep(scope.keep(stemM.trimByPlane([0, 0, 1], zSeat)).subtract(hole)).getMesh();
      stemPart = { positions: xyz(stemOut), indices: new Uint32Array(stemOut.triVerts), seatZ: zSeat };
    }

    // CSG の数値誤差で出る体積ほぼ 0 の破片は捨てる
    const parts = result.decompose();
    parts.forEach((m) => scope.keep(m));
    const solidParts = parts.filter((m) => m.volume() > 0.5);
    if (solidParts.length !== parts.length) result = scope.keep(wasm.Manifold.compose(solidParts));

    const mesh = result.getMesh();
    const positions = xyz(mesh);
    const indices = new Uint32Array(mesh.triVerts);
    const groups: MeshGroup[] = [];
    const runIndex = mesh.runIndex;
    const runId = mesh.runOriginalID;
    for (let r = 0; r < runId.length; r++) {
      const start = runIndex[r];
      const count = runIndex[r + 1] - start;
      if (count <= 0) continue;
      const kind = ids[runId[r]] ?? 'inner';
      const last = groups[groups.length - 1];
      if (last && last.kind === kind && last.start + last.count === start) last.count += count;
      else groups.push({ start, count, kind });
    }

    const bb = result.boundingBox();
    const stats: BuildStats = {
      width: bb.max[0] - bb.min[0],
      depth: bb.max[1] - bb.min[1],
      height: bb.max[2] - bb.min[2],
      triangles: indices.length / 3,
      ms: 0,
      contactDiameter: info.rContact * 2,
      maxDiameter: info.rMax * 2,
      rEq: info.rEq,
    };
    // ベッド判定は書き出しと同じ配置（差し込み式はヘタを +x 側に並べる）で測る
    const bodySize: Vec3 = [stats.width, stats.depth, stats.height];
    const stemSize = stemPart && partSize(boxOf(stemPart.positions), stemPart.seatZ);
    const bed: Vec3 = stemSize
      ? [bodySize[0] + PRINT_GAP + stemSize[0], Math.max(bodySize[1], stemSize[1]), Math.max(bodySize[2], stemSize[2])]
      : bodySize;
    const { items, level } = runChecks(p, {
      status: result.status(),
      empty: result.isEmpty(),
      components: solidParts.length,
      stats,
      bed,
      peg,
      face: face.check as FaceCheck,
    });
    stats.ms = performance.now() - t0;
    return { positions, indices, groups, checks: items, level, stats, ...(stemPart && { stem: stemPart }) };
  } finally {
    scope.dispose();
  }
}
