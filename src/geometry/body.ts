// 本体外形：r(θ,φ) = R·P(φ)·(1 − d·G(u)·W(φ)) を経緯度グリッドで閉じたメッシュにする。
// 座標系：mm、z が上（造形方向）、正面は −y 方向（θ = −π/2）。

import { TOP_SHARE, type Params } from '../model/params';
import { FACE_REF_DIAMETER } from './face/layout';
import { hashSigned, sphereNoise } from './rng';

export const FRONT_THETA = -Math.PI / 2;

export interface GridMesh {
  positions: Float32Array;
  indices: Uint32Array;
  nTheta: number;
  rings: number;
}

export interface BodyInfo {
  /** 正面パーツの投影中心（最大径の高さ） */
  zCenter: number;
  /** 最大径の位置での平均半径 */
  rEq: number;
  /** 最大半径 */
  rMax: number;
  /** 接地リングの最小半径 */
  rContact: number;
  /** 天頂（くぼみの底）の z */
  zTop: number;
  height: number;
}

export interface Body extends GridMesh {
  info: BodyInfo;
}

/** 正規化半径（R=1）。θ は正面基準に回した方位角、φ は天頂からの極角 */
export function radiusFn(p: Params) {
  const N = p.ribs;
  const tau = (p.twist * Math.PI) / 180;
  const jit = p.ribJitter;
  const e = p.superE;
  // 筋の境界と深さの個体差（周期 N）
  const delta: number[] = [];
  const depthMul: number[] = [];
  for (let k = 0; k < N; k++) {
    delta.push(jit * 0.5 * hashSigned(p.seed, k, 7));
    depthMul.push(1 + jit * hashSigned(p.seed, k, 3));
  }
  const dl = (k: number) => {
    const m = ((k % N) + N) % N;
    return k + delta[m];
  };

  return (theta: number, phi: number): number => {
    const c = Math.cos(phi);
    const s = Math.sin(phi);
    const ch = p.height * (c >= 0 ? TOP_SHARE : 1 - TOP_SHARE);
    // 超楕円体（上下で高さが別）＋卵形項
    let r = 1 / Math.pow(Math.pow(Math.abs(s), e) + Math.pow(Math.abs(c / ch), e), 1 / e);
    r *= 1 + p.egg * c;
    // ヘタ周りのくぼみ
    r *= 1 - p.dimpleDepth * Math.exp(-((phi / p.dimpleWidth) ** 2));
    // 筋：u = frac(N(θ + τh(φ))/2π)、h は赤道で 0
    const h = -c * 0.5;
    const x = ((theta - FRONT_THETA + tau * h) / (2 * Math.PI)) * N;
    let k = Math.floor(x);
    if (x < dl(k)) k -= 1;
    else if (x >= dl(k + 1)) k += 1;
    const b0 = dl(k);
    const b1 = dl(k + 1);
    const u = Math.min(1, Math.max(0, (x - b0) / (b1 - b0)));
    const G = 1 - Math.pow(Math.abs(Math.cos(Math.PI * Math.pow(u, p.ribSkew))), p.ribSharp);
    const W = Math.pow(s, p.ribFade);
    const m = depthMul[((k % N) + N) % N];
    r *= 1 - p.ribDepth * m * G * W;
    // 低周波の歪み（極で 0）
    if (p.wobble > 0) r *= 1 + p.wobble * s * sphereNoise(p.seed, theta, phi);
    return r;
  };
}

export interface Resolution {
  theta: number;
  rings: number;
}

export const DRAFT_RES: Resolution = { theta: 64, rings: 28 };
export const PREVIEW_RES: Resolution = { theta: 120, rings: 56 };
export const EXPORT_RES: Resolution = { theta: 360, rings: 160 };

/** 基準径より小さいときに LED 開口を縮める比率。底の切り口を基準径のときと同じにして、直径だけで形が変わらないように */
function ledScale(p: Params): number {
  return Math.min(1, p.diameter / FACE_REF_DIAMETER);
}

/** 実際に開ける LED 開口の直径 [mm] */
export function ledHole(p: Params): number {
  return p.led * ledScale(p);
}

/** 接地径の実効値。LED 開口＋余白が収まるよう広げる（余白は基準径での値を縮めたもの。壁厚＋1 mm は必ず残す） */
export function effectiveFlat(p: Params): number {
  const s = ledScale(p);
  const need = Math.max(s * (p.led + 2 * (p.wall + 4)), ledHole(p) + 2 * p.wall + 2);
  return Math.min(0.85, Math.max(p.flat, need / p.diameter));
}

