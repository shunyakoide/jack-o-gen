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

describe('書き出し解像度（蓋付き）', () => {
  it('器と蓋がそれぞれ manifold で、STL が書ける', () => {
    const r = buildPumpkin(wasm, { ...defaultParams(), opening: 'lid' }, 'export');
    expect(r.level).toBe('green');
    expect(r.lid).toBeDefined();
    const lid = wasm.Manifold.ofMesh(new wasm.Mesh({ numProp: 3, vertProperties: r.lid!.positions, triVerts: r.lid!.indices }));
    expect(lid.status()).toBe('NoError');
    expect(lid.decompose().length).toBe(1);
    expect(toBinaryStl(r.lid!.positions, r.lid!.indices).byteLength).toBe(84 + 50 * (r.lid!.indices.length / 3));
  });
});
