import { describe, expect, it } from 'vitest';
import { defaultFace, defaultParams } from '../src/model/params';
import { decodeParams, encodeParams } from '../src/state/url';

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
