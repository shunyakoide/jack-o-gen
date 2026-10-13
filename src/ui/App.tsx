import { useState } from 'react';
import { Viewer } from '../preview/Viewer';
import { shareUrl, useAutoBuild, useUrlSync } from '../state/sync';
import { useStore } from '../state/store';
import { CheckBadge } from './CheckBadge';
import { PresetCards } from './PresetCards';
import { TabContent, TABS } from './tabs/Tabs';

export function App() {
  useAutoBuild();
  useUrlSync();
  const tab = useStore((s) => s.tab);
  const setTab = useStore((s) => s.setTab);
  const [sheet, setSheet] = useState<'half' | 'full' | 'min'>('half');
  const [toast, setToast] = useState<string | null>(null);

  const share = async () => {
    const url = shareUrl(useStore.getState().params);
    try {
      await navigator.clipboard.writeText(url);
      setToast('URLをコピーしました');
    } catch {
      window.prompt('このURLをコピーしてください', url);
    }
    setTimeout(() => setToast(null), 2000);
  };

  return (
    <div className={`app sheet-${sheet}`}>
      <header className="topbar">
        <h1>
          <span aria-hidden>🎃</span> Jack-o-Gen
        </h1>
        <div className="topbar-actions">
          <CheckBadge />
          <button className="ghost" onClick={share}>
            共有
          </button>
        </div>
      </header>
      <main className="layout">
        <section className="panel" aria-label="パラメータ">
          <button
            className="sheet-handle"
            aria-label="パネルの高さを切り替え"
            onClick={() => setSheet(sheet === 'half' ? 'full' : sheet === 'full' ? 'min' : 'half')}
          >
            <span />
          </button>
          <PresetCards />
          <nav className="tabs" role="tablist">
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                className={tab === t.id ? 'on' : ''}
                onClick={() => {
                  setTab(t.id);
                  if (sheet === 'min') setSheet('half');
                }}
              >
                {t.label}
              </button>
            ))}
          </nav>
          <div className="tab-body" role="tabpanel">
            <TabContent tab={tab} />
          </div>
        </section>
        <section className="stage" aria-label="3Dプレビュー">
          <Viewer />
        </section>
      </main>
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
