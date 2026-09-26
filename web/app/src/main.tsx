import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

const el = document.getElementById('root');
if (!el) throw new Error('#root missing');

createRoot(el).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

/**
 * Native chrome, when running under Capacitor.
 *
 * Dynamic and failure-tolerant on purpose: the same bundle has to run in a plain browser tab where
 * these plugins do not exist. A thrown import here would take the whole app down in dev.
 */
void (async () => {
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (!Capacitor.isNativePlatform()) return;
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#3b1436' });
  } catch {
    /* browser, or plugin unavailable */
  }
})();
