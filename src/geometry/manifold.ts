// manifold-3d（WASM）の読み込みと、WASM オブジェクトの解放をまとめるヘルパー。

import Module from 'manifold-3d';
import type { ManifoldToplevel } from 'manifold-3d';

export type { Manifold, CrossSection } from 'manifold-3d';
export type Wasm = ManifoldToplevel;

let loading: Promise<Wasm> | null = null;

export function loadManifold(wasmUrl?: string): Promise<Wasm> {
  if (!loading) {
    loading = Module(wasmUrl ? { locateFile: () => wasmUrl } : undefined).then((m) => {
      m.setup();
      return m;
    });
  }
  return loading;
}

/** 生成した WASM オブジェクトを記録し、最後にまとめて delete する */
export class Scope {
  private items: { delete(): void }[] = [];
  keep<T extends { delete(): void }>(x: T): T {
    this.items.push(x);
    return x;
  }
  dispose() {
    for (const x of this.items) {
      try {
        x.delete();
      } catch {
        /* 二重解放は無視 */
      }
    }
    this.items = [];
  }
}
