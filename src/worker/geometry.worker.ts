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
    const bufs = [r.positions.buffer, r.indices.buffer];
    if (r.stem) bufs.push(r.stem.positions.buffer, r.stem.indices.buffer);
    return Comlink.transfer(r, bufs);
  },
  /** 差し込み式ではヘタを別ファイル（suffix '-stem'、底面を z=0 に移動）で返す */
  async exportStl(p: Params): Promise<{ files: { suffix: string; stl: ArrayBuffer }[]; result: Omit<BuildResult, 'positions' | 'indices' | 'stem'> }> {
    const wasm = await loadManifold(wasmUrl);
    const r = buildPumpkin(wasm, p, 'export');
    const files = [{ suffix: '', stl: toBinaryStl(r.positions, r.indices) }];
    if (r.stem) {
      const pos = r.stem.positions;
      for (let i = 2; i < pos.length; i += 3) pos[i] -= r.stem.seatZ;
      files.push({ suffix: '-stem', stl: toBinaryStl(pos, r.stem.indices) });
    }
    const { positions, indices, stem, ...rest } = r;
    void positions;
    void indices;
    void stem;
    return Comlink.transfer({ files, result: rest }, files.map((f) => f.stl));
  },
};

export type GeometryApi = typeof api;
Comlink.expose(api);
