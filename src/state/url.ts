// 全パラメータを URL クエリに入れる／URL から読む。
import {
  clampNum,
  defaultParams,
  NUM_DEFS,
  PART_KEYS,
  type FacePart,
  type FaceParams,
  type Params,
} from '../model/params';

const r1 = (v: number) => Math.round(v * 10) / 10;
const fmt = (v: number) => String(+v.toFixed(4));

function encodePart(p: FacePart): string {
  return [p.preset, r1(p.x), r1(p.y), r1(p.w), r1(p.h), r1(p.rot)].join(',');
}

function decodePart(s: string | undefined, def: FacePart): FacePart {
  if (!s) return def;
  const [preset, ...nums] = s.split(',');
  const n = nums.map(Number);
  const ok = (v: number, d: number, lo: number, hi: number) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
  return {
    preset: /^[a-z]+$/.test(preset) ? preset : def.preset,
    x: ok(n[0], def.x, -120, 120),
    y: ok(n[1], def.y, -90, 90),
    w: ok(n[2], def.w, 3, 120),
    h: ok(n[3], def.h, 3, 120),
    rot: ok(n[4], def.rot, -180, 180),
  };
}

export function encodeParams(p: Params): string {
  const q = new URLSearchParams();
  // 既定値と同じ項目は省いて URL を短くする
  for (const d of NUM_DEFS) if (fmt(p[d.key]) !== fmt(d.def)) q.set(d.q, fmt(p[d.key]));
  q.set('m', p.mode === 'lantern' ? 'l' : 's');
  q.set('f', [p.face.symmetric ? '1' : '0', ...PART_KEYS.map((k) => encodePart(p.face[k]))].join('_'));
  return q.toString();
}

export function decodeParams(search: string): Params | null {
  const q = new URLSearchParams(search);
  if (![...q.keys()].length) return null;
  const p = defaultParams();
  for (const d of NUM_DEFS) {
    const v = q.get(d.q);
    if (v !== null) (p as unknown as Record<string, number>)[d.key] = clampNum(d, Number(v));
  }
  if (q.get('m') === 's') p.mode = 'sealed';
  const f = q.get('f');
  if (f) {
    const parts = f.split('_');
    const face: FaceParams = { ...p.face, symmetric: parts[0] !== '0' };
    PART_KEYS.forEach((k, i) => (face[k] = decodePart(parts[i + 1], p.face[k])));
    p.face = face;
  }
  return p;
}
