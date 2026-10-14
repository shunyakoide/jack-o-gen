import { describe, expect, it } from 'vitest';
import { defaultParams } from '../src/model/params';
import { useStore } from '../src/state/store';

describe('プリセット', () => {
  it('大きさと印刷まわりの設定は変えずに形だけ入れ替える', () => {
    useStore.setState({ params: { ...defaultParams(), diameter: 80, led: 60, wall: 2.4, stemAttach: 'peg' } });
    useStore.getState().applyPreset('ghost');
    const p = useStore.getState().params;
    expect([p.diameter, p.led, p.wall, p.stemAttach, p.height]).toEqual([80, 60, 2.4, 'peg', 2.1]);
    expect(useStore.getState().fitToBed).toBe(true);
  });

  it('ベッドに収まらなければ直径を縮め、収まれば止める', () => {
    useStore.setState({ params: { ...defaultParams(), diameter: 240 }, fitToBed: true });
    useStore.getState().fitBed(useStore.getState().params, 275);
    expect(useStore.getState().params.diameter).toBe(213);
    expect(useStore.getState().shrunkFrom).toBe(240);
    useStore.getState().fitBed(useStore.getState().params, 244);
    expect(useStore.getState().fitToBed).toBe(false);
  });
});
