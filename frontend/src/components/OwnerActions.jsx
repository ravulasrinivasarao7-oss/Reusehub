import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { materialsApi } from '../services/api.js';

const btn = 'rounded-lg border px-3 py-1.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50';

// Edit / availability toggle / delete for the listing owner.
export default function OwnerActions({ material, onUpdated, onDeleted, onError }) {
  const { verifySession } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  function redirectToLogin() {
    navigate('/login', {
      replace: true,
      state: { from: location, authMessage: 'Please log in to manage your listings.' },
    });
  }

  useEffect(() => {
    let cancelled = false;
    setSessionReady(false);
    verifySession()
      .then((verifiedUser) => {
        if (cancelled) return;
        if (!verifiedUser) {
          redirectToLogin();
          return;
        }
        if (verifiedUser.id !== material.ownerId) {
          onError('You can only manage your own listings.');
          return;
        }
        setSessionReady(true);
      })
      .catch((error) => {
        if (!cancelled) onError(error.message);
      });
    return () => { cancelled = true; };
  }, [material.ownerId, navigate, location, onError, verifySession]);

  async function requireOwnerSession() {
    let verifiedUser;
    try {
      verifiedUser = await verifySession();
    } catch (error) {
      onError(error.message);
      return false;
    }
    if (!verifiedUser) {
      navigate('/login', {
        replace: true,
        state: { from: location, authMessage: 'Please log in to manage your listings.' },
      });
      return false;
    }
    if (verifiedUser.id !== material.ownerId) {
      onError('You can only manage your own listings.');
      return false;
    }
    return true;
  }

  function handleActionError(error) {
    if (error.status === 401) {
      setConfirming(false);
      navigate('/login', {
        replace: true,
        state: { from: location, authMessage: 'Please log in to manage your listings.' },
      });
      return;
    }
    onError(error.message);
  }

  async function toggleAvailability() {
    setBusy(true);
    try {
      if (!await requireOwnerSession()) return;
      const res = await materialsApi.setAvailability(material.id, !material.isAvailable);
      onUpdated(res.data);
    } catch (error) {
      handleActionError(error);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    setBusy(true);
    try {
      if (!await requireOwnerSession()) {
        setConfirming(false);
        return;
      }
      await materialsApi.remove(material.id);
      onDeleted(material);
    } catch (error) {
      handleActionError(error);
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }

  async function showDeleteConfirmation() {
    setBusy(true);
    try {
      if (await requireOwnerSession()) setConfirming(true);
    } finally {
      setBusy(false);
    }
  }

  if (!sessionReady) return null;

  return (
    <div className="flex flex-wrap gap-2">
      <Link to={`/materials/${material.id}/edit`} className={`${btn} border-green-700 text-green-800 hover:bg-green-50`}>
        Edit<span className="sr-only">: {material.title}</span>
      </Link>
      <button type="button" disabled={busy} onClick={toggleAvailability} className={`${btn} border-slate-400 text-slate-800 hover:bg-slate-100`}>
        {material.isAvailable ? 'Mark unavailable' : 'Mark available'}
      </button>
      {confirming ? (
        <>
          <button type="button" disabled={busy} onClick={handleDelete} className={`${btn} border-red-700 bg-red-700 text-white hover:bg-red-800`}>
            {busy ? 'Deleting…' : 'Confirm delete'}
          </button>
          <button type="button" disabled={busy} onClick={() => setConfirming(false)} className={`${btn} border-slate-400 text-slate-800 hover:bg-slate-100`}>
            Cancel
          </button>
        </>
      ) : (
        <button type="button" disabled={busy} onClick={showDeleteConfirmation} className={`${btn} border-red-700 text-red-800 hover:bg-red-50`}>
          Delete<span className="sr-only">: {material.title}</span>
        </button>
      )}
    </div>
  );
}
