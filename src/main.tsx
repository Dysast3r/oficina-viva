import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './App.css';
import { lang } from './i18n';

document.documentElement.lang = lang();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
