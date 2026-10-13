// 顔パーツの 2D プリセット。単位正方形 [-1,1]² 内、y が上。
// holes = 切り抜く領域、islands = 穴の内側に残す島（瞳など）。すべて CCW。

import type { PartKind } from '../../model/params';

export type Pt = [number, number];
export interface PartShape {
  holes: Pt[][];
  islands: Pt[][];
}

export interface PresetDef {
  id: string;
  kind: PartKind;
  make: () => PartShape;
}

function ellipse(cx: number, cy: number, rx: number, ry: number, n = 40): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = (2 * Math.PI * i) / n;
    out.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]);
  }
  return out;
}

/** 三角波 0..1..0（n 山） */
function tri(x: number, n: number): number {
  const f = (x * n) % 1;
  return 1 - Math.abs(2 * f - 1);
}

/** 三日月形の口。上辺・下辺に歯（toothTop/toothBottom 本）を付けられる */
function crescentMouth(opts: { thick: number; teethTop: number; teethBottom: number; toothH: number }): Pt[] {
  const n = 120;
  const yt = (x: number) => 1 - opts.thick + opts.thick * x * x;
  const yb = (x: number) => -1 + 2 * x * x;
  const toothEnv = (x: number) => Math.max(0, 1 - (x / 0.78) ** 2);
  const lower: Pt[] = [];
  const upper: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const x = -1 + (2 * i) / n;
    const u = (x + 0.78) / 1.56;
    const inRange = u > 0 && u < 1;
    let b = yb(x);
    let t = Math.max(b, yt(x));
    if (inRange && opts.teethBottom > 0) b += opts.toothH * toothEnv(x) * tri(u, opts.teethBottom);
    if (inRange && opts.teethTop > 0) t -= opts.toothH * toothEnv(x) * tri(u + 0.5 / opts.teethTop, opts.teethTop);
    if (t < b) t = b;
    lower.push([x, b]);
    upper.push([x, t]);
  }
  // 下辺を左→右、上辺を右→左（CCW）
  const pts = [...lower, ...upper.reverse().slice(1, -1)];
  return pts;
}

export const PRESETS: PresetDef[] = [
  // 目
  { id: 'triangle', kind: 'eye', make: () => ({ holes: [[[-1, -1], [1, -1], [0, 1]]], islands: [] }) },
  { id: 'round', kind: 'eye', make: () => ({ holes: [ellipse(0, 0, 1, 1)], islands: [] }) },
  {
    id: 'angry',
    kind: 'eye',
   
    make: () => ({ holes: [[[-1, -0.7], [0.7, -1], [1, 0.3], [-0.9, 1]]], islands: [] }),
  },
  {
    id: 'happy',
    kind: 'eye',
   
    make: () => {
      const outer: Pt[] = [];
      const inner: Pt[] = [];
      for (let i = 0; i <= 24; i++) {
        const a = (Math.PI * i) / 24;
        outer.push([Math.cos(a), -1 + 2 * Math.sin(a)]);
        inner.push([0.5 * Math.cos(a), -1 + 1.05 * Math.sin(a)]);
      }
      return { holes: [[...outer, ...inner.reverse()]], islands: [] };
    },
  },
  {
    id: 'pupil',
    kind: 'eye',
   
    make: () => ({ holes: [ellipse(0, 0, 1, 1)], islands: [ellipse(0.12, -0.1, 0.38, 0.38, 24)] }),
  },
  { id: 'diamond', kind: 'eye', make: () => ({ holes: [[[0, -1], [1, 0], [0, 1], [-1, 0]]], islands: [] }) },
  { id: 'none', kind: 'eye', make: () => ({ holes: [], islands: [] }) },

  // 鼻
  { id: 'triangle', kind: 'nose', make: () => ({ holes: [[[-1, -1], [1, -1], [0, 1]]], islands: [] }) },
  { id: 'down', kind: 'nose', make: () => ({ holes: [[[0, -1], [1, 1], [-1, 1]]], islands: [] }) },
  { id: 'round', kind: 'nose', make: () => ({ holes: [ellipse(0, 0, 1, 1, 28)], islands: [] }) },
  { id: 'none', kind: 'nose', make: () => ({ holes: [], islands: [] }) },

  // 口
  {
    id: 'jagged',
    kind: 'mouth',
   
    make: () => ({ holes: [crescentMouth({ thick: 0.75, teethTop: 3, teethBottom: 2, toothH: 0.42 })], islands: [] }),
  },
  {
    id: 'smile',
    kind: 'mouth',
   
    make: () => ({ holes: [crescentMouth({ thick: 0.7, teethTop: 0, teethBottom: 0, toothH: 0 })], islands: [] }),
  },
  {
    id: 'fangs',
    kind: 'mouth',
   
    make: () => ({ holes: [crescentMouth({ thick: 0.85, teethTop: 2, teethBottom: 0, toothH: 0.6 })], islands: [] }),
  },
  {
    id: 'grin',
    kind: 'mouth',
   
    make: () => {
      const hole = ellipse(0, 0, 1, 0.75, 56);
      const teeth: Pt[][] = [];
      for (let i = 0; i < 4; i++) {
        const cx = -0.54 + i * 0.36;
        teeth.push([[cx - 0.12, -0.25], [cx + 0.12, -0.25], [cx + 0.12, 0.3], [cx - 0.12, 0.3]]);
      }
      return { holes: [hole], islands: teeth };
    },
  },
  { id: 'o', kind: 'mouth', make: () => ({ holes: [ellipse(0, 0, 0.75, 1, 40)], islands: [] }) },
  { id: 'none', kind: 'mouth', make: () => ({ holes: [], islands: [] }) },
];

export function presetsFor(kind: PartKind): PresetDef[] {
  return PRESETS.filter((p) => p.kind === kind);
}

export function findPreset(kind: PartKind, id: string): PresetDef {
  return PRESETS.find((p) => p.kind === kind && p.id === id) ?? PRESETS.find((p) => p.kind === kind)!;
}
