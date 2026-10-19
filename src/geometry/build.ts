// 形状生成の全体：本体＋ヘタの union、顔の切り抜き（または色分け用の別パーツ化）、中空化、チェック。

import type { Params } from '../model/params';
import { buildBody, DRAFT_RES, EXPORT_RES, FRONT_THETA, ledHole as ledDiameter, offsetInward, PREVIEW_RES, type Body, type BodyInfo } from './body';
import { boxOf } from './layout';
import { runChecks, type CheckItem, type CheckLevel } from './checks';
import { FACE_REF_DIAMETER, layoutFace, subdivide, type FaceCheck } from './face/layout';
import type { Pt } from './face/presets';
import { Scope, type CrossSection, type Manifold, type Wasm } from './manifold';
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
  /** 顔の細い穴・細い連結部の領域（展開図 mm）。エディタで赤く塗る */
  faceProblems: [number, number][][];
  /** 差し込み式のときだけ：ヘタ単体（本体に差した位置の座標）。seatZ は平らな底面の z */
  stem?: { positions: Float32Array; indices: Uint32Array; seatZ: number };
  /** 色分け（faceStyle = 'inlay'）のときだけ：壁の顔の部分（本体と同じ座標。本体にはちょうどこの形の穴がある） */
  face?: { positions: Float32Array; indices: Uint32Array };
  /** 蓋付き（opening = 'lid'）のときだけ：蓋（本体に載せた位置の座標）。seatZ は蓋の平らな底面の z */
  lid?: { positions: Float32Array; indices: Uint32Array; groups: MeshGroup[]; seatZ: number };
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

/** WASM・解放用スコープ・部位の対応表（originalID → 表示グループ）をまとめて渡す */
interface Ctx {
  wasm: Wasm;
  scope: Scope;
  ids: Record<number, PartKindId>;
}

/** 顔の 2D レイアウトを、中心から外向きの切り抜き用ソリッドにする */
function faceCutter(c: Ctx, p: Params, info: BodyInfo, quality: Quality) {
  // 色分けでは穴にならないので、天井の尖頭アーチも島のブリッジも要らない
  const cut = p.faceStyle === 'cut';
  const face = layoutFace(c.wasm, c.scope, p.face, {
    scale: p.diameter / FACE_REF_DIAMETER,
    arch: cut && p.arch > 0,
    bridge: cut ? p.bridge : 0,
    checkScale: (info.rEq - p.wall) / info.rEq,
    minHole: MIN_HOLE,
    minLink: MIN_LINK,
  });
  const maxLen = quality === 'export' ? 0.8 : quality === 'draft' ? 5 : 2.5;
  const contours = ((face.cs?.toPolygons() ?? []) as Pt[][]).map((poly) => subdivide(poly, maxLen));
  const frame = { z: info.zCenter, rEq: info.rEq, rIn: info.rEq * 0.2, rOut: info.rMax * 1.7 };
  const frustum = radialFrustum(c.wasm, c.scope, contours, frame);
  if (frustum) c.ids[frustum.originalID()] = 'cut';
  return { frustum, check: face.check as FaceCheck };
}

/**
 * 中空部（床の上から内天井まで）。zCeil は中央の平らな内天井の高さ
 * （座ぐりが内天井を突き破らないよう深さを制限するのに使う）
 */
