// プリセットカード。
import { clampNum, defaultFace, defaultParams, NUM_DEFS, type FaceParams, type Params } from '../model/params';
import { mulberry32 } from '../geometry/rng';

export interface PresetCard {
  id: string;
  label: string;
  hint: string;
  make: (seed: number) => Params;
}

function withFace(face: Partial<FaceParams>): FaceParams {
  return { ...defaultFace(), ...face };
}

export const PRESET_CARDS: PresetCard[] = [
  {
    id: 'classic',
    label: 'クラシック',
    hint: '定番のジャック・オー・ランタン',
    make: () => defaultParams(),
  },
  {
    id: 'ghost',
    label: 'おばけ',
    hint: '縦長で少し歪んだ形',
    make: () => ({
      ...defaultParams(),
      topH: 1.15, bottomH: 0.95, egg: 0.12, wobble: 0.06, superE: 2.0,
      ribs: 8, ribDepth: 0.06, ribSharp: 1.6, twist: 25, ribJitter: 0.1,
      stemHeight: 0.16, stemBend: 0.55, stemRadius: 0.06, stemTwist: 70,
      diameter: 100,
      face: withFace({
        eyeL: { preset: 'round', x: -18, y: 22, w: 18, h: 26, rot: 0 },
        nose: { preset: 'none', x: 0, y: 0, w: 10, h: 10, rot: 0 },
        mouth: { preset: 'o', x: 0, y: -14, w: 20, h: 32, rot: 0 },
      }),
    }),
  },
  {
    id: 'flat',
    label: '平たい坊ちゃん',
    hint: 'つぶれた丸い形',
    make: () => ({
      ...defaultParams(),
      topH: 0.5, bottomH: 0.5, superE: 2.6, ribs: 12, ribDepth: 0.11, ribSharp: 2.2,
      dimpleDepth: 0.06, stemHeight: 0.1, stemRadius: 0.1, stemTaper: 0.15, stemBend: 0.1,
      diameter: 140, flat: 0.55,
      face: withFace({
        eyeL: { preset: 'happy', x: -26, y: 7, w: 22, h: 13, rot: 0 },
        nose: { preset: 'none', x: 0, y: 0, w: 10, h: 10, rot: 0 },
        mouth: { preset: 'smile', x: 0, y: -10, w: 56, h: 16, rot: 0 },
      }),
    }),
  },
  {
    id: 'kiku',
    label: '和風菊座',
    hint: '細かい筋と深い菊座',
    make: () => ({
      ...defaultParams(),
      topH: 0.62, bottomH: 0.6, superE: 2.8, ribs: 18, ribDepth: 0.07, ribSharp: 0.55, ribFade: 0.4,
      dimpleDepth: 0.13, dimpleWidth: 0.45, stemSides: 6, stemStar: 0.3, stemHeight: 0.12,
      stemRadius: 0.075, stemTaper: 0.2, stemBend: 0.15, stemTwist: 20,
      face: withFace({
        eyeL: { preset: 'angry', x: -24, y: 11, w: 22, h: 14, rot: 0 },
        nose: { preset: 'down', x: 0, y: -1, w: 10, h: 8, rot: 0 },
        mouth: { preset: 'fangs', x: 0, y: -17, w: 56, h: 18, rot: 0 },
      }),
    }),
  },
  {
    id: 'random',
    label: 'ランダム',
    hint: '押すたびに違う形',
    make: (seed) => {
      const rnd = mulberry32(seed);
      const base = defaultParams();
      const pick = <T,>(arr: T[]) => arr[Math.floor(rnd() * arr.length)];
      const out: Params = { ...base, seed: Math.floor(rnd() * 9000) + 1 };
      const rand = (lo: number, hi: number) => lo + (hi - lo) * rnd();
      const half = (lo: number, hi: number) => Math.round(rand(lo, hi) * 2) / 2;
      Object.assign(out, {
        topH: rand(0.5, 1.1), bottomH: rand(0.5, 0.95), superE: rand(1.9, 3), egg: rand(-0.1, 0.15),
        wobble: rand(0, 0.05), ribs: Math.round(rand(6, 18)), ribDepth: rand(0.04, 0.14),
        ribSharp: rand(0.5, 2.5), twist: rand(-40, 40), ribJitter: rand(0, 0.1),
        dimpleDepth: rand(0.03, 0.12), stemHeight: rand(0.1, 0.3), stemRadius: rand(0.05, 0.1),
        stemBend: rand(0, 0.6), stemTwist: rand(-90, 90), stemStar: rand(0, 0.35),
        stemSides: Math.round(rand(4, 7)),
      });
      for (const d of NUM_DEFS) (out as unknown as Record<string, number>)[d.key] = clampNum(d, out[d.key]);
      const eye = pick(['triangle', 'round', 'angry', 'happy', 'pupil', 'diamond']);
      const ew = half(16, 24);
      out.face = withFace({
        eyeL: { preset: eye, x: -half(20, 27), y: half(10, 18), w: ew, h: eye === 'happy' ? Math.round(ew * 1.2) / 2 : half(16, 24), rot: 0 },
        nose: { preset: pick(['triangle', 'down', 'round', 'none']), x: 0, y: half(-4, 2), w: half(9, 13), h: half(8, 12), rot: 0 },
        mouth: { preset: pick(['jagged', 'smile', 'fangs', 'grin']), x: 0, y: half(-24, -16), w: half(48, 66), h: half(18, 26), rot: 0 },
      });
      return out;
    },
  },
];
