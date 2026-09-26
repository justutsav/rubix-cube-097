import { useEffect } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import Interview from './pages/Interview';
import Chat from './pages/Chat';
import MyPlan from './pages/MyPlan';
import Field from './pages/Field';
import Officer from './pages/Officer';
import Settings from './pages/Settings';
import { startSyncLoop } from './lib/supabase';

/**
 * HashRouter, not BrowserRouter: Capacitor serves the app from `file://` inside the WebView, where
 * path-based routing has no server to fall back to and a deep link 404s on reload.
 */
export default function App() {
  useEffect(() => {
    let stop: (() => void) | undefined;
    void startSyncLoop().then((fn) => {
      stop = fn;
    });
    return () => stop?.();
  }, []);

  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Interview />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/me" element={<MyPlan />} />
        <Route path="/field" element={<Field />} />
        <Route path="/officer" element={<Officer />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}
