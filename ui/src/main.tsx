import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app';
import { applyPreferences, initialLanguage, initialTheme } from './preferences';
import './style.css';

applyPreferences(initialTheme(), initialLanguage());
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
