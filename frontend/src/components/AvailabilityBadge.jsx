export default function AvailabilityBadge({ isAvailable }) {
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${isAvailable ? 'bg-green-100 text-green-900' : 'bg-slate-200 text-slate-800'}`}>
      {isAvailable ? 'Available' : 'Unavailable'}
    </span>
  );
}
