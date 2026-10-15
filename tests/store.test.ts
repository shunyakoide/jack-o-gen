import { describe, expect, it } from 'vitest';
import { defaultParams } from '../src/model/params';
import { useStore } from '../src/state/store';

describe('プリセット', () => {
  it('大きさと印刷まわりの設定は変えずに形だけ入れ替える', () => {
    useStore.setState({ params: { ...defaultParams(), diameter: 80, led: 60, wall: 2.4, stemAttach: 'peg' } });
    useStore.getState().applyPreset('ghost');
    const p = useStore.getState().params;
    expect([p.diameter, p.led, p.wall, p.stemAttach, p.height]).toEqual([80, 60, 2.4, 'peg', 2.1]);
  });

  it('直径はスライダーの端より大きく打ち込め、プリセットでも縮まない', () => {
    useStore.setState({ params: defaultParams() });
    useStore.getState().setNum('diameter', 400);
    useStore.getState().setNum('wall', 99);
    useStore.getState().applyPreset('ghost');
    expect([useStore.getState().params.diameter, useStore.getState().params.wall]).toEqual([400, 4]);
  });
});

describe('描いた形', () => {
  const shape = { x: 30, y: 10, w: 10, h: 10, rot: 0, mirror: false, line: 0, pts: [[-1, -1], [1, -1], [0, 1]] as [number, number][] };

  it('足すと選ばれ、上限で止まり、消すと隣を選ぶ。undo で戻る', () => {
    useStore.setState({ params: defaultParams(), past: [], future: [] });
    const s = useStore.getState;
    expect(s().addDrawn(shape)).toBe(true);
    expect(s().selectedPart).toBe('d0');
    for (let i = 1; i < 8; i++) s().addDrawn({ ...shape, x: 30 + i });
    expect(s().addDrawn(shape)).toBe(false);
    expect(s().params.face.drawn.length).toBe(8);
    s().setPart('d7', { x: -20, preset: 'round' });
    expect(s().params.face.drawn[7].x).toBe(-20);
    s().removeDrawn(7);
    expect(s().selectedPart).toBe('d6');
    s().undo();
    expect(s().params.face.drawn.length).toBe(8);
  });

  it('描いた形があればプリセットは本体の形だけを変え、顔は残す', () => {
    useStore.setState({ params: defaultParams(), past: [], future: [] });
    const s = useStore.getState;
    s().applyPreset('ghost');
    const ghostFace = s().params.face;
    s().addDrawn(shape);
    s().applyPreset('flat');
    expect(s().params.face.drawn.length).toBe(1);
    expect(s().params.face.eyeL).toEqual(ghostFace.eyeL);
    expect(s().toast).toBe('presetKeptFace');
    s().undo();
    s().undo();
    s().applyPreset('flat');
    expect(s().params.face.drawn).toEqual([]);
  });
});
