import { useCallback, useState } from 'react';
import { findPreset, presetsFor } from '../../geometry/face/presets';
import { useT } from '../../i18n';
import { PART_KEYS, PART_KIND, type PartKind, type TabId } from '../../model/params';
import { useStore } from '../../state/store';
import { matchStem, STEM_STYLES } from '../../state/stems';
import { FaceEditor } from '../face-editor/FaceEditor';
import { gestureProps } from '../gesture';
import { ParamGroup } from '../ParamGroup';
import { ExportPanel } from './ExportPanel';
import { LedNotice } from './LedNotice';

export const TABS: TabId[] = ['shape', 'face', 'print'];

function ShapeTab() {
  return (
    <>
      <ParamGroup group="body" title />
      <ParamGroup group="ribs" title />
      <ParamGroup group="stem" title>
        <StemPicker />
      </ParamGroup>
    </>
  );
}

function StemPicker() {
  const t = useT();
  const current = useStore((s) => matchStem(s.params));
  const apply = useStore((s) => s.applyStem);
  return (
    <div className="stem-grid">
      {STEM_STYLES.map((st) => (
        <button
          key={st.id}
          className={`stem-card ${current === st.id ? 'on' : ''}`}
          aria-pressed={current === st.id}
          onClick={() => apply(st.id)}
        >
          <span aria-hidden>{st.icon}</span>
          {t(`stem.${st.id}`)}
        </button>
      ))}
    </div>
  );
}

/** プリセット形状の小さな見本（選択中パーツの縦横比で描く） */
function ShapeThumb({ kind, id, w, h }: { kind: PartKind; id: string; w: number; h: number }) {
  const { holes, islands } = findPreset(kind, id).make();
  // 4:3 の枠に収まる最大の大きさ
  const k = Math.min(4 / 3 / w, 1 / h);
  const d = [...holes, ...islands]
    .map((poly) => 'M' + poly.map(([u, v]) => `${(u * w * k).toFixed(3)},${(-v * h * k).toFixed(3)}`).join('L') + 'Z')
    .join('');
  return (
    <svg className="shape-thumb" viewBox="-1.5 -1.125 3 2.25" aria-hidden>
      {id === 'none' ? <path d="M-0.6,-0.6L0.6,0.6M0.6,-0.6L-0.6,0.6" className="none" /> : <path d={d} fillRule="evenodd" />}
    </svg>
  );
}

function FaceTab() {
  const t = useT();
  const face = useStore((s) => s.params.face);
  const selected = useStore((s) => s.selectedPart);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);
  const canUndo = useStore((s) => s.past.length > 0);
  const canRedo = useStore((s) => s.future.length > 0);
  const selectPart = useStore((s) => s.selectPart);
  const setPart = useStore((s) => s.setPart);
  const setSymmetric = useStore((s) => s.setSymmetric);
  const [pen, setPen] = useState(false);
  const exitPen = useCallback(() => setPen(false), []);
  const part = face[selected];
  const kind = PART_KIND[selected];
  const current = (face.symmetric && selected === 'eyeR' ? face.eyeL : part).preset;
  // 大きさは縦横比を保ったまま幅で指定する
  const setSize = (w: number) => setPart(selected, { w, h: Math.round(((part.h * w) / part.w) * 2) / 2 });
  return (
    <>
      <div className="fe-wrap">
        <FaceEditor pen={pen} onPenExit={exitPen} />
        <div className="fe-tools">
          <button
            className="icon-btn"
            onClick={() => setPen(!pen)}
            aria-pressed={pen}
            title={`${t('draw')} (Esc)`}
            aria-label={t('draw')}
          >
            <svg viewBox="0 0 24 24" aria-hidden><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
          </button>
          <button className="icon-btn" onClick={undo} disabled={!canUndo} title={`${t('undo')} (⌘Z)`} aria-label={t('undo')}>
            <svg viewBox="0 0 24 24" aria-hidden><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></svg>
          </button>
          <button className="icon-btn" onClick={redo} disabled={!canRedo} title={`${t('redo')} (⇧⌘Z)`} aria-label={t('redo')}>
            <svg viewBox="0 0 24 24" aria-hidden><path d="m15 14 5-5-5-5" /><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" /></svg>
          </button>
        </div>
      </div>
      <div className="row">
        <div className="seg">
          {/* 左右対称のときは両目を 1 つのボタンにまとめる */}
          {(face.symmetric ? (['eyeL', 'nose', 'mouth'] as const) : PART_KEYS).map((k) => {
            const on = k === selected || (face.symmetric && k === 'eyeL' && selected === 'eyeR');
            return (
              <button key={k} aria-pressed={on} className={on ? 'on' : ''} onClick={() => selectPart(k)}>
                {t(face.symmetric && k === 'eyeL' ? 'part.eyes' : `part.${k}`)}
              </button>
            );
          })}
        </div>
        <label className="toggle">
          <input type="checkbox" checked={face.symmetric} onChange={(e) => setSymmetric(e.target.checked)} />
          {t('symmetric')}
        </label>
      </div>
      <div className="shape-grid">
        {presetsFor(kind).map((p) => (
          <button
            key={p.id}
            className={`shape-card ${current === p.id ? 'on' : ''}`}
            aria-pressed={current === p.id}
            onClick={() => setPart(selected, { preset: p.id })}
          >
            <ShapeThumb kind={kind} id={p.id} w={part.w} h={part.h} />
            <span>{t(`${kind}.${p.id}`)}</span>
          </button>
        ))}
      </div>
      {current !== 'none' && (
        <label className="slider" {...gestureProps}>
          <span className="slider-head">
            <span>{t('part.size')}</span>
          </span>
          <input type="range" min={6} max={100} step={0.5} value={part.w} onChange={(e) => setSize(Number(e.target.value))} />
        </label>
      )}
      <p className="hint">{t(pen ? 'drawHint' : 'faceHint')}</p>
    </>
  );
}

function PrintTab() {
  const t = useT();
  const stemAttach = useStore((s) => s.params.stemAttach);
  const setStemAttach = useStore((s) => s.setStemAttach);
  return (
    <>
      <LedNotice />
      <ParamGroup group="print" />
      <div className="seg wide">
        {(['fused', 'peg'] as const).map((a) => (
          <button key={a} className={stemAttach === a ? 'on' : ''} aria-pressed={stemAttach === a} onClick={() => setStemAttach(a)}>
            {t(`stemAttach.${a}`)}
          </button>
        ))}
      </div>
      {stemAttach === 'peg' && <p className="hint">{t('pegHint')}</p>}
      <ExportPanel />
    </>
  );
}

export function TabContent({ tab }: { tab: TabId }) {
  switch (tab) {
    case 'shape':
      return <ShapeTab />;
    case 'face':
      return <FaceTab />;
    case 'print':
      return <PrintTab />;
  }
}
