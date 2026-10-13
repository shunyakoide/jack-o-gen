// 差し込み穴の肉厚テスト本体。1 件約 1.5 秒 × 21 件と重いので、直径ごとに別ファイルから呼んで並列に走らせる
import { describe, expect, it } from 'vitest';
import { buildPumpkin } from '../src/geometry/build';
import { loadManifold } from '../src/geometry/manifold';
import { defaultParams, type Params } from '../src/model/params';
import { PRESET_CARDS } from '../src/state/presets';
import { STEM_STYLES } from '../src/state/stems';
import { stemWall } from './fit-helpers';

const wasm = await loadManifold();

export function pegWallSuite(D: number) {
  describe(`差し込み穴の肉厚 D=${D}`, () => {
    const ghost = PRESET_CARDS.find((c) => c.id === 'ghost')!.make(42);
    const cases: [string, Partial<Params>][] = [...STEM_STYLES.map((s): [string, Partial<Params>] => [s.id, s.values]), ['ghost', ghost]];
    for (const [id, values] of cases) {
      it(`${id}：穴のまわりに 0.8 mm 以上残るか、細すぎの警告が出る`, () => {
        const p: Params = { ...defaultParams(), ...values, diameter: D, stemAttach: 'peg' };
        const r = buildPumpkin(wasm, p, 'preview');
        const peg = r.checks.find((c) => c.id === 'peg')!;
        // 直径 120 以上ならどのヘタにも差し込める
        if (D >= 120) expect(peg.level).toBe('green');
        if (peg.level === 'green') expect(stemWall(wasm, p, r)).toBeGreaterThanOrEqual(0.8);
        else expect([peg.level, peg.detail]).toEqual(['yellow', 'thin']);
      });
    }
  });
}
