// パラメータの型・初期値・範囲。UI・URL・ジオメトリで共有する唯一の定義。

export type InteriorMode = 'lantern' | 'sealed';
export type PartKind = 'eye' | 'nose' | 'mouth';

export interface FacePart {
  /** プリセット名（face/presets.ts） */
  preset: string;
  /** 展開図上の中心 [mm]。x は赤道に沿った弧長、y は赤道からの子午線方向の弧長 */
  x: number;
  y: number;
  /** 幅・高さ [mm] */
  w: number;
  h: number;
  /** 回転 [deg] */
  rot: number;
}

export interface FaceParams {
  symmetric: boolean;
  eyeL: FacePart;
  eyeR: FacePart;
  nose: FacePart;
  mouth: FacePart;
}

export interface NumParams {
  seed: number;
  // 形
  diameter: number;
  topH: number;
  bottomH: number;
  superE: number;
  egg: number;
  wobble: number;
  flat: number;
  dimpleDepth: number;
  dimpleWidth: number;
  // 筋
  ribs: number;
  ribDepth: number;
  ribSharp: number;
  ribSkew: number;
  twist: number;
  ribFade: number;
  ribJitter: number;
  // ヘタ
  stemSides: number;
  stemStar: number;
  stemHeight: number;
  stemRadius: number;
  stemTaper: number;
  stemTwist: number;
  stemBend: number;
  stemFlare: number;
  // 顔
  arch: number;
  bridge: number;
  // 内部
  wall: number;
  floor: number;
  led: number;
  engrave: number;
}

export interface Params extends NumParams {
  mode: InteriorMode;
  face: FaceParams;
}

export type TabId = 'shape' | 'ribs' | 'stem' | 'face' | 'interior' | 'export';

export interface NumDef {
  key: keyof NumParams;
  /** URLクエリのキー（短縮） */
  q: string;
  label: string;
  tab: TabId;
  min: number;
  max: number;
  step: number;
  def: number;
  unit?: string;
  advanced?: boolean;
  int?: boolean;
}