function cavityOf(c: Ctx, p: Params, body: Body) {
  const info = body.info;
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
  // 蓋付きでは平らな天井がそのまま蓋の底（ベッドに置く面）になるので、蓋の切れ目の星形が収まる大きさにする
  const bridgeR = p.opening === 'lid' ? lidStarRadius(info) + 1 : Math.min(BRIDGE_R, 0.42 * info.rEq);
  const rOf = (v: number) => Math.hypot(inner[v * 3], inner[v * 3 + 1]);
  const zk = (v: number) => inner[v * 3 + 2] + k * rOf(v);
  let zCap = inner[2];
  for (let v = 1; v < inner.length / 3; v++) {
    if (inner[v * 3 + 2] >= info.zCenter && rOf(v) <= bridgeR) zCap = Math.min(zCap, inner[v * 3 + 2]);
  }
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
  // 円錐より上にある内面の頂点を円錐面まで下ろす。多角形の円錐と intersect すると、
  // 円錐が内面にほぼ接する所で交線がギザギザになり、円錐の細長い面も残るため、内面のメッシュのまま形を作る
  for (let v = 0; v < inner.length / 3; v++) inner[v * 3 + 2] = Math.min(inner[v * 3 + 2], zApex - k * rOf(v));
  const innerM = toManifold(c.wasm, c.scope, inner, body.indices);
  c.ids[innerM.originalID()] = 'inner';
  const cavity = c.scope.keep(c.scope.keep(innerM.trimByPlane([0, 0, -1], -zCap)).trimByPlane([0, 0, 1], p.floor));
  return { cavity, zCeil: zCap };
}

/** 底の LED 用の穴 */
function ledHole(c: Ctx, p: Params, fine: boolean): Manifold {
  const led = c.scope.keep(
    c.scope.keep(c.wasm.Manifold.cylinder(p.floor + 2, ledDiameter(p) / 2, ledDiameter(p) / 2, fine ? 128 : 48)).translate([0, 0, -1]),
  );
  const ledId = c.scope.keep(led.asOriginal());
  c.ids[ledId.originalID()] = 'inner';
  return ledId;
}

/** 差し込み式：本体に座ぐりとピン、ヘタに座面と穴を加える */
function addPeg(c: Ctx, p: Params, body: Body, stemM: Manifold, result: Manifold, rf: number, zCeil: number, fine: boolean) {
  const { wasm, scope } = c;
  const info = body.info;
  const seg = fine ? 128 : 48;
  // 座面：ヘタの足元の範囲で外形がいちばん低い高さ。ランタンでは内天井から壁厚ぶん上までに留める
  let zSeat = Infinity;
  let zRim = -Infinity;
  const bp = body.positions;
  for (let v = 0; v < bp.length / 3; v++) {
    if (bp[v * 3 + 2] <= info.zCenter) continue;
    const r = Math.hypot(bp[v * 3], bp[v * 3 + 1]);
    if (r <= rf) zSeat = Math.min(zSeat, bp[v * 3 + 2]);
    if (r <= rf + 2) zRim = Math.max(zRim, bp[v * 3 + 2]);
  }
  zSeat = Math.max(zSeat, zCeil + p.wall);
  // 座ぐりはヘタの形：本体に埋まる高さのヘタを真上から見た外形を seatGap だけ太らせて押し出す（丸より回り止めになる）
  const foot = scope.keep(scope.keep(stemM.trimByPlane([0, 0, 1], zSeat)).trimByPlane([0, 0, -1], -zRim)).project();
  const outline = scope.keep(scope.keep(scope.keep(foot).offset(FIT.seatGap, 'Round', 2, seg)).simplify(0.01));
  const seat = scope.keep(scope.keep(scope.keep(outline.extrude(zRim - zSeat + 10)).translate([0, 0, zSeat])).asOriginal());
  const peg = stemPin(p, info.zTop, zSeat);
  const { rp, hp } = peg;
  // ピンは座面より 0.5 mm 下から生やして本体と確実に重ねる。先端は面取りして差し込みやすく。
  // 根元は穴の入口の面取りに沿う 45° の肉盛り（すき間は pinClear のまま）で、層の境目に力が集中しないように
  const tip = Math.min(1, hp / 2);
  const root = Math.min(FIT.chamfer, hp - tip - 0.2);
  const pinProfile: [number, number][] = [[0, -0.5], [rp + root + 0.5, -0.5], [rp, root], [rp, hp - tip], [rp - 0.4 * tip, hp], [0, hp]];
  const pin = scope.keep(scope.keep(scope.keep(wasm.Manifold.revolve([pinProfile], seg)).translate([0, 0, zSeat])).asOriginal());
  c.ids[seat.originalID()] = 'body';
  c.ids[pin.originalID()] = 'body';
  const withPin = scope.keep(scope.keep(result.subtract(seat)).add(pin));

  // ヘタ側：座面で平らに切り、ピン用の穴（すき間・深さの余裕は FIT）をあける。入口は 45° に面取り
  const rh = rp + FIT.pinClear;
  const ch = FIT.chamfer;
  const holeProfile: [number, number][] = [[0, -1], [rh + ch + 1, -1], [rh, ch], [rh, hp + FIT.holeExtra], [0, hp + FIT.holeExtra]];
  const hole = scope.keep(scope.keep(wasm.Manifold.revolve([holeProfile], seg)).translate([0, 0, zSeat]));
  const stemOut = scope.keep(scope.keep(stemM.trimByPlane([0, 0, 1], zSeat)).subtract(hole)).getMesh();
  const stem = { positions: xyz(stemOut), indices: new Uint32Array(stemOut.triVerts), seatZ: zSeat };
  return { result: withPin, peg, stem };
}

