import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import Alert from '../components/Alert.jsx';
import AvailabilityBadge from '../components/AvailabilityBadge.jsx';
import MaterialImage from '../components/MaterialImage.jsx';
import OwnerActions from '../components/OwnerActions.jsx';
import Spinner from '../components/Spinner.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { categoryLabel, conditionLabel } from '../data/materialOptions.js';
import { materialsApi } from '../services/api.js';

export default function MaterialDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [material, setMaterial] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const success = location.state?.message;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    materialsApi
      .get(id)
      .then((res) => !cancelled && setMaterial(res.data))
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [id]);

  if (loading) return <Spinner label="Loading material…" />;

  if (error || !material) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-16 text-center">
        <Alert type="error">{error || 'Material not found.'}</Alert>
        <Link to="/materials" className="mt-6 inline-block rounded-lg bg-green-700 px-5 py-2 font-semibold text-white hover:bg-green-800">Back to materials</Link>
      </section>
    );
  }

  const isOwner = user?.id === material.ownerId;
  const rows = [
    ['Category', categoryLabel(material.category)],
    ['Quantity', `${material.quantity} ${material.unit}`],
    ['Condition', conditionLabel(material.condition)],
    ['Location', material.location],
    ['Listed by', material.owner?.name],
    ['Listed on', new Date(material.createdAt).toLocaleDateString()],
  ];

  return (
    <article className="mx-auto max-w-4xl px-4 py-10">
      <Link to="/materials" className="text-sm font-semibold text-green-800 underline">← Back to materials</Link>
      <div className="mt-4 space-y-4">
        <Alert type="success">{success}</Alert>
        <Alert type="error">{actionError}</Alert>
      </div>

      <div className="mt-4 grid gap-8 md:grid-cols-2">
        <MaterialImage key={material.imageUrl} src={material.imageUrl} alt={`Photo of ${material.title}`} className="h-72 w-full rounded-xl" />
        <div>
          <AvailabilityBadge isAvailable={material.isAvailable} />
          <h1 className="mt-3 text-3xl font-bold text-slate-900">{material.title}</h1>
          <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            {rows.map(([term, value]) => (
              <div key={term}>
                <dt className="font-semibold text-slate-900">{term}</dt>
                <dd className="text-slate-700">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <h2 className="mt-8 text-xl font-bold text-slate-900">Description</h2>
      <p className="mt-2 whitespace-pre-line text-slate-700">{material.description}</p>

      {isOwner && (
        <div className="mt-8 rounded-xl border border-green-100 bg-green-50 p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Manage your listing</h2>
          <OwnerActions
            material={material}
            onUpdated={(updated) => { setActionError(''); setMaterial(updated); }}
            onDeleted={() => navigate('/my-listings', { state: { message: 'Listing deleted.' } })}
            onError={setActionError}
          />
        </div>
      )}
    </article>
  );
}
