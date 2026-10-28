export default function Pagination({ meta, onChange }) {
  if (!meta || meta.totalPages <= 1) return null;
  const btn = 'rounded-lg border border-slate-400 px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50';
  return (
    <nav aria-label="Pagination" className="mt-8 flex items-center justify-center gap-4">
      <button type="button" className={btn} disabled={meta.page <= 1} onClick={() => onChange(meta.page - 1)}>Previous</button>
      <span className="text-sm text-slate-700">Page {meta.page} of {meta.totalPages}</span>
      <button type="button" className={btn} disabled={meta.page >= meta.totalPages} onClick={() => onChange(meta.page + 1)}>Next</button>
    </nav>
  );
}
