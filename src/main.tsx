import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import * as repo from './db/repo';
import './styles/tokens.css';
import './styles/global.css';

registerSW({ immediate: true });

// Dev-only console access: window.__wortwechsel.repo.makeAllDueNow()
if (import.meta.env.DEV) {
  (window as unknown as { __wortwechsel: unknown }).__wortwechsel = { repo };
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
