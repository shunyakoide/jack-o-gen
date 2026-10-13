import { NUM_DEF_BY_KEY, type NumParams } from '../model/params';
import { useStore } from '../state/store';

export function ParamSlider({ k }: { k: keyof NumParams }) {
  const def = NUM_DEF_BY_KEY[k];
  const value = useStore((s) => s.params[k]);
  const setNum = useStore((s) => s.setNum);
  const digits = def.step >= 1 ? 0 : def.step >= 0.1 ? 1 : def.step >= 0.01 ? 2 : 3;
  return (
    <label className="slider">
      <span className="slider-head">
        <span>{def.label}</span>
        <input
          type="number"
          className="slider-num"
          min={def.min}
          max={def.max}
          step={def.step}
          value={+value.toFixed(digits)}
          onChange={(e) => setNum(k, Number(e.target.value))}
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
