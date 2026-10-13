// アプリ全体の状態（zustand）。
import { create } from 'zustand';
import type { BuildResult } from '../geometry/build';
import {
  applySymmetry,
  clampNum,
  defaultParams,
  NUM_DEF_BY_KEY,
  type FacePart,
  type InteriorMode,
  type NumParams,
  type Params,
  type PartKey,
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
  setNum: (key: keyof NumParams, v: number) => void;
  setMode: (m: InteriorMode) => void;
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

export const useStore = create<State>((set, get) => ({
  params: initialParams(),
  tab: 'shape',
  selectedPart: 'eyeL',
  preview: null,
  building: false,
  error: null,
  activePreset: null,
  setNum: (key, v) =>
    set((s) => ({ params: { ...s.params, [key]: clampNum(NUM_DEF_BY_KEY[key], v) }, activePreset: null })),
  setMode: (mode) => set((s) => ({ params: { ...s.params, mode } })),
  setSymmetric: (on) =>
    set((s) => ({ params: { ...s.params, face: applySymmetry({ ...s.params.face, symmetric: on }) } })),
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
      return { params: { ...s.params, face: applySymmetry(face) }, activePreset: null };
    }),
  selectPart: (selectedPart) => set({ selectedPart }),
  setTab: (tab) => set({ tab }),
  applyPreset: (id) => {
    const card = PRESET_CARDS.find((c) => c.id === id);
    if (!card) return;
    const seed = (Date.now() ^ (Math.random() * 1e9)) >>> 0;
    const next = card.make(seed);
    set({ params: { ...next, mode: get().params.mode }, activePreset: id });
  },
  applyStem: (id) => {
    const st = STEM_STYLES.find((s) => s.id === id);
    if (st) set((s) => ({ params: { ...s.params, ...st.values }, activePreset: null }));
  },
  setPreview: (preview, error = null) => set({ preview, error }),
  setBuilding: (building) => set({ building }),
}));
