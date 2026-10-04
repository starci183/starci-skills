import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app';
import { MotionProvider } from './components/motion';
import { applyPreferences, initialLanguage, initialTheme } from './preferences';
import './style.css';

applyPreferences(initialTheme(), initialLanguage());
// After a deploy, a tab opened on the previous build asks for chunks that no longer exist.
// Reload once to pick up the new index.html (guarded so a real outage does not loop).
window.addEventListener('vite:preloadError', (event) => {
  let last = 0;
  try { last = Number(sessionStorage.getItem('starci-chunk-reload') ?? 0); }
  catch { return; }
  if (Date.now() - last < 60_000) return;
  try { sessionStorage.setItem('starci-chunk-reload', String(Date.now())); }
  catch { return; }
  event.preventDefault();
  window.location.reload();
});
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MotionProvider><App /></MotionProvider>
  </React.StrictMode>,
);
