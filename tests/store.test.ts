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
