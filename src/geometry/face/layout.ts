// 顔パーツを展開図（mm）上の 2D 形状にまとめ、尖頭アーチ化・島のブリッジ・2D チェックを行う。

import { applySymmetry, PART_KEYS, PART_KIND, type FaceParams, type FacePart, type PartKey } from '../../model/params';
import type { CrossSection, Scope, Wasm } from '../manifold';
import { findPreset, type Pt } from './presets';

/** 顔パラメータは直径 120mm 基準の mm。実寸へはこの比で拡大縮小する */
export const FACE_REF_DIAMETER = 120;

export function partPolygons(key: PartKey, part: FacePart, scale: number): { holes: Pt[][]; islands: Pt[][] } {
  const shape = findPreset(PART_KIND[key], part.preset).make();
  const mirror = key === 'eyeR';
  const a = (part.rot * Math.PI) / 180;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const tf = (poly: Pt[]): Pt[] => {
    const out = poly.map(([u, v]): Pt => {
      const x0 = (mirror ? -u : u) * part.w * 0.5;
      const y0 = v * part.h * 0.5;
      return [(part.x + x0 * ca - y0 * sa) * scale, (part.y + x0 * sa + y0 * ca) * scale];
    });
    return mirror ? out.reverse() : out;
  };
  return { holes: shape.holes.map(tf), islands: shape.islands.map(tf) };
}

function signedArea(poly: Pt[]): number {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x0, y0] = poly[i];
    const [x1, y1] = poly[(i + 1) % poly.length];
    s += x0 * y1 - x1 * y0;
  }
  return s / 2;
}

function ccw(poly: Pt[]): Pt[] {
  return signedArea(poly) < 0 ? [...poly].reverse() : poly;
}

/**
 * 穴の天井（穴の内側が下にある、傾き 45° 未満の辺）を 45° の山形に置き換える。
 * 長い天井は幅 maxSpan ごとの連続した山（ノコギリ屋根）にする。
 */
export function archTents(contours: Pt[][], minSpan: number, maxSpan: number): Pt[][] {
  const tents: Pt[][] = [];
  for (const poly of contours) {
    const n = poly.length;
    // 島の輪郭（CW）は下からブリッジで支えるので対象外
    if (n < 3 || signedArea(poly) < 0) continue;
    const isCeil = (i: number) => {
      const [x0, y0] = poly[i];
      const [x1, y1] = poly[(i + 1) % n];
      const dx = x1 - x0;
      const dy = y1 - y0;
      return dx < 0 && Math.abs(dy) < -dx;
    };
    // 天井でない辺から走査を始め、連続する天井辺をまとめる
    let start = -1;
    for (let i = 0; i < n; i++) if (!isCeil(i)) { start = i; break; }
    const runs: Pt[][] = [];
    if (start < 0) {
      runs.push([...poly, poly[0]]);
    } else {
      let cur: Pt[] | null = null;
      for (let k = 1; k <= n; k++) {
        const i = (start + k) % n;
        if (isCeil(i)) {
          if (!cur) cur = [poly[i]];
          cur.push(poly[(i + 1) % n]);
        } else if (cur) {
          runs.push(cur);
          cur = null;
        }
      }
      if (cur) runs.push(cur);
    }
    for (const run of runs) {
      const xA = run[0][0];
      const xB = run[run.length - 1][0];
      const span = xA - xB;
      if (span < minSpan) continue;
      const pieces = Math.ceil(span / maxSpan);
      const yAt = (x: number) => {
        for (let k = 0; k < run.length - 1; k++) {
          const [x0, y0] = run[k];
          const [x1, y1] = run[k + 1];
          if (x <= x0 && x >= x1) return x0 === x1 ? y0 : y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
        }
        return run[run.length - 1][1];
      };
      for (let m = 0; m < pieces; m++) {
        const xa = xA - (span * m) / pieces;
        const xb = xA - (span * (m + 1)) / pieces;
        const A: Pt = [xa, yAt(xa)];
        const B: Pt = [xb, yAt(xb)];
        const pts: Pt[] = [A, ...run.filter(([x]) => x < xa && x > xb), B];
        // A から左上 45°、B から右上 45° の交点
        const ax = (A[1] + A[0] - B[1] + B[0]) / 2;
        const ay = B[1] + ax - B[0];
        pts.push([ax, ay + 0.05]);
        tents.push(ccw(pts));
      }
    }
  }
  return tents;
}

