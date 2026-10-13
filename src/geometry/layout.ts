// 造形ベッド上の配置（Print タブのプレビュー用）。純粋関数のみ。
export type Vec3 = [number, number, number];
export interface Box {
  min: Vec3;
  max: Vec3;
}

export function boxOf(pos: ArrayLike<number>): Box {
  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < pos.length; i++) {
    const k = i % 3;
    if (pos[i] < min[k]) min[k] = pos[i];
    if (pos[i] > max[k]) max[k] = pos[i];
  }
  return { min, max };
}

/** STL に書き出される大きさ（ヘタは seatZ を底面として測る） */
export function partSize(box: Box, floorZ = box.min[2]): Vec3 {
  return [box.max[0] - box.min[0], box.max[1] - box.min[1], box.max[2] - floorZ];
}

/**
 * 本体とヘタを +x 方向に gap mm あけて並べ、組の中心をベッド中央 (0,0) に置く平行移動量。
 * 本体は底面を z=0、ヘタは seatZ を z=0 に下ろす。
 */
export function printLayout(body: Box, stem: { box: Box; seatZ: number } | null, gap = 10): { body: Vec3; stem: Vec3 | null } {
  const cy = (b: Box) => -(b.min[1] + b.max[1]) / 2;
  if (!stem) return { body: [-(body.min[0] + body.max[0]) / 2, cy(body), -body.min[2]], stem: null };
  const s = stem.box;
  const total = body.max[0] - body.min[0] + gap + (s.max[0] - s.min[0]);
  const bx = -total / 2 - body.min[0];
  return {
    body: [bx, cy(body), -body.min[2]],
    stem: [bx + body.max[0] + gap - s.min[0], cy(s), -stem.seatZ],
  };
}
