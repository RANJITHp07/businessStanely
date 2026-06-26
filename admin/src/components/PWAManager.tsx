'use client';

import { useEffect } from 'react';

export default function PWAManager() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        const activateWaiting = (sw: ServiceWorker) => sw.postMessage('SKIP_WAITING');

        if (registration.waiting) {
          activateWaiting(registration.waiting);
        }

        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              activateWaiting(newWorker);
            }
          });
        });

        const interval = setInterval(() => registration.update(), 60_000);
        return () => clearInterval(interval);
      })
      .catch(console.error);

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload();
    });
  }, []);

  return null;
}
