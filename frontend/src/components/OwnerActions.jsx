import { useState } from 'react';
import { Link } from 'react-router-dom';
import { materialsApi } from '../services/api.js';

const btn = 'rounded-lg border px-3 py-1.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50';

// Edit / availability toggle / delete for the listing owner.
export default function OwnerActions({ material, onUpdated, onDeleted, onError }) {
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function toggleAvailability() {
    setBusy(true);
    try {
      const res = await materialsApi.setAvailability(material.id, !material.isAvailable);
      onUpdated(res.data);
    } catch (error) {
      onError(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    setBusy(true);
    try {
      await materialsApi.remove(material.id);
      onDeleted(material);
    } catch (error) {
      onError(error.message);
      setBusy(false);
      setConfirming(false);
    }
  }

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
        <button type="button" disabled={busy} onClick={() => setConfirming(true)} className={`${btn} border-red-700 text-red-800 hover:bg-red-50`}>
          Delete<span className="sr-only">: {material.title}</span>
        </button>
      )}
    </div>
  );
}
