import { describe, expect, it } from 'vitest';
import { buildPumpkin } from '../src/geometry/build';
import { loadManifold } from '../src/geometry/manifold';
import { defaultParams, NUM_DEFS, type Params } from '../src/model/params';
import { solidOf } from './fit-helpers';

const wasm = await loadManifold();
const check = (r: ReturnType<typeof buildPumpkin>, id: string) => r.checks.find((c) => c.id === id);

describe('全パラメータの最小・最大（draft）', () => {
  for (const d of NUM_DEFS) {
    for (const v of [d.min, d.max]) {
      it(`${d.key}=${v} で manifold`, () => {
        const p: Params = { ...defaultParams(), [d.key]: v };
        const modes = d.group === 'stem' ? (['fused', 'peg'] as const) : (['fused'] as const);
        for (const stemAttach of modes) {
          const r = buildPumpkin(wasm, { ...p, stemAttach }, 'draft');
          const m = check(r, 'manifold')!;
          expect(m.level, `${stemAttach}: ${m.detail}`).toBe('green');
          if (r.stem) expect(solidOf(wasm, r.stem.positions, r.stem.indices).decompose().length).toBe(1);
        }
      });
    }
  }
});
