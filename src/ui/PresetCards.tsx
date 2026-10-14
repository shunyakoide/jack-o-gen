import { PRESET_CARDS } from '../state/presets';
import { useStore } from '../state/store';
import { BED_SIZE } from '../geometry/checks';
import { useT } from '../i18n';

const ICONS: Record<string, string> = { classic: '🎃', ghost: '👻', flat: '🟠', kiku: '🌼', random: '🎲' };

export function PresetCards() {
  const t = useT();
  const apply = useStore((s) => s.applyPreset);
  const active = useStore((s) => s.activePreset);
  const shrunkFrom = useStore((s) => s.shrunkFrom);
  const diameter = useStore((s) => s.params.diameter);
  return (
    <>
      <div className="presets">
        {PRESET_CARDS.map((c) => (
          <button
            key={c.id}
            className={`preset ${active === c.id ? 'active' : ''}`}
            aria-current={active === c.id}
            onClick={() => apply(c.id)}
            title={t(`preset.${c.id}.hint`)}
          >
            <span className="preset-icon" aria-hidden>{ICONS[c.id]}</span>
            <span className="preset-label">{t(`preset.${c.id}`)}</span>
          </button>
        ))}
      </div>
      {shrunkFrom !== null && (
        <p className="preset-note" role="status">
          {t('presetShrunk', { from: shrunkFrom, to: diameter, bed: BED_SIZE })}
        </p>
      )}
    </>
  );
}
