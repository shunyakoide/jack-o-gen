import { describe, expect, it } from 'vitest';
import { buildBody, PREVIEW_RES } from '../src/geometry/body';
import type { Quality } from '../src/geometry/build';
import { loadManifold } from '../src/geometry/manifold';
import { defaultParams, type Params } from '../src/model/params';
import { PRESET_CARDS } from '../src/state/presets';
import { matchStem, STEM_STYLES } from '../src/state/stems';
import { decodeParams, encodeParams } from '../src/state/url';
import { cachedBuild } from './fit-helpers';

const wasm = await loadManifold();

function summary(p: Params, q: Quality = 'preview') {
  const r = cachedBuild(wasm, p, q);
  const bad = r.checks.filter((c) => c.level !== 'green').map((c) => `${c.level}:${c.id}:${c.detail}`);
  return { r, bad };
}

describe('外形', () => {
  it('45°オーバーハング制約と接地径を満たす', () => {
    const p = defaultParams();
    const b = buildBody(p, PREVIEW_RES);
    const nt = b.nTheta;
    let worst = 0;
    for (let i = 0; i < nt; i++) {
      let prev: [number, number] | null = null;
      let maxR = 0;
      let below = false;
      for (let j = 1; j <= b.rings; j++) {
        const v = 1 + (j - 1) * nt + i;
        const r = Math.hypot(b.positions[v * 3], b.positions[v * 3 + 1]);
        const z = b.positions[v * 3 + 2];
        if (r >= maxR && !below) maxR = r;
        else below = true;
        if (below && prev) {
          const dz = prev[1] - z;
          const dr = prev[0] - r;
          if (dz > 1e-6) worst = Math.max(worst, dr / dz);
        }
        prev = [r, z];
      }
    }
    // リング間の線形補間による誤差を少し許す
    expect(worst).toBeLessThan(1.05);
    expect((b.info.rContact * 2) / (b.info.rMax * 2)).toBeGreaterThanOrEqual(0.35);
  });

  it('格子の四角形が対角線で折れない（平らな底・ねじれた深い筋）', () => {
    const random = PRESET_CARDS.find((c) => c.id === 'random')!;
    const shapes = [...PRESET_CARDS.filter((c) => c.id !== 'random').map((c) => c.make(1)), random.make(4 * 7919), random.make(11 * 7919)];
    for (const p of shapes) {
      const { positions: P, indices: I, nTheta, rings } = buildBody(p, PREVIEW_RES);
      const normal = (f: number) => {
        const [a, b, c] = [I[f], I[f + 1], I[f + 2]].map((v) => [P[v * 3], P[v * 3 + 1], P[v * 3 + 2]]);
        const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
        const w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
        const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
        const l = Math.hypot(...n);
        return n.map((x) => x / l);
      };
      let worst = 0;
      // 底面に接する最後の 2 リングは本来の角なので除く
      for (let q = 0; q < (rings - 3) * nTheta; q++) {
        const f = (nTheta + q * 2) * 3;
        const [n1, n2] = [normal(f), normal(f + 3)];
        worst = Math.max(worst, (Math.acos(Math.min(1, n1[0] * n2[0] + n1[1] * n2[1] + n1[2] * n2[2])) * 180) / Math.PI);
      }
      expect(worst).toBeLessThan(15);
    }
  });
});

