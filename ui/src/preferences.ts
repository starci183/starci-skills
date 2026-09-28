export type Theme = 'dark' | 'light';
export type Language = 'vi';

const themeKey = 'starci-status-theme';

export function initialTheme(): Theme {
  return localStorage.getItem(themeKey) === 'light' ? 'light' : 'dark';
}

export function initialLanguage(): Language {
  return 'vi';
}

export function applyPreferences(theme: Theme, language: Language): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.documentElement.classList.toggle('light', theme === 'light');
  document.documentElement.lang = language;
  document.title = 'StarCi Operations Center';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#09090b' : '#ffffff');
  localStorage.setItem(themeKey, theme);
}
