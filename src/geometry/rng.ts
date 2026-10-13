// シード付きの決定的な乱数・ノイズ。

/** 整数ハッシュ → [0,1) */
export function hash01(seed: number, i: number, j = 0): number {
  let h = (seed | 0) ^ Math.imul(i | 0, 0x9e3779b1) ^ Math.imul(j | 0, 0x85ebca77);
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** [-1,1) */
export function hashSigned(seed: number, i: number, j = 0): number {
  return hash01(seed, i, j) * 2 - 1;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 球面上の低周波ノイズ（数個の正弦波の和）。θ方向は周期的なので継ぎ目が出ない。
 * 戻り値はおおよそ [-1,1]。
 */
export function sphereNoise(seed: number, theta: number, phi: number): number {
  let s = 0;
  let norm = 0;
  for (let m = 1; m <= 3; m++) {
    const a = 1 / m;
    const p1 = hash01(seed, 101, m) * Math.PI * 2;
    const p2 = hash01(seed, 202, m) * Math.PI * 2;
    s += a * Math.sin(m * theta + p1) * Math.cos((m + 1) * phi * 0.5 + p2);
    norm += a;
  }
  return s / norm;
}
