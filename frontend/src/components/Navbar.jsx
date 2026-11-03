import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import UserAvatar from './UserAvatar.jsx';

const linkClass = 'rounded px-2 py-1 text-sm font-medium text-slate-700 hover:text-green-800';

export default function Navbar() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const accountMenuRef = useRef(null);
  const accountButtonRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const closeOnOutsideClick = (event) => {
      if (!accountMenuRef.current?.contains(event.target)) setMenuOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        accountButtonRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [menuOpen]);

  async function handleLogout() {
    if (!window.confirm('Are you sure you want to log out?')) return;
    setLogoutError('');
    setLoggingOut(true);
    try {
      await logout();
      setMenuOpen(false);
      navigate('/login', { replace: true });
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
          {user && <Link to="/my-requests" className={linkClass}>My Requests</Link>}
          {user && <Link to="/received-requests" className={linkClass}>Received Requests</Link>}
          {user && <Link to="/materials/new" className={linkClass}>Add Material</Link>}
        </nav>

        <div className="flex items-center gap-2">
          {loading ? null : user ? (
            <div className="relative" ref={accountMenuRef}>
              <button
                ref={accountButtonRef}
                type="button"
                aria-label={`Account menu for ${user.name}`}
                aria-expanded={menuOpen}
                aria-controls="account-menu"
                onClick={() => setMenuOpen((open) => !open)}
                className="flex items-center gap-2 rounded-lg p-1.5 text-sm font-semibold text-slate-800 hover:bg-green-50 focus-visible:outline-green-700"
              >
                <UserAvatar user={user} />
                <span className="hidden max-w-36 truncate sm:inline">{user.name}</span>
                <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-slate-500">
                  <path fillRule="evenodd" d="M5.2 7.5a.75.75 0 0 1 1.06 0L10 11.19l3.72-3.69a.75.75 0 1 1 1.06 1.06l-4.25 4.22a.75.75 0 0 1-1.06 0L5.2 8.56a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                </svg>
              </button>
              {menuOpen && (
                <div id="account-menu" className="absolute right-0 z-50 mt-2 w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-green-100 bg-white shadow-lg">
                  <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-4">
                    <UserAvatar user={user} className="h-11 w-11" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{user.name}</p>
                      <p className="truncate text-xs text-slate-600">{user.email}</p>
                    </div>
                  </div>
                  <nav aria-label="Account" className="p-2">
                    <Link to="/profile" onClick={() => setMenuOpen(false)} className="block rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-green-50 hover:text-green-800">
                      Profile
                    </Link>
                    <Link to="/profile?edit=1" onClick={() => setMenuOpen(false)} className="block rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-green-50 hover:text-green-800">
                      Edit Profile
                    </Link>
                    <div className="my-2 border-t border-slate-100" />
                    <button
                      type="button"
                      onClick={handleLogout}
                      disabled={loggingOut}
                      className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                    >
                      {loggingOut ? 'Logging out…' : 'Logout'}
                    </button>
                    {logoutError && <p role="alert" className="px-3 py-2 text-sm text-red-700">{logoutError}</p>}
                  </nav>
                </div>
              )}
            </div>
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
