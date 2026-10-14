// パラメータの型・初期値・範囲。UI・URL・ジオメトリで共有する唯一の定義。

/** ヘタを本体と一体で出すか、別パーツ（本体のピンに差し込む）にするか */
export type StemAttach = 'fused' | 'peg';
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
  // 本体
  diameter: number;
  /** 高さ／半径（上下の合計） */
  height: number;
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
}

export interface Params extends NumParams {
  stemAttach: StemAttach;
  face: FaceParams;
}

export type TabId = 'shape' | 'face' | 'print';
/** 形タブ内の小見出し */
export type GroupId = 'body' | 'ribs' | 'stem' | 'print';

export interface NumDef {
  key: keyof NumParams;
  /** URLクエリのキー（短縮） */
  q: string;
  group: GroupId;
  min: number;
  max: number;
  step: number;
  def: number;
  unit?: string;
  /** 「More」に畳む */
  advanced?: boolean;
  /** UI に出さない（プリセット・URL からのみ変わる） */
  hidden?: boolean;
  int?: boolean;
}

export const NUM_DEFS: NumDef[] = [
  { key: 'diameter', q: 'D', group: 'body', min: 60, max: 240, step: 1, def: 120, unit: 'mm' },
  { key: 'height', q: 'H', group: 'body', min: 0.8, max: 2.6, step: 0.01, def: 1.4 },
  { key: 'wobble', q: 'wb', group: 'body', min: 0, max: 0.12, step: 0.005, def: 0.01, advanced: true },
  { key: 'superE', q: 'e', group: 'body', min: 1.6, max: 4, step: 0.05, def: 2.3, advanced: true },
  { key: 'egg', q: 'k', group: 'body', min: -0.3, max: 0.3, step: 0.01, def: 0.05, advanced: true },
  { key: 'dimpleDepth', q: 'dd', group: 'body', min: 0, max: 0.2, step: 0.005, def: 0.07, advanced: true },
  { key: 'flat', q: 'fl', group: 'body', min: 0.35, max: 0.7, step: 0.01, def: 0.45, advanced: true },
  { key: 'seed', q: 's', group: 'body', min: 1, max: 9999, step: 1, def: 1031, int: true, advanced: true },
  { key: 'dimpleWidth', q: 'dw', group: 'body', min: 0.15, max: 0.8, step: 0.01, def: 0.35, hidden: true },

  { key: 'ribs', q: 'N', group: 'ribs', min: 4, max: 24, step: 1, def: 10, int: true },
  { key: 'ribDepth', q: 'rd', group: 'ribs', min: 0, max: 0.25, step: 0.005, def: 0.09 },
  { key: 'twist', q: 't', group: 'ribs', min: -120, max: 120, step: 1, def: 0, unit: '°', advanced: true },
  { key: 'ribSharp', q: 'p', group: 'ribs', min: 0.3, max: 4, step: 0.05, def: 1.0, advanced: true },
  { key: 'ribJitter', q: 'j', group: 'ribs', min: 0, max: 0.15, step: 0.005, def: 0.04, advanced: true },
  { key: 'ribSkew', q: 'sk', group: 'ribs', min: 0.5, max: 2, step: 0.01, def: 1, hidden: true },
  { key: 'ribFade', q: 'q', group: 'ribs', min: 0.1, max: 3, step: 0.05, def: 0.7, hidden: true },

  { key: 'stemHeight', q: 'sh', group: 'stem', min: 0.05, max: 0.45, step: 0.005, def: 0.2, advanced: true },
  { key: 'stemBend', q: 'sb', group: 'stem', min: 0, max: 0.8, step: 0.01, def: 0.3, advanced: true },
  { key: 'stemRadius', q: 'sr', group: 'stem', min: 0.04, max: 0.18, step: 0.002, def: 0.09, advanced: true },
  { key: 'stemTwist', q: 'sw', group: 'stem', min: -180, max: 180, step: 1, def: 40, unit: '°', advanced: true },
  { key: 'stemTaper', q: 'st', group: 'stem', min: 0, max: 0.7, step: 0.01, def: 0.3, hidden: true },
  { key: 'stemSides', q: 'sn', group: 'stem', min: 4, max: 9, step: 1, def: 5, int: true, hidden: true },
  { key: 'stemStar', q: 'ss', group: 'stem', min: 0, max: 0.45, step: 0.01, def: 0.15, hidden: true },
  { key: 'stemFlare', q: 'sf', group: 'stem', min: 0, max: 1, step: 0.01, def: 0.5, hidden: true },

  { key: 'arch', q: 'ar', group: 'print', min: 0, max: 1, step: 1, def: 1, int: true, hidden: true },
  { key: 'bridge', q: 'br', group: 'print', min: 1.5, max: 5, step: 0.1, def: 2, unit: 'mm', hidden: true },

  { key: 'wall', q: 'w', group: 'print', min: 1.2, max: 4, step: 0.1, def: 1.6, unit: 'mm' },
  { key: 'led', q: 'L', group: 'print', min: 40, max: 80, step: 1, def: 44, unit: 'mm' },
  { key: 'floor', q: 'fb', group: 'print', min: 1.2, max: 5, step: 0.1, def: 2, unit: 'mm', hidden: true },
];

/** 上半分の高さの割合（残りが下半分） */
export const TOP_SHARE = 0.515;

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
  return { ...p, stemAttach: 'fused', face: defaultFace() };
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
