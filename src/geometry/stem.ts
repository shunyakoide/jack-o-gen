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

export function buildStem(p: Params, zTop: number, fine: boolean): TriMesh {
  const D = p.diameter;
  const r0 = p.stemRadius * D * 0.5;
  const sink = Math.max(3, r0 * 0.6 + p.dimpleDepth * D * 0.15);
  const H = p.stemHeight * D + sink;
  const z0 = zTop - sink;
  const ts = sink / H; // 本体表面の位置（パス上の比率）
  const bend = p.stemBend;
  const dir = hash01(p.seed, 55) * Math.PI * 2;

  const ctrl = [
    [0, 0, z0],
    [0, 0, z0 + H * 0.45],
    [bend * H * 0.3, 0, z0 + H * 0.85],
    [bend * H * 0.85, 0, z0 + H * (1 - 0.3 * bend)],
  ];
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
    const above = Math.max(0, t - ts) / (1 - ts);
    const flare = 1 + p.stemFlare * 0.9 * Math.exp(-((above / 0.14) ** 2));
    const r = r0 * (1 - p.stemTaper * above) * flare;
    const tw = twist * above;
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

/** ヘタ先端の高さ（造形高さの見積もり用） */
export function stemTopZ(p: Params, zTop: number): number {
  const D = p.diameter;
  const r0 = p.stemRadius * D * 0.5;
  const sink = Math.max(3, r0 * 0.6 + p.dimpleDepth * D * 0.15);
  const H = p.stemHeight * D + sink;
  return zTop - sink + H * (1 - 0.3 * p.stemBend);
}
