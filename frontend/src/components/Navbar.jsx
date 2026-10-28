import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const linkClass = 'rounded px-2 py-1 text-sm font-medium text-slate-700 hover:text-green-800';

export default function Navbar() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();
  const [logoutError, setLogoutError] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLogoutError('');
    setLoggingOut(true);
    try {
      await logout();
      navigate('/');
    } catch (error) {
      setLogoutError(error.message);
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <header className="sticky top-0 z-40 border-b border-green-100 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3">
        <Link to="/" className="flex items-center gap-2 rounded text-xl font-bold text-green-800">
          <span aria-hidden="true" className="grid h-8 w-8 place-items-center rounded-lg bg-green-700 text-white">♻</span>
          ReUseHub
        </Link>

        <nav aria-label="Primary" className="order-3 flex w-full flex-wrap justify-center gap-2 sm:order-none sm:w-auto">
          <Link to="/" className={linkClass}>Home</Link>
          <Link to="/materials" className={linkClass}>Browse Materials</Link>
          <a href="/#how-it-works" className={linkClass}>How It Works</a>
          {user && <Link to="/my-listings" className={linkClass}>My Listings</Link>}
          {user && <Link to="/materials/new" className={linkClass}>Add Material</Link>}
        </nav>

        <div className="flex items-center gap-2">
          {loading ? null : user ? (
            <>
              <span className="hidden text-sm text-slate-700 sm:inline">Hi, {user.name}</span>
              <button type="button" onClick={handleLogout} disabled={loggingOut} className="rounded-lg border border-green-700 px-4 py-2 text-sm font-semibold text-green-800 hover:bg-green-50 disabled:opacity-60">
                {loggingOut ? 'Logging out…' : 'Logout'}
              </button>
              {logoutError && <p role="alert" className="max-w-xs text-sm text-red-700">{logoutError}</p>}
            </>
          ) : (
            <>
              <Link to="/login" className="rounded-lg border border-green-700 px-4 py-2 text-sm font-semibold text-green-800 hover:bg-green-50">Login</Link>
              <Link to="/register" className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800">Register</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
