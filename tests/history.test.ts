import { describe, expect, it, vi } from 'vitest';
import { useStore } from '../src/state/store';

describe('undo / redo', () => {
  it('coalesces rapid edits into one step and restores them', () => {
    vi.useFakeTimers();
    const s = () => useStore.getState();
    const d0 = s().params.diameter;
    s().setNum('diameter', 130);
    vi.advanceTimersByTime(100);
    s().setNum('diameter', 140);
    vi.advanceTimersByTime(1000);
    s().setNum('diameter', 150);
    expect(s().past.length).toBe(2);
    s().undo();
    expect(s().params.diameter).toBe(140);
    s().undo();
    expect(s().params.diameter).toBe(d0);
    s().redo();
    expect(s().params.diameter).toBe(140);
    s().setNum('diameter', 125);
    expect(s().future.length).toBe(0);
    vi.useRealTimers();
  });
});
