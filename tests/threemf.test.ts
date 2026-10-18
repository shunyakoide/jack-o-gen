import { describe, expect, it } from 'vitest';
import { loadManifold } from '../src/geometry/manifold';
import { to3mf } from '../src/geometry/threemf';
import { defaultParams } from '../src/model/params';
import { cachedBuild } from './fit-helpers';

const wasm = await loadManifold();

// store-only zip の中央ディレクトリから 名前 → 中身（文字列）を取り出す
function unzip(buf: ArrayBuffer): Record<string, string> {
  const v = new DataView(buf);
  const dec = new TextDecoder();
  const end = buf.byteLength - 22;
  const out: Record<string, string> = {};
  let p = v.getUint32(end + 16, true);
  for (let i = 0; i < v.getUint16(end + 10, true); i++) {
    const size = v.getUint32(p + 20, true);
    const nameLen = v.getUint16(p + 28, true);
    const local = v.getUint32(p + 42, true);
    const dataAt = local + 30 + v.getUint16(local + 26, true);
    out[dec.decode(new Uint8Array(buf, p + 46, nameLen))] = dec.decode(new Uint8Array(buf, dataAt, size));
    p += 46 + nameLen;
  }
  return out;
}

// 開きタグと閉じタグの対応だけを確かめる最小の整形式チェック（node には DOMParser がない）
function wellFormed(xml: string): boolean {
  const stack: string[] = [];
  for (const m of xml.replace(/<\?xml[^>]*\?>/, '').matchAll(/<(\/?)([\w:]+)[^>]*?(\/?)>/g)) {
    if (m[1]) {
      if (stack.pop() !== m[2]) return false;
    } else if (!m[3]) stack.push(m[2]);
  }
  return stack.length === 0;
}

describe('3MF', () => {
  it('色分けの本体と顔を 1 オブジェクトの 2 パーツにし、顔をフィラメント 2 に割り当てる', () => {
    const r = cachedBuild(wasm, { ...defaultParams(), faceStyle: 'inlay', stemAttach: 'peg' }, 'preview');
    const stem = r.stem!;
    const files = unzip(
      to3mf([
        { name: 'lantern', parts: [{ name: 'body', positions: r.positions, indices: r.indices, extruder: 1 }, { name: 'face', positions: r.face!.positions, indices: r.face!.indices, extruder: 2 }] },
        { name: 'stem', parts: [{ name: 'stem', positions: stem.positions, indices: stem.indices, extruder: 1 }], offset: [100, 0, 0] },
      ]),
    );
    expect(Object.keys(files).sort()).toEqual(['3D/3dmodel.model', 'Metadata/model_settings.config', '[Content_Types].xml', '_rels/.rels']);
    for (const text of Object.values(files)) expect(wellFormed(text)).toBe(true);

    const model = files['3D/3dmodel.model'];
    const objects = [...model.matchAll(/<object id="(\d+)"[^>]*>([\s\S]*?)<\/object>/g)].map((m) => ({ id: m[1], body: m[2] }));
    const counts = objects.filter((o) => o.body.includes('<mesh>')).map((o) => [o.body.split('<vertex ').length - 1, o.body.split('<triangle ').length - 1]);
    expect(counts).toEqual([r.positions, r.face!.positions, stem.positions].map((pos, i) => [pos.length / 3, [r.indices, r.face!.indices, stem.indices][i].length / 3]));
    // 部品メッシュ 1・2 → オブジェクト 3、ヘタ 4 → オブジェクト 5。ビルドに載るのは 3 と 5 だけ
    expect(objects.find((o) => o.id === '3')!.body).toBe('<components><component objectid="1"/><component objectid="2"/></components>');
    expect([...model.matchAll(/<item objectid="(\d+)"/g)].map((m) => m[1])).toEqual(['3', '5']);

    const config = files['Metadata/model_settings.config'];
    expect([...config.matchAll(/<part id="(\d+)"[^>]*><metadata key="name" value="(\w+)"\/><metadata key="extruder" value="(\d)"/g)].map((m) => m.slice(1))).toEqual([
      ['1', 'body', '1'],
      ['2', 'face', '2'],
      ['4', 'stem', '1'],
    ]);
  });
});
