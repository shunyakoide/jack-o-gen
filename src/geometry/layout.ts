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

/** パーツどうしの間隔 [mm] */
export const PRINT_GAP = 10;

/** 別パーツ（蓋・ヘタ）。seatZ をベッド面 z=0 に下ろす */
export interface LoosePart {
  box: Box;
  seatZ: number;
}

/**
 * 本体の +x 側に別パーツを gap mm ずつあけて順に並べ、組の中心をベッド中央 (0,0) に置く平行移動量。
 * 本体は底面を z=0 に下ろす。
 */
export function printLayout(body: Box, parts: LoosePart[], gap = PRINT_GAP): { body: Vec3; parts: Vec3[] } {
  const cy = (b: Box) => -(b.min[1] + b.max[1]) / 2;
  const width = (b: Box) => b.max[0] - b.min[0];
  const total = parts.reduce((w, p) => w + gap + width(p.box), width(body));
  let x = -total / 2;
  const place = (b: Box, z: number): Vec3 => {
    const v: Vec3 = [x - b.min[0], cy(b), -z];
    x += width(b) + gap;
    return v;
  };
  return { body: place(body, body.min[2]), parts: parts.map((p) => place(p.box, p.seatZ)) };
}
