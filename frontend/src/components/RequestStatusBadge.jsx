const STATUS_STYLES = {
  PENDING: 'bg-amber-100 text-amber-900',
  ACCEPTED: 'bg-green-100 text-green-900',
  REJECTED: 'bg-red-100 text-red-900',
  CANCELLED: 'bg-slate-100 text-slate-700',
};

export function requestStatusLabel(status) {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

export default function RequestStatusBadge({ status }) {
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLES[status] || STATUS_STYLES.CANCELLED}`}>
      {requestStatusLabel(status)}
    </span>
  );
}
