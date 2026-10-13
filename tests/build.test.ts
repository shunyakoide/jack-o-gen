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

