import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Alert from '../components/Alert.jsx';
import MaterialImage from '../components/MaterialImage.jsx';
import RequestStatusBadge from '../components/RequestStatusBadge.jsx';
import Spinner from '../components/Spinner.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { requestsApi } from '../services/api.js';

export default function MyRequestsPage() {
  const { updateRequest } = useAuth();
  const [state, setState] = useState({ loading: true, error: '', items: [] });
  const [message, setMessage] = useState('');
  const [updatingId, setUpdatingId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    requestsApi.mine()
      .then((res) => !cancelled && setState({ loading: false, error: '', items: res.data }))
      .catch((error) => !cancelled && setState({ loading: false, error: error.message, items: [] }));
    return () => { cancelled = true; };
  }, []);

  async function cancelRequest(request) {
    if (!window.confirm('Cancel this pending material request?')) return;
    setUpdatingId(request.id);
    setMessage('');
    setState((current) => ({ ...current, error: '' }));
    try {
      const result = await requestsApi.updateStatus(request.id, 'CANCELLED');
      updateRequest(result.data);
      setState((current) => ({
        ...current,
        items: current.items.map((item) => item.id === request.id ? result.data : item),
      }));
      setMessage('Request cancelled.');
    } catch (error) {
      setState((current) => ({ ...current, error: error.message }));
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <section className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-bold text-slate-900">My Requests</h1>
      <p className="mt-2 text-slate-700">Track the materials you’ve requested and their current status.</p>
      <div className="mt-4 space-y-3">
        <Alert type="success">{message}</Alert>
        <Alert type="error">{state.error}</Alert>
      </div>
      {state.loading ? <Spinner label="Loading your requests…" /> : state.items.length ? (
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          {state.items.map((item) => (
            <article key={item.id} className="flex flex-col gap-4 rounded-xl border border-green-100 bg-white p-4 shadow-sm sm:flex-row">
              <MaterialImage src={item.material.imageUrl} alt={`Photo of ${item.material.title}`} className="h-36 w-full shrink-0 rounded-lg sm:w-40" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-lg font-bold text-slate-900">{item.material.title}</h2>
                  <RequestStatusBadge status={item.status} />
                </div>
                <p className="mt-2 text-sm text-slate-700">Owner: {item.material.owner.name}</p>
                <p className="mt-1 text-sm text-slate-700">Requested {new Date(item.createdAt).toLocaleDateString()}</p>
                <Link to={`/materials/${item.material.id}`} className="mt-3 inline-block text-sm font-semibold text-green-800 underline">View material</Link>
                {item.status === 'PENDING' && (
                  <button
                    type="button"
                    onClick={() => cancelRequest(item)}
                    disabled={updatingId === item.id}
                    className="ml-4 rounded-lg border border-slate-400 px-3 py-1.5 text-sm font-semibold text-slate-800 hover:bg-slate-100 disabled:opacity-60"
                  >
                    {updatingId === item.id ? 'Cancelling…' : 'Cancel request'}
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : state.error ? null : (
        <div className="mt-6 rounded-xl border border-dashed border-slate-300 p-10 text-center text-slate-700">
          <p className="font-semibold text-slate-900">You haven’t requested any materials yet.</p>
          <Link to="/materials" className="mt-4 inline-block rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800">Browse materials</Link>
        </div>
      )}
    </section>
  );
}
