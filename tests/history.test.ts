import { beforeEach, describe, expect, it } from 'vitest';
import { defaultParams } from '../src/model/params';
import { beginGesture, endGesture, useStore } from '../src/state/store';

const s = () => useStore.getState();

describe('undo / redo', () => {
  beforeEach(() => {
    endGesture();
    useStore.setState({ params: defaultParams(), past: [], future: [] });
  });

  it('1 回のドラッグは何度変わっても 1 手', () => {
    const d0 = s().params.diameter;
    beginGesture();
    s().setNum('diameter', 130);
    s().setNum('diameter', 140);
    s().setNum('diameter', 150);
    endGesture();
    expect(s().past.length).toBe(1);
    s().undo();
    expect(s().params.diameter).toBe(d0);
    s().redo();
    expect(s().params.diameter).toBe(150);
  });

  it('区切りのない変更（クリック）は 1 回ずつ 1 手', () => {
    const d0 = s().params.diameter;
    s().setNum('diameter', 130);
    s().setNum('diameter', 140);
    expect(s().past.length).toBe(2);
    s().undo();
    expect(s().params.diameter).toBe(130);
    s().undo();
    expect(s().params.diameter).toBe(d0);
  });

  it('続けて 2 回ドラッグすると 2 手、新しい変更でやり直しは消える', () => {
    const p0 = s().params.face.eyeL.x;
    for (const x of [[1, 2, 3], [4, 5]]) {
      beginGesture();
      // 長押し中のキーリピートでも begin が何度も呼ばれる
      for (const v of x) {
        beginGesture();
        s().setPart('eyeL', { x: v });
      }
      endGesture();
    }
    expect(s().past.length).toBe(2);
    s().undo();
    expect(s().params.face.eyeL.x).toBe(3);
    s().undo();
    expect(s().params.face.eyeL.x).toBe(p0);
    s().redo();
    s().setNum('diameter', 125);
    expect(s().future.length).toBe(0);
  });
});
