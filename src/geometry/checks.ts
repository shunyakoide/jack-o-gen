// プリント適性チェック。赤＝出力不可、黄＝警告、緑＝OK。

import type { Params, SelKey } from '../model/params';
import { AREA_TOL, type FaceCheck } from './face/layout';
import { ledHole } from './body';
import { FIT } from './stem';
import { LID } from './build';

export type CheckLevel = 'red' | 'yellow' | 'green';

export interface CheckItem {
  id: string;
  level: CheckLevel;
  /** 表示文のキー（UI 側で翻訳する）。label は `check.<id>`、detail は `check.<id>.<detail>` */
  detail: string;
  vars: Record<string, string | number>;
  /** 原因の顔パーツ（警告を押すとエディタで選ぶ） */
  parts?: SelKey[];
}

export interface CheckInput {
  status: string;
  empty: boolean;
  components: number;
  stats: { contactDiameter: number; maxDiameter: number };
  /** 差し込み式のピン寸法。fits=false はヘタが細すぎて最小ピンでも肉厚が残らない */
  peg: { rp: number; hp: number; fits: boolean } | null;
  face: FaceCheck;
  /** 色分け：顔に穴が開かないので、穴の幅・連結部のチェックは要らない */
  inlay?: boolean;
  /** 蓋付き：器の口の内接円の径 [mm]。fits=false は顔が蓋にかかる */
  lid?: { opening: number; fits: boolean } | null;
}

export function runChecks(p: Params, c: CheckInput): { items: CheckItem[]; level: CheckLevel } {
  const items: CheckItem[] = [];

  const okMesh = c.status === 'NoError' && !c.empty;
  items.push({
    id: 'manifold',
    level: okMesh && c.components === 1 ? 'green' : 'red',
    detail: !okMesh ? 'broken' : c.components === 1 ? 'ok' : 'parts',
    vars: { status: c.status, n: c.components },
  });

  if (c.peg) {
    items.push({
      id: 'peg',
      level: c.peg.fits ? 'green' : 'yellow',
      detail: c.peg.fits ? 'ok' : 'thin',
      vars: { d: (c.peg.rp * 2).toFixed(1), h: c.peg.hp.toFixed(1), wall: FIT.minWall },
    });
  }

  if (c.lid) {
    const small = c.lid.opening < LID.teaLight;
    items.push({
      id: 'lid',
      level: !c.lid.fits ? 'red' : small ? 'yellow' : 'green',
      detail: !c.lid.fits ? 'face' : small ? 'small' : 'ok',
      vars: { d: c.lid.opening.toFixed(0), led: LID.teaLight },
    });
  }

  const ratio = c.stats.contactDiameter / c.stats.maxDiameter;
  const led = ledHole(p);
  // 蓋付きは底に穴が無い
  const ledFits = !!c.lid || led + 2 * p.wall + 2 <= c.stats.contactDiameter;
  items.push({
    id: 'base',
    level: ratio >= 0.35 && ledFits ? 'green' : 'red',
    detail: c.lid ? 'closed' : ledFits ? 'led' : 'ledTooBig',
    vars: { d: c.stats.contactDiameter.toFixed(0), pct: Math.round(ratio * 100), led: led.toFixed(0) },
  });

  const f = c.face;
  if (f.holeCount > 0 && !c.inlay) {
    items.push({
      id: 'hole',
      level: f.tinyHoles > 0 || f.thinHoleArea > AREA_TOL ? 'yellow' : 'green',
      detail: f.tinyHoles > 0 ? 'tiny' : f.thinHoleArea > AREA_TOL ? 'thin' : 'ok',
      vars: { n: f.tinyHoles || f.holeCount, area: f.thinHoleArea.toFixed(0) },
      parts: f.holeParts,
    });
    items.push({
      id: 'link',
      level: f.mergedHoles > 0 || f.narrowBridgeArea > AREA_TOL ? 'yellow' : 'green',
      detail: f.mergedHoles > 0 ? 'merged' : f.narrowBridgeArea > AREA_TOL ? 'narrow' : 'ok',
      vars: { n: f.mergedHoles },
      parts: f.linkParts,
    });
    if (f.islands > 0) {
      items.push({ id: 'island', level: 'green', detail: 'added', vars: { n: f.islands, w: p.bridge } });
    }
  }

  const level: CheckLevel = items.some((i) => i.level === 'red')
    ? 'red'
    : items.some((i) => i.level === 'yellow')
      ? 'yellow'
      : 'green';
  return { items, level };
}
