import { useState } from 'react';
import Alert from './Alert.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { requestsApi } from '../services/api.js';

export default function RequestMaterialButton({ material }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  if (!user || !material.isAvailable || material.ownerId === user.id) return null;

  async function submitRequest() {
    setLoading(true);
    setMessage('');
    setError('');
    try {
      await requestsApi.create(material.id);
      setMessage('Request sent. You can track its status in My Requests.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={submitRequest}
        disabled={loading || Boolean(message)}
        className="w-full rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? 'Sending request…' : message ? 'Request sent' : 'Request Material'}
      </button>
      <Alert type="success">{message}</Alert>
      <Alert type="error">{error}</Alert>
    </div>
  );
}
