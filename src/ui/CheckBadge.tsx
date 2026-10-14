import { useStore } from '../state/store';
import { useT } from '../i18n';

export function CheckBadge() {
  const t = useT();
  const preview = useStore((s) => s.preview);
  const setTab = useStore((s) => s.setTab);
  if (!preview) return <span className="badge pending">{t('checking')}</span>;
  return (
    <button className={`badge ${preview.level}`} onClick={() => setTab('print')} title={t('seeChecks')}>
      <span className="dot" aria-hidden />
      {t(`level.${preview.level}`)}
    </button>
  );
}

export function CheckList() {
  const t = useT();
  const preview = useStore((s) => s.preview);
  if (!preview) return null;
  return (
    <ul className="checks">
      {preview.checks.map((c) => (
        <li key={c.id} className={c.level}>
          <span className="dot" aria-hidden />
          <div>
            <div className="check-label">{t(`check.${c.id}`, c.vars)}</div>
            <div className="check-detail">{t(`check.${c.id}.${c.detail}`, c.vars)}</div>
            {c.level !== 'green' && <div className="check-fix">{t(`check.${c.id}.${c.detail}.fix`, c.vars)}</div>}
          </div>
        </li>
      ))}
    </ul>
  );
}
