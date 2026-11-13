import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import Alert from './Alert.jsx';
import Spinner from './Spinner.jsx';

export default function ProtectedRoute({ children }) {
  const { user, loading, verifySession } = useAuth();
  const location = useLocation();
  const routeKey = `${location.key}:${location.pathname}:${location.search}`;
  const [sessionCheck, setSessionCheck] = useState({ key: '', status: 'checking', error: '' });
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (loading || !user) return undefined;
    let cancelled = false;
    setSessionCheck({ key: routeKey, status: 'checking', error: '' });
    verifySession()
      .then((verifiedUser) => {
        if (!cancelled) {
          setSessionCheck({
            key: routeKey,
            status: verifiedUser ? 'verified' : 'unauthenticated',
            error: '',
          });
        }
      })
      .catch((error) => {
        if (!cancelled) setSessionCheck({ key: routeKey, status: 'error', error: error.message });
      });
    return () => { cancelled = true; };
  }, [loading, user?.id, routeKey, verifySession, retryCount]);

  if (loading) return <Spinner label="Checking your session…" />;
  if (!user) {
    const listingManagement = location.pathname === '/materials/new'
      || /^\/materials\/\d+\/edit$/.test(location.pathname)
      || location.pathname === '/my-listings';
    return (
      <Navigate
        to="/login"
        replace
        state={{
          from: location,
          authMessage: listingManagement ? 'Please log in to manage your listings.' : 'Please log in to continue.',
        }}
      />
    );
  }
  if (sessionCheck.key === routeKey && sessionCheck.status === 'unauthenticated') {
    const listingManagement = location.pathname === '/materials/new'
      || /^\/materials\/\d+\/edit$/.test(location.pathname)
      || location.pathname === '/my-listings';
    return (
      <Navigate
        to="/login"
        replace
        state={{
          from: location,
          authMessage: listingManagement ? 'Please log in to manage your listings.' : 'Please log in to continue.',
        }}
      />
    );
  }
  if (sessionCheck.key !== routeKey || sessionCheck.status === 'checking') {
    return <Spinner label="Verifying your session…" />;
  }
  if (sessionCheck.status === 'error') {
    return (
      <section className="mx-auto max-w-2xl px-4 py-16 text-center">
        <Alert type="error">{sessionCheck.error}</Alert>
        <button
          type="button"
          onClick={() => {
            setSessionCheck({ key: routeKey, status: 'checking', error: '' });
            setRetryCount((count) => count + 1);
          }}
          className="mt-6 rounded-lg bg-green-700 px-5 py-2 font-semibold text-white hover:bg-green-800"
        >
          Try again
        </button>
      </section>
    );
  }
  return children;
}
