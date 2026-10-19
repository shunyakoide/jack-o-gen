// 形状生成を UI スレッドから分離する Worker。
import * as Comlink from 'comlink';
import wasmUrl from 'manifold-3d/manifold.wasm?url';
import { buildPumpkin, type BuildResult, type Quality } from '../geometry/build';
import { loadManifold } from '../geometry/manifold';
import { boxOf, printLayout } from '../geometry/layout';
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
    if (r.lid) bufs.push(r.lid.positions.buffer, r.lid.indices.buffer);
    return Comlink.transfer(r, bufs);
  },
  /**
   * 蓋付きでは蓋を、差し込み式ではヘタを別ファイル（'-lid.stl'・'-stem.stl'、底面を z=0 に移動）にする。
   * 色分けでは 3MF 1 つ（本体＋顔 = 1 オブジェクトの 2 パーツ、顔はフィラメント 2。蓋・ヘタは横に並べた別オブジェクト）
   */
  async exportFiles(p: Params): Promise<{ files: { suffix: string; data: ArrayBuffer }[]; result: Omit<BuildResult, 'positions' | 'indices' | 'stem' | 'face' | 'lid'> }> {
    const wasm = await loadManifold(wasmUrl);
    const r = buildPumpkin(wasm, p, 'export');
    const loose = [r.lid && { name: 'lid', ...r.lid }, r.stem && { name: 'stem', ...r.stem }].filter((x) => !!x);
    for (const part of loose) {
      const pos = part.positions;
      for (let i = 2; i < pos.length; i += 3) pos[i] -= part.seatZ;
    }
    const files: { suffix: string; data: ArrayBuffer }[] = [];
    if (r.face) {
      // 本体の右に 10 mm ずつ空けて並べる（Print タブのプレビューと同じ）
      const layout = printLayout(boxOf(r.positions), loose.map((part) => ({ box: boxOf(part.positions), seatZ: 0 })));
      const objects: ThreeMfObject[] = [
        {
          name: 'jack-o-gen',
          parts: [
            { name: 'body', positions: r.positions, indices: r.indices, extruder: 1, color: BODY_COLOR },
            { name: 'face', positions: r.face.positions, indices: r.face.indices, extruder: 2, color: FACE_COLOR },
          ],
        },
        ...loose.map((part, i): ThreeMfObject => ({
          name: part.name,
          parts: [{ name: part.name, positions: part.positions, indices: part.indices, extruder: 1, color: BODY_COLOR }],
          offset: [layout.parts[i][0] - layout.body[0], layout.parts[i][1] - layout.body[1], 0],
        })),
      ];
      files.push({ suffix: '.3mf', data: to3mf(objects) });
    } else {
      files.push({ suffix: '.stl', data: toBinaryStl(r.positions, r.indices) });
      for (const part of loose) files.push({ suffix: `-${part.name}.stl`, data: toBinaryStl(part.positions, part.indices) });
    }
    const { positions, indices, stem, face, lid, ...rest } = r;
    void positions;
    void indices;
    void stem;
    void face;
    void lid;
    return Comlink.transfer({ files, result: rest }, files.map((f) => f.data));
  },
};

export type GeometryApi = typeof api;
Comlink.expose(api);