export const LID = {
  /** 切れ目の星形の山の半径（赤道の平均半径 rEq に対する比） */
  size: 0.55,
  /** 谷の半径／山の半径（ギザギザの深さ） */
  notch: 0.8,
  /** 蓋と器の 45° の面どうしのすき間（面に垂直な距離） */
  gap: 0.2,
  /** LED ティーライト（Ø38 mm 前後）が通る口の径 */
  teaLight: 40,
};

export const lidStarRadius = (info: BodyInfo) => LID.size * info.rEq;

/** 断面の内側で、原点を中心にした内接円の半径（断面が無ければ 0） */
function inscribedRadius(cs: CrossSection): number {
  let r = Infinity;
  const polys = cs.toPolygons() as Pt[][];
  for (const poly of polys) {
    for (let i = 0; i < poly.length; i++) {
      const [ax, ay] = poly[i];
      const [bx, by] = poly[(i + 1) % poly.length];
      const ex = bx - ax;
      const ey = by - ay;
      const t = Math.max(0, Math.min(1, -(ax * ex + ay * ey) / (ex * ex + ey * ey || 1)));
      r = Math.min(r, Math.hypot(ax + t * ex, ay + t * ey));
    }
  }
  return polys.length ? r : 0;
}

/**
 * 蓋付き：本物のジャック・オー・ランタンのように、ヘタの周りをギザギザに切り抜いた蓋。
 * 切れ目は筋 1 本につき山 1 つの星形で、山は筋の中央に合わせる（筋の向きが合う位置でしかはまらない）。
 * 星形は平らな内天井（高さ zCeil）から上へ 45° で広がるすり鉢なので、蓋は器に座って落ちず、横にもずれない。
 * 蓋の底は平らな内天井そのもの（そのままベッドに置いて印刷でき、蓋の側面は 45°）。
 * 器側は、星形と丸い平天井の間に残る水平な張り出しを、星形から下へ 45° で広がる面で埋める
 */
