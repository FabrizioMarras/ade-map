import { mount } from 'svelte';
import App from './App.svelte';
import './app.css';
import './ui/ui.css';

mount(App, { target: document.getElementById('app')! });

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  // When a new deploy's service worker takes over a page loaded by the previous one,
  // reload once so the page runs the new version. (No reload on the very first install.)
  const hadController = !!navigator.serviceWorker.controller;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return;
    reloading = true;
    location.reload();
  });
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js', { updateViaCache: 'none' })
      .then((reg) => {
        // Check for a new deploy whenever the app comes back to the foreground.
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') reg.update().catch(() => {});
        });
      })
      .catch((e) => console.warn('Service worker failed', e));
  });
}
// The app started: clear the one-shot recovery flag set by index.html.
sessionStorage.removeItem('ade-recovered');
