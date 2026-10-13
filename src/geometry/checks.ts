// プリント適性チェック。赤＝出力不可、黄＝警告、緑＝OK。

import type { Params } from '../model/params';
import type { FaceCheck } from './face/layout';

export type CheckLevel = 'red' | 'yellow' | 'green';

export interface CheckItem {
  id: string;
  level: CheckLevel;
  /** 表示文のキー（UI 側で翻訳する）。label は `check.<id>`、detail は `check.<id>.<detail>` */
  detail: string;
  vars: Record<string, string | number>;
}

export interface CheckInput {
  status: string;
  empty: boolean;
  components: number;
  stats: { width: number; depth: number; height: number; contactDiameter: number; maxDiameter: number };
  face: FaceCheck;
}

const BED = 250;
const MIN_WALL = 1.2;

export function runChecks(p: Params, c: CheckInput): { items: CheckItem[]; level: CheckLevel } {
  const items: CheckItem[] = [];

  const okMesh = c.status === 'NoError' && !c.empty;
  items.push({
    id: 'manifold',
    level: okMesh && c.components === 1 ? 'green' : 'red',
    detail: !okMesh ? 'broken' : c.components === 1 ? 'ok' : 'parts',
    vars: { status: c.status, n: c.components },
  });

  const maxDim = Math.max(c.stats.width, c.stats.depth, c.stats.height);
  items.push({
    id: 'bed',
    level: maxDim <= BED ? 'green' : 'red',
    detail: 'size',
    vars: { bed: BED, w: c.stats.width.toFixed(0), d: c.stats.depth.toFixed(0), h: c.stats.height.toFixed(0) },
  });

  items.push({
    id: 'wall',
    level: p.wall >= MIN_WALL ? 'green' : 'red',
    detail: 'hollow',
    vars: { min: MIN_WALL, wall: p.wall.toFixed(1) },
  });

  const ratio = c.stats.contactDiameter / c.stats.maxDiameter;
  const ledFits = p.led + 2 * p.wall + 2 <= c.stats.contactDiameter;
  items.push({
    id: 'base',
    level: ratio >= 0.35 && ledFits ? 'green' : 'red',
    detail: ledFits ? 'led' : 'ledTooBig',
    vars: { d: c.stats.contactDiameter.toFixed(0), pct: Math.round(ratio * 100), led: p.led },
  });

  const f = c.face;
  if (f.holeCount > 0) {
    items.push({
      id: 'hole',
      level: f.tinyHoles > 0 || f.thinHoleArea > 1 ? 'yellow' : 'green',
      detail: f.tinyHoles > 0 ? 'tiny' : f.thinHoleArea > 1 ? 'thin' : 'ok',
      vars: { n: f.tinyHoles || f.holeCount, area: f.thinHoleArea.toFixed(0) },
    });
    items.push({
      id: 'link',
      level: f.mergedHoles > 0 || f.narrowBridgeArea > 1 ? 'yellow' : 'green',
      detail: f.mergedHoles > 0 ? 'merged' : f.narrowBridgeArea > 1 ? 'narrow' : 'ok',
      vars: { n: f.mergedHoles },
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
