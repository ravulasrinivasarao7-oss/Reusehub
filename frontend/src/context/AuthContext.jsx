import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authApi, requestsApi } from '../services/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [requestsError, setRequestsError] = useState('');

  // Restore the session on page load (a 401 simply means "not logged in").
  useEffect(() => {
    let cancelled = false;
    authApi
      .me()
      .then((res) => {
        if (cancelled) return;
        setRequestsLoading(true);
        setUser(res.data.user);
      })
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

  useEffect(() => {
    let cancelled = false;
    setRequests([]);
    setRequestsError('');
    if (!user) {
      setRequestsLoading(false);
      return undefined;
    }

    setRequestsLoading(true);
    requestsApi.mine()
      .then((res) => !cancelled && setRequests(res.data))
      .catch((error) => !cancelled && setRequestsError(error.message))
      .finally(() => !cancelled && setRequestsLoading(false));
    return () => { cancelled = true; };
  }, [user?.id]);

  const login = useCallback(async (credentials) => {
    const res = await authApi.login(credentials);
    setRequests([]);
    setRequestsError('');
    setRequestsLoading(true);
    setUser(res.data.user);
  }, []);

  const register = useCallback(async (details) => {
    const res = await authApi.register(details);
    setRequests([]);
    setRequestsError('');
    setRequestsLoading(true);
    setUser(res.data.user);
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout();
    setRequests([]);
    setRequestsError('');
    setRequestsLoading(false);
    setUser(null);
  }, []);

  const updateProfile = useCallback(async (details) => {
    const res = await authApi.updateProfile(details);
    setUser(res.data.user);
    return res.data.user;
  }, []);

  const updateRequest = useCallback((request) => {
    setRequests((current) => [
      request,
      ...current.filter((item) => item.id !== request.id),
    ]);
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      register,
      logout,
      updateProfile,
      requests,
      requestsLoading,
      requestsError,
      updateRequest,
    }),
    [user, loading, login, register, logout, updateProfile, requests, requestsLoading, requestsError, updateRequest],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
