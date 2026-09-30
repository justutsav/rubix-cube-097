import { useEffect, useState } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import Home from './pages/Home';
import Login from './pages/Login';
import Interview from './pages/Interview';
import Chat from './pages/Chat';
import MyPlan from './pages/MyPlan';
import Demo from './pages/Demo';
import Onboarding from './pages/Onboarding';
import Outcomes from './pages/Outcomes';
import State from './pages/State';
import Officer from './pages/Officer';
import Settings from './pages/Settings';
import { RoleContext } from './components';
import { getRole, isOfficer, type Role } from './lib/role';
import { startSyncLoop } from './lib/supabase';

/**
 * HashRouter, not BrowserRouter: Capacitor serves from `file://` inside the WebView, where
 * path-based routing has no server to fall back to and a reload on a deep link 404s.
 *
 * `/` is the role-aware home, not the interview. The interview lives at `/interview` and is
 * something you enter deliberately — opening an app directly into a consent script, with no way
 * back and no account, is what made this feel like one screen rather than a product.
 */
export default function App() {
  const [role, setRole] = useState<Role | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void getRole().then((r) => {
      setRole(r);
      setReady(true);
    });
  }, []);

  useEffect(() => {
    let stop: (() => void) | undefined;
    void startSyncLoop().then((fn) => {
      stop = fn;
    });
    return () => stop?.();
  }, []);

  // Don't flash a beneficiary home at an officer while the stored role is still loading.
  if (!ready) return null;

  return (
    <RoleContext.Provider value={role ?? 'beneficiary'}>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Home role={role} onRole={setRole} />} />
          <Route path="/home" element={<Home role={role} onRole={setRole} />} />
          <Route path="/demo" element={<Demo onRole={setRole} />} />
          <Route path="/welcome" element={<Onboarding onRole={setRole} />} />
          <Route path="/login" element={<Login />} />
          <Route path="/interview" element={<Interview />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/me" element={<MyPlan />} />
          {/* The officer consoles list other people's answers. Reaching them by typing a hash
              must not work either, so the guard is on the route, not just on the tab bar. */}
          <Route path="/outcomes" element={role === 'district_officer' ? <Outcomes /> : <Navigate to="/" replace />} />
          <Route path="/officer" element={isOfficer(role) ? <Officer /> : <Navigate to="/" replace />} />
          <Route path="/state" element={role === 'state_officer' ? <State /> : <Navigate to="/" replace />} />
          <Route path="/settings" element={<Settings role={role} onRole={setRole} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </RoleContext.Provider>
  );
}
