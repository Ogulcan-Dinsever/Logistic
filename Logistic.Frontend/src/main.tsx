import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { connection } from './config';
import '@fontsource-variable/dm-sans';
import './styles.css';

async function start() {
  if (connection.mode === 'demo') {
    const { worker } = await import('./demo/browser');
    await worker.start({ onUnhandledRequest: 'bypass', quiet: true });
  } else {
    // Remove our demo worker when switching to a real API, including after reload.
    const registrations = await navigator.serviceWorker?.getRegistrations();
    await Promise.all(
      (registrations || [])
        .filter((r) =>
          (r.active || r.waiting || r.installing)?.scriptURL.endsWith('/mockServiceWorker.js'),
        )
        .map((r) => r.unregister()),
    );
  }
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}
void start().catch(() => {
  const root = document.getElementById('root')!;
  root.textContent =
    'Uygulama başlatılamadı. Demoyu localhost üzerinde npm run dev ile açıp sayfayı yenile.';
});
