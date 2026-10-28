import { useEffect, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import Alert from '../components/Alert.jsx';
import MaterialCard from '../components/MaterialCard.jsx';
import OwnerActions from '../components/OwnerActions.jsx';
import Pagination from '../components/Pagination.jsx';
import Spinner from '../components/Spinner.jsx';
import { materialsApi } from '../services/api.js';

export default function MyListingsPage() {
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const page = params.get('page') || '1';
  const [state, setState] = useState({ loading: true, error: '', items: [], meta: null });
  const [message, setMessage] = useState(location.state?.message || '');
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setState((current) => ({ ...current, loading: true, error: '' }));
    materialsApi
      .mine({ page, limit: 12 })
      .then((res) => !cancelled && setState({ loading: false, error: '', items: res.data, meta: res.meta }))
      .catch((err) => !cancelled && setState({ loading: false, error: err.message, items: [], meta: null }));
    return () => { cancelled = true; };
  }, [page]);

  const replaceItem = (updated) =>
    setState((s) => ({ ...s, items: s.items.map((m) => (m.id === updated.id ? updated : m)) }));
  const removeItem = (removed) => {
    setMessage('Listing deleted.');
    setState((s) => ({
      ...s,
      items: s.items.filter((m) => m.id !== removed.id),
      meta: s.meta && { ...s.meta, total: s.meta.total - 1 },
    }));
  };

  return (
    <section className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold text-slate-900">My Listings</h1>
        <Link to="/materials/new" className="rounded-lg bg-green-700 px-5 py-2 font-semibold text-white hover:bg-green-800">Add Material</Link>
      </div>

      <div className="mt-4 space-y-3">
        <Alert type="success">{message}</Alert>
        <Alert type="error">{actionError || state.error}</Alert>
      </div>

      {state.loading ? (
        <Spinner label="Loading your listings…" />
      ) : (
        !state.error && (
          <>
            {state.items.length > 0 ? (
              <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {state.items.map((material) => (
                  <MaterialCard
                    key={material.id}
                    material={material}
                    actions={
                      <OwnerActions
                        material={material}
                        onUpdated={(updated) => { setActionError(''); replaceItem(updated); }}
                        onDeleted={removeItem}
                        onError={setActionError}
                      />
                    }
                  />
                ))}
              </div>
            ) : (
              <div className="mt-6 rounded-xl border border-dashed border-slate-300 p-10 text-center text-slate-700">
                <p className="font-semibold text-slate-900">You haven’t listed any materials yet.</p>
                <Link to="/materials/new" className="mt-4 inline-block rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800">Create your first listing</Link>
              </div>
            )}
            <Pagination meta={state.meta} onChange={(p) => setParams({ page: String(p) })} />
          </>
        )
      )}
    </section>
  );
}
