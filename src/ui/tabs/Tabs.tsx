import { presetsFor } from '../../geometry/face/presets';
import { PART_KIND, type PartKey, type TabId } from '../../model/params';
import { useStore } from '../../state/store';
import { CheckList } from '../CheckBadge';
import { FaceEditor } from '../face-editor/FaceEditor';
import { ParamGroup } from '../ParamGroup';
import { ExportPanel } from './ExportPanel';
import { LedNotice } from './LedNotice';

export const TABS: { id: TabId; label: string }[] = [
  { id: 'shape', label: '形' },
  { id: 'ribs', label: '筋' },
  { id: 'stem', label: 'ヘタ' },
  { id: 'face', label: '顔' },
  { id: 'interior', label: '内部' },
  { id: 'export', label: '出力' },
];

const PART_LABEL: Record<PartKey, string> = { eyeL: '左目', eyeR: '右目', nose: '鼻', mouth: '口' };

function FaceTab() {
  const face = useStore((s) => s.params.face);
  const selected = useStore((s) => s.selectedPart);
  const selectPart = useStore((s) => s.selectPart);
  const setPart = useStore((s) => s.setPart);
  const setSymmetric = useStore((s) => s.setSymmetric);
  const part = face[selected];
  const kind = PART_KIND[selected];
  const lockX = face.symmetric && (selected === 'nose' || selected === 'mouth');
  return (
    <>
      <FaceEditor />
      <div className="row">
        <div className="seg" role="tablist" aria-label="パーツ">
          {(Object.keys(PART_LABEL) as PartKey[]).map((k) => (
            <button key={k} className={k === selected ? 'on' : ''} onClick={() => selectPart(k)}>
              {PART_LABEL[k]}
            </button>
          ))}
        </div>
        <label className="toggle">
          <input type="checkbox" checked={face.symmetric} onChange={(e) => setSymmetric(e.target.checked)} />
          左右対称
        </label>
      </div>
      <div className="chips">
        {presetsFor(kind).map((p) => (
          <button
            key={p.id}
            className={`chip ${(face.symmetric && selected === 'eyeR' ? face.eyeL : part).preset === p.id ? 'on' : ''}`}
            onClick={() => setPart(selected, { preset: p.id })}
          >
            {p.label}
          </button>
        ))}
      </div>
      <PartNumber label="幅" unit="mm" value={part.w} min={4} max={120} onChange={(w) => setPart(selected, { w })} />
      <PartNumber label="高さ" unit="mm" value={part.h} min={4} max={120} onChange={(h) => setPart(selected, { h })} />
      {!lockX && (
        <PartNumber label="回転" unit="°" value={part.rot} min={-180} max={180} onChange={(rot) => setPart(selected, { rot })} />
      )}
      <p className="hint">ドラッグで移動、角の丸で大きさ、上の丸で回転。寸法は直径120mm基準で、本体の大きさに合わせて拡大縮小します。</p>
      <ParamGroup tab="face" />
    </>
  );
}

function PartNumber(props: { label: string; unit: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <label className="slider">
      <span className="slider-head">
        <span>{props.label}</span>
        <input
          type="number"
          className="slider-num"
          value={Math.round(props.value * 10) / 10}
          min={props.min}
          max={props.max}
          onChange={(e) => props.onChange(Math.min(props.max, Math.max(props.min, Number(e.target.value) || 0)))}
        />
        <span className="unit">{props.unit}</span>
      </span>
      <input type="range" min={props.min} max={props.max} step={0.5} value={props.value} onChange={(e) => props.onChange(Number(e.target.value))} />
    </label>
  );
}

function InteriorTab() {
  const mode = useStore((s) => s.params.mode);
  const setMode = useStore((s) => s.setMode);
  return (
    <>
      <div className="seg wide">
        <button className={mode === 'lantern' ? 'on' : ''} onClick={() => setMode('lantern')}>
          ランタン（中空・穴あき）
        </button>
        <button className={mode === 'sealed' ? 'on' : ''} onClick={() => setMode('sealed')}>
          密閉（ソリッド・彫り込み）
        </button>
      </div>
      {mode === 'lantern' ? (
        <>
          <LedNotice />
          <ParamGroup tab="interior" exclude={['engrave']} />
          <p className="hint">内天井は45°の円錐にしているので、サポートなしで印刷できます。</p>
        </>
      ) : (
        <>
          <p className="hint">中空にせずソリッドで出力します（インフィルはスライサーで設定）。顔は彫り込みになります。</p>
          <ParamGroup tab="interior" exclude={['wall', 'led', 'floor']} />
        </>
      )}
    </>
  );
}

export function TabContent({ tab }: { tab: TabId }) {
  switch (tab) {
    case 'shape':
      return <ParamGroup tab="shape" />;
    case 'ribs':
      return <ParamGroup tab="ribs" />;
    case 'stem':
      return <ParamGroup tab="stem" />;
    case 'face':
      return <FaceTab />;
    case 'interior':
      return <InteriorTab />;
    case 'export':
      return (
        <>
          <ExportPanel />
          <h3 className="sub">プリント適性チェック</h3>
          <CheckList />
        </>
      );
  }
}
