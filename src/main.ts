import { mount } from 'svelte';
import App from './App.svelte';
import './app.css';
import './ui/ui.css';

mount(App, { target: document.getElementById('app')! });

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('Service worker failed', e));
  });
}
