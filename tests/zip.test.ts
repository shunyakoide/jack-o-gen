import { describe, expect, it } from 'vitest';
import { crc32, zipStore } from '../src/geometry/zip';

const enc = new TextEncoder();
const bytes = (s: string) => enc.encode(s).buffer as ArrayBuffer;

describe('zipStore', () => {
  it('crc32 は既知値と一致', () => {
    expect(crc32(enc.encode('hello'))).toBe(0x3610a686);
  });

  it('中央ディレクトリから 2 ファイルの名前と中身を取り出せる', () => {
    const buf = zipStore([{ name: 'body.stl', data: bytes('solid body') }, { name: 'body-stem.stl', data: bytes('solid stem!') }], new Date(2026, 9, 24, 18, 30, 10));
    const v = new DataView(buf);
    const end = buf.byteLength - 22;
    expect(v.getUint32(end, true)).toBe(0x06054b50);
    expect(v.getUint16(end + 10, true)).toBe(2);
    const dec = new TextDecoder();
    const got: Record<string, string> = {};
    let p = v.getUint32(end + 16, true);
    for (let i = 0; i < 2; i++) {
      expect(v.getUint32(p, true)).toBe(0x02014b50);
      const size = v.getUint32(p + 20, true);
      const nameLen = v.getUint16(p + 28, true);
      const local = v.getUint32(p + 42, true);
      const name = dec.decode(new Uint8Array(buf, p + 46, nameLen));
      const dataAt = local + 30 + v.getUint16(local + 26, true);
      got[name] = dec.decode(new Uint8Array(buf, dataAt, size));
      p += 46 + nameLen;
    }
    expect(got).toEqual({ 'body.stl': 'solid body', 'body-stem.stl': 'solid stem!' });
    // 2026-10-24 18:30:10 → DOS 日付・時刻
    expect([v.getUint16(12, true), v.getUint16(10, true)]).toEqual([((2026 - 1980) << 9) | (10 << 5) | 24, (18 << 11) | (30 << 5) | 5]);
  });
});
