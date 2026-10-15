import { describe, expect, it } from 'vitest';
import { crossesCenter, finishStroke, MAX_DRAW_PTS, mirrorX } from '../src/geometry/face/draw';
import type { Pt } from '../src/geometry/face/presets';

// 手ぶれ付きで円をなぞった点列
const wobblyCircle = (cx: number, r: number, n = 300): Pt[] =>
  Array.from({ length: n }, (_, i) => {
    const a = (2 * Math.PI * i) / n;
    const rr = r + 0.3 * Math.sin(i * 1.7);
    return [cx + rr * Math.cos(a), rr * Math.sin(a)];
  });

describe('手描きの線', () => {
  it('点が多くても上限まで間引き、形は保つ', () => {
    const out = finishStroke(wobblyCircle(20, 10))!;
    expect(out.length).toBeLessThanOrEqual(MAX_DRAW_PTS);
    expect(out.length).toBeGreaterThan(8);
    for (const [x, y] of out) expect(Math.abs(Math.hypot(x - 20, y) - 10)).toBeLessThan(1.5);
  });

  it('小さすぎる形・細すぎる線は捨てる', () => {
    expect(finishStroke(wobblyCircle(0, 1.5))).toBeNull();
    expect(finishStroke([[0, 0], [30, 0.5], [0, 1]])).toBeNull();
  });

  it('中心線をまたがない形だけ鏡像にする', () => {
    const eye = finishStroke(wobblyCircle(20, 8))!;
    expect(crossesCenter(eye)).toBe(false);
    expect(crossesCenter(finishStroke(wobblyCircle(0, 8))!)).toBe(true);
    expect(Math.min(...mirrorX(eye).map((p) => p[0]))).toBeLessThan(-27);
  });
});