export interface FaceCheck {
  /** 2mm 未満の細い穴の部分の面積 [mm²] */
  thinHoleArea: number;
  /** 2mm の幅を持たない（ほぼ全体が細い）穴の数 */
  tinyHoles: number;
  /** 3mm 未満の連結部の面積 [mm²] */
  narrowBridgeArea: number;
  /** 3mm 以内に近づいて実質つながる穴の組の数 */
  mergedHoles: number;
  islands: number;
  holeCount: number;
}

export interface FaceLayout {
  /** 切り抜き形状（mm、展開図座標）。パーツがなければ null */
  cs: CrossSection | null;
  check: FaceCheck;
}

/**
 * 顔全体の 2D 形状を作る。scale は展開図 mm → 実寸 mm、checkScale は穴の内面での縮み率。
 */
export function layoutFace(
  wasm: Wasm,
  scope: Scope,
  faceIn: FaceParams,
  opts: { scale: number; arch: boolean; bridge: number; checkScale: number; minHole: number; minLink: number },
): FaceLayout {
  const { CrossSection } = wasm;
  const face = applySymmetry(faceIn);
  const parts: CrossSection[] = [];
  for (const key of PART_KEYS) {
    const { holes, islands } = partPolygons(key, face[key], opts.scale);
    if (!holes.length) continue;
    let part = scope.keep(new CrossSection(holes.map(ccw), 'NonZero'));
    if (islands.length) part = scope.keep(part.subtract(scope.keep(new CrossSection(islands.map(ccw), 'NonZero'))));
    parts.push(part);
  }
  const empty: FaceCheck = { thinHoleArea: 0, tinyHoles: 0, narrowBridgeArea: 0, mergedHoles: 0, islands: 0, holeCount: 0 };
  if (!parts.length) return { cs: null, check: empty };
  let cs = scope.keep(CrossSection.union(parts));

  if (opts.arch && !cs.isEmpty()) {
    const tents = archTents(cs.toPolygons() as Pt[][], 2.5, 8);
    if (tents.length) cs = scope.keep(cs.add(scope.keep(new CrossSection(tents, 'NonZero'))));
  }

  // 2D チェック（穴の内面での実寸に縮めて評価）
  const k = opts.checkScale;
  const scaled = scope.keep(cs.scale(k));
  const rH = opts.minHole / 2;
  const rL = opts.minLink / 2;
  const opened = scope.keep(scope.keep(scaled.offset(-rH, 'Round')).offset(rH, 'Round'));
  // 角の先端の削れ（くさび形の小片）は除外し、細い帯状の部分だけを数える
  const sliver = 0.35;
  const thinHoleArea = scope.keep(scope.keep(scaled.subtract(opened)).offset(-sliver, 'Round')).area();
  const comps = scaled.decompose();
  let tinyHoles = 0;
  for (const c of comps) {
    scope.keep(c);
    if (scope.keep(c.offset(-rH, 'Round')).isEmpty()) tinyHoles++;
  }
  const grown = scope.keep(scaled.offset(rL, 'Round'));
  const grownComps = grown.decompose();
  grownComps.forEach((c) => scope.keep(c));
  const closed = scope.keep(grown.offset(-rL, 'Round'));
  const narrowBridgeArea = scope.keep(scope.keep(closed.subtract(scaled)).offset(-sliver, 'Round')).area();

  // 島（穴の内側の材料）を、下向きのブリッジで縁とつなぐ
  let islands = 0;
  if (!cs.isEmpty()) {
    const pieces: CrossSection[] = [];
    for (const comp of cs.decompose()) {
      scope.keep(comp);
      const polys = comp.toPolygons() as Pt[][];
      const b = comp.bounds();
      let c = comp;
      for (const poly of polys) {
        if (signedArea(poly) >= 0) continue;
        islands++;
        let cx = 0;
        let cy = 0;
        for (const [x, y] of poly) {
          cx += x;
          cy += y;
        }
        cx /= poly.length;
        cy /= poly.length;
        const w = opts.bridge * 0.5;
        const strip: Pt[] = [
          [cx - w, b.min[1] - 1],
          [cx + w, b.min[1] - 1],
          [cx + w, cy],
          [cx - w, cy],
        ];
        c = scope.keep(c.subtract(scope.keep(new CrossSection([strip]))));
      }
      pieces.push(c);
    }
    cs = scope.keep(CrossSection.union(pieces));
  }

  return {
    cs,
    check: {
      thinHoleArea,
      tinyHoles,
      narrowBridgeArea,
      mergedHoles: Math.max(0, comps.length - grownComps.length),
      islands,
      holeCount: comps.length,
    },
  };
}

/** 辺を maxLen 以下に分割する（放射投影で曲面に沿わせるため） */
export function subdivide(poly: Pt[], maxLen: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / maxLen));
    for (let k = 0; k < n; k++) out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
  }
  return out;
}
