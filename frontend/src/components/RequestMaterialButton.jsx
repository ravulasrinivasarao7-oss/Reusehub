import { useState } from 'react';
import Alert from './Alert.jsx';
import RequestStatusBadge from './RequestStatusBadge.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { requestsApi } from '../services/api.js';

export default function RequestMaterialButton({ material }) {
  const { user, requests, requestsLoading, requestsError, updateRequest } = useAuth();
  const [action, setAction] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const request = requests.find((item) => item.materialId === material.id);

  if (!user || material.ownerId === user.id) return null;

  if (requestsLoading) return <p role="status" className="text-sm text-slate-600">Checking request status…</p>;
  if (requestsError) {
    return <Alert type="error">Could not load your request status. Please refresh and try again.</Alert>;
  }

  async function submitRequest() {
    setAction('sending');
    setMessage('');
    setError('');
    try {
      const result = await requestsApi.create(material.id);
      updateRequest(result.data);
      setMessage('Request sent. You can track its status in My Requests.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setAction('');
    }
  }

  async function cancelRequest() {
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
        <button
          type="button"
          onClick={submitRequest}
          disabled={Boolean(action)}
          className="w-full rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {action === 'sending' ? 'Sending request…' : 'Request Material'}
        </button>
      ) : null}
      <Alert type="success">{message}</Alert>
      <Alert type="error">{error}</Alert>
    </div>
  );
}
