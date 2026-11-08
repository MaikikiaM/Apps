// src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Registro seguro de Service Worker para PWA
if ('serviceWorker' in navigator && import.meta.env.PROD && window.location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    try {
      navigator.serviceWorker.register('./sw.js').catch((err) => {
        console.warn('Registro de Service Worker omitido en este entorno:', err);
      });
    } catch (e) {
      console.warn('Service Worker no activo:', e);
    }
  });
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
