export type Theme = 'dark' | 'light';
export type Language = 'vi';

const themeKey = 'starci-status-theme';
let sessionTheme: Theme = 'dark';

export function initialTheme(): Theme {
  try { return localStorage.getItem(themeKey) === 'light' ? 'light' : 'dark'; }
  catch { return sessionTheme; }
}

export function initialLanguage(): Language {
  return 'vi';
}

export function applyPreferences(theme: Theme, language: Language): void {
  sessionTheme = theme;
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.documentElement.classList.toggle('light', theme === 'light');
  document.documentElement.lang = language;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', getComputedStyle(document.body).backgroundColor);
  try { localStorage.setItem(themeKey, theme); }
  catch { return; }
}
