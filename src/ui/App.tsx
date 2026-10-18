import { useEffect, useState } from 'react';
import { Viewer } from '../preview/Viewer';
import { shareUrl, useAutoBuild, useUrlSync } from '../state/sync';
import { useStore } from '../state/store';
import { encodeParams } from '../state/url';
import { CheckBadge, CheckList } from './CheckBadge';
import { PresetCards } from './PresetCards';
import { TabContent, TABS } from './tabs/Tabs';
import { useLang, useT } from '../i18n';

const HINT_KEY = 'jog.hintSeen';

/** 初回訪問かどうか。読み込んだ時点で既読にする（保存領域が使えない環境では毎回表示） */
const FIRST_VISIT = ((): boolean => {
  try {
    if (localStorage.getItem(HINT_KEY)) return false;
    localStorage.setItem(HINT_KEY, '1');
  } catch {
    /* noop */
  }
  return true;
})();

export function App() {
  useAutoBuild();
  useUrlSync();
  const t = useT();
  const lang = useLang((s) => s.lang);
  const setLang = useLang((s) => s.setLang);
  const tab = useStore((s) => s.tab);
  const setTab = useStore((s) => s.setTab);
  const drawing = useStore((s) => s.pen !== 'off' && s.tab === 'face');
  const [sheet, setSheet] = useState<'half' | 'full' | 'min'>('half');
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);
  const canUndo = useStore((s) => s.past.length > 0);
  const canRedo = useStore((s) => s.future.length > 0);
  // URL に何か書かれる＝既定から変わっている、のときだけリセットを出す
  const changed = useStore((s) => encodeParams(s.params) !== '');
  const toast = useStore((s) => s.toast);
  const showToast = useStore((s) => s.showToast);
  const [hint, setHint] = useState(FIRST_VISIT);

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

  const reset = () => {
    if (window.confirm(t('resetConfirm'))) useStore.getState().reset();
  };

  const share = async () => {
    const url = shareUrl(useStore.getState().params);
    try {
      await navigator.clipboard.writeText(url);
      showToast('copied');
    } catch {
      window.prompt(t('copyPrompt'), url);
    }
  };

  // ゴールのダウンロードはどのタブからも 1 押しで出力タブへ（ヘタの付け方・肉厚を確認してから保存させる）
  const toDownload = () => {
    setTab('print');
    if (sheet === 'min') setSheet('half');
    requestAnimationFrame(() => {
      const btn = document.querySelector<HTMLButtonElement>('.export > .primary');
      btn?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      btn?.focus({ preventScroll: true });
    });
  };

  return (
    <div className={`app sheet-${sheet}${drawing ? ' drawing' : ''}`}>
      <header className="topbar">
        <h1>
          <img className="brand-mark" src="/brand/pumpkin-small.png" width="96" height="64" alt="" />
          Jack-o-Gen
        </h1>
        <div className="topbar-actions">
          {changed && (
            <button className="ghost" onClick={reset}>
              {t('reset')}
            </button>
          )}
          <CheckBadge />
          <button className="ghost lang" onClick={() => setLang(lang === 'en' ? 'ja' : 'en')} title="Language / 言語">
            {lang === 'en' ? '日本語' : 'EN'}
          </button>
          <button className="ghost" onClick={share}>
            {t('share')}
          </button>
          <button className="primary cta" onClick={toDownload} aria-label={t('toDownload')}>
            <svg viewBox="0 0 24 24" aria-hidden><path d="M12 4v11" /><path d="m7 10 5 5 5-5" /><path d="M5 20h14" /></svg>
            <span className="cta-label">{t('toDownload')}</span>
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
          {hint && (
            <p className="first-hint">
              <span>{t('firstHint')}</span>
              <button className="first-hint-close" onClick={() => setHint(false)} aria-label={t('dismiss')}>
                ×
              </button>
            </p>
          )}
          <PresetCards />
          <div className="tabbar">
            <nav className="tabs" role="tablist">
              {TABS.map((id) => (
                <button
                  key={id}
                  role="tab"
                  id={`tab-${id}`}
                  aria-controls="tab-panel"
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
            {/* 戻る・進むは操作するパネルの上、スクロールしないタブの行に置く。タブとは区切った別のまとまりにする */}
            <div className="history" role="group" aria-label={t('history')}>
              <button className="icon-btn" onClick={undo} disabled={!canUndo} title={`${t('undo')} (⌘Z)`} aria-label={t('undo')}>
                <svg viewBox="0 0 24 24" aria-hidden><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></svg>
              </button>
              <button className="icon-btn" onClick={redo} disabled={!canRedo} title={`${t('redo')} (⇧⌘Z)`} aria-label={t('redo')}>
                <svg viewBox="0 0 24 24" aria-hidden><path d="m15 14 5-5-5-5" /><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" /></svg>
              </button>
            </div>
          </div>
          <div className="tab-body" role="tabpanel" id="tab-panel" aria-labelledby={`tab-${tab}`}>
            <TabContent tab={tab} />
          </div>
        </section>
        <section className="stage" aria-label={t('preview3d')}>
          <Viewer />
          <CheckList problems />
        </section>
      </main>
      {/* ライブリージョンは常に置いておき、中身の出し入れで読み上げさせる */}
      <div role="status" aria-live="polite">
        {toast && <div className="toast">{t(toast)}</div>}
      </div>
    </div>
  );
}