describe('buildPumpkin', () => {
  for (const st of STEM_STYLES) {
    it(`ヘタ ${st.id} は単一の manifold で警告なし`, () => {
      const p = { ...defaultParams(), ...st.values };
      expect(matchStem(p)).toBe(st.id);
      const { r, bad } = summary(p);
      expect(bad).toEqual([]);
      expect(r.level).toBe('green');
    });
  }
  for (const card of PRESET_CARDS) {
    it(`${card.id}は単一の manifold`, () => {
      const { r, bad } = summary(card.make(42));
      if (bad.length) console.log(card.id, bad);
      const m = r.checks.find((c) => c.id === 'manifold')!;
      expect(m.level, m.detail).toBe('green');
      expect(r.level).not.toBe('red');
    });
  }

  it('draft（操作中プレビュー）でも全プリセットが manifold', () => {
    for (const card of PRESET_CARDS) {
      const { r } = summary(card.make(42), 'draft');
      const m = r.checks.find((c) => c.id === 'manifold')!;
      expect(m.level, `${card.id}: ${m.detail}`).toBe('green');
    }
  });

  it('ランタンの目・口まわりの壁は壁厚どおり薄い（天井円錐が側面まで食い込まない）', () => {
    for (const card of PRESET_CARDS) {
      const { r } = summary(card.make(42));
      const g = r.groups.find((g) => g.kind === 'cut')!;
      let depth = 0;
      for (let i = g.start; i < g.start + g.count; i += 3) {
        const y = [0, 1, 2].map((k) => r.positions[r.indices[i + k] * 3 + 1]);
        depth = Math.max(depth, Math.max(...y) - Math.min(...y));
      }
      // 旧 45° 円錐では 25〜38 mm あった
      expect(depth, card.id).toBeLessThan(6);
    }
  });

  it('大きすぎるとサイズチェックが赤', () => {
    const { r } = summary({ ...defaultParams(), diameter: 240, height: 2.4, stemHeight: 0.4 }, 'draft');
    expect(r.checks.find((c) => c.id === 'bed')!.level).toBe('red');
  });

  it('瞳つきの目は島にブリッジが入る', () => {
    const p = defaultParams();
    p.face.eyeL.preset = 'pupil';
    const { r } = summary(p, 'draft');
    expect(r.checks.find((c) => c.id === 'island')?.level).toBe('green');
    expect(r.checks.find((c) => c.id === 'manifold')!.level).toBe('green');
  });

  it('警告には原因のパーツが付く', () => {
    const tiny = defaultParams();
    tiny.face.nose = { ...tiny.face.nose, w: 2, h: 2 };
    const h = summary(tiny, 'draft').r.checks.find((c) => c.id === 'hole')!;
    expect([h.level, h.parts]).toEqual(['yellow', ['nose']]);

    const close = defaultParams();
    close.face.symmetric = false;
    close.face.eyeR = { ...close.face.eyeR, x: 18, y: 4 };
    const l = summary(close, 'draft').r.checks.find((c) => c.id === 'link')!;
    expect(l.level).toBe('yellow');
    expect(l.parts).toEqual(expect.arrayContaining(['eyeR', 'nose']));
    expect(l.parts).not.toContain('eyeL');
  });

  it('穴が近すぎると連結部の警告が出る', () => {
    const p = defaultParams();
    p.face.eyeL = { ...p.face.eyeL, x: -1.2, w: 2 };
    p.face.symmetric = true;
    const { r } = summary(p, 'draft');
    expect(r.checks.find((c) => c.id === 'link')!.level).toBe('yellow');
  });
});

describe('URL', () => {
  it('往復で値が保たれる', () => {
    const p = PRESET_CARDS[3].make(1);
    const q = decodeParams(encodeParams(p))!;
    expect(q.ribs).toBe(p.ribs);
    expect(q.face.mouth.preset).toBe(p.face.mouth.preset);
    expect(q.face.eyeL.x).toBeCloseTo(p.face.eyeL.x, 1);
    expect(q.stemAttach).toBe('fused');
    expect(decodeParams(encodeParams({ ...p, stemAttach: 'peg' }))!.stemAttach).toBe('peg');
  });
});


describe('直径', () => {
  it('基準径より小さくしても同じ形のまま縮み、LED 開口も縮む', () => {
    const big = buildBody(defaultParams(), PREVIEW_RES).info;
    const small = buildBody({ ...defaultParams(), diameter: 60 }, PREVIEW_RES).info;
    expect(small.height / small.rMax).toBeCloseTo(big.height / big.rMax, 2);
    expect(small.rContact / small.rMax).toBeCloseTo(big.rContact / big.rMax, 2);
    const { r } = summary({ ...defaultParams(), diameter: 60 }, 'draft');
    const base = r.checks.find((c) => c.id === 'base')!;
    expect(base.level).toBe('green');
    expect(base.vars!.led).toBe('22');
  });
});
