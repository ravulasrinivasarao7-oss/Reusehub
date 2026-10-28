import { Link } from 'react-router-dom';
import { categoryLabel, conditionLabel } from '../data/materialOptions.js';
import AvailabilityBadge from './AvailabilityBadge.jsx';
import MaterialImage from './MaterialImage.jsx';

// `actions` is an optional node rendered under the card (e.g. owner buttons).
export default function MaterialCard({ material, actions }) {
  const { id, title, category, description, quantity, unit, condition, location, imageUrl, isAvailable, owner } = material;

  return (
    <article className="flex flex-col overflow-hidden rounded-xl border border-green-100 bg-white shadow-sm">
      <MaterialImage key={imageUrl} src={imageUrl} alt={`Photo of ${title}`} className="h-44 w-full" />
      <div className="flex flex-1 flex-col p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-900">{categoryLabel(category)}</span>
          <AvailabilityBadge isAvailable={isAvailable} />
        </div>
        <h3 className="mt-3 text-lg font-bold text-slate-900">{title}</h3>
        <p className="mt-2 line-clamp-3 text-sm text-slate-700">{description}</p>

        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div>
            <dt className="font-semibold text-slate-900">Quantity</dt>
            <dd className="text-slate-700">{quantity} {unit}</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-900">Condition</dt>
            <dd className="text-slate-700">{conditionLabel(condition)}</dd>
          </div>
          <div className="col-span-2">
            <dt className="font-semibold text-slate-900">Location</dt>
            <dd className="text-slate-700">{location}</dd>
          </div>
          {owner && (
            <div className="col-span-2">
              <dt className="font-semibold text-slate-900">Listed by</dt>
              <dd className="text-slate-700">{owner.name}</dd>
            </div>
          )}
        </dl>

        <Link to={`/materials/${id}`} className="mt-5 rounded-lg bg-green-700 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-green-800">
          View Material<span className="sr-only">: {title}</span>
        </Link>
        {actions && <div className="mt-3">{actions}</div>}
      </div>
    </article>
  );
}
