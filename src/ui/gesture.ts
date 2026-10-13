// スライダーなどに付けるハンドラ：押してから離すまで（ドラッグ・キー長押し）を元に戻すの 1 手にまとめる
import { beginGesture, endGesture } from '../state/store';

export const gestureProps = {
  onPointerDown: () => {
    beginGesture();
    // つまみの外で指を離しても終わらせる（同じ関数の重複登録はブラウザが無視する）
    addEventListener('pointerup', endGesture, { once: true });
    addEventListener('pointercancel', endGesture, { once: true });
  },
  onKeyDown: beginGesture,
  onKeyUp: endGesture,
  onBlur: endGesture,
};
