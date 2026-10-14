import { describe, expect, it } from 'vitest';
import { buildPumpkin } from '../src/geometry/build';
import { clampFace } from '../src/geometry/face/layout';
import { loadManifold } from '../src/geometry/manifold';
import { defaultFace, defaultParams, type Params } from '../src/model/params';
import { decodeParams, encodeParams } from '../src/state/url';
import { cutDepth, solidOf, topThickness } from './fit-helpers';

const wasm = await loadManifold();
const check = (r: ReturnType<typeof buildPumpkin>, id: string) => r.checks.find((c) => c.id === id);

describe('小さいカボチャの天井', () => {
  it('直径 60 でも頂上の肉は 6 mm 未満、顔の切り抜きの奥行きも 6 mm 未満', () => {
    // 修正前（ブリッジ半径 25 mm 固定）は頂上 10.3 mm、切り抜き 16.9 mm だった
    const p: Params = { ...defaultParams(), diameter: 60, stemAttach: 'peg' };
    const r = buildPumpkin(wasm, p, 'preview');
    expect(topThickness(wasm, r, p.stemRadius * p.diameter * 1.5 + 2)).toBeLessThan(6);
    expect(cutDepth(r)).toBeLessThan(6);
  });
});

describe('ベッド判定', () => {
  it('差し込み式は横に並べたヘタも含めて測る', () => {
    const p: Params = { ...defaultParams(), diameter: 230, height: 1.0 };
    expect(check(buildPumpkin(wasm, p, 'draft'), 'bed')!.level).toBe('green');
    const bed = check(buildPumpkin(wasm, { ...p, stemAttach: 'peg' }, 'draft'), 'bed')!;
    expect([bed.level, bed.detail]).toEqual(['yellow', 'pair']);
  });
});

describe('顔パーツの位置制限', () => {
  const lowMouth = (): Params => {
    const p = defaultParams();
    p.face.mouth = { ...p.face.mouth, y: -50 };
    return p;
  };
  // 底面から床厚＋1 mm までの輪切りの体積（顔が底を削るとここが減る）
  const baseVolume = (p: Params) => {
    const r = buildPumpkin(wasm, p, 'preview');
    const slab = wasm.Manifold.cube([400, 400, p.floor + 1]).translate([-200, -200, 0]);
    return solidOf(wasm, r.positions, r.indices).intersect(slab).volume();
  };

  it('既定の顔は動かさない', () => {
    expect(clampFace(defaultParams())).toEqual(defaultFace());
  });

  it('下げすぎた口は底面を削らない位置まで上がる', () => {
    const ref = baseVolume(defaultParams());
    const p = lowMouth();
    expect(baseVolume(p)).toBeLessThan(ref * 0.99);
    const clamped = { ...p, face: clampFace(p) };
    expect(clamped.face.mouth.y).toBeGreaterThan(-50);
    expect(Math.abs(baseVolume(clamped) - ref) / ref).toBeLessThan(0.001);
  });

  it('URL から読んだ顔も同じく制限される', () => {
    const p = lowMouth();
    expect(decodeParams(encodeParams(p))!.face.mouth.y).toBeCloseTo(clampFace(p).mouth.y, 1);
  });
});
