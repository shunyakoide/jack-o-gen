import type { CheckLevel } from '../geometry/checks';
import { useStore } from '../state/store';

export const LEVEL_TEXT: Record<CheckLevel, string> = { green: '印刷OK', yellow: '警告あり', red: '出力不可' };

export function CheckBadge() {
  const preview = useStore((s) => s.preview);
  const setTab = useStore((s) => s.setTab);
  if (!preview) return <span className="badge pending">チェック中</span>;
  return (
    <button className={`badge ${preview.level}`} onClick={() => setTab('export')} title="チェック結果を見る">
      <span className="dot" aria-hidden />
      {LEVEL_TEXT[preview.level]}
    </button>
  );
}

export function CheckList() {
  const preview = useStore((s) => s.preview);
  if (!preview) return null;
  return (
    <ul className="checks">
      {preview.checks.map((c) => (
        <li key={c.id} className={c.level}>
          <span className="dot" aria-hidden />
          <div>
            <div className="check-label">{c.label}</div>
            <div className="check-detail">{c.detail}</div>
          </div>
        </li>
      ))}
    </ul>
  );
}
