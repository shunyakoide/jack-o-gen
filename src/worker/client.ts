import * as Comlink from 'comlink';
import type { GeometryApi } from './geometry.worker';

let remote: Comlink.Remote<GeometryApi> | null = null;

export function geometry(): Comlink.Remote<GeometryApi> {
  if (!remote) {
    const worker = new Worker(new URL('./geometry.worker.ts', import.meta.url), { type: 'module' });
    remote = Comlink.wrap<GeometryApi>(worker);
  }
  return remote;
}
