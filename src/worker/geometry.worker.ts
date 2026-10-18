// 形状生成を UI スレッドから分離する Worker。
import * as Comlink from 'comlink';
import wasmUrl from 'manifold-3d/manifold.wasm?url';
import { buildPumpkin, type BuildResult, type Quality } from '../geometry/build';
import { loadManifold } from '../geometry/manifold';
import { boxOf } from '../geometry/layout';
import { toBinaryStl } from '../geometry/stl';
import { to3mf, type ThreeMfObject } from '../geometry/threemf';
import type { Params } from '../model/params';

// 3MF のパーツ色（プレビューと同じオレンジ、顔は黒）
const BODY_COLOR = '#F07A1A';
const FACE_COLOR = '#000000';

const api = {
  async build(p: Params, quality: Quality): Promise<BuildResult> {
    const wasm = await loadManifold(wasmUrl);
    const r = buildPumpkin(wasm, p, quality);
    const bufs = [r.positions.buffer, r.indices.buffer];
    if (r.stem) bufs.push(r.stem.positions.buffer, r.stem.indices.buffer);
    if (r.face) bufs.push(r.face.positions.buffer, r.face.indices.buffer);
    return Comlink.transfer(r, bufs);
  },
  /**
   * 差し込み式ではヘタを別ファイル（'-stem.stl'、底面を z=0 に移動）にする。
   * 色分けでは 3MF 1 つ（本体＋顔 = 1 オブジェクトの 2 パーツ、顔はフィラメント 2。ヘタは横に並べた別オブジェクト）
   */
  async exportFiles(p: Params): Promise<{ files: { suffix: string; data: ArrayBuffer }[]; result: Omit<BuildResult, 'positions' | 'indices' | 'stem' | 'face'> }> {
    const wasm = await loadManifold(wasmUrl);
    const r = buildPumpkin(wasm, p, 'export');
    if (r.stem) {
      const pos = r.stem.positions;
      for (let i = 2; i < pos.length; i += 3) pos[i] -= r.stem.seatZ;
    }
    const files: { suffix: string; data: ArrayBuffer }[] = [];
    if (r.face) {
      const objects: ThreeMfObject[] = [
        {
          name: 'jack-o-gen',
          parts: [
            { name: 'body', positions: r.positions, indices: r.indices, extruder: 1, color: BODY_COLOR },
            { name: 'face', positions: r.face.positions, indices: r.face.indices, extruder: 2, color: FACE_COLOR },
          ],
        },
      ];
      if (r.stem) {
        // 本体の右に 10 mm 空けて置く
        const gap = boxOf(r.positions).max[0] - boxOf(r.stem.positions).min[0] + 10;
        objects.push({ name: 'stem', parts: [{ name: 'stem', positions: r.stem.positions, indices: r.stem.indices, extruder: 1, color: BODY_COLOR }], offset: [gap, 0, 0] });
      }
      files.push({ suffix: '.3mf', data: to3mf(objects) });
    } else {
      files.push({ suffix: '.stl', data: toBinaryStl(r.positions, r.indices) });
      if (r.stem) files.push({ suffix: '-stem.stl', data: toBinaryStl(r.stem.positions, r.stem.indices) });
    }
    const { positions, indices, stem, face, ...rest } = r;
    void positions;
    void indices;
    void stem;
    void face;
    return Comlink.transfer({ files, result: rest }, files.map((f) => f.data));
  },
};

export type GeometryApi = typeof api;
Comlink.expose(api);
