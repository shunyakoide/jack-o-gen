import { describe, expect, it } from 'vitest';
import { buildPumpkin } from '../src/geometry/build';
import { loadManifold } from '../src/geometry/manifold';
import { toBinaryStl } from '../src/geometry/stl';
import { defaultParams } from '../src/model/params';

const wasm = await loadManifold();

describe('書き出し解像度（一体式）', () => {
  it('manifold、STL が書ける', () => {
    const r = buildPumpkin(wasm, defaultParams(), 'export');
    console.log('export', r.stats);
    expect(r.checks.find((c) => c.id === 'manifold')!.level).toBe('green');
    const stl = toBinaryStl(r.positions, r.indices);
    expect(stl.byteLength).toBe(84 + 50 * r.stats.triangles);
  });
});
