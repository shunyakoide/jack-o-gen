// UI 文言の翻訳。既定は英語、トップバーで日本語に切り替えられる（localStorage に保存）。
import { create } from 'zustand';
import { en } from './en';
import { ja } from './ja';

export type Lang = 'en' | 'ja';
export type Dict = Record<string, string>;
const DICTS: Record<Lang, Dict> = { en, ja };
const KEY = 'jog.lang';

function initialLang(): Lang {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'en' || v === 'ja') return v;
  } catch {
    /* 保存領域が使えない環境では既定値 */
  }
  return 'en';
}

export const useLang = create<{ lang: Lang; setLang: (l: Lang) => void }>((set) => ({
  lang: initialLang(),
  setLang: (lang) => {
    try {
      localStorage.setItem(KEY, lang);
    } catch {
      /* noop */
    }
    document.documentElement.lang = lang;
    set({ lang });
  },
}));

export type T = (key: string, vars?: Record<string, string | number>) => string;

export function translate(lang: Lang, key: string, vars?: Record<string, string | number>): string {
  const s = DICTS[lang][key] ?? en[key] ?? key;
  return vars ? s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? '')) : s;
}

export function useT(): T {
  const lang = useLang((s) => s.lang);
  return (key, vars) => translate(lang, key, vars);
}
