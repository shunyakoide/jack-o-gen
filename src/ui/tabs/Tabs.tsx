import { presetsFor } from '../../geometry/face/presets';
import { useT } from '../../i18n';
import { PART_KEYS, PART_KIND, type TabId } from '../../model/params';
import { useStore } from '../../state/store';
import { matchStem, STEM_STYLES } from '../../state/stems';
import { FaceEditor } from '../face-editor/FaceEditor';
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
        <button key={st.id} className={`stem-card ${current === st.id ? 'on' : ''}`} onClick={() => apply(st.id)}>
          <span aria-hidden>{st.icon}</span>
          {t(`stem.${st.id}`)}
        </button>
      ))}
    </div>
  );
}

function FaceTab() {
  const t = useT();
  const face = useStore((s) => s.params.face);
  const selected = useStore((s) => s.selectedPart);
  const selectPart = useStore((s) => s.selectPart);
  const setPart = useStore((s) => s.setPart);
  const setSymmetric = useStore((s) => s.setSymmetric);
  const part = face[selected];
  const kind = PART_KIND[selected];
  const current = (face.symmetric && selected === 'eyeR' ? face.eyeL : part).preset;
  // 大きさは縦横比を保ったまま幅で指定する
  const setSize = (w: number) => setPart(selected, { w, h: Math.round(((part.h * w) / part.w) * 2) / 2 });
  return (
    <>
      <FaceEditor />
      <div className="row">
        <div className="seg" role="tablist">
          {PART_KEYS.map((k) => (
            <button key={k} className={k === selected ? 'on' : ''} onClick={() => selectPart(k)}>
              {t(`part.${k}`)}
            </button>
          ))}
        </div>
        <label className="toggle">
          <input type="checkbox" checked={face.symmetric} onChange={(e) => setSymmetric(e.target.checked)} />
          {t('symmetric')}
        </label>
      </div>
      <div className="chips">
        {presetsFor(kind).map((p) => (
          <button key={p.id} className={`chip ${current === p.id ? 'on' : ''}`} onClick={() => setPart(selected, { preset: p.id })}>
            {t(`${kind}.${p.id}`)}
          </button>
        ))}
      </div>
      {current !== 'none' && (
        <label className="slider">
          <span className="slider-head">
            <span>{t('part.size')}</span>
          </span>
          <input type="range" min={6} max={100} step={0.5} value={part.w} onChange={(e) => setSize(Number(e.target.value))} />
        </label>
      )}
      <p className="hint">{t('faceHint')}</p>
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
          <button key={a} className={stemAttach === a ? 'on' : ''} onClick={() => setStemAttach(a)}>
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
