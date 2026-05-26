import type { ThemePreference } from '../types/finance';
import { defaultFinanceState } from '../data/defaults';

const THEME_STORAGE_KEY = 'finance-theme-preference-v1';

const VALID: ThemePreference[] = ['system', 'light', 'dark'];

function isThemePreference(v: string): v is ThemePreference {
  return (VALID as string[]).includes(v);
}

/** Per-device appearance — not synced to the household server. */
export function loadThemePreference(): ThemePreference {
  try {
    const raw = (localStorage.getItem(THEME_STORAGE_KEY) ?? '').trim();
    if (raw && isThemePreference(raw)) return raw;
  } catch {
    /* ignore */
  }
  return defaultFinanceState().theme;
}

export function saveThemePreference(theme: ThemePreference): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* ignore */
  }
}

/** Apply light/dark class on `document.documentElement` (call from app shell). */
export function applyThemeClass(theme: ThemePreference): void {
  const root = document.documentElement;
  const setDark = (on: boolean) => {
    root.classList.toggle('dark', on);
  };
  if (theme === 'dark') setDark(true);
  else if (theme === 'light') setDark(false);
  else {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    setDark(mq.matches);
  }
}
