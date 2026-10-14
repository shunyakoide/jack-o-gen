// アプリ全体の状態（zustand）。
import { create } from 'zustand';
import type { BuildResult } from '../geometry/build';
import { clampFace } from '../geometry/face/layout';
import {
  applySymmetry,
  clampNum,
  defaultParams,
  NUM_DEF_BY_KEY,
  type FacePart,
  type NumParams,
  type Params,
  type PartKey,
  type StemAttach,
  type TabId,
} from '../model/params';
import { PRESET_CARDS } from './presets';
import { STEM_STYLES } from './stems';
import { decodeParams } from './url';

interface State {
  params: Params;
  tab: TabId;
  selectedPart: PartKey;
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
  setPart: (key: PartKey, patch: Partial<FacePart>) => void;
  selectPart: (key: PartKey) => void;
  setTab: (t: TabId) => void;
  applyPreset: (id: string) => void;
  applyStem: (id: string) => void;
  setPreview: (r: BuildResult | null, error?: string | null) => void;
  setBuilding: (b: boolean) => void;
}

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

export const useStore = create<State>((set) => ({
  params: initialParams(),
  tab: 'shape',
  selectedPart: 'eyeL',
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
      // 対称モードでは右目の操作を左目へ鏡映して反映する
      if (face.symmetric && key === 'eyeR') {
        const m: Partial<FacePart> = { ...patch };
        if (patch.x !== undefined) m.x = -patch.x;
        if (patch.rot !== undefined) m.rot = -patch.rot;
        face = { ...face, eyeL: { ...face.eyeL, ...m } };
      } else {
        face = { ...face, [key]: { ...face[key], ...patch } };
      }
      const params = { ...s.params, face: applySymmetry(face) };
      return { ...track(s, { ...params, face: clampFace(params) }), activePreset: null };
    }),
  selectPart: (selectedPart) => set({ selectedPart }),
  setTab: (tab) => set({ tab }),
  applyPreset: (id) => {
    const card = PRESET_CARDS.find((c) => c.id === id);
    if (!card) return;
    const seed = (Date.now() ^ (Math.random() * 1e9)) >>> 0;
    const next = card.make(seed);
    set((s) => {
      const kept = Object.fromEntries(KEEP_ON_PRESET.map((k) => [k, s.params[k]]));
      return { ...track(s, { ...next, ...kept }), activePreset: id };
    });
  },
  applyStem: (id) => {
    const st = STEM_STYLES.find((s) => s.id === id);
    if (st) set((s) => ({ ...track(s, { ...s.params, ...st.values }), activePreset: null }));
  },
  setPreview: (preview, error = null) => set({ preview, error }),
  setBuilding: (building) => set({ building }),
}));
