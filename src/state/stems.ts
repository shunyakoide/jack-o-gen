// ヘタのパターン。選ぶとヘタ関連のパラメータをまとめて設定する。
// 曲がりは 0.4 程度まで（それ以上は先端の下面が下を向き、サポートなしでは垂れやすい）。
import type { NumParams } from '../model/params';

export type StemKey =
  | 'stemHeight' | 'stemRadius' | 'stemBend' | 'stemTwist' | 'stemTaper' | 'stemSides' | 'stemStar' | 'stemFlare';
export type StemValues = Pick<NumParams, StemKey>;

export interface StemStyle {
  id: string;
  icon: string;
  values: StemValues;
}

export const STEM_STYLES: StemStyle[] = [
  { id: 'classic', icon: '🪵', values: { stemHeight: 0.2, stemRadius: 0.09, stemBend: 0.3, stemTwist: 40, stemTaper: 0.3, stemSides: 5, stemStar: 0.15, stemFlare: 0.5 } },
  { id: 'stubby', icon: '🍄', values: { stemHeight: 0.09, stemRadius: 0.13, stemBend: 0.05, stemTwist: 15, stemTaper: 0.15, stemSides: 6, stemStar: 0.25, stemFlare: 0.7 } },
  { id: 'tall', icon: '🕯️', values: { stemHeight: 0.38, stemRadius: 0.08, stemBend: 0, stemTwist: 20, stemTaper: 0.35, stemSides: 5, stemStar: 0.12, stemFlare: 0.4 } },
  { id: 'crooked', icon: '🪝', values: { stemHeight: 0.3, stemRadius: 0.08, stemBend: 0.4, stemTwist: 90, stemTaper: 0.45, stemSides: 5, stemStar: 0.1, stemFlare: 0.5 } },
  { id: 'twisted', icon: '🌀', values: { stemHeight: 0.24, stemRadius: 0.095, stemBend: 0.15, stemTwist: 170, stemTaper: 0.3, stemSides: 6, stemStar: 0.4, stemFlare: 0.6 } },
  { id: 'chunky', icon: '🧱', values: { stemHeight: 0.16, stemRadius: 0.16, stemBend: 0.1, stemTwist: 10, stemTaper: 0.2, stemSides: 8, stemStar: 0.3, stemFlare: 0.8 } },
];

export const STEM_KEYS = Object.keys(STEM_STYLES[0].values) as StemKey[];

/** 現在の値に一致するパターン（スライダーで変えたら null） */
export function matchStem(p: NumParams): string | null {
  const s = STEM_STYLES.find((st) => STEM_KEYS.every((k) => Math.abs(st.values[k] - p[k]) < 1e-6));
  return s?.id ?? null;
}
