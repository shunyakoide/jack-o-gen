import * as Comlink from 'comlink';
import type { GeometryApi } from './geometry.worker';

/** 書き出しの待ち時間を超えたときのエラー（UI で専用の文言を出す） */
export class WorkerTimeout extends Error {}

let current: { worker: Worker; remote: Comlink.Remote<GeometryApi>; dead: Promise<never>; kill: (e: Error) => void; pending: number } | null = null;

function start() {
  const worker = new Worker(new URL('./geometry.worker.ts', import.meta.url), { type: 'module' });
  let die!: (e: Error) => void;
  const dead = new Promise<never>((_, reject) => (die = reject));
  dead.catch(() => {});
  const w = {
    worker,
    remote: Comlink.wrap<GeometryApi>(worker),
    dead,
    pending: 0,
    // Worker が死ぬと comlink の呼び出しは永遠に返らないので、待っている呼び出しをまとめて失敗させる
    kill: (e: Error) => {
      worker.terminate();
      if (current === w) current = null;
      die(e);
    },
  };
  worker.addEventListener('error', (e) => w.kill(new Error(e.message || 'Geometry worker crashed')));
  worker.addEventListener('messageerror', () => w.kill(new Error('Geometry worker message error')));
  return w;
}

/** Worker 呼び出し。クラッシュ・タイムアウト時は reject し、次の呼び出しで新しい Worker を起動する */
export function callWorker<T>(f: (api: Comlink.Remote<GeometryApi>) => Promise<T>, timeoutMs: number): Promise<T> {
  const w = (current ??= start());
  let timer: ReturnType<typeof setTimeout> | undefined;
  w.pending++;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const err = new WorkerTimeout(`Timed out after ${timeoutMs / 1000} s`);
      // 他の呼び出し（書き出しなど）の後ろで待っているだけかもしれないので、自分だけのときに限り Worker を止める
      if (w.pending > 1) reject(err);
      else w.kill(err);
    }, timeoutMs);
  });
  return Promise.race([f(w.remote), w.dead, timeout]).finally(() => {
    clearTimeout(timer);
    w.pending--;
  });
}
