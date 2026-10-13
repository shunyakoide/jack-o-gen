import { describe, expect, it } from 'vitest';
import { buildPumpkin } from '../src/geometry/build';
import { loadManifold } from '../src/geometry/manifold';
import { PRESET_CARDS } from '../src/state/presets';

const wasm = await loadManifold();

describe('おまかせ', () => {
  it('ランダム 20 形状がすべて manifold', () => {
    const random = PRESET_CARDS.find((c) => c.id === 'random')!;
    for (let s = 1; s <= 20; s++) {
      const r = buildPumpkin(wasm, random.make(s * 7919), 'preview');
      const m = r.checks.find((c) => c.id === 'manifold')!;
      expect(m.level, `seed ${s}: ${m.detail}`).toBe('green');
    }
  });
});
