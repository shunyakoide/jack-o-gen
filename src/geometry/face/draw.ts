// 手描きの線を、閉じたなめらかな多角形にする（展開図 mm 座標）。

import type { Pt } from './presets';

/** 描いた形の点数の上限（URL の長さと CSG の重さのため） */
export const MAX_DRAW_PTS = 48;
/** 幅・高さがこれ未満の形は穴として成り立たないので捨てる [mm] */
export const MIN_DRAW_SIZE = 4;

/** 閉じた多角形の角を Chaikin 法で丸める */
function chaikin(poly: Pt[]): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < poly.length; i++) {
    const [x0, y0] = poly[i];
    const [x1, y1] = poly[(i + 1) % poly.length];
    out.push([0.75 * x0 + 0.25 * x1, 0.75 * y0 + 0.25 * y1], [0.25 * x0 + 0.75 * x1, 0.25 * y0 + 0.75 * y1]);
  }
  return out;
}

/** Ramer–Douglas–Peucker（開いた折れ線、両端は残す） */
function rdp(pts: Pt[], tol: number): Pt[] {
  if (pts.length < 3) return pts;
  const [ax, ay] = pts[0];
  const [bx, by] = pts[pts.length - 1];
  const len = Math.hypot(bx - ax, by - ay) || 1;
  let far = 0;
  let at = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = Math.abs((bx - ax) * (ay - pts[i][1]) - (ax - pts[i][0]) * (by - ay)) / len;
    if (d > far) [far, at] = [d, i];
  }
  if (far <= tol) return [pts[0], pts[pts.length - 1]];
  return [...rdp(pts.slice(0, at + 1), tol).slice(0, -1), ...rdp(pts.slice(at), tol)];
}

/**
 * なぞった点列 → 閉じてなめらかにし、MAX_DRAW_PTS 点以下に間引いた多角形。小さすぎれば null
 */
export function finishStroke(raw: Pt[]): Pt[] | null {
  if (raw.length < 3) return null;
  const xs = raw.map((p) => p[0]);
  const ys = raw.map((p) => p[1]);
  if (Math.max(...xs) - Math.min(...xs) < MIN_DRAW_SIZE || Math.max(...ys) - Math.min(...ys) < MIN_DRAW_SIZE) return null;
  const smooth = chaikin(chaikin(raw));
  // 閉じた形は始点と終点が重なり RDP が効かないので、始点からいちばん遠い点で 2 本の折れ線に分ける
  let far = 0;
  for (let i = 1; i < smooth.length; i++) {
    if (Math.hypot(smooth[i][0] - smooth[0][0], smooth[i][1] - smooth[0][1]) > Math.hypot(smooth[far][0] - smooth[0][0], smooth[far][1] - smooth[0][1])) far = i;
  }
  // 許容誤差を広げながら上限点数まで間引く
  for (let tol = 0.3; ; tol *= 1.4) {
    const out = [...rdp(smooth.slice(0, far + 1), tol).slice(0, -1), ...rdp([...smooth.slice(far), smooth[0]], tol).slice(0, -1)];
    if (out.length <= MAX_DRAW_PTS) return out;
  }
}

/** 左右対称モードで反対側に鏡像を出すか（中心線をまたがない形だけ） */
export function crossesCenter(poly: Pt[]): boolean {
  return poly.some((p) => p[0] < 0) && poly.some((p) => p[0] > 0);
}

export const mirrorX = (poly: Pt[]): Pt[] => poly.map(([x, y]): Pt => [-x, y]).reverse();
