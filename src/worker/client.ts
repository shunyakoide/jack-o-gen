import * as Comlink from 'comlink';
import type { GeometryApi } from './geometry.worker';

/** 書き出しの待ち時間を超えたときのエラー（UI で専用の文言を出す） */
export class WorkerTimeout extends Error {}

let current: { worker: Worker; remote: Comlink.Remote<GeometryApi>; dead: Promise<never>; kill: (e: Error) => void } | null = null;

function start() {
  const worker = new Worker(new URL('./geometry.worker.ts', import.meta.url), { type: 'module' });
  let die!: (e: Error) => void;
  const dead = new Promise<never>((_, reject) => (die = reject));
  dead.catch(() => {});
  const w = {
    worker,
    remote: Comlink.wrap<GeometryApi>(worker),
    dead,
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
  const timeout = new Promise<never>(() => {
    timer = setTimeout(() => w.kill(new WorkerTimeout(`Timed out after ${timeoutMs / 1000} s`)), timeoutMs);
  });
  return Promise.race([f(w.remote), w.dead, timeout]).finally(() => clearTimeout(timer));
}