function lidCut(c: Ctx, p: Params, body: Body, cavity: Manifold, zCeil: number, frustum: Manifold | null, bodyM: Manifold) {
  const { wasm, scope } = c;
  const info = body.info;
  const N = p.ribs;
  const ro = lidStarRadius(info);
  const ri = ro * LID.notch;
  // 筋の中央の方位（頂上付近。ねじれは頂上で +τ/2 ずれる。body.ts の radiusFn と同じ）。
  // 0.25° ずらすのは、山と谷が経緯度グリッドの頂点にちょうど乗ると切れ目に面積 0 の三角形ができるため
  const t0 = FRONT_THETA + (p.twist * Math.PI) / 360 + Math.PI / N + (0.25 * Math.PI) / 180;
  const star: Pt[] = Array.from({ length: 2 * N }, (_, i) => {
    const a = t0 + (i * Math.PI) / N;
    const r = i % 2 ? ri : ro;
    return [r * Math.cos(a), r * Math.sin(a)];
  });
  // 辺の直線と原点の距離（どの辺も同じ）。これを 1 にした星形を拡大して 45° の錐台を作る
  const [[x0, y0], [x1, y1]] = star;
  const apo = Math.abs(x0 * y1 - x1 * y0) / Math.hypot(x1 - x0, y1 - y0);
  const unit = scope.keep(new wasm.CrossSection([star.map(([x, y]): Pt => [x / apo, y / apo])]));
  /** 高さ zCeil で辺の距離が a の星形を、z0〜z1 の範囲で 45° に広げた（down なら下へ広げた）錐台 */
  const pyramid = (a: number, z0: number, z1: number, down = false) => {
    const a0 = down ? a + (zCeil - z0) : a - (zCeil - z0);
    const a1 = down ? a + (zCeil - z1) : a - (zCeil - z1);
    return scope.keep(scope.keep(scope.keep(unit.scale(a0)).extrude(z1 - z0, 0, 0, [a1 / a0, a1 / a0])).translate([0, 0, z0]));
  };
  const half = (LID.gap * Math.SQRT2) / 2;
  const zTop = zCeil + 2 * info.rMax + p.stemHeight * p.diameter * 2;
  // 蓋は zCeil から上だけ（平天井の縁で内面の三角形がわずかに下がる分を切り落とし、底面をきっちり平らにする）
  const inner = scope.keep(pyramid(apo - half, zCeil, zTop).asOriginal());
  c.ids[inner.originalID()] = 'body';
  const outer = pyramid(apo + half, zCeil - 1, zTop);
  // 器の張り出しを埋める：丸い平天井の範囲で、下へ 45° に広がる星形の錐台より外側
  const flatR = ro + 1;
  // 一番下で、下へ広げた星形の谷が円柱より外に出る深さ（円柱の底が水平な張り出しとして残らない）
  const depth = ((flatR + 1) * apo) / ri - apo + 1;
  const ring = scope.keep(
    scope.keep(scope.keep(wasm.Manifold.cylinder(depth + 1, flatR + 0.5, flatR + 0.5, 96)).translate([0, 0, zCeil - depth])).subtract(
      pyramid(apo + half, zCeil - depth - 1, zCeil + 1, true),
    ),
  );
  const cavityLeft = scope.keep(cavity.subtract(ring));
  const opening = 2 * inscribedRadius(scope.keep(unit.scale(apo + half)));
  // 顔が蓋の範囲にかかると、蓋に穴や色分けの境目ができてしまう
  const crossesFace = !!frustum && !scope.keep(scope.keep(frustum.intersect(outer)).intersect(bodyM)).isEmpty();
  return { zCut: zCeil, opening, fits: !crossesFace, cavity: cavityLeft, inner, outer };
}

/** CSG の数値誤差で出る体積ほぼ 0 の破片は捨てる */
function dropSlivers(c: Ctx, result: Manifold) {
  const parts = result.decompose();
  parts.forEach((m) => c.scope.keep(m));
  const solidParts = parts.filter((m) => m.volume() > 0.5);
  const kept = solidParts.length !== parts.length ? c.scope.keep(c.wasm.Manifold.compose(solidParts)) : result;
  return { result: kept, components: solidParts.length };
}

