// 形状生成を UI スレッドから分離する Worker。
import * as Comlink from 'comlink';
import wasmUrl from 'manifold-3d/manifold.wasm?url';
import { buildPumpkin, type BuildResult, type Quality } from '../geometry/build';
import { loadManifold } from '../geometry/manifold';
import { toBinaryStl } from '../geometry/stl';
import type { Params } from '../model/params';

const api = {
  async build(p: Params, quality: Quality): Promise<BuildResult> {
    const wasm = await loadManifold(wasmUrl);
    const r = buildPumpkin(wasm, p, quality);
    return Comlink.transfer(r, [r.positions.buffer, r.indices.buffer]);
  },
  async exportStl(p: Params): Promise<{ stl: ArrayBuffer; result: Omit<BuildResult, 'positions' | 'indices'> }> {
    const wasm = await loadManifold(wasmUrl);
    const r = buildPumpkin(wasm, p, 'export');
    const stl = toBinaryStl(r.positions, r.indices);
    const { positions, indices, ...rest } = r;
    void positions;
    void indices;
    return Comlink.transfer({ stl, result: rest }, [stl]);
  },
};

export type GeometryApi = typeof api;
Comlink.expose(api);
