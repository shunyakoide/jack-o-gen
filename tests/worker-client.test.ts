import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('comlink', () => ({ wrap: () => ({}) }));

class FakeWorker {
  static count = 0;
  terminated = false;
  constructor() {
    FakeWorker.count++;
  }
  addEventListener() {}
  terminate() {
    this.terminated = true;
  }
}

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

describe('callWorker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('Worker', FakeWorker);
    vi.resetModules();
    FakeWorker.count = 0;
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('書き出しの後ろで待っている間はプレビューのタイムアウトが進まない', async () => {
    const { callWorker } = await import('../src/worker/client');
    const exportJob = deferred<string>();
    const exported = callWorker(() => exportJob.promise, 120_000);
    // Worker は 1 本なので、プレビューの処理は書き出しが終わるまで始まらない
    const preview = callWorker(() => exportJob.promise.then(() => 'preview'), 30_000);
    const outcome = preview.then((v) => v, (e: Error) => `rejected: ${e.message}`);

    await vi.advanceTimersByTimeAsync(60_000);
    exportJob.resolve('stl');

    expect(await exported).toBe('stl');
    expect(await outcome).toBe('preview');
    expect(FakeWorker.count).toBe(1);
  });

  it('自分の実行がタイムアウトしたら Worker を止め、次の呼び出しは新しい Worker で動く', async () => {
    const { callWorker, WorkerTimeout } = await import('../src/worker/client');
    const hung = callWorker(() => new Promise<never>(() => {}), 30_000);
    const caught = hung.catch((e) => e);
    await vi.advanceTimersByTimeAsync(30_000);

    expect(await caught).toBeInstanceOf(WorkerTimeout);
    expect(await callWorker(async () => 'ok', 30_000)).toBe('ok');
    expect(FakeWorker.count).toBe(2);
  });
});