export function buildBody(p: Params, res: Resolution): Body {
  const N = p.ribs;
  // 溝の中心がサンプル点に乗るよう θ 分割数を N の倍数にする
  const nTheta = Math.max(N * 4, Math.round(res.theta / N) * N);
  const M = res.rings;
  const F = M * 4; // 子午線の細かいサンプル数
  const rf = radiusFn(p);
  // 子午線を筋のねじれに沿って回す（θ = θi + τ·cosφ/2）。溝の中心がいつも列の線に乗り、斜めの溝が階段状にならない
  const tw = ((p.twist * Math.PI) / 180) * 0.5;

  const rho: Float64Array[] = [];
  const zz: Float64Array[] = [];
  const thetas: number[] = [];
  let rMax = 0;
  for (let i = 0; i < nTheta; i++) {
    const th = FRONT_THETA + (2 * Math.PI * i) / nTheta;
    thetas.push(th);
    const R = new Float64Array(F + 1);
    const Z = new Float64Array(F + 1);
    let jm = 0;
    for (let j = 0; j <= F; j++) {
      const phi = (Math.PI * j) / F;
      const r = rf(th + tw * Math.cos(phi), phi);
      R[j] = j === 0 || j === F ? 0 : r * Math.sin(phi);
      Z[j] = r * Math.cos(phi);
      if (R[j] > R[jm]) jm = j;
    }
    // オーバーハング補正：最大径より下で |Δρ| ≤ Δz·tan45°
    const eps = 1e-5;
    for (let j = jm + 1; j <= F; j++) {
      if (Z[j] > Z[j - 1] - eps) Z[j] = Z[j - 1] - eps;
      const dz = Z[j - 1] - Z[j];
      if (R[j] < R[j - 1] - dz) R[j] = R[j - 1] - dz;
    }
    rho.push(R);
    zz.push(Z);
    rMax = Math.max(rMax, R[jm]);
  }

  // 底面カット高さ：全子午線で ρ ≥ flat·rMax を満たす最も高い z
  const target = effectiveFlat(p) * rMax;
  const cutIdx: number[] = [];
  let zCut = -Infinity;
  const crossing: number[] = [];
  for (let i = 0; i < nTheta; i++) {
    const R = rho[i];
    const Z = zz[i];
    let jm = 0;
    for (let j = 0; j <= F; j++) if (R[j] > R[jm]) jm = j;
    let zc = Z[F];
    for (let j = jm + 1; j <= F; j++) {
      if (R[j] < target) {
        const t = (R[j - 1] - target) / (R[j - 1] - R[j]);
        zc = Z[j - 1] + (Z[j] - Z[j - 1]) * t;
        break;
      }
    }
    crossing.push(zc);
    zCut = Math.max(zCut, zc);
  }
  for (let i = 0; i < nTheta; i++) {
    const R = rho[i];
    const Z = zz[i];
    let jm = 0;
    for (let j = 0; j <= F; j++) if (R[j] > R[jm]) jm = j;
    let idx = F;
    for (let j = jm + 1; j <= F; j++) {
      if (Z[j] <= zCut) {
        idx = j - 1 + (Z[j - 1] - zCut) / (Z[j - 1] - Z[j]);
        break;
      }
    }
    cutIdx.push(idx);
  }

  const scale = p.diameter / 2 / rMax;
  const nVert = 2 + M * nTheta;
  const pos = new Float32Array(nVert * 3);
  const zTopRaw = zz[0][0];
  pos[0] = 0;
  pos[1] = 0;
  pos[2] = (zTopRaw - zCut) * scale;
  let rContact = Infinity;
  let zCenterAcc = 0;
  let rEqAcc = 0;
  for (let i = 0; i < nTheta; i++) {
    const R = rho[i];
    const Z = zz[i];
    let jm = 0;
    for (let j = 0; j <= F; j++) if (R[j] > R[jm]) jm = j;
    zCenterAcc += Z[jm];
    rEqAcc += R[jm];
    // リングは断面の弧長で等分する。φ で等分すると、平らな底（45° 補正で ρ が止まり z もほぼ一定）の
    // 長さ 0 の区間にリングが潰れ、その区間の長さが子午線ごとに違うためリングの高さが隣とずれて面が折れる
    const S = new Float64Array(F + 1);
    for (let j = 1; j <= F; j++) S[j] = S[j - 1] + Math.hypot(R[j] - R[j - 1], Z[j] - Z[j - 1]);
    const c0 = Math.min(F - 1, Math.floor(cutIdx[i]));
    const len = S[c0] + (S[c0 + 1] - S[c0]) * (cutIdx[i] - c0);
    let k = 0;
    for (let j = 1; j <= M; j++) {
      const target = (len * j) / M;
      while (k < F - 1 && S[k + 1] < target) k++;
      const f = j === M ? cutIdx[i] : k + (S[k + 1] > S[k] ? (target - S[k]) / (S[k + 1] - S[k]) : 0);
      const j0 = Math.min(F - 1, Math.floor(f));
      const t = f - j0;
      const r = R[j0] + (R[j0 + 1] - R[j0]) * t;
      let z = Z[j0] + (Z[j0 + 1] - Z[j0]) * t;
      if (j === M) {
        z = zCut;
        rContact = Math.min(rContact, r);
      }
      const v = 1 + (j - 1) * nTheta + i;
      const a = thetas[i] + tw * Math.cos((Math.PI * f) / F);
      pos[v * 3] = r * Math.cos(a) * scale;
      pos[v * 3 + 1] = r * Math.sin(a) * scale;
      pos[v * 3 + 2] = (z - zCut) * scale;
    }
  }
  const bottom = nVert - 1;
  pos[bottom * 3 + 2] = 0;

  const indices = gridIndices(nTheta, M, pos);
  return {
    positions: pos,
    indices,
    nTheta,
    rings: M,
    info: {
      zCenter: (zCenterAcc / nTheta - zCut) * scale,
      rEq: (rEqAcc / nTheta) * scale,
      rMax: rMax * scale,
      rContact: rContact * scale,
      zTop: (zTopRaw - zCut) * scale,
      height: (zTopRaw - zCut) * scale,
    },
  };
}

