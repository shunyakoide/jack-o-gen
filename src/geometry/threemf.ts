// 3MF の書き出し（座標は mm、z が上）。色分けモードの本体＋顔を 1 オブジェクトの複数パーツとして渡す。
// パーツは 3MF コアの components なので どのスライサーでも 1 オブジェクトになる。
// フィラメント割り当ては Bambu Studio / OrcaSlicer の Metadata/model_settings.config（part id = 部品メッシュの object id、key "extruder"）。
import { zipStore } from './zip';

export type ThreeMfPart = { name: string; positions: Float32Array; indices: Uint32Array; extruder: number };
/** parts が 1 つのオブジェクトの部品。offset は配置（ビルド面上でずらして重ならないようにする） */
export type ThreeMfObject = { name: string; parts: ThreeMfPart[]; offset?: [number, number, number] };

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// 0.1 µm に丸めて桁数を抑える（同じ float は同じ文字列になるので本体と顔の境界は一致したまま）
const num = (v: number) => String(Math.round(v * 1e4) / 1e4);

function meshXml(id: number, p: ThreeMfPart): string {
  const out = [`<object id="${id}" name="${esc(p.name)}" type="model"><mesh><vertices>`];
  const pos = p.positions;
  for (let i = 0; i < pos.length; i += 3) out.push(`<vertex x="${num(pos[i])}" y="${num(pos[i + 1])}" z="${num(pos[i + 2])}"/>`);
  out.push('</vertices><triangles>');
  const ix = p.indices;
  for (let i = 0; i < ix.length; i += 3) out.push(`<triangle v1="${ix[i]}" v2="${ix[i + 1]}" v3="${ix[i + 2]}"/>`);
  out.push('</triangles></mesh></object>');
  return out.join('\n');
}

export function to3mf(objects: ThreeMfObject[]): ArrayBuffer {
  const res: string[] = [];
  const items: string[] = [];
  const config: string[] = [];
  let id = 1;
  for (const o of objects) {
    const partIds = o.parts.map((p) => {
      res.push(meshXml(id, p));
      return id++;
    });
    const objId = id++;
    res.push(`<object id="${objId}" name="${esc(o.name)}" type="model"><components>${partIds.map((pid) => `<component objectid="${pid}"/>`).join('')}</components></object>`);
    const [x, y, z] = o.offset ?? [0, 0, 0];
    items.push(`<item objectid="${objId}" transform="1 0 0 0 1 0 0 0 1 ${num(x)} ${num(y)} ${num(z)}"/>`);
    config.push(
      `<object id="${objId}"><metadata key="name" value="${esc(o.name)}"/><metadata key="extruder" value="${o.parts[0].extruder}"/>`,
      ...o.parts.map((p, i) => `<part id="${partIds[i]}" subtype="normal_part"><metadata key="name" value="${esc(p.name)}"/><metadata key="extruder" value="${p.extruder}"/></part>`),
      '</object>',
    );
  }
  const model = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">',
    '<metadata name="Application">Jack-o-Gen</metadata>',
    '<resources>',
    ...res,
    '</resources>',
    `<build>${items.join('')}</build>`,
    '</model>',
  ].join('\n');
  const enc = new TextEncoder();
  const file = (name: string, text: string) => ({ name, data: enc.encode(text).buffer as ArrayBuffer });
  return zipStore([
    file(
      '[Content_Types].xml',
      '<?xml version="1.0" encoding="UTF-8"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/><Default Extension="config" ContentType="text/xml"/></Types>',
    ),
    file(
      '_rels/.rels',
      '<?xml version="1.0" encoding="UTF-8"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>',
    ),
    file('3D/3dmodel.model', model),
    file('Metadata/model_settings.config', ['<?xml version="1.0" encoding="UTF-8"?>', '<config>', ...config, '</config>'].join('\n')),
  ]);
}
