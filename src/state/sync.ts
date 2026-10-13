// パラメータ変更 → Worker で低解像度ビルド（最新の要求だけを処理）、URL 同期。
import { useEffect } from 'react';
import { geometry } from '../worker/client';
import { useStore } from './store';
import { encodeParams } from './url';
import type { Params } from '../model/params';

export function useAutoBuild() {
  useEffect(() => {
    let busy = false;
    let pending: Params | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const run = async (p: Params) => {
      busy = true;
      useStore.getState().setBuilding(true);
      try {
        const r = await geometry().build(p, 'preview');
        useStore.getState().setPreview(r);
      } catch (e) {
        console.error(e);
        useStore.getState().setPreview(useStore.getState().preview, String(e));
      } finally {
        busy = false;
        if (pending) {
          const next = pending;
          pending = null;
          void run(next);
        } else {
          useStore.getState().setBuilding(false);
        }
      }
    };

    const request = (p: Params) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (busy) pending = p;
        else void run(p);
      }, 60);
    };

    request(useStore.getState().params);
    const unsub = useStore.subscribe((s, prev) => {
      if (s.params !== prev.params) request(s.params);
    });
    return () => {
      unsub();
      clearTimeout(timer);
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
