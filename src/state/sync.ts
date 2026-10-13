// パラメータ変更 → Worker でビルド（操作中は draft、停止後に preview。最新の要求だけを処理）、URL 同期。
import { useEffect } from 'react';
import { callWorker } from '../worker/client';
import { useStore } from './store';
import { encodeParams } from './url';
import type { Params } from '../model/params';
import type { Quality } from '../geometry/build';

export function useAutoBuild() {
  useEffect(() => {
    let busy = false;
    let pending: { p: Params; q: Quality } | null = null;
    let settle: ReturnType<typeof setTimeout> | undefined;

    const run = async (p: Params, q: Quality) => {
      busy = true;
      useStore.getState().setBuilding(true);
      try {
        const r = await callWorker((g) => g.build(p, q), 30_000);
        useStore.getState().setPreview(r);
      } catch (e) {
        console.error(e);
        useStore.getState().setPreview(useStore.getState().preview, String(e));
      } finally {
        busy = false;
        if (pending) {
          const next = pending;
          pending = null;
          void run(next.p, next.q);
        } else {
          useStore.getState().setBuilding(false);
        }
      }
    };

    const request = (p: Params, q: Quality) => {
      if (busy) pending = { p, q };
      else void run(p, q);
    };

    // 操作中は粗い draft を即座に、手が止まったら通常の preview で仕上げる
    const onChange = (p: Params) => {
      request(p, 'draft');
      clearTimeout(settle);
      settle = setTimeout(() => request(p, 'preview'), 250);
    };

    request(useStore.getState().params, 'preview');
    const unsub = useStore.subscribe((s, prev) => {
      if (s.params !== prev.params) onChange(s.params);
    });
    return () => {
      unsub();
      clearTimeout(settle);
    };
  }, []);
}

export function useUrlSync() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const write = (p: Params) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        history.replaceState(null, '', `${location.pathname}?${encodeParams(p)}`);
      }, 250);
    };
    const unsub = useStore.subscribe((s, prev) => {
      if (s.params !== prev.params) write(s.params);
    });
    return () => {
      unsub();
      clearTimeout(timer);
    };
  }, []);
}

export function shareUrl(p: Params): string {
  return `${location.origin}${location.pathname}?${encodeParams(p)}`;
}
