// アプリ全体の状態（zustand）。
import { create } from 'zustand';
import type { BuildResult } from '../geometry/build';
import { clampFace } from '../geometry/face/layout';
import {
  applySymmetry,
  clampNum,
  defaultParams,
  drawnIndex,
  drawnKey,
  MAX_DRAWN,
  NUM_DEF_BY_KEY,
  type DrawnPart,
  type FacePart,
  type NumParams,
  type Params,
  type PartKey,
  type SelKey,
  type StemAttach,
  type TabId,
} from '../model/params';
import { PRESET_CARDS } from './presets';
import { STEM_STYLES } from './stems';
import { decodeParams } from './url';

interface State {
  params: Params;
  tab: TabId;
  selectedPart: SelKey;
  /** 顔エディタのペン：面（なぞって囲う）か線か */
  pen: 'off' | 'fill' | 'line';
  preview: BuildResult | null;
  building: boolean;
  error: string | null;
  activePreset: string | null;
  /** プリセット適用直後：ビルド結果がベッドに収まらなければ直径を縮める */
  /** 元に戻す / やり直す用のパラメータ履歴 */
  past: Params[];
  future: Params[];
  undo: () => void;
  redo: () => void;
  setNum: (key: keyof NumParams, v: number) => void;
  setStemAttach: (a: StemAttach) => void;
  setSymmetric: (on: boolean) => void;
  setPart: (key: SelKey, patch: PartPatch) => void;
  /** 描いた形を足して選ぶ。上限に達していれば false */
  addDrawn: (d: DrawnPart) => boolean;
  removeDrawn: (i: number) => void;
  selectPart: (key: SelKey) => void;
  setPen: (pen: State['pen']) => void;
  setTab: (t: TabId) => void;
  applyPreset: (id: string) => void;
  applyStem: (id: string) => void;
  setPreview: (r: BuildResult | null, error?: string | null) => void;
  /** 画面下に少しだけ出す通知（翻訳キー） */
  toast: string | null;
  showToast: (key: string) => void;
  setBuilding: (b: boolean) => void;
}

export type PartPatch = Partial<FacePart> & { mirror?: boolean };

function initialParams(): Params {
  if (typeof location !== 'undefined') {
    const p = decodeParams(location.search);
    if (p) return p;
  }
  return defaultParams();
}

// 操作単位の履歴：ドラッグや長押し中（beginGesture〜endGesture）の変更は最初の 1 回だけ履歴に積む。
// 区切りがない変更（クリックなど）は毎回 1 手
let gesture: 'none' | 'open' | 'pushed' = 'none';

export function beginGesture() {
  if (gesture === 'none') gesture = 'open';
}

export function endGesture() {
  gesture = 'none';
}

/** params を変更しつつ履歴に積む */
function track(s: State, params: Params): Pick<State, 'params' | 'past' | 'future'> {
  const past = gesture === 'pushed' ? s.past : [...s.past, s.params].slice(-50);
  if (gesture === 'open') gesture = 'pushed';
  return { params, past, future: [] };
}

/** プリセットを選んでも変えない設定（大きさと印刷まわり） */
const KEEP_ON_PRESET = ['diameter', 'led', 'wall', 'floor', 'bridge', 'arch', 'stemAttach'] as const;

let toastTimer: ReturnType<typeof setTimeout> | undefined;

export const useStore = create<State>((set) => ({
  params: initialParams(),
  tab: 'shape',
  selectedPart: 'eyeL',
  pen: 'off',
  preview: null,
  building: false,
  error: null,
  activePreset: null,
  past: [],
  future: [],
  undo: () =>
    set((s) => {
      if (!s.past.length) return {};
      endGesture();
      return { params: s.past[s.past.length - 1], past: s.past.slice(0, -1), future: [s.params, ...s.future], activePreset: null };
    }),
  redo: () =>
    set((s) => {
      if (!s.future.length) return {};
      endGesture();
      return { params: s.future[0], past: [...s.past, s.params], future: s.future.slice(1), activePreset: null };
    }),
  setNum: (key, v) =>
    set((s) => ({ ...track(s, { ...s.params, [key]: clampNum(NUM_DEF_BY_KEY[key], v) }), activePreset: null })),
  setStemAttach: (stemAttach) => set((s) => track(s, { ...s.params, stemAttach })),
  setSymmetric: (on) =>
    set((s) => track(s, { ...s.params, face: applySymmetry({ ...s.params.face, symmetric: on }) })),
  setPart: (key, patch) =>
    set((s) => {
      let face = s.params.face;
      const di = drawnIndex(key);
      if (di >= 0) {
        if (!face.drawn[di]) return {};
        const { preset: _, ...box } = patch;
        face = { ...face, drawn: face.drawn.map((d, i) => (i === di ? { ...d, ...box } : d)) };
      } else if (face.symmetric && key === 'eyeR') {
        // 対称モードでは右目の操作を左目へ鏡映して反映する
        const m: Partial<FacePart> = { ...patch };
        if (patch.x !== undefined) m.x = -patch.x;
        if (patch.rot !== undefined) m.rot = -patch.rot;
        face = { ...face, eyeL: { ...face.eyeL, ...m } };
      } else {
        face = { ...face, [key]: { ...face[key as PartKey], ...patch } };
      }
      const params = { ...s.params, face: applySymmetry(face) };
      return { ...track(s, { ...params, face: clampFace(params) }), activePreset: null };
    }),
  addDrawn: (d) => {
    if (useStore.getState().params.face.drawn.length >= MAX_DRAWN) return false;
    set((s) => {
      const params = { ...s.params, face: { ...s.params.face, drawn: [...s.params.face.drawn, d] } };
      return { ...track(s, { ...params, face: clampFace(params) }), selectedPart: drawnKey(params.face.drawn.length - 1), activePreset: null };
    });
    return true;
  },
  removeDrawn: (i) =>
    set((s) => {
      const drawn = s.params.face.drawn.filter((_, j) => j !== i);
      const selectedPart = drawn.length ? drawnKey(Math.min(i, drawn.length - 1)) : 'eyeL';
      return { ...track(s, { ...s.params, face: { ...s.params.face, drawn } }), selectedPart, activePreset: null };
    }),
  selectPart: (selectedPart) => set({ selectedPart }),
  setPen: (pen) => set({ pen }),
  setTab: (tab) => set({ tab }),
  applyPreset: (id) => {
    const card = PRESET_CARDS.find((c) => c.id === id);
    if (!card) return;
    const seed = (Date.now() ^ (Math.random() * 1e9)) >>> 0;
    const next = card.make(seed);
    // 顔を描いていたら、プリセットは本体の形だけを変えて描いた顔は残す
    const keepFace = useStore.getState().params.face.drawn.length > 0;
    set((s) => {
      const kept = Object.fromEntries(KEEP_ON_PRESET.map((k) => [k, s.params[k]]));
      const params = { ...next, ...kept, ...(keepFace && { face: s.params.face }) };
      return { ...track(s, keepFace ? { ...params, face: clampFace(params) } : params), activePreset: id };
    });
    if (keepFace) useStore.getState().showToast('presetKeptFace');
  },
  applyStem: (id) => {
    const st = STEM_STYLES.find((s) => s.id === id);
    if (st) set((s) => ({ ...track(s, { ...s.params, ...st.values }), activePreset: null }));
  },
  setPreview: (preview, error = null) => set({ preview, error }),
  setBuilding: (building) => set({ building }),
  toast: null,
  showToast: (toast) => {
    set({ toast });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => set({ toast: null }), 2000);
  },
}));
