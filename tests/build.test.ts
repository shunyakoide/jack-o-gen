import { describe, expect, it } from 'vitest';
import { buildBody, EXPORT_RES, PREVIEW_RES } from '../src/geometry/body';
import { buildPumpkin } from '../src/geometry/build';
import { loadManifold } from '../src/geometry/manifold';
import { stemPeg } from '../src/geometry/stem';
import { toBinaryStl } from '../src/geometry/stl';
import { defaultParams, type Params } from '../src/model/params';
import { PRESET_CARDS } from '../src/state/presets';
import { matchStem, STEM_STYLES } from '../src/state/stems';
import { decodeParams, encodeParams } from '../src/state/url';

const wasm = await loadManifold();

function summary(p: Params, q: 'draft' | 'preview' | 'export' = 'preview') {
  const r = buildPumpkin(wasm, p, q);
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
    for (const mode of ['lantern', 'sealed'] as const) {
      it(`${card.id} (${mode})は単一の manifold`, () => {
        const p = { ...card.make(42), mode };
        const { r, bad } = summary(p);
        if (bad.length) console.log(card.id, mode, bad);
        const m = r.checks.find((c) => c.id === 'manifold')!;
        expect(m.level, m.detail).toBe('green');
        expect(r.level).not.toBe('red');
      });
    }
  }

  it('ランダム 20 形状がすべて manifold', () => {
    const random = PRESET_CARDS.find((c) => c.id === 'random')!;
    for (let s = 1; s <= 20; s++) {
      const p = { ...random.make(s * 7919), mode: s % 2 ? 'lantern' : 'sealed' } as Params;
      const { r } = summary(p);
      const m = r.checks.find((c) => c.id === 'manifold')!;
      expect(m.level, `seed ${s}: ${m.detail}`).toBe('green');
    }
  });

  it('draft（操作中プレビュー）でも全プリセットが manifold', () => {
    for (const card of PRESET_CARDS) {
      for (const mode of ['lantern', 'sealed'] as const) {
        const { r } = summary({ ...card.make(42), mode }, 'draft');
        const m = r.checks.find((c) => c.id === 'manifold')!;
        expect(m.level, `${card.id} ${mode}: ${m.detail}`).toBe('green');
      }
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

  it('書き出し解像度でも manifold、STL が書ける', () => {
    const { r } = summary(defaultParams(), 'export');
    console.log('export', r.stats);
    expect(r.checks.find((c) => c.id === 'manifold')!.level).toBe('green');
    const stl = toBinaryStl(r.positions, r.indices);
    expect(stl.byteLength).toBe(84 + 50 * r.stats.triangles);
  });

  it('大きすぎるとサイズチェックが赤', () => {
    const { r } = summary({ ...defaultParams(), diameter: 240, height: 2.4, stemHeight: 0.4 });
    expect(r.checks.find((c) => c.id === 'bed')!.level).toBe('red');
  });

  it('瞳つきの目は島にブリッジが入る', () => {
    const p = defaultParams();
    p.face.eyeL.preset = 'pupil';
    const { r } = summary(p);
    expect(r.checks.find((c) => c.id === 'island')?.level).toBe('green');
    expect(r.checks.find((c) => c.id === 'manifold')!.level).toBe('green');
  });

  it('穴が近すぎると連結部の警告が出る', () => {
    const p = defaultParams();
    p.face.eyeL = { ...p.face.eyeL, x: -1.2, w: 2 };
    p.face.symmetric = true;
    const { r } = summary(p);
    expect(r.checks.find((c) => c.id === 'link')!.level).toBe('yellow');
  });
});

function solidOf(positions: Float32Array, indices: Uint32Array) {
  return new wasm.Manifold(new wasm.Mesh({ numProp: 3, vertProperties: positions, triVerts: indices }));
}

describe('ヘタ差し込み式', () => {
  for (const card of PRESET_CARDS) {
    for (const mode of ['lantern', 'sealed'] as const) {
      it(`${card.id} (${mode})：本体とヘタがそれぞれ単一の manifold で、差しても干渉しない`, () => {
        const p: Params = { ...card.make(42), mode, stemAttach: 'peg' };
        const { r } = summary(p);
        expect(r.checks.find((c) => c.id === 'manifold')!.level).toBe('green');
        const st = r.stem!;
        const body = solidOf(r.positions, r.indices);
        const stem = solidOf(st.positions, st.indices);
        expect(stem.status()).toBe('NoError');
        expect(stem.decompose().length).toBe(1);
        let zMin = Infinity;
        for (let i = 2; i < st.positions.length; i += 3) zMin = Math.min(zMin, st.positions[i]);
        expect(zMin).toBeCloseTo(st.seatZ, 3);
        expect(body.intersect(stem).volume()).toBeLessThan(0.5);
      });
    }
  }

  it('draft でも本体・ヘタとも単一の manifold', () => {
    for (const card of PRESET_CARDS) {
      for (const mode of ['lantern', 'sealed'] as const) {
        const { r } = summary({ ...card.make(42), mode, stemAttach: 'peg' }, 'draft');
        expect(r.checks.find((c) => c.id === 'manifold')!.level, `${card.id} ${mode}`).toBe('green');
        expect(solidOf(r.stem!.positions, r.stem!.indices).decompose().length, `${card.id} ${mode}`).toBe(1);
      }
    }
  });

  it('ランタンの座ぐりの下には壁厚ぶんの肉が残る（空洞を突き破らない）', () => {
    // draft は内天井の円錐カットを省くので対象外（内側だけの見た目の差）
    for (const card of PRESET_CARDS) {
      for (const q of card.id === 'classic' ? (['preview', 'export'] as const) : (['preview'] as const)) {
        const p: Params = { ...card.make(42), stemAttach: 'peg' };
        const { r } = summary(p, q);
        const { rf } = stemPeg(p);
        const zSeat = r.stem!.seatZ;
        // 座面のすぐ下、厚さ wall の円盤が全部埋まっている
        const disc = wasm.Manifold.cylinder(p.wall - 0.05, rf, rf, 48).translate([0, 0, zSeat - p.wall]);
        const filled = solidOf(r.positions, r.indices).intersect(disc).volume();
        expect(filled / disc.volume(), `${card.id} ${q}`).toBeGreaterThan(0.999);
      }
    }
  });

  it('一体式ではヘタ単体を返さない', () => {
    expect(summary(defaultParams()).r.stem).toBeUndefined();
  });
});

describe('URL', () => {
  it('往復で値が保たれる', () => {
    const p = PRESET_CARDS[3].make(1);
    const q = decodeParams(encodeParams(p))!;
    expect(q.ribs).toBe(p.ribs);
    expect(q.face.mouth.preset).toBe(p.face.mouth.preset);
    expect(q.face.eyeL.x).toBeCloseTo(p.face.eyeL.x, 1);
    expect(q.mode).toBe(p.mode);
    expect(q.stemAttach).toBe('fused');
    expect(decodeParams(encodeParams({ ...p, stemAttach: 'peg' }))!.stemAttach).toBe('peg');
  });
});

void EXPORT_RES;
