import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Alert from '../components/Alert.jsx';
import FormField from '../components/FormField.jsx';
import MaterialCard from '../components/MaterialCard.jsx';
import Pagination from '../components/Pagination.jsx';
import Spinner from '../components/Spinner.jsx';
import { CATEGORIES, CONDITIONS } from '../data/materialOptions.js';
import { materialsApi } from '../services/api.js';

const FILTER_KEYS = ['search', 'category', 'condition', 'location', 'availability'];

const draftFromParams = (params) =>
  Object.fromEntries(FILTER_KEYS.map((key) => [key, params.get(key) || (key === 'availability' ? 'available' : '')]));

export default function MaterialsPage() {
  const [params, setParams] = useSearchParams();
  const [draft, setDraft] = useState(() => draftFromParams(params));
  const [state, setState] = useState({ loading: true, error: '', items: [], meta: null });
  const query = params.toString();
  const hasFilters = FILTER_KEYS.some((key) => params.has(key));

  useEffect(() => {
    let cancelled = false;
    setState((current) => ({ ...current, loading: true, error: '' }));
    materialsApi
      .list(Object.fromEntries(new URLSearchParams(query)))
      .then((res) => !cancelled && setState({ loading: false, error: '', items: res.data, meta: res.meta }))
      .catch((error) => !cancelled && setState({ loading: false, error: error.message, items: [], meta: null }));
    return () => { cancelled = true; };
  }, [query]);

  const setField = (field) => (event) => setDraft((current) => ({ ...current, [field]: event.target.value }));

  function applyFilters(event) {
    event.preventDefault();
    const next = new URLSearchParams();
    FILTER_KEYS.forEach((key) => {
      const value = draft[key].trim();
      if (value && !(key === 'availability' && value === 'available')) next.set(key, value);
    });
    setParams(next);
  }

  function clearFilters() {
    setDraft(draftFromParams(new URLSearchParams()));
    setParams({});
  }

  function goToPage(page) {
    const next = new URLSearchParams(params);
    next.set('page', String(page));
    setParams(next);
  }

  return (
    <section className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold text-slate-900">Browse Materials</h1>
        <Link to="/materials/new" className="rounded-lg bg-green-700 px-5 py-2 font-semibold text-white hover:bg-green-800">Add Material</Link>
      </div>

      <form role="search" aria-label="Search and filter materials" onSubmit={applyFilters} className="mt-6 grid gap-4 rounded-xl border border-green-100 bg-green-50 p-4 sm:grid-cols-2 lg:grid-cols-5">
        <FormField id="f-search" label="Search" type="search" placeholder="e.g. boxes" value={draft.search} onChange={setField('search')} className="lg:col-span-2" />
        <FormField id="f-category" label="Category" as="select" value={draft.category} onChange={setField('category')}>
          <option value="">All categories</option>
          {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </FormField>
        <FormField id="f-condition" label="Condition" as="select" value={draft.condition} onChange={setField('condition')}>
          <option value="">Any condition</option>
          {CONDITIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </FormField>
        <FormField id="f-location" label="Location" placeholder="e.g. Guntur" value={draft.location} onChange={setField('location')} />
        <FormField id="f-availability" label="Availability" as="select" value={draft.availability} onChange={setField('availability')}>
          <option value="available">Available only</option>
          <option value="unavailable">Unavailable only</option>
          <option value="all">All listings</option>
        </FormField>
        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-2">
          <button type="submit" className="rounded-lg bg-green-700 px-5 py-2 font-semibold text-white hover:bg-green-800">Apply</button>
          <button type="button" onClick={clearFilters} className="rounded-lg border border-slate-400 bg-white px-5 py-2 font-semibold text-slate-800 hover:bg-slate-100">Clear</button>
        </div>
      </form>

      <div className="mt-6">
        <Alert type="error">{state.error}</Alert>
        {state.loading ? (
          <Spinner label="Loading materials…" />
        ) : (
          !state.error && (
            <>
              <p role="status" className="text-sm text-slate-700">
                {state.meta.total} {state.meta.total === 1 ? 'material' : 'materials'} found
              </p>
              {state.items.length > 0 ? (
                <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {state.items.map((material) => <MaterialCard key={material.id} material={material} />)}
                </div>
              ) : (
                <div className="mt-4 rounded-xl border border-dashed border-slate-300 p-10 text-center text-slate-700">
                  {hasFilters ? (
                    <>
                      <p className="font-semibold text-slate-900">No materials match your search or filters.</p>
                      <p className="mt-1 text-sm">Try different keywords or clear the filters.</p>
                      <button type="button" onClick={clearFilters} className="mt-4 rounded-lg border border-green-700 px-4 py-2 text-sm font-semibold text-green-800 hover:bg-green-50">Clear filters</button>
                    </>
                  ) : (
                    <>
                      <p className="font-semibold text-slate-900">No materials have been listed yet.</p>
                      <Link to="/materials/new" className="mt-4 inline-block rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800">List the first material</Link>
                    </>
                  )}
                </div>
              )}
              <Pagination meta={state.meta} onChange={goToPage} />
            </>
          )
        )}
      </div>
    </section>
  );
}
