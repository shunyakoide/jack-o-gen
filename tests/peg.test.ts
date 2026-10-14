import { describe, expect, it } from 'vitest';
import { loadManifold } from '../src/geometry/manifold';
import { stemSeatRadius } from '../src/geometry/stem';
import { defaultParams, type Params } from '../src/model/params';
import { PRESET_CARDS } from '../src/state/presets';
import { cachedBuild, solidOf } from './fit-helpers';

const wasm = await loadManifold();

describe('ヘタ差し込み式', () => {
  for (const card of PRESET_CARDS) {
    it(`${card.id}：本体とヘタがそれぞれ単一の manifold で、差しても干渉しない`, () => {
      const p: Params = { ...card.make(42), stemAttach: 'peg' };
      const r = cachedBuild(wasm, p, 'preview');
      expect(r.checks.find((c) => c.id === 'manifold')!.level).toBe('green');
      const st = r.stem!;
      const body = solidOf(wasm, r.positions, r.indices);
      const stem = solidOf(wasm, st.positions, st.indices);
      expect(stem.status()).toBe('NoError');
      expect(stem.decompose().length).toBe(1);
      let zMin = Infinity;
      for (let i = 2; i < st.positions.length; i += 3) zMin = Math.min(zMin, st.positions[i]);
      expect(zMin).toBeCloseTo(st.seatZ, 3);
      expect(body.intersect(stem).volume()).toBeLessThan(0.5);
    });
  }

  it('draft でも本体・ヘタとも単一の manifold', () => {
    for (const card of PRESET_CARDS) {
      const r = cachedBuild(wasm, { ...card.make(42), stemAttach: 'peg' }, 'draft');
      expect(r.checks.find((c) => c.id === 'manifold')!.level, card.id).toBe('green');
      expect(solidOf(wasm, r.stem!.positions, r.stem!.indices).decompose().length, card.id).toBe(1);
    }
  });

  it('ランタンの座ぐりの下には壁厚ぶんの肉が残る（空洞を突き破らない）', () => {
    // draft は内天井の円錐カットを省くので対象外（内側だけの見た目の差）。書き出し解像度は export-peg.slow.test.ts
    for (const card of PRESET_CARDS) {
      const p: Params = { ...card.make(42), stemAttach: 'peg' };
      const r = cachedBuild(wasm, p, 'preview');
      const rf = stemSeatRadius(p);
      const zSeat = r.stem!.seatZ;
      // 座面のすぐ下、厚さ wall の円盤が全部埋まっている
      const disc = wasm.Manifold.cylinder(p.wall - 0.05, rf, rf, 48).translate([0, 0, zSeat - p.wall]);
      const filled = solidOf(wasm, r.positions, r.indices).intersect(disc).volume();
      expect(filled / disc.volume(), card.id).toBeGreaterThan(0.999);
    }
  });

  it('一体式ではヘタ単体を返さない', () => {
    expect(cachedBuild(wasm, defaultParams(), 'draft').stem).toBeUndefined();
  });
});

describe('ピンの太さ', () => {
  const pin = (p: Partial<Params>) => {
    const v = cachedBuild(wasm, { ...defaultParams(), ...p, stemAttach: 'peg' }, 'draft').checks.find((c) => c.id === 'peg')!.vars;
    return [+v.d, +v.h];
  };
  it('太いヘタは大きいピンになり、基準の太さのヘタは変わらない', () => {
    expect(pin({ diameter: 120 })).toEqual([4.2, 4.5]);
    const [d, h] = pin({ diameter: 240, stemRadius: 0.16 });
    expect(d).toBeGreaterThan(15);
    expect(h).toBeGreaterThanOrEqual(8);
  });
});
