import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Unregister any active service workers on page load to prevent stale/incorrect route interception (like 405 errors)
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      registration.unregister().then((success) => {
        if (success) {
          console.log('[SW] Stale Service Worker unregistered successfully.');
        }
      });
    }
  }).catch((err) => {
    console.error('[SW] Error fetching registrations:', err);
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

