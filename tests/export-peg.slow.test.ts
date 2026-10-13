// 差し込み式の書き出し解像度のテスト。重いので 1 回だけ作って使い回す
import { describe, expect, it } from 'vitest';
import { buildPumpkin } from '../src/geometry/build';
import { loadManifold } from '../src/geometry/manifold';
import { stemSeatRadius } from '../src/geometry/stem';
import { defaultParams, type Params } from '../src/model/params';
import { solidOf, stemWall } from './fit-helpers';

const wasm = await loadManifold();
const p: Params = { ...defaultParams(), stemAttach: 'peg' };
const r = buildPumpkin(wasm, p, 'export');

describe('書き出し解像度（差し込み式）', () => {
  it('本体は manifold', () => {
    expect(r.checks.find((c) => c.id === 'manifold')!.level).toBe('green');
  });

  it('座ぐりの下には壁厚ぶんの肉が残る', () => {
    const rf = stemSeatRadius(p);
    const zSeat = r.stem!.seatZ;
    const disc = wasm.Manifold.cylinder(p.wall - 0.05, rf, rf, 48).translate([0, 0, zSeat - p.wall]);
    const filled = solidOf(wasm, r.positions, r.indices).intersect(disc).volume();
    expect(filled / disc.volume()).toBeGreaterThan(0.999);
  });

  it('ヘタの穴のまわりに 0.8 mm 以上残る', () => {
    expect(stemWall(wasm, p, r, true)).toBeGreaterThanOrEqual(0.8);
  });
});
