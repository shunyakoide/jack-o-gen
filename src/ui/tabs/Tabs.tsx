import type { CSSProperties } from 'react';
import { findPreset, presetsFor } from '../../geometry/face/presets';
import { useT } from '../../i18n';
import { drawnIndex, MAX_DRAWN, PART_KEYS, PART_KIND, type PartKey, type PartKind, type TabId } from '../../model/params';
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
  const pen = useStore((s) => s.pen);
  const setPen = useStore((s) => s.setPen);
  const selectPart = useStore((s) => s.selectPart);
  const setPart = useStore((s) => s.setPart);
  const removeDrawn = useStore((s) => s.removeDrawn);
  const setSymmetric = useStore((s) => s.setSymmetric);
  const di = drawnIndex(selected);
  const drawn = di >= 0 ? face.drawn[di] : undefined;
  // 描いた形が undo で消えていたら左目を選んでいるものとして扱う
  const key: PartKey = di >= 0 ? 'eyeL' : (selected as PartKey);
  const part = drawn ?? face[key];
  const kind = PART_KIND[key];
  const current = drawn ? null : (face.symmetric && key === 'eyeR' ? face.eyeL : face[key]).preset;
  // 大きさは縦横比を保ったまま幅で指定する
  const setSize = (w: number) => setPart(drawn ? selected : key, { w, h: Math.round(((part.h * w) / part.w) * 2) / 2 });
  return (
    <>
      <div className="fe-wrap">
        <FaceEditor />
        <div className="fe-tools">
          {/* 面／線の切り替えは描く場所のすぐ横に置く（スマホではパネルの下が画面外になる） */}
          {pen !== 'off' &&
            (['fill', 'line'] as const).map((m) => (
              <button
                key={m}
                className="icon-btn"
                onClick={() => setPen(m)}
                aria-pressed={pen === m}
                title={t(`pen.${m}`)}
                aria-label={t(`pen.${m}`)}
              >
                <svg viewBox="0 0 24 24" aria-hidden>
                  {m === 'fill' ? (
                    <path d="M7 5c4-2 11 0 12 5s-3 9-8 9-8-3-8-7 1-6 4-7Z" fill="currentColor" />
                  ) : (
                    <path d="M3 16c3-6 6-6 9-2s6 4 9-2" />
                  )}
                </svg>
              </button>
            ))}
          <button
            className="icon-btn"
            onClick={() => setPen(pen === 'off' ? 'fill' : 'off')}
            aria-pressed={pen !== 'off'}
            title={`${t('draw')} (Esc)`}
            aria-label={t('draw')}
          >
            <svg viewBox="0 0 24 24" aria-hidden><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
          </button>
        </div>
      </div>
      {pen !== 'off' ? (
        <>
          <div className="row">
            <label className="toggle">
              <input type="checkbox" checked={face.symmetric} onChange={(e) => setSymmetric(e.target.checked)} />
              {t('symmetric')}
            </label>
            <button className="ghost" onClick={() => setPen('off')}>
              {t('drawDone')}
            </button>
          </div>
          <p className="hint">{t(pen === 'line' ? 'drawHintLine' : 'drawHint')}</p>
        </>
      ) : (
        <>
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
          {drawn ? (
            <div className="row">
              <span className="drawn-label">{t('drawnShape', { n: di + 1, max: MAX_DRAWN })}</span>
              <label className="toggle">
                <input type="checkbox" checked={drawn.mirror} onChange={(e) => setPart(selected, { mirror: e.target.checked })} />
                {t('drawnMirror')}
              </label>
              <button className="ghost" onClick={() => removeDrawn(di)}>
                {t('drawnDelete')}
              </button>
            </div>
          ) : (
            <div className="shape-grid">
              {presetsFor(kind).map((p) => (
                <button
                  key={p.id}
                  className={`shape-card ${current === p.id ? 'on' : ''}`}
                  aria-pressed={current === p.id}
                  onClick={() => setPart(key, { preset: p.id })}
                >
                  <ShapeThumb kind={kind} id={p.id} w={part.w} h={part.h} />
                  <span>{t(`${kind}.${p.id}`)}</span>
                </button>
              ))}
              {/* 自分で描く：このパーツを消してペンにする（描いた形が代わりになる） */}
              <button
                className="shape-card"
                onClick={() => {
                  setPart(key, { preset: 'none' });
                  setPen('fill');
                }}
              >
                <svg className="shape-thumb draw" viewBox="0 0 24 18" aria-hidden>
                  <path d="M12 16h8" /><path d="M15.5 2.5a2.1 2.1 0 0 1 3 3L7 17l-4 1 1-4Z" />
                </svg>
                <span>{t('drawOwn')}</span>
              </button>
            </div>
          )}
          {(drawn || current !== 'none') && (
            <label className="slider" {...gestureProps}>
              <span className="slider-head">
                <span>{t('part.size')}</span>
              </span>
              <input
                type="range"
                min={drawn ? 2 : 6}
                max={100}
                step={0.5}
                value={part.w}
                style={{ '--p': `${((part.w - (drawn ? 2 : 6)) / (100 - (drawn ? 2 : 6))) * 100}%` } as CSSProperties}
                onChange={(e) => setSize(Number(e.target.value))} />
            </label>
          )}
          <p className="hint">{t('faceHint')}</p>
        </>
      )}
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
