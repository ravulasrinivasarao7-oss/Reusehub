import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Alert from '../components/Alert.jsx';
import MaterialForm from '../components/MaterialForm.jsx';
import Spinner from '../components/Spinner.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { materialsApi } from '../services/api.js';

export default function MaterialFormPage({ mode }) {
  const isEdit = mode === 'edit';
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [material, setMaterial] = useState(null);
  const [loading, setLoading] = useState(isEdit);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isEdit) return undefined;
    let cancelled = false;
    materialsApi
      .get(id)
      .then((res) => !cancelled && setMaterial(res.data))
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [isEdit, id]);

  if (loading) return <Spinner label="Loading listing…" />;

  const notOwner = isEdit && material && material.ownerId !== user?.id;
  if (error || notOwner || (isEdit && !material)) {
    return (
      <section className="mx-auto max-w-2xl px-4 py-16 text-center">
        <Alert type="error">{notOwner ? 'You can only edit your own listings.' : error || 'Material not found.'}</Alert>
        <Link to="/materials" className="mt-6 inline-block rounded-lg bg-green-700 px-5 py-2 font-semibold text-white hover:bg-green-800">Back to materials</Link>
      </section>
    );
  }

  async function handleSubmit(payload) {
    const res = isEdit ? await materialsApi.update(id, payload) : await materialsApi.create(payload);
    navigate(`/materials/${res.data.id}`, { state: { message: isEdit ? 'Listing updated.' : 'Listing created.' } });
  }

  return (
    <section className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-3xl font-bold text-slate-900">{isEdit ? 'Edit Material' : 'Add Material'}</h1>
      <div className="mt-6">
        <MaterialForm
          initial={material}
          submitLabel={isEdit ? 'Save changes' : 'Create listing'}
          cancelTo={isEdit ? `/materials/${id}` : '/materials'}
          onSubmit={handleSubmit}
        />
      </div>
    </section>
  );
}
