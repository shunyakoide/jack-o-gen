import { describe, expect, it } from 'vitest';
import { loadManifold } from '../src/geometry/manifold';
import { defaultParams, type Params } from '../src/model/params';
import { PRESET_CARDS } from '../src/state/presets';
import { decodeParams, encodeParams } from '../src/state/url';
import { cachedBuild, solidOf } from './fit-helpers';

const wasm = await loadManifold();

const shapes: [string, Params][] = [
  ...PRESET_CARDS.filter((c) => c.id !== 'random').map((c): [string, Params] => [c.id, c.make(1)]),
  ['random', PRESET_CARDS.find((c) => c.id === 'random')!.make(42)],
];

function parts(p: Params) {
  const r = cachedBuild(wasm, { ...p, opening: 'lid' }, 'preview');
  return { r, bowl: solidOf(wasm, r.positions, r.indices), lid: solidOf(wasm, r.lid!.positions, r.lid!.indices) };
}

describe('蓋付き', () => {
  for (const [id, p] of shapes) {
    it(`${id}: 器と蓋がそれぞれ 1 つの閉じた形で、真上に外せて、横に 0.5 mm もずれない`, () => {
      const { r, bowl, lid } = parts(p);
      expect(r.level, r.checks.map((c) => `${c.level}:${c.id}:${c.detail}`).join()).not.toBe('red');
      expect(r.checks.find((c) => c.id === 'manifold')!.level).toBe('green');
      expect(lid.status()).toBe('NoError');
      expect(lid.decompose().length).toBe(1);
      const seat = r.lid!.seatZ;
      expect(lid.boundingBox().min[2]).toBeCloseTo(seat, 3);
      // リップが切り口から立ち上がる
      expect(bowl.boundingBox().max[2]).toBeGreaterThan(seat + 2);
      // 載せた位置から真上へ持ち上げる間、器に当たらない
      for (let dz = 0; dz <= 8; dz += 0.5) expect(lid.translate([0, 0, dz]).intersect(bowl).volume(), `dz=${dz}`).toBeLessThan(0.01);
      // 0.5 mm 横にずらすとリップに当たる（すき間は LID.gap = 0.3 mm）
      expect(lid.translate([0.5, 0, 0.1]).intersect(bowl).volume()).toBeGreaterThan(0.05);
      expect(lid.translate([0, -0.5, 0.1]).intersect(bowl).volume()).toBeGreaterThan(0.05);
    });
  }

  it('底に LED の穴を開けない', () => {
    const { bowl } = parts(defaultParams());
    const floor = bowl.slice(1).toPolygons();
    expect(floor.length).toBe(1);
    const open = cachedBuild(wasm, defaultParams(), 'preview');
    expect(solidOf(wasm, open.positions, open.indices).slice(1).toPolygons().length).toBe(2);
    expect(open.lid).toBeUndefined();
  });

  it('色分けの顔は器だけに入る', () => {
    const { r } = parts({ ...defaultParams(), faceStyle: 'inlay' });
    const faceTop = solidOf(wasm, r.face!.positions, r.face!.indices).boundingBox().max[2];
    expect(faceTop).toBeLessThan(r.lid!.seatZ);
  });

  it('ヘタは差し込み式でも蓋に付く', () => {
    const { r, lid } = parts({ ...defaultParams(), stemAttach: 'peg' });
    expect(r.stem!.seatZ).toBeGreaterThan(r.lid!.seatZ);
    // ピンは蓋の天辺に立つ
    expect(lid.boundingBox().max[2]).toBeGreaterThan(r.stem!.seatZ);
  });

  it('顔が頂上近くまであると蓋が作れず、赤で止める', () => {
    const p = defaultParams();
    p.face.eyeL = { ...p.face.eyeL, y: 40, h: 30 };
    const r = cachedBuild(wasm, { ...p, opening: 'lid' }, 'draft');
    expect(r.checks.find((c) => c.id === 'lid')).toMatchObject({ level: 'red', detail: 'noRoom' });
    expect(r.lid).toBeUndefined();
  });

  it('URL で往復する', () => {
    const q = encodeParams({ ...defaultParams(), opening: 'lid' });
    expect(q).toBe('o=l');
    expect(decodeParams(q)!.opening).toBe('lid');
    expect(decodeParams('D=150')!.opening).toBe('base');
  });
});
