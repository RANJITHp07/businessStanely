'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';

export default function PWAManager() {
  const [updateReady, setUpdateReady] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        if (registration.waiting) {
          setWaitingWorker(registration.waiting);
          setUpdateReady(true);
        }

        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              setWaitingWorker(newWorker);
              setUpdateReady(true);
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

  const handleUpdate = () => {
    if (waitingWorker) {
      waitingWorker.postMessage('SKIP_WAITING');
    }
    setUpdateReady(false);
  };

  if (!updateReady) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-3 bg-gray-900 text-white px-4 py-3 rounded-xl shadow-lg text-sm">
      <RefreshCw className="w-4 h-4 shrink-0 text-blue-400" />
      <span>A new update is available.</span>
      <button
        onClick={handleUpdate}
        className="ml-1 bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-lg font-medium transition-colors"
      >
        Update now
      </button>
      <button
        onClick={() => setUpdateReady(false)}
        className="text-gray-400 hover:text-white transition-colors"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
