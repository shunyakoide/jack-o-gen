import { describe, expect, it } from 'vitest';
import { defaultFace, defaultParams } from '../src/model/params';
import { decodeParams, encodeParams, URL_VERSION } from '../src/state/url';

describe('共有 URL', () => {
  it('既定の顔は URL に入れない', () => {
    expect(encodeParams(defaultParams())).toBe('');
    const q = encodeParams({ ...defaultParams(), diameter: 150 });
    expect(new URLSearchParams(q).has('f')).toBe(false);
    const back = decodeParams(q)!;
    expect(back.diameter).toBe(150);
    expect(back.face).toEqual(defaultFace());
  });

  it('既定から変えた顔は URL に入り、往復で戻る', () => {
    const p = defaultParams();
    p.face.mouth = { ...p.face.mouth, preset: 'fangs', x: 3 };
    const q = encodeParams(p);
    expect(new URLSearchParams(q).has('f')).toBe(true);
    const back = decodeParams(q)!;
    expect(back.face.mouth.preset).toBe('fangs');
    expect(back.face.mouth.x).toBe(3);
  });
});

// v=1 のリンクは省いた項目を「この既定値」と読む。既定値を変えるとこのテストが落ちる。
// そのときは URL_VERSION を上げ、decodeParams で v=1 のリンクにこの値を補ってから、ここに v2 の既定値を足す
const DEFAULTS_V1 = {"diameter":120,"height":1.4,"wobble":0.01,"superE":2.3,"egg":0.05,"dimpleDepth":0.07,"flat":0.45,"seed":1031,"dimpleWidth":0.35,"ribs":10,"ribDepth":0.09,"twist":0,"ribSharp":1,"ribJitter":0.04,"ribSkew":1,"ribFade":0.7,"stemHeight":0.2,"stemBend":0.3,"stemRadius":0.09,"stemTwist":40,"stemTaper":0.3,"stemSides":5,"stemStar":0.15,"stemFlare":0.5,"arch":1,"bridge":2,"wall":1.6,"led":44,"floor":2,"stemAttach":"fused","faceStyle":"cut","opening":"base","face":{"symmetric":true,"eyeL":{"preset":"triangle","x":-24,"y":14,"w":22,"h":20,"rot":0},"eyeR":{"preset":"triangle","x":24,"y":14,"w":22,"h":20,"rot":0},"nose":{"preset":"triangle","x":0,"y":-2,"w":12,"h":11,"rot":0},"mouth":{"preset":"jagged","x":0,"y":-20,"w":62,"h":24,"rot":0},"drawn":[]}};

describe('共有 URL の互換性（v=1）', () => {
  it('既定値は v=1 のときのまま', () => {
    expect(URL_VERSION).toBe(1);
    expect(defaultParams()).toEqual(DEFAULTS_V1);
  });

  it('既定から変えた URL には版が付き、すべて既定なら空', () => {
    expect(encodeParams({ ...defaultParams(), ribs: 12 })).toBe('v=1&N=12');
    expect(encodeParams(defaultParams())).toBe('');
  });

  it('公開時点の v=1 のリンクが同じ形に戻る', () => {
    const q = 'v=1&H=1.22&e=2.8&dd=0.13&dw=0.45&N=18&rd=0.07&p=0.55&q=0.4&sh=0.12&sb=0.15&sr=0.095&sw=20&st=0.2&sn=6&ss=0.3&a=p&o=l&f=1_angry%2C-24%2C11%2C22%2C14%2C0_triangle%2C24%2C14%2C22%2C20%2C0_down%2C0%2C-1%2C10%2C8%2C0_fangs%2C0%2C-17%2C56%2C18%2C0';
    const p = decodeParams(q)!;
    expect(p).toMatchObject({ height: 1.22, ribs: 18, wall: 1.6, diameter: 120, stemAttach: 'peg', opening: 'lid', faceStyle: 'cut' });
    expect(p.face.eyeL).toEqual({ preset: 'angry', x: -24, y: 11, w: 22, h: 14, rot: 0 });
    expect(p.face.mouth).toEqual({ preset: 'fangs', x: 0, y: -17, w: 56, h: 18, rot: 0 });
    expect(encodeParams(p)).toBe(q);
  });
});

describe('URL からの入力の制限', () => {
  it('直径はスライダーの端を超えられるが 1 m まで', () => {
    expect(decodeParams('D=500')!.diameter).toBe(500);
    expect(decodeParams('D=1e30')!.diameter).toBe(1000);
    expect(decodeParams('D=-5')!.diameter).toBe(60);
  });

  it('点が重なっただけの描いた形は捨てる', () => {
    const p = defaultParams();
    const drawn = (pts: [number, number][], line: number) => ({ x: 0, y: 0, w: 20, h: 20, rot: 0, mirror: false, line, pts });
    const square: [number, number][] = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    p.face.drawn = [drawn(square, 0), drawn([[0.2, 0.2], [0.2, 0.2], [0.2, 0.2]], 0), drawn([[0, 0], [0.01, 0]], 4), drawn([[-1, 0], [1, 0]], 4)];
    const back = decodeParams(encodeParams(p))!;
    expect(back.face.drawn.map((d) => [d.line, d.pts.length])).toEqual([[0, 4], [4, 2]]);
  });
});
