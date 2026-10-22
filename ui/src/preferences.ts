/** The colour theme the interface can be shown in. */
export type Theme = 'dark' | 'light';
/** The language the interface is shown in; Vietnamese is the only one the product ships. */
export type Language = 'vi';

const themeKey = 'starci-status-theme';
let sessionTheme: Theme = 'dark';

/**
 * The theme to start with: the owner's saved choice when storage is readable, otherwise this
 * session's last choice.
 */
export const initialTheme = (): Theme => {
  try { return localStorage.getItem(themeKey) === 'light' ? 'light' : 'dark'; }
  catch { return sessionTheme; }
};

/** The language to start with, which is always Vietnamese. */
export const initialLanguage = (): Language => {
  return 'vi';
};

/**
 * Applies the theme and language to the document, updates the browser chrome colour and saves the
 * theme when storage allows.
 */
export const applyPreferences = (theme: Theme, language: Language): void => {
  sessionTheme = theme;
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.documentElement.classList.toggle('light', theme === 'light');
  document.documentElement.lang = language;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', getComputedStyle(document.body).backgroundColor);
  try { localStorage.setItem(themeKey, theme); }
  catch { return; }
};
