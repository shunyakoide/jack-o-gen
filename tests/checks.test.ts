import { describe, expect, it } from 'vitest';
import { runChecks, type CheckInput } from '../src/geometry/checks';
import { defaultParams } from '../src/model/params';
import { en } from '../src/i18n/en';
import { ja } from '../src/i18n/ja';

const ok: CheckInput = {
  status: 'NoError', empty: false, components: 1,
  stats: { contactDiameter: 60, maxDiameter: 120 },
  peg: { rp: 2, hp: 5, fits: true },
  face: { thinHoleArea: 0, tinyHoles: 0, narrowBridgeArea: 0, mergedHoles: 0, islands: 0, holeCount: 4, holeParts: [], linkParts: [], problems: [] },
};
const bad: Partial<CheckInput>[] = [
  { components: 2 }, { status: 'NotManifold' },
  { peg: { rp: 1.5, hp: 2, fits: false } }, { stats: { contactDiameter: 30, maxDiameter: 120 } },
  { stats: { contactDiameter: 60, maxDiameter: 240 } },
  { face: { ...ok.face, tinyHoles: 1 } }, { face: { ...ok.face, thinHoleArea: 5 } },
  { face: { ...ok.face, mergedHoles: 1 } }, { face: { ...ok.face, narrowBridgeArea: 5 } },
  { lid: { opening: 30, lipHeight: 3, fits: true } }, { lid: { opening: 8, lipHeight: 0, fits: false } },
  { lid: { opening: 50, lipHeight: 6, fits: true }, stats: { contactDiameter: 30, maxDiameter: 120 } },
];

describe('チェックの直し方', () => {
  it('緑以外の判定にはすべて両言語の直し方がある', () => {
    const seen = new Set<string>();
    for (const b of bad) {
      for (const c of runChecks(defaultParams(), { ...ok, ...b }).items) {
        if (c.level === 'green') continue;
        const key = `check.${c.id}.${c.detail}.fix`;
        seen.add(key);
        expect(en[key], key).toBeTruthy();
        expect(ja[key], key).toBeTruthy();
      }
    }
    expect([...seen].sort()).toEqual(Object.keys(en).filter((k) => k.endsWith('.fix')).sort());
  });
});
