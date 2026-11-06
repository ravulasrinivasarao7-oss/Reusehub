import { useState } from 'react';
import Alert from './Alert.jsx';
import RequestStatusBadge from './RequestStatusBadge.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { requestsApi } from '../services/api.js';
import { Link } from 'react-router-dom';

export default function RequestMaterialButton({ material }) {
  const { user, loading, requests, requestsLoading, requestsError, updateRequest } = useAuth();
  const [action, setAction] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [requestNote, setRequestNote] = useState('');
  const request = requests.find((item) => item.materialId === material.id);

  if (user && material.ownerId === user.id) return null;
  if (loading) return <p role="status" className="text-sm text-slate-600">Checking your session…</p>;

  if (requestsLoading) return <p role="status" className="text-sm text-slate-600">Checking request status…</p>;
  if (requestsError) {
    return <Alert type="error">Could not load your request status. Please refresh and try again.</Alert>;
  }

  if (!user) {
    return (
      <div className="space-y-2 rounded-lg bg-green-50 p-3 text-sm text-slate-800">
        <p>Log in or register to request this material.</p>
        <div className="flex gap-3">
          <Link to="/login" className="font-semibold text-green-800 underline">Log in</Link>
          <Link to="/register" className="font-semibold text-green-800 underline">Create an account</Link>
        </div>
      </div>
    );
  }

  async function submitRequest() {
    setAction('sending');
    setMessage('');
    setError('');
    try {
      const result = await requestsApi.create(material.id, requestNote.trim());
      updateRequest(result.data);
      setMessage('Request sent. You can track its status in My Requests.');
      setRequestNote('');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setAction('');
    }
  }

  async function cancelRequest() {
    if (!window.confirm('Cancel this pending material request?')) return;
    setAction('cancelling');
    setMessage('');
    setError('');
    try {
      const result = await requestsApi.updateStatus(request.id, 'CANCELLED');
      updateRequest(result.data);
      setMessage('Request cancelled.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setAction('');
    }
  }

  const canRequest = material.isAvailable && (!request || ['REJECTED', 'CANCELLED'].includes(request.status));
  if (!request && !material.isAvailable) return null;

  return (
    <div className="space-y-2">
      {request && <RequestStatusBadge status={request.status} />}
      {request?.status === 'PENDING' ? (
        <button
          type="button"
          onClick={cancelRequest}
          disabled={Boolean(action)}
          className="w-full rounded-lg border border-slate-400 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {action === 'cancelling' ? 'Cancelling request…' : 'Cancel Request'}
        </button>
      ) : canRequest ? (
        <>
          <label htmlFor={`request-message-${material.id}`} className="block text-sm font-medium text-slate-800">
            Optional message to the owner
          </label>
          <textarea
            id={`request-message-${material.id}`}
            value={requestNote}
            onChange={(event) => setRequestNote(event.target.value)}
            maxLength={500}
            rows={3}
            disabled={Boolean(action)}
            className="w-full rounded-lg border border-slate-400 px-3 py-2 text-sm"
            placeholder="Add a note about how you plan to reuse this material."
          />
          <p className="text-right text-xs text-slate-600">{requestNote.length}/500</p>
          <button
            type="button"
            onClick={submitRequest}
            disabled={Boolean(action)}
            className="w-full rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {action === 'sending' ? 'Sending request…' : 'Request Material'}
          </button>
        </>
      ) : null}
      <Alert type="success">{message}</Alert>
      <Alert type="error">{error}</Alert>
    </div>
  );
}
