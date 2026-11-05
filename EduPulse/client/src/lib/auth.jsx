import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, setUnauthorizedHandler } from './api.js';
import { startLive, stopLive } from './live.js';

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
    api.get('/auth/me').then((r) => setUser(r.user)).catch(() => setUser(null)).finally(() => setReady(true));
  }, []);
  useEffect(() => { if (user) startLive(); else stopLive(); }, [user]);
  const login = useCallback(async (identifier, password, remember = false) => { const r = await api.post('/auth/login', { identifier, password, remember }); setUser(r.user); return r.user; }, []);
  const signup = useCallback(async (payload) => { const r = await api.post('/auth/signup', payload); setUser(r.user); return r.user; }, []);
  const logout = useCallback(async () => { try { await api.post('/auth/logout'); } finally { setUser(null); } }, []);
  const refresh = useCallback(async () => { const r = await api.get('/auth/me'); setUser(r.user); }, []);
  return <AuthCtx.Provider value={{ user, ready, login, signup, logout, refresh, isStaff: user?.role === 'admin' || user?.role === 'teacher' }}>{children}</AuthCtx.Provider>;
}
