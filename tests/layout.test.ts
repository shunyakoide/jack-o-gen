import { describe, expect, it } from 'vitest';
import { boxOf, partSize, printLayout } from '../src/geometry/layout';

describe('ベッド配置', () => {
  it('ヘタを本体の +x 側に 10 mm あけて並べ、組をベッド中央に置く', () => {
    // 幅 120 + 10 + 20 = 150 → 本体 x は -75..45、ヘタ x は 55..75
    const l = printLayout({ min: [-60, -40, 2], max: [60, 60, 102] }, { box: { min: [-10, -6, 90], max: [10, 10, 130] }, seatZ: 95 });
    expect(l.body).toEqual([-15, -10, -2]);
    expect(l.stem).toEqual([65, -2, -95]);
  });

  it('ヘタが無ければ本体だけを中央に置く', () => {
    expect(printLayout({ min: [0, 10, 1], max: [100, 30, 50] }, null)).toEqual({ body: [-50, -20, -1], stem: null });
  });

  it('ヘタの大きさは seatZ から測る', () => {
    const box = boxOf(new Float32Array([-10, -8, 90, 12, 8, 130, 0, 0, 100]));
    expect(box).toEqual({ min: [-10, -8, 90], max: [12, 8, 130] });
    expect(partSize(box, 95)).toEqual([22, 16, 35]);
  });
});
