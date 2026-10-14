import { useState } from 'react';
import { ledHole } from '../geometry/body';
import { NUM_DEF_BY_KEY, type NumParams } from '../model/params';
import { useStore } from '../state/store';
import { useT } from '../i18n';
import { gestureProps } from './gesture';

export function ParamSlider({ k }: { k: keyof NumParams }) {
  const t = useT();
  const def = NUM_DEF_BY_KEY[k];
  const value = useStore((s) => s.params[k]);
  const setNum = useStore((s) => s.setNum);
  // LED 開口は小さい本体では縮めて開けるので、実際の穴径も並べる
  const actual = useStore((s) => (k === 'led' ? ledHole(s.params) : value));
  // 入力中の文字列（null = 確定済み）。打鍵ごとに範囲へ丸めると "150" が途中の "1" で止まるため、Enter／フォーカス外れで確定する
  const [draft, setDraft] = useState<string | null>(null);
  const digits = def.step >= 1 ? 0 : def.step >= 0.1 ? 1 : def.step >= 0.01 ? 2 : 3;
  const commit = () => {
    if (draft !== null && draft.trim() !== '' && Number.isFinite(Number(draft))) setNum(k, Number(draft));
    setDraft(null);
  };
  return (
    <label className="slider" {...gestureProps}>
      <span className="slider-head">
        <span>
          {t(`p.${k}`)}
          {actual < value && <span className="slider-note">{t('ledActual', { d: actual.toFixed(0) })}</span>}
        </span>
        <input
          type="number"
          className="slider-num"
          min={def.min}
          max={def.openMax ? undefined : def.max}
          step={def.step}
          value={draft ?? +value.toFixed(digits)}
          onChange={(e) => {
            // スピンボタン・矢印キー（inputType なし）は即確定、打鍵は下書き
            if ((e.nativeEvent as InputEvent).inputType) setDraft(e.target.value);
            else {
              setDraft(null);
              setNum(k, Number(e.target.value));
            }
          }}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            else if (e.key === 'Escape') setDraft(null);
          }}
        />
        {def.unit && <span className="unit">{def.unit}</span>}
      </span>
      <input
        type="range"
        min={def.min}
        max={def.max}
        step={def.step}
        value={value}
        onChange={(e) => setNum(k, Number(e.target.value))}
      />
    </label>
  );
}
