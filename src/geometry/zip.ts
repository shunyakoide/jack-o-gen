// 無圧縮（store）の ZIP 書き出し。STL 2 本をまとめるだけなので依存を増やさない。

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export function zipStore(files: { name: string; data: ArrayBuffer }[]): ArrayBuffer {
  const enc = new TextEncoder();
  const entries = files.map((f) => ({ name: enc.encode(f.name), data: new Uint8Array(f.data), crc: crc32(new Uint8Array(f.data)), offset: 0 }));
  const localSize = entries.reduce((s, e) => s + 30 + e.name.length + e.data.length, 0);
  const centralSize = entries.reduce((s, e) => s + 46 + e.name.length, 0);
  const out = new Uint8Array(localSize + centralSize + 22);
  const v = new DataView(out.buffer);
  let p = 0;
  // ヘッダ共通部：必要バージョン 20、UTF-8 ファイル名フラグ、store、日時 1980-01-01
  const common = (e: (typeof entries)[number]) => {
    v.setUint16(p, 20, true);
    v.setUint16(p + 2, 0x0800, true);
    v.setUint16(p + 4, 0, true);
    v.setUint16(p + 6, 0, true);
    v.setUint16(p + 8, 0x21, true);
    v.setUint32(p + 10, e.crc, true);
    v.setUint32(p + 14, e.data.length, true);
    v.setUint32(p + 18, e.data.length, true);
    v.setUint16(p + 22, e.name.length, true);
    v.setUint16(p + 24, 0, true);
    p += 26;
  };
  for (const e of entries) {
    e.offset = p;
    v.setUint32(p, 0x04034b50, true);
    p += 4;
    common(e);
    out.set(e.name, p);
    p += e.name.length;
    out.set(e.data, p);
    p += e.data.length;
  }
  const cd = p;
  for (const e of entries) {
    v.setUint32(p, 0x02014b50, true);
    v.setUint16(p + 4, 20, true);
    p += 6;
    common(e);
    v.setUint16(p, 0, true); // コメント長
    v.setUint16(p + 2, 0, true); // ディスク番号
    v.setUint16(p + 4, 0, true); // 内部属性
    v.setUint32(p + 6, 0, true); // 外部属性
    v.setUint32(p + 10, e.offset, true);
    p += 14;
    out.set(e.name, p);
    p += e.name.length;
  }
  v.setUint32(p, 0x06054b50, true);
  v.setUint16(p + 8, entries.length, true);
  v.setUint16(p + 10, entries.length, true);
  v.setUint32(p + 12, p - cd, true);
  v.setUint32(p + 16, cd, true);
  return out.buffer;
}