/** 頂点0=天頂、続いて M 本のリング、最後に底面中心。外向き CCW */
function gridIndices(nTheta: number, M: number, P: Float32Array): Uint32Array {
  const d2 = (u: number, v: number) => (P[u * 3] - P[v * 3]) ** 2 + (P[u * 3 + 1] - P[v * 3 + 1]) ** 2 + (P[u * 3 + 2] - P[v * 3 + 2]) ** 2;
  const tris: number[] = [];
  const ring = (j: number, i: number) => 1 + (j - 1) * nTheta + (i % nTheta);
  for (let i = 0; i < nTheta; i++) tris.push(0, ring(1, i), ring(1, i + 1));
  for (let j = 1; j < M; j++) {
    for (let i = 0; i < nTheta; i++) {
      const a = ring(j, i);
      const b = ring(j, i + 1);
      const c = ring(j + 1, i + 1);
      const d = ring(j + 1, i);
      // 短い方の対角線で割る。ねじれた深い溝が格子を斜めに横切る所で、溝を横切る向きに割ると面が折れて筋が出る
      if (d2(b, d) <= d2(a, c)) tris.push(a, d, b, b, d, c);
      else tris.push(a, d, c, a, c, b);
    }
  }
  const bottom = 1 + M * nTheta;
  for (let i = 0; i < nTheta; i++) tris.push(bottom, ring(M, i + 1), ring(M, i));
  return new Uint32Array(tris);
}

/**
 * 法線方向に内側へ t だけ移動した殻。凹部ではマイター補正で肉厚 ≥ t を保つ。
 */
export function offsetInward(g: GridMesh, t: number): Float32Array {
  const P = g.positions;
  const I = g.indices;
  const nv = P.length / 3;
  const nrm = new Float64Array(nv * 3);
  const fn = new Float64Array(I.length); // 面法線（単位）
  for (let f = 0; f < I.length; f += 3) {
    const a = I[f] * 3;
    const b = I[f + 1] * 3;
    const c = I[f + 2] * 3;
    const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2];
    const vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1;
    fn[f] = nx / l;
    fn[f + 1] = ny / l;
    fn[f + 2] = nz / l;
    for (const v of [a, b, c]) {
      nrm[v] += nx;
      nrm[v + 1] += ny;
      nrm[v + 2] += nz;
    }
  }
  for (let v = 0; v < nv; v++) {
    const l = Math.hypot(nrm[v * 3], nrm[v * 3 + 1], nrm[v * 3 + 2]) || 1;
    nrm[v * 3] /= l;
    nrm[v * 3 + 1] /= l;
    nrm[v * 3 + 2] /= l;
  }
  const minDot = new Float64Array(nv).fill(1);
  for (let f = 0; f < I.length; f += 3) {
    for (let k = 0; k < 3; k++) {
      const v = I[f + k];
      const d = nrm[v * 3] * fn[f] + nrm[v * 3 + 1] * fn[f + 1] + nrm[v * 3 + 2] * fn[f + 2];
      if (d < minDot[v]) minDot[v] = d;
    }
  }
  const out = new Float32Array(P.length);
  for (let v = 0; v < nv; v++) {
    const k = t / Math.max(0.5, minDot[v]);
    out[v * 3] = P[v * 3] - nrm[v * 3] * k;
    out[v * 3 + 1] = P[v * 3 + 1] - nrm[v * 3 + 1] * k;
    out[v * 3 + 2] = P[v * 3 + 2] - nrm[v * 3 + 2] * k;
  }
  return out;
}
