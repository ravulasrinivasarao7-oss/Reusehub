import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authApi } from '../services/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore the session on page load (a 401 simply means "not logged in").
  useEffect(() => {
    let cancelled = false;
    authApi
      .me()
      .then((res) => !cancelled && setUser(res.data.user))
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, []);

  // The API client fires this when a protected request returns 401 (session expired).
  useEffect(() => {
    const handler = () => setUser(null);
    window.addEventListener('reusehub:unauthorized', handler);
    return () => window.removeEventListener('reusehub:unauthorized', handler);
  }, []);

  const login = useCallback(async (credentials) => {
    const res = await authApi.login(credentials);
    setUser(res.data.user);
  }, []);

  const register = useCallback(async (details) => {
    const res = await authApi.register(details);
    setUser(res.data.user);
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout();
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, loading, login, register, logout }), [user, loading, login, register, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