/** manifold の run（元の部品ごとの三角形の並び）を表示グループにまとめる */
function meshGroups(mesh: { runIndex: Uint32Array; runOriginalID: Uint32Array }, ids: Ctx['ids']): MeshGroup[] {
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
  return groups;
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
    const c: Ctx = { wasm, scope, ids: { [bodyM.originalID()]: 'body', [stemM.originalID()]: 'stem' } };
    const rf = p.stemAttach === 'peg' ? stemSeatRadius(p) : null;
    // 差し込み式では本体とヘタを分ける（座ぐり・ピンは CSG の最後に加える）
    const solid = rf ? bodyM : scope.keep(bodyM.add(stemM));

    const face = faceCutter(c, p, info, quality);
    const { cavity, zCeil } = cavityOf(c, p, body);
    const inlay = p.faceStyle === 'inlay';
    // 蓋付きは LED を上から入れるので底に穴を開けない
    const lid = p.opening === 'lid' ? lidCut(c, p, body, cavity, zCeil, face.frustum, bodyM) : null;
    const cutters = lid ? [lid.fits ? lid.cavity : cavity] : [cavity, ledHole(c, p, fine)];
    if (face.frustum && !inlay) cutters.push(face.frustum);
    let result: Manifold = scope.keep(solid.subtract(scope.keep(wasm.Manifold.union(cutters))));

    let stemPart: BuildResult['stem'];
    let peg: ReturnType<typeof stemPin> | null = null;
    if (rf) ({ result, peg, stem: stemPart } = addPeg(c, p, body, stemM, result, rf, zCeil, fine));

    // 蓋と器に分ける（ヘタ・ピンは蓋に付く。顔は蓋にかからない）
    let lidPart: BuildResult['lid'];
    let lidComponents = 1;
    if (lid?.fits) {
      const lidCleaned = dropSlivers(c, scope.keep(result.intersect(lid.inner)));
      lidComponents = lidCleaned.components;
      result = scope.keep(result.subtract(lid.outer));
      const lm = lidCleaned.result.getMesh();
      if (lm.triVerts.length) lidPart = { positions: xyz(lm), indices: new Uint32Array(lm.triVerts), groups: meshGroups(lm, c.ids), seatZ: lid.zCut };
    }

    // 色分け：壁を顔の錐台で 2 つに分ける。境界が共通なので段差なく、スライサーで 1 つの物体の 2 パーツとして重ねられる
    let facePart: BuildResult['face'];
    let components: number | null = null;
    if (inlay && face.frustum) {
      // 顔の内側の島（目の瞳など）は本体から離れるが、顔パーツと接して一緒に印刷されるので、部品数は分ける前の壁で数える
      components = dropSlivers(c, result).components;
      const faceM = dropSlivers(c, scope.keep(result.intersect(face.frustum))).result;
      result = scope.keep(result.subtract(face.frustum));
      const fm = faceM.getMesh();
      if (fm.triVerts.length) facePart = { positions: xyz(fm), indices: new Uint32Array(fm.triVerts) };
    }

    const cleaned = dropSlivers(c, result);
    result = cleaned.result;

    const mesh = result.getMesh();
    const positions = xyz(mesh);
    const indices = new Uint32Array(mesh.triVerts);
    const groups = meshGroups(mesh, c.ids);

    // 寸法は組み立てた全体（蓋付きでは器＋蓋）
    const lb = lidPart && boxOf(lidPart.positions);
    const bb = lb ? boxOf([...result.boundingBox().min, ...result.boundingBox().max, ...lb.min, ...lb.max]) : result.boundingBox();
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
    const { items, level } = runChecks(p, {
      status: result.status(),
      empty: result.isEmpty(),
      // 蓋付きでは器と蓋がそれぞれ 1 つの塊なら 1
      components: (components ?? cleaned.components) + lidComponents - 1,
      stats,
      peg,
      face: face.check,
      inlay,
      lid: lid && { opening: lid.opening, fits: lid.fits },
    });
    stats.ms = performance.now() - t0;
    return { positions, indices, groups, checks: items, level, stats, faceProblems: inlay ? [] : face.check.problems, ...(stemPart && { stem: stemPart }), ...(facePart && { face: facePart }), ...(lidPart && { lid: lidPart }) };
  } finally {
    scope.dispose();
  }
}