export const NUM_DEFS: NumDef[] = [
  { key: 'seed', q: 's', label: 'シード', tab: 'shape', min: 1, max: 9999, step: 1, def: 1031, int: true, advanced: true },

  { key: 'diameter', q: 'D', label: '直径', tab: 'shape', min: 60, max: 240, step: 1, def: 120, unit: 'mm' },
  { key: 'topH', q: 'th', label: '上半分の高さ', tab: 'shape', min: 0.4, max: 1.4, step: 0.01, def: 0.72 },
  { key: 'bottomH', q: 'bh', label: '下半分の高さ', tab: 'shape', min: 0.4, max: 1.2, step: 0.01, def: 0.68 },
  { key: 'superE', q: 'e', label: '角ばり（超楕円指数）', tab: 'shape', min: 1.6, max: 4, step: 0.05, def: 2.3, advanced: true },
  { key: 'egg', q: 'k', label: '卵形', tab: 'shape', min: -0.3, max: 0.3, step: 0.01, def: 0.05, advanced: true },
  { key: 'wobble', q: 'wb', label: '歪み', tab: 'shape', min: 0, max: 0.12, step: 0.005, def: 0.01 },
  { key: 'flat', q: 'fl', label: '接地径（最大径比）', tab: 'shape', min: 0.35, max: 0.7, step: 0.01, def: 0.45, advanced: true },
  { key: 'dimpleDepth', q: 'dd', label: 'ヘタ周りのくぼみ', tab: 'shape', min: 0, max: 0.2, step: 0.005, def: 0.07 },
  { key: 'dimpleWidth', q: 'dw', label: 'くぼみの広さ', tab: 'shape', min: 0.15, max: 0.8, step: 0.01, def: 0.35, advanced: true },

  { key: 'ribs', q: 'N', label: '筋の数', tab: 'ribs', min: 4, max: 24, step: 1, def: 10, int: true },
  { key: 'ribDepth', q: 'rd', label: '溝の深さ', tab: 'ribs', min: 0, max: 0.25, step: 0.005, def: 0.09 },
  { key: 'ribSharp', q: 'p', label: '溝の形（小:V ↔ 大:U）', tab: 'ribs', min: 0.3, max: 4, step: 0.05, def: 1.0 },
  { key: 'twist', q: 't', label: 'ねじれ', tab: 'ribs', min: -120, max: 120, step: 1, def: 0, unit: '°' },
  { key: 'ribSkew', q: 'sk', label: '溝の非対称', tab: 'ribs', min: 0.5, max: 2, step: 0.01, def: 1, advanced: true },
  { key: 'ribFade', q: 'q', label: '極での溝の消え方', tab: 'ribs', min: 0.1, max: 3, step: 0.05, def: 0.7, advanced: true },
  { key: 'ribJitter', q: 'j', label: '筋ごとの個体差', tab: 'ribs', min: 0, max: 0.15, step: 0.005, def: 0.04, advanced: true },

  { key: 'stemHeight', q: 'sh', label: 'ヘタの高さ', tab: 'stem', min: 0.05, max: 0.45, step: 0.005, def: 0.2 },
  { key: 'stemRadius', q: 'sr', label: 'ヘタの太さ', tab: 'stem', min: 0.03, max: 0.14, step: 0.002, def: 0.07 },
  { key: 'stemBend', q: 'sb', label: '曲がり', tab: 'stem', min: 0, max: 0.8, step: 0.01, def: 0.3 },
  { key: 'stemSides', q: 'sn', label: '断面の角数', tab: 'stem', min: 4, max: 9, step: 1, def: 5, int: true, advanced: true },
  { key: 'stemStar', q: 'ss', label: '星形の深さ', tab: 'stem', min: 0, max: 0.45, step: 0.01, def: 0.15, advanced: true },
  { key: 'stemTaper', q: 'st', label: 'テーパー', tab: 'stem', min: 0, max: 0.7, step: 0.01, def: 0.3, advanced: true },
  { key: 'stemTwist', q: 'sw', label: 'ねじれ', tab: 'stem', min: -180, max: 180, step: 1, def: 40, unit: '°', advanced: true },
  { key: 'stemFlare', q: 'sf', label: '根元の広がり', tab: 'stem', min: 0, max: 1, step: 0.01, def: 0.5, advanced: true },

  { key: 'arch', q: 'ar', label: '穴の上辺を尖頭アーチにする（0で無効）', tab: 'face', min: 0, max: 1, step: 1, def: 1, int: true, advanced: true },
  { key: 'bridge', q: 'br', label: '島のブリッジ幅', tab: 'face', min: 1.5, max: 5, step: 0.1, def: 2, unit: 'mm', advanced: true },

  { key: 'wall', q: 'w', label: '肉厚', tab: 'interior', min: 1.2, max: 4, step: 0.1, def: 1.6, unit: 'mm' },
  { key: 'led', q: 'L', label: 'LED用開口の直径', tab: 'interior', min: 40, max: 80, step: 1, def: 44, unit: 'mm' },
  { key: 'floor', q: 'fb', label: '底の厚み', tab: 'interior', min: 1.2, max: 5, step: 0.1, def: 2, unit: 'mm', advanced: true },
  { key: 'engrave', q: 'eg', label: '彫り込み深さ（密閉）', tab: 'interior', min: 1, max: 2, step: 0.1, def: 1.5, unit: 'mm' },
];

export const NUM_DEF_BY_KEY = Object.fromEntries(NUM_DEFS.map((d) => [d.key, d])) as Record<keyof NumParams, NumDef>;

export function defaultFace(): FaceParams {
  return {
    symmetric: true,
    eyeL: { preset: 'triangle', x: -24, y: 14, w: 22, h: 20, rot: 0 },
    eyeR: { preset: 'triangle', x: 24, y: 14, w: 22, h: 20, rot: 0 },
    nose: { preset: 'triangle', x: 0, y: -2, w: 12, h: 11, rot: 0 },
    mouth: { preset: 'jagged', x: 0, y: -20, w: 62, h: 24, rot: 0 },
  };
}

export function defaultParams(): Params {
  const p = {} as NumParams;
  for (const d of NUM_DEFS) (p as unknown as Record<string, number>)[d.key] = d.def;
  return { ...p, mode: 'lantern', face: defaultFace() };
}

export function clampNum(def: NumDef, v: number): number {
  if (!Number.isFinite(v)) return def.def;
  let x = Math.min(def.max, Math.max(def.min, v));
  if (def.int) x = Math.round(x);
  return x;
}

/** 左右対称モードのとき、右目を左目の鏡像にし、鼻と口を中央に揃える */
export function applySymmetry(face: FaceParams): FaceParams {
  if (!face.symmetric) return face;
  const l = face.eyeL;
  return {
    ...face,
    eyeR: { ...l, x: -l.x, rot: -l.rot },
    nose: { ...face.nose, x: 0, rot: 0 },
    mouth: { ...face.mouth, x: 0, rot: 0 },
  };
}

export const PART_KEYS = ['eyeL', 'eyeR', 'nose', 'mouth'] as const;
export type PartKey = (typeof PART_KEYS)[number];
export const PART_KIND: Record<PartKey, PartKind> = { eyeL: 'eye', eyeR: 'eye', nose: 'nose', mouth: 'mouth' };
