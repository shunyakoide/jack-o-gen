// ヘタ：五角形〜星形の断面をベジェ曲線に沿ってテーパーとねじれを付けながらスイープする。

import type { Params } from '../model/params';
import { hash01 } from './rng';

export interface TriMesh {
  positions: Float32Array;
  indices: Uint32Array;
}

/** 断面の半径関数（単位円基準）。star=0 で正多角形、大きいほど辺の中央がくぼむ */
export function stemSection(sides: number, star: number, samples: number): number[] {
  const out: number[] = [];
  const seg = (2 * Math.PI) / sides;
  for (let k = 0; k < samples; k++) {
    const a = (2 * Math.PI * k) / samples;
    const local = (a % seg) - seg / 2;
    const poly = Math.cos(seg / 2) / Math.cos(local);
    const starTerm = 1 - star * (1 - Math.abs(Math.cos((sides * a) / 2)));
    out.push(poly * starTerm);
  }
  return out;
}

function bezier(p: number[][], t: number): number[] {
  const u = 1 - t;
  const w = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
  return [0, 1, 2].map((k) => w[0] * p[0][k] + w[1] * p[1][k] + w[2] * p[2][k] + w[3] * p[3][k]);
}

function bezierTangent(p: number[][], t: number): number[] {
  const u = 1 - t;
  const w = [-3 * u * u, 3 * u * u - 6 * u * t, 6 * u * t - 3 * t * t, 3 * t * t];
  const v = [0, 1, 2].map((k) => w[0] * p[0][k] + w[1] * p[1][k] + w[2] * p[2][k] + w[3] * p[3][k]);
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return v.map((x) => x / l);
}

/** ヘタの芯線（ベジェ制御点）と寸法。buildStem と差し込み穴の計算で共有する */
function stemFrame(p: Params, zTop: number) {
  const D = p.diameter;
  const r0 = p.stemRadius * D * 0.5;
  const sink = Math.max(3, r0 * 0.6 + p.dimpleDepth * D * 0.15);
  const H = p.stemHeight * D + sink;
  const z0 = zTop - sink;
  const bend = p.stemBend;
  const ctrl = [
    [0, 0, z0],
    [0, 0, z0 + H * 0.45],
    [bend * H * 0.3, 0, z0 + H * 0.85],
    [bend * H * 0.85, 0, z0 + H * (1 - 0.3 * bend)],
  ];
  const ts = sink / H; // 本体表面の位置（パス上の比率）
  /** パス上の比率 t での断面の拡大率（単位断面 → mm） */
  const radius = (t: number) => {
    const above = Math.max(0, t - ts) / (1 - ts);
    const flare = 1 + p.stemFlare * 0.9 * Math.exp(-((above / 0.14) ** 2));
    return r0 * (1 - p.stemTaper * above) * flare;
  };
  return { ctrl, ts, radius, z1: ctrl[3][2] };
}

export function buildStem(p: Params, zTop: number, fine: boolean): TriMesh {
  const { ctrl, ts, radius } = stemFrame(p, zTop);
  const dir = hash01(p.seed, 55) * Math.PI * 2;
  const K = fine ? p.stemSides * 12 : p.stemSides * 6;
  const S = fine ? 48 : 18;
  const sec = stemSection(p.stemSides, p.stemStar, K);
  const twist = (p.stemTwist * Math.PI) / 180;
  const cd = Math.cos(dir);
  const sd = Math.sin(dir);

  const nv = (S + 1) * K + 2;
  const pos = new Float32Array(nv * 3);
  const put = (v: number, x: number, y: number, z: number) => {
    // 曲がり方向へ z 軸まわりに回転
    pos[v * 3] = x * cd - y * sd;
    pos[v * 3 + 1] = x * sd + y * cd;
    pos[v * 3 + 2] = z;
  };
  for (let s = 0; s <= S; s++) {
    const t = s / S;
    const c = bezier(ctrl, t);
    const T = bezierTangent(ctrl, t);
    // B = +Y（パスは XZ 平面内）、N = B × T
    const N = [T[2], 0, -T[0]];
    const r = radius(t);
    const tw = (twist * Math.max(0, t - ts)) / (1 - ts);
    for (let k = 0; k < K; k++) {
      const a = (2 * Math.PI * k) / K + tw;
      const rr = r * sec[k];
      const ca = Math.cos(a) * rr;
      const sa = Math.sin(a) * rr;
      put(s * K + k, c[0] + N[0] * ca, c[1] + sa, c[2] + N[2] * ca);
    }
  }
  const base = (S + 1) * K;
  const top = base + 1;
  const c0 = bezier(ctrl, 0);
  const c1 = bezier(ctrl, 1);
  put(base, c0[0], c0[1], c0[2]);
  put(top, c1[0], c1[1], c1[2]);

  const tris: number[] = [];
  const at = (s: number, k: number) => s * K + (k % K);
  for (let s = 0; s < S; s++) {
    for (let k = 0; k < K; k++) {
      const a = at(s, k), b = at(s, k + 1), c = at(s + 1, k + 1), d = at(s + 1, k);
      tris.push(a, b, d, b, c, d);
    }
  }
  for (let k = 0; k < K; k++) {
    tris.push(base, at(0, k + 1), at(0, k));
    tris.push(top, at(S, k), at(S, k + 1));
  }
  return { positions: pos, indices: new Uint32Array(tris) };
}

