import { useCallback, useEffect, useState } from 'react';
import { getBackendHealth, getDatabaseHealth } from '../services/api.js';

// Development-only diagnostics. Rendered by HomePage only when import.meta.env.DEV.
// Each check is 'checking' | 'connected' | 'failed'.
const COLORS = {
  checking: 'text-slate-700',
  connected: 'text-green-800',
  failed: 'text-red-700',
};

export default function ConnectionStatus() {
  const [backend, setBackend] = useState({ state: 'checking', detail: '' });
  const [database, setDatabase] = useState({ state: 'checking', detail: '' });
  const [runId, setRunId] = useState(0);

  const recheck = useCallback(() => {
    setBackend({ state: 'checking', detail: '' });
    setDatabase({ state: 'checking', detail: '' });
    setRunId((id) => id + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        await getBackendHealth();
        if (cancelled) return;
        setBackend({ state: 'connected', detail: '' });
      } catch (error) {
        if (cancelled) return;
        setBackend({ state: 'failed', detail: error.message });
        setDatabase({ state: 'failed', detail: 'Not checked because the backend is unreachable.' });
        return;
      }

      try {
        const data = await getDatabaseHealth();
        if (cancelled) return;
        setDatabase({ state: 'connected', detail: `Database name: ${data.database.name}` });
      } catch (error) {
        if (cancelled) return;
        setDatabase({ state: 'failed', detail: error.message });
      }
    }

    run();
    return () => { cancelled = true; };
  }, [runId]);

  const row = (title, check) => (
    <li className="flex flex-wrap items-baseline gap-x-2">
      <span className={`font-semibold ${COLORS[check.state]}`}>
        {check.state === 'checking' && 'Checking connection…'}
        {check.state === 'connected' && `${title} connected`}
        {check.state === 'failed' && `${title}: Connection failed`}
      </span>
      {check.detail && <span className="text-xs text-slate-600">({check.detail})</span>}
    </li>
  );

  return (
    <section aria-labelledby="diag-heading" className="mx-auto my-8 max-w-3xl rounded-lg border border-dashed border-slate-400 bg-slate-50 p-4 text-sm">
      <h2 id="diag-heading" className="font-bold text-slate-900">Development diagnostics</h2>
      <p className="text-xs text-slate-600">Visible in development mode only.</p>
      <ul role="status" className="mt-3 space-y-1">
        {row('Backend', backend)}
        {row('Database', database)}
      </ul>
      <button type="button" onClick={recheck} className="mt-3 rounded border border-slate-400 bg-white px-3 py-1 font-medium hover:bg-slate-100">
        Re-check
      </button>
    </section>
  );
}
