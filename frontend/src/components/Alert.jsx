const STYLES = {
  error: 'border-red-300 bg-red-50 text-red-900',
  success: 'border-green-300 bg-green-50 text-green-900',
  info: 'border-slate-300 bg-slate-50 text-slate-900',
};

export default function Alert({ type = 'info', children }) {
  if (!children) return null;
  return (
    <div role={type === 'error' ? 'alert' : 'status'} className={`rounded-lg border px-4 py-3 text-sm ${STYLES[type]}`}>
      {children}
    </div>
  );
}
