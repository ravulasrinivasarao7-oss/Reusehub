import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CATEGORIES, CONDITIONS, UNIT_SUGGESTIONS } from '../data/materialOptions.js';
import Alert from './Alert.jsx';
import FormField from './FormField.jsx';
import MaterialImage from './MaterialImage.jsx';

const EMPTY = {
  title: '', description: '', category: '', quantity: '', unit: '',
  condition: '', location: '', imageUrl: '', isAvailable: true,
};

// Mirrors the server rules for fast feedback. The server remains the source of truth.
function validate(v) {
  const errors = {};
  const title = v.title.trim();
  const description = v.description.trim();
  const qty = Number(v.quantity);
  if (title.length < 3 || title.length > 120) errors.title = 'Title must be 3–120 characters.';
  if (description.length < 10 || description.length > 2000) errors.description = 'Description must be 10–2000 characters.';
  if (!v.category) errors.category = 'Choose a category.';
  if (v.quantity === '' || !Number.isInteger(qty) || qty < 1 || qty > 1000000) errors.quantity = 'Enter a whole number between 1 and 1,000,000.';
  if (v.unit.trim().length < 1 || v.unit.trim().length > 30) errors.unit = 'Unit is required (max 30 characters).';
  if (!v.condition) errors.condition = 'Choose a condition.';
  if (v.location.trim().length < 2 || v.location.trim().length > 120) errors.location = 'Location must be 2–120 characters.';
  if (v.imageUrl.trim()) {
    try {
      const url = new URL(v.imageUrl.trim());
      if (!['http:', 'https:'].includes(url.protocol)) errors.imageUrl = 'Image URL must start with http:// or https://.';
    } catch {
      errors.imageUrl = 'Enter a valid image URL starting with http:// or https://.';
    }
  }
  return errors;
}

function toFormValues(material) {
  if (!material) return EMPTY;
  return {
    title: material.title, description: material.description, category: material.category,
    quantity: String(material.quantity), unit: material.unit, condition: material.condition,
    location: material.location, imageUrl: material.imageUrl || '', isAvailable: material.isAvailable,
  };
}

export default function MaterialForm({ initial, submitLabel, cancelTo, onSubmit }) {
  const [values, setValues] = useState(() => toFormValues(initial));
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const set = (field) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setValues((current) => ({ ...current, [field]: value }));
  };

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError('');
    const found = validate(values);
    setErrors(found);
    if (Object.keys(found).length) {
      setFormError('Please correct the highlighted fields.');
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({
        title: values.title, description: values.description, category: values.category,
        quantity: Number(values.quantity), unit: values.unit, condition: values.condition,
        location: values.location, imageUrl: values.imageUrl, isAvailable: values.isAvailable,
      });
    } catch (error) {
      setFormError(error.message);
      if (error.errors) setErrors(error.errors);
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <Alert type="error">{formError}</Alert>

      <FormField id="title" label="Title" required value={values.title} onChange={set('title')} error={errors.title} maxLength={120} />
      <FormField id="description" label="Description" as="textarea" required value={values.description} onChange={set('description')} error={errors.description} maxLength={2000} hint="Describe what it is, its size, and how it can be reused." />

      <div className="grid gap-5 sm:grid-cols-2">
        <FormField id="category" label="Category" as="select" required value={values.category} onChange={set('category')} error={errors.category}>
          <option value="">Select a category</option>
          {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </FormField>
        <FormField id="condition" label="Condition" as="select" required value={values.condition} onChange={set('condition')} error={errors.condition}>
          <option value="">Select a condition</option>
          {CONDITIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </FormField>
        <FormField id="quantity" label="Quantity" type="number" min="1" step="1" required value={values.quantity} onChange={set('quantity')} error={errors.quantity} />
        <div>
          <FormField id="unit" label="Unit" required list="unit-options" value={values.unit} onChange={set('unit')} error={errors.unit} maxLength={30} hint="For example: pieces, kg, sheets" />
          <datalist id="unit-options">{UNIT_SUGGESTIONS.map((u) => <option key={u} value={u} />)}</datalist>
        </div>
      </div>

      <FormField id="location" label="Location" required value={values.location} onChange={set('location')} error={errors.location} maxLength={120} hint="City or area where the material can be collected." />
      <FormField id="imageUrl" label="Image URL (optional)" type="url" value={values.imageUrl} onChange={set('imageUrl')} error={errors.imageUrl} maxLength={500} hint="Link to an existing image. Uploading files is not supported yet." />

      {values.imageUrl.trim() && !errors.imageUrl && (
        <div>
          <p className="mb-1 text-sm font-semibold text-slate-900">Image preview</p>
          <MaterialImage key={values.imageUrl} src={values.imageUrl.trim()} alt="Preview of the linked image" className="h-40 w-64 rounded-lg" />
        </div>
      )}

      <label className="flex items-center gap-2 text-sm font-medium text-slate-900">
        <input type="checkbox" checked={values.isAvailable} onChange={set('isAvailable')} className="h-4 w-4" />
        This material is currently available
      </label>

      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={submitting} className="rounded-lg bg-green-700 px-6 py-2.5 font-semibold text-white hover:bg-green-800 disabled:opacity-60">
          {submitting ? 'Saving…' : submitLabel}
        </button>
        <Link to={cancelTo} className="rounded-lg border border-slate-400 px-6 py-2.5 font-semibold text-slate-800 hover:bg-slate-100">Cancel</Link>
      </div>
    </form>
  );
}
