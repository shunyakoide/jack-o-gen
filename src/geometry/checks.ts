// プリント適性チェック。赤＝出力不可、黄＝警告、緑＝OK。

import type { Params } from '../model/params';
import type { FaceCheck } from './face/layout';

export type CheckLevel = 'red' | 'yellow' | 'green';

export interface CheckItem {
  id: string;
  level: CheckLevel;
  label: string;
  detail: string;
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
  const lantern = p.mode === 'lantern';

  const okMesh = c.status === 'NoError' && !c.empty;
  items.push({
    id: 'manifold',
    level: okMesh ? (c.components === 1 ? 'green' : 'red') : 'red',
    label: 'メッシュの健全性（manifold）',
    detail: !okMesh
      ? `メッシュが壊れています（${c.status}）`
      : c.components === 1
        ? '閉じた1つの立体です'
        : `${c.components}個の部品に分かれています（浮いた部品があります）`,
  });

  const maxDim = Math.max(c.stats.width, c.stats.depth, c.stats.height);
  items.push({
    id: 'bed',
    level: maxDim <= BED ? 'green' : 'red',
    label: `造形範囲（${BED}mm角）`,
    detail: `${c.stats.width.toFixed(0)} × ${c.stats.depth.toFixed(0)} × ${c.stats.height.toFixed(0)} mm`,
  });

  items.push({
    id: 'wall',
    level: !lantern || p.wall >= MIN_WALL ? 'green' : 'red',
    label: `肉厚 ${MIN_WALL}mm以上`,
    detail: lantern ? `肉厚 ${p.wall.toFixed(1)}mm（内側は法線方向にオフセット）` : '密閉モード（ソリッド）',
  });

  const ratio = c.stats.contactDiameter / c.stats.maxDiameter;
  const ledFits = !lantern || p.led + 2 * p.wall + 2 <= c.stats.contactDiameter;
  items.push({
    id: 'base',
    level: ratio >= 0.35 && ledFits ? 'green' : 'red',
    label: '接地面',
    detail:
      `接地径 ${c.stats.contactDiameter.toFixed(0)}mm（最大径の${Math.round(ratio * 100)}%）` +
      (lantern ? (ledFits ? `／LED開口 φ${p.led}mm` : '／LED開口が底に収まりません') : ''),
  });

  const f = c.face;
  if (f.holeCount > 0) {
    const holeLevel: CheckLevel = f.tinyHoles > 0 || f.thinHoleArea > 1 ? 'yellow' : 'green';
    items.push({
      id: 'hole',
      level: holeLevel,
      label: '穴の幅 2mm以上',
      detail:
        f.tinyHoles > 0
          ? `幅2mm未満の小さな穴が${f.tinyHoles}個あります（ふさがる可能性）`
          : f.thinHoleArea > 1
            ? `幅2mm未満の細い部分があります（約${f.thinHoleArea.toFixed(0)}mm²）`
            : `${f.holeCount}個の穴はすべて幅2mm以上です`,
    });
    const linkLevel: CheckLevel = f.mergedHoles > 0 || f.narrowBridgeArea > 1 ? 'yellow' : 'green';
    items.push({
      id: 'link',
      level: linkLevel,
      label: '穴と穴の間 3mm以上',
      detail:
        f.mergedHoles > 0
          ? `間隔3mm未満の穴が${f.mergedHoles}か所あります（折れやすい）`
          : f.narrowBridgeArea > 1
            ? '歯などの連結部に3mm未満の細い部分があります'
            : '連結部はすべて3mm以上です',
    });
    if (f.islands > 0) {
      items.push({
        id: 'island',
        level: 'green',
        label: '島のブリッジ',
        detail: `${f.islands}個の島に幅${p.bridge}mmのブリッジを自動で追加しました`,
      });
    }
  }

  const level: CheckLevel = items.some((i) => i.level === 'red')
    ? 'red'
    : items.some((i) => i.level === 'yellow')
      ? 'yellow'
      : 'green';
  return { items, level };
}
