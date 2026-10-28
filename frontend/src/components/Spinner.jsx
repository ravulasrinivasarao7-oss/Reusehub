export default function Spinner({ label = 'Loading…' }) {
  return (
    <div role="status" className="flex items-center justify-center gap-3 py-16 text-slate-700">
      <span aria-hidden="true" className="h-5 w-5 animate-spin rounded-full border-2 border-green-700 border-t-transparent motion-reduce:animate-none" />
      <span>{label}</span>
    </div>
  );
}
