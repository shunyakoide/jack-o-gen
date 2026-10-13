import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
// フォントは同梱（外部 CDN に依存しない）。--font / --font-display のファミリー名と一致させる
import '@fontsource/outfit/400.css';
import '@fontsource/outfit/500.css';
import '@fontsource/outfit/600.css';
import '@fontsource/outfit/700.css';
import '@fontsource/grenze-gotisch/700.css';
import './styles.css';
import { useLang } from './i18n';

document.documentElement.lang = useLang.getState().lang;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