// はめ合いの寸法 [mm]。試し刷りの結果に合わせて調整するのはここだけ
export const FIT = {
  /** ピンと穴の半径方向のすき間（押し込み嵌合） */
  pinClear: 0.15,
  /** ヘタの足元外形と本体の座ぐりの半径方向のすき間 */
  seatGap: 0.8,
  /** 穴の深さの余裕（ピン先端より奥） */
  holeExtra: 0.6,
  /** ヘタ側の穴の入口の 45° 面取り（1 層目のつぶれ＝エレファントフット対策） */
  chamfer: 0.4,
  /** 穴のまわりに残すヘタの肉厚（0.4 mm ノズルで 2 周） */
  minWall: 0.8,
  /** ピン半径の上限・下限 */
  pinMax: 3,
  pinMin: 1.2,
};

/** 座ぐりの半径：本体表面の位置ではフレアが最大（1 + 0.9·flare） */
export function stemSeatRadius(p: Params): number {
  const sec = stemSection(p.stemSides, p.stemStar, p.stemSides * 12);
  return p.stemRadius * p.diameter * 0.5 * (1 + p.stemFlare * 0.9) * Math.max(...sec) + FIT.seatGap;
}

/**
 * 差し込みピンの半径 rp・高さ hp [mm]。座面 zSeat から穴の上端（＋天井 minWall）までの各高さで、
 * ヘタ断面の内接半径（テーパー・星形込み）から曲がりによる芯のずれを引き、穴＋面取り＋minWall が収まる最大の rp を選ぶ。
 * 既定の長さで pinMin が入らなければ短くして試し、それでも入らなければ fits=false（最小ピンで出力）
 */
export function stemPin(p: Params, zTop: number, zSeat: number): { rp: number; hp: number; fits: boolean } {
  const { ctrl, radius, z1 } = stemFrame(p, zTop);
  const inR = Math.min(...stemSection(p.stemSides, p.stemStar, p.stemSides * 12));
  // 芯線を細かくたどって (z, 軸から外形までの最短距離) を集める。断面の傾きは無視（水平断面は傾けた断面より太いので安全側）
  const prof: [number, number][] = [];
  for (let i = 0; i <= 400; i++) {
    const t = i / 400;
    const c = bezier(ctrl, t);
    prof.push([c[2], radius(t) * inR - Math.abs(c[0])]);
  }
  // メッシュの折れ線近似で細る分の余裕
  const margin = 0.05;
  const rpFor = (hp: number) => {
    const top = zSeat + hp + FIT.holeExtra;
    if (top + FIT.minWall > z1) return -Infinity;
    let rp = FIT.pinMax;
    for (const [z, d] of prof) {
      if (z < zSeat || z > top + FIT.minWall) continue;
      const ch = Math.max(0, FIT.chamfer - (z - zSeat));
      rp = Math.min(rp, d - margin - FIT.minWall - FIT.pinClear - ch);
    }
    return rp;
  };
  const hp0 = Math.min(6, 0.4 * p.stemHeight * p.diameter);
  for (let hp = hp0; hp >= Math.min(hp0, 2); hp -= 0.5) {
    const rp = rpFor(hp);
    if (rp >= FIT.pinMin) return { rp, hp, fits: true };
  }
  return { rp: FIT.pinMin, hp: Math.min(hp0, 2), fits: false };
}
