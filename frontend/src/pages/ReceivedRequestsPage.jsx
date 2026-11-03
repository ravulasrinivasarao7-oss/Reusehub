import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Alert from '../components/Alert.jsx';
import MaterialImage from '../components/MaterialImage.jsx';
import RequestStatusBadge from '../components/RequestStatusBadge.jsx';
import Spinner from '../components/Spinner.jsx';
import { requestsApi } from '../services/api.js';

export default function ReceivedRequestsPage() {
  const [state, setState] = useState({ loading: true, error: '', items: [] });
  const [message, setMessage] = useState('');
  const [updatingId, setUpdatingId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    requestsApi.received()
      .then((res) => !cancelled && setState({ loading: false, error: '', items: res.data }))
      .catch((error) => !cancelled && setState({ loading: false, error: error.message, items: [] }));
    return () => { cancelled = true; };
  }, []);

  async function respond(request, status) {
    setUpdatingId(request.id);
    setMessage('');
    setState((current) => ({ ...current, error: '' }));
    try {
      const result = await requestsApi.updateStatus(request.id, status);
      setState((current) => ({
        ...current,
        items: current.items.map((item) => item.id === request.id ? result.data : item),
      }));
      setMessage(status === 'ACCEPTED' ? 'Request accepted. The material is now unavailable.' : 'Request rejected.');
    } catch (error) {
      setState((current) => ({ ...current, error: error.message }));
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <section className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-bold text-slate-900">Received Requests</h1>
      <p className="mt-2 text-slate-700">Review and respond to requests for your listed materials.</p>
      <div className="mt-4 space-y-3">
        <Alert type="success">{message}</Alert>
        <Alert type="error">{state.error}</Alert>
      </div>
      {state.loading ? <Spinner label="Loading received requests…" /> : state.items.length ? (
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          {state.items.map((item) => (
            <article key={item.id} className="flex flex-col gap-4 rounded-xl border border-green-100 bg-white p-4 shadow-sm sm:flex-row">
              <MaterialImage src={item.material.imageUrl} alt={`Photo of ${item.material.title}`} className="h-36 w-full shrink-0 rounded-lg sm:w-40" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-lg font-bold text-slate-900">{item.material.title}</h2>
                  <RequestStatusBadge status={item.status} />
                </div>
                <p className="mt-2 text-sm text-slate-700">Requested by: {item.requester.name}</p>
                <p className="mt-1 text-sm text-slate-700">Received {new Date(item.createdAt).toLocaleDateString()}</p>
                <Link to={`/materials/${item.material.id}`} className="mt-3 inline-block text-sm font-semibold text-green-800 underline">View material</Link>
                {item.status === 'PENDING' && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => respond(item, 'ACCEPTED')}
                      disabled={updatingId === item.id || !item.material.isAvailable}
                      className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800 disabled:opacity-60"
                    >
                      {updatingId === item.id ? 'Updating…' : 'Accept'}
                    </button>
                    <button
                      type="button"
                      onClick={() => respond(item, 'REJECTED')}
                      disabled={updatingId === item.id}
                      className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-800 hover:bg-red-50 disabled:opacity-60"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : state.error ? null : (
        <div className="mt-6 rounded-xl border border-dashed border-slate-300 p-10 text-center text-slate-700">
          <p className="font-semibold text-slate-900">You haven’t received any material requests yet.</p>
          <Link to="/my-listings" className="mt-4 inline-block rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800">View your listings</Link>
        </div>
      )}
    </section>
  );
}
