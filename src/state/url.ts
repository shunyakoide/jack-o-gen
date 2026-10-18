// 全パラメータを URL クエリに入れる／URL から読む。
import { clampFace } from '../geometry/face/layout';
import {
  clampNum,
  defaultFace,
  defaultParams,
  MAX_DRAWN,
  NUM_DEFS,
  PART_KEYS,
  type DrawnPart,
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

// 描いた形：x,y,w,h,rot,鏡像,線の太さ,点（int8 の組を base64url）。形どうしは '*'（URL でエスケープされず、数値の小数点とも重ならない）で区切る
const MAX_PTS = 48;

function encodeDrawn(d: DrawnPart): string {
  const bytes = Uint8Array.from(d.pts.flat(), (v) => Math.round(Math.max(-1, Math.min(1, v)) * 127) & 0xff);
  const b64 = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return [r1(d.x), r1(d.y), r1(d.w), r1(d.h), r1(d.rot), d.mirror ? 1 : 0, r1(d.line), b64].join(',');
}

function decodeDrawn(s: string): DrawnPart | null {
  const f = s.split(',');
  if (f.length !== 8) return null;
  const n = f.slice(0, 7).map(Number);
  if (!n.every(Number.isFinite)) return null;
  let bin: string;
  try {
    bin = atob(f[7].replace(/-/g, '+').replace(/_/g, '/'));
  } catch {
    return null;
  }
  const v = Array.from(bin, (c) => ((c.charCodeAt(0) << 24) >> 24) / 127);
  const pts: [number, number][] = [];
  for (let i = 0; i + 1 < v.length && pts.length < MAX_PTS; i += 2) pts.push([v[i], v[i + 1]]);
  const line = Math.min(20, Math.max(0, n[6]));
  if (pts.length < (line > 0 ? 2 : 3)) return null;
  const c = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
  return { x: c(n[0], -120, 120), y: c(n[1], -90, 90), w: c(n[2], 1, 120), h: c(n[3], 1, 120), rot: c(n[4], -180, 180), mirror: n[5] === 1, line, pts };
}

const encodeFace = (f: FaceParams) => [f.symmetric ? '1' : '0', ...PART_KEYS.map((k) => encodePart(f[k]))].join('_');
const DEFAULT_FACE = encodeFace(defaultFace());

export function encodeParams(p: Params): string {
  const q = new URLSearchParams();
  // 既定値と同じ項目は省いて URL を短くする
  for (const d of NUM_DEFS) if (fmt(p[d.key]) !== fmt(d.def)) q.set(d.q, fmt(p[d.key]));
  if (p.stemAttach === 'peg') q.set('a', 'p');
  if (p.faceStyle === 'inlay') q.set('fs', 'i');
  const f = encodeFace(p.face);
  if (f !== DEFAULT_FACE) q.set('f', f);
  if (p.face.drawn.length) q.set('d', p.face.drawn.map(encodeDrawn).join('*'));
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
  if (q.get('a') === 'p') p.stemAttach = 'peg';
  if (q.get('fs') === 'i') p.faceStyle = 'inlay';
  const f = q.get('f');
  if (f) {
    const parts = f.split('_');
    const face: FaceParams = { ...p.face, symmetric: parts[0] !== '0' };
    PART_KEYS.forEach((k, i) => (face[k] = decodePart(parts[i + 1], p.face[k])));
    p.face = face;
  }
  const d = q.get('d');
  if (d) p.face = { ...p.face, drawn: d.split('*').slice(0, MAX_DRAWN).map(decodeDrawn).filter((x): x is DrawnPart => !!x) };
  p.face = clampFace(p);
  return p;
}
