import { useEffect, useState } from 'react';
import { Viewer } from '../preview/Viewer';
import { shareUrl, useAutoBuild, useUrlSync } from '../state/sync';
import { useStore } from '../state/store';
import { CheckBadge } from './CheckBadge';
import { PresetCards } from './PresetCards';
import { TabContent, TABS } from './tabs/Tabs';
import { useLang, useT } from '../i18n';

export function App() {
  useAutoBuild();
  useUrlSync();
  const t = useT();
  const lang = useLang((s) => s.lang);
  const setLang = useLang((s) => s.setLang);
  const tab = useStore((s) => s.tab);
  const setTab = useStore((s) => s.setTab);
  const [sheet, setSheet] = useState<'half' | 'full' | 'min'>('half');
  const [toast, setToast] = useState<string | null>(null);

  // ⌘Z / Ctrl+Z で元に戻す、⇧ 付きか Ctrl+Y でやり直す（数値入力欄は自前の取り消しに任せる）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || (e.target instanceof Element && e.target.matches('input[type=number], textarea'))) return;
      const k = e.key.toLowerCase();
      if (k === 'z' || k === 'y') {
        e.preventDefault();
        const s = useStore.getState();
        if (k === 'y' || e.shiftKey) s.redo();
        else s.undo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const share = async () => {
    const url = shareUrl(useStore.getState().params);
    try {
      await navigator.clipboard.writeText(url);
      setToast(t('copied'));
    } catch {
      window.prompt(t('copyPrompt'), url);
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
          <button className="ghost lang" onClick={() => setLang(lang === 'en' ? 'ja' : 'en')} title="Language / 言語">
            {lang === 'en' ? '日本語' : 'EN'}
          </button>
          <button className="ghost" onClick={share}>
            {t('share')}
          </button>
        </div>
      </header>
      <main className="layout">
        <section className="panel" aria-label={t('panel')}>
          <button
            className="sheet-handle"
            aria-label={t('sheetToggle')}
            onClick={() => setSheet(sheet === 'half' ? 'full' : sheet === 'full' ? 'min' : 'half')}
          >
            <span />
          </button>
          <PresetCards />
          <nav className="tabs" role="tablist">
            {TABS.map((id) => (
              <button
                key={id}
                role="tab"
                aria-selected={tab === id}
                className={tab === id ? 'on' : ''}
                onClick={() => {
                  setTab(id);
                  if (sheet === 'min') setSheet('half');
                }}
              >
                {t(`tab.${id}`)}
              </button>
            ))}
          </nav>
          <div className="tab-body" role="tabpanel">
            <TabContent tab={tab} />
          </div>
        </section>
        <section className="stage" aria-label={t('preview3d')}>
          <Viewer />
        </section>
      </main>
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
