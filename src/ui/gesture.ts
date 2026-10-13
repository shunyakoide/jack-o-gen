import { beginGesture, endGesture } from '../state/store';

/**
 * 押してから離すまで（ドラッグ・キー長押し）の変更を元に戻すの 1 手にまとめる。
 * 離したのがどの要素でも終わるよう window で待つ（blur では切らない：押した瞬間に前の要素の blur が来るため）
 */
export function holdGesture(e: { type: string }) {
  beginGesture();
  // 同じ関数の重複登録はブラウザが無視する
  for (const t of e.type === 'keydown' ? ['keyup'] : ['pointerup', 'pointercancel']) {
    addEventListener(t, endGesture, { once: true });
  }
}

export const gestureProps = { onPointerDown: holdGesture, onKeyDown: holdGesture };
