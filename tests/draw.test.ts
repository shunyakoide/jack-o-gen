import { describe, expect, it } from 'vitest';
import { crossesCenter, finishStroke, MAX_DRAW_PTS, mirrorX } from '../src/geometry/face/draw';
import { archTents } from '../src/geometry/face/layout';
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

describe('穴の天井のアーチ', () => {
  const ring = (r: number, n = 48): Pt[] => Array.from({ length: n }, (_, i): Pt => [r * Math.cos((2 * Math.PI * i) / n), r * Math.sin((2 * Math.PI * i) / n)]);
  it('丸い穴の上は 1 つの尖頭アーチ（小さな山が並ぶ王冠にしない）', () => {
    expect(archTents([ring(10)], 2.5, 8).length).toBe(1);
  });
  it('幅の広い天井（口など）は幅 8 mm ごとの山に分ける', () => {
    expect(archTents([[[-20, -5], [20, -5], [20, 5], [-20, 5]]], 2.5, 8).length).toBe(5);
  });
});

describe('描いた形を本体に切り抜く', async () => {
  const { buildPumpkin } = await import('../src/geometry/build');
  const { loadManifold } = await import('../src/geometry/manifold');
  const { defaultParams } = await import('../src/model/params');
  const { decodeParams, encodeParams } = await import('../src/state/url');
  const { finishLine, toDrawn, LINE_WIDTH } = await import('../src/geometry/face/draw');
  const wasm = await loadManifold();

  // 8 の字（自己交差）を右頬に、眉の線を左右に、口は消す
  const eight: Pt[] = Array.from({ length: 80 }, (_, i) => {
    const a = (2 * Math.PI * i) / 80;
    return [30 + 8 * Math.sin(2 * a), -18 + 12 * Math.sin(a)];
  });
  const brow = finishLine(Array.from({ length: 30 }, (_, i): Pt => [12 + i, 30 + 3 * Math.sin(i / 5)]))!;
  const p = defaultParams();
  p.face = {
    ...p.face,
    mouth: { ...p.face.mouth, preset: 'none' },
    drawn: [toDrawn(finishStroke(eight)!, 0, false), toDrawn(brow, LINE_WIDTH, true)],
  };

  it('本体は 1 つの manifold のまま、描いた形のぶん穴が増える', () => {
    const r = buildPumpkin(wasm, p, 'draft');
    expect(r.checks.find((c) => c.id === 'manifold')!.level).toBe('green');
    const plain = buildPumpkin(wasm, { ...p, face: { ...p.face, drawn: [] } }, 'draft');
    const vol = (q: typeof r) => wasm.Manifold.ofMesh(new wasm.Mesh({ numProp: 3, vertProperties: q.positions, triVerts: q.indices })).volume();
    expect(vol(plain) - vol(r)).toBeGreaterThan(100);
  });

  it('URL で往復しても形は 1/127 の精度で戻る', () => {
    const back = decodeParams(encodeParams(p))!;
    expect(back.face.drawn.length).toBe(2);
    expect(back.face.drawn[1].mirror).toBe(true);
    expect(back.face.drawn[1].line).toBe(LINE_WIDTH);
    back.face.drawn[0].pts.forEach(([u, v], i) => {
      expect(Math.abs(u - p.face.drawn[0].pts[i][0])).toBeLessThan(0.01);
      expect(Math.abs(v - p.face.drawn[0].pts[i][1])).toBeLessThan(0.01);
    });
  });

  it('壊れた URL の形は捨てる', () => {
    expect(decodeParams('d=1,2,3&x=1')!.face.drawn).toEqual([]);
    expect(decodeParams('d=0,0,10,10,0,0,0,AAA')!.face.drawn).toEqual([]);
  });

  it('細すぎる形は描いた形が原因として警告に出る', () => {
    // 縦長の細い形（幅 1.2 mm）。手描きでは捨てる大きさだが、拡大縮小で細くされた場合に備えて検査側でも拾う
    const thin = toDrawn([[30, -20], [34, 0], [38, -20]], 0, false);
    const q = { ...p, face: { ...p.face, drawn: [{ ...thin, w: 1.2 }] } };
    const r = buildPumpkin(wasm, q, 'draft');
    const hole = r.checks.find((c) => c.id === 'hole')!;
    expect(hole.level).toBe('yellow');
    expect(hole.parts).toContain('d0');
    expect(r.faceProblems.length).toBeGreaterThan(0);
  });

  it('斜めの線の天井に付けた尖りが、独立した小穴にならない', () => {
    // ブラウザで描いた眉（URL の値そのまま）。以前は尖りが線でだけ接して小穴＋連結部の警告になっていた
    const q = decodeParams('d=29.5%2C39.4%2C28.5%2C4.6%2C0%2C0%2C4%2CgYHKQgF_OlF_pQ')!;
    const r = buildPumpkin(wasm, q, 'preview');
    expect(r.checks.filter((c) => c.level !== 'green').map((c) => c.id)).toEqual([]);
    expect(r.faceProblems).toEqual([]);
  });

  it('近すぎる 2 つの形は、そのすき間が赤く塗られる', () => {
    const circle = (cx: number): Pt[] => Array.from({ length: 24 }, (_, i): Pt => [cx + 6 * Math.cos((i * Math.PI) / 12), -20 + 6 * Math.sin((i * Math.PI) / 12)]);
    const q = { ...p, face: { ...p.face, drawn: [toDrawn(circle(20), 0, false), toDrawn(circle(34), 0, false)] } };
    const r = buildPumpkin(wasm, q, 'preview');
    const link = r.checks.find((c) => c.id === 'link')!;
    expect(link.detail).toBe('merged');
    expect(link.parts).toEqual(['d0', 'd1']);
    // すき間（x ≈ 26..28）に赤い領域がある
    const xs = r.faceProblems.flat().map(([x]) => x);
    expect(Math.min(...xs)).toBeLessThan(27.5);
    expect(Math.max(...xs)).toBeGreaterThan(26.5);
  });

  it('終わりが始点を通り過ぎた手描きの円でも、島・細い穴・小穴ができない', () => {
    // 以前は重なった尻尾が逆向きの小さな輪になり、島（＋ブリッジの棒）や細い穴の警告になっていた
    for (const [over, dr] of [[5, -3], [20, -3], [20, 1], [40, 3], [80, 3]]) {
      const raw: Pt[] = [];
      for (let i = 0; i <= 360 + over; i++) {
        const a = (i / 360) * 2 * Math.PI;
        const r = 10 + (i > 360 ? ((i - 360) / over) * dr : 0);
        raw.push([-75 + r * Math.cos(a), 25 + r * Math.sin(a)]);
      }
      const q = { ...p, face: { ...p.face, drawn: [toDrawn(finishStroke(raw)!, 0, false)] } };
      const r = buildPumpkin(wasm, q, 'draft');
      expect(r.checks.filter((c) => c.level !== 'green' || c.id === 'island').map((c) => c.id), `${over},${dr}`).toEqual([]);
    }
  });
});
