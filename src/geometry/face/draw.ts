// 手描きの線を、閉じたなめらかな多角形にする（展開図 mm 座標）。

import type { DrawnPart, PartBox } from '../../model/params';
import type { Pt } from './presets';

/** 描いた形の点数の上限（URL の長さと CSG の重さのため） */
export const MAX_DRAW_PTS = 48;
/** 幅・高さがこれ未満の形は穴として成り立たないので捨てる [mm] */
export const MIN_DRAW_SIZE = 4;

/** 線ペンの太さ [mm、直径 120 基準]。最小の穴 2 mm に、穴の内面での縮みと印刷の誤差の余裕を足した */
export const LINE_WIDTH = 4;

/** 角を Chaikin 法で丸める（open なら両端は動かさない） */
function chaikin(poly: Pt[], open = false): Pt[] {
  const out: Pt[] = open ? [poly[0]] : [];
  for (let i = 0; i < (open ? poly.length - 1 : poly.length); i++) {
    const [x0, y0] = poly[i];
    const [x1, y1] = poly[(i + 1) % poly.length];
    out.push([0.75 * x0 + 0.25 * x1, 0.75 * y0 + 0.25 * y1], [0.25 * x0 + 0.75 * x1, 0.25 * y0 + 0.75 * y1]);
  }
  if (open) out.push(poly[poly.length - 1]);
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
export function finishStroke(rawIn: Pt[]): Pt[] | null {
  const raw = trimOvershoot(rawIn);
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

/**
 * 終わりが始点を通り過ぎた分を切る（重なった尻尾が逆向きの小さな輪になり、島や細い穴になるため）。
 * 前半の点と後半の点が CLOSE_GAP 以内に戻ってくる組のうち、輪がいちばん長くなる所で切る。戻ってこなければそのまま
 */
const CLOSE_GAP = 1.5;
function trimOvershoot(raw: Pt[]): Pt[] {
  const n = raw.length;
  const half = Math.floor(n / 2);
  let best: [number, number] | null = null;
  for (let i = 0; i < half; i++) {
    for (let j = n - 1; j >= half; j--) {
      if (best && j - i <= best[1] - best[0]) break;
      if (Math.hypot(raw[i][0] - raw[j][0], raw[i][1] - raw[j][1]) < CLOSE_GAP) {
        best = [i, j];
        break;
      }
    }
  }
  return best ? raw.slice(best[0], best[1] + 1) : raw;
}

/** なぞった点列 → なめらかな開いた折れ線。短すぎれば null */
export function finishLine(raw: Pt[]): Pt[] | null {
  if (raw.length < 2) return null;
  let len = 0;
  for (let i = 1; i < raw.length; i++) len += Math.hypot(raw[i][0] - raw[i - 1][0], raw[i][1] - raw[i - 1][1]);
  if (len < MIN_DRAW_SIZE) return null;
  const smooth = chaikin(chaikin(raw, true), true);
  for (let tol = 0.3; ; tol *= 1.4) {
    const out = rdp(smooth, tol);
    if (out.length <= MAX_DRAW_PTS) return out;
  }
}

/** 展開図 mm の点列 → 外接枠で正規化した描いた形 */
export function toDrawn(poly: Pt[], line: number, mirror: boolean): DrawnPart {
  const xs = poly.map((p) => p[0]);
  const ys = poly.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  // まっすぐな線は幅か高さがほぼ 0 になるので、正規化で割り切れるよう 1 mm を下限にする
  const w = Math.max(1, x1 - x0);
  const h = Math.max(1, y1 - y0);
  const x = (x0 + x1) / 2;
  const y = (y0 + y1) / 2;
  const q = (v: number) => Math.round(v * 127) / 127;
  return { x, y, w, h, rot: 0, mirror, line, pts: poly.map(([px, py]): Pt => [q((px - x) / (w / 2)), q((py - y) / (h / 2))]) };
}

/** 単位正方形の点を枠に置く（展開図 mm） */
export function placeBox(box: PartBox, pts: Pt[]): Pt[] {
  const a = (box.rot * Math.PI) / 180;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  return pts.map(([u, v]): Pt => {
    const x0 = u * box.w * 0.5;
    const y0 = v * box.h * 0.5;
    return [box.x + x0 * ca - y0 * sa, box.y + x0 * sa + y0 * ca];
  });
}

/** 描いた形の点列（展開図 mm）。鏡像があれば 2 本 */
export function placeDrawn(d: DrawnPart): Pt[][] {
  const p = placeBox(d, d.pts);
  return d.mirror ? [p, mirrorX(p)] : [p];
}

/** 線を、各辺の長方形と各頂点の多角形の重なりで太らせる（NonZero で塗れば和になる） */
function thicken(line: Pt[], width: number): Pt[][] {
  const r = width / 2;
  const out: Pt[][] = [];
  for (const [cx, cy] of line) {
    out.push(Array.from({ length: 12 }, (_, k): Pt => [cx + r * Math.cos((k * Math.PI) / 6), cy + r * Math.sin((k * Math.PI) / 6)]));
  }
  for (let i = 1; i < line.length; i++) {
    const [ax, ay] = line[i - 1];
    const [bx, by] = line[i];
    const l = Math.hypot(bx - ax, by - ay) || 1;
    const nx = (-(by - ay) / l) * r;
    const ny = ((bx - ax) / l) * r;
    out.push([[ax + nx, ay + ny], [ax - nx, ay - ny], [bx - nx, by - ny], [bx + nx, by + ny]]);
  }
  return out;
}

/** 描いた形の切り抜き多角形（向きはそろえていない）。scale は展開図 mm → 実寸 mm */
export function drawnPolygons(d: DrawnPart, scale: number): Pt[][] {
  const polys = placeDrawn(d).flatMap((p) => (d.line > 0 ? thicken(p, d.line) : [p]));
  return polys.map((p) => p.map(([x, y]): Pt => [x * scale, y * scale]));
}

/** 左右対称モードで反対側に鏡像を出すか（中心線をまたがない形だけ） */
export function crossesCenter(poly: Pt[]): boolean {
  return poly.some((p) => p[0] < 0) && poly.some((p) => p[0] > 0);
}

export const mirrorX = (poly: Pt[]): Pt[] => poly.map(([x, y]): Pt => [-x, y]).reverse();
