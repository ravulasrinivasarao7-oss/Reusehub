import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CATEGORIES, CONDITIONS, UNIT_SUGGESTIONS } from '../data/materialOptions.js';
import Alert from './Alert.jsx';
import FormField from './FormField.jsx';
import MaterialImage from './MaterialImage.jsx';
import { materialsApi } from '../services/api.js';

const EMPTY = {
  title: '', description: '', category: '', quantity: '', unit: '',
  condition: '', location: '', imageUrl: '', isAvailable: true,
};
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const IMAGE_TYPES = new Map([
  ['image/jpeg', ['.jpg', '.jpeg']],
  ['image/png', ['.png']],
  ['image/webp', ['.webp']],
]);
const UPLOADED_IMAGE_PATH = /^\/uploads\/[a-z0-9-]+\.(?:jpe?g|png|webp)$/i;

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
    if (!UPLOADED_IMAGE_PATH.test(v.imageUrl.trim())) {
      try {
        const url = new URL(v.imageUrl.trim());
        if (!['http:', 'https:'].includes(url.protocol)) errors.imageUrl = 'Image URL must start with http:// or https://.';
      } catch {
        errors.imageUrl = 'Enter a valid image URL starting with http:// or https://.';
      }
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
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');

  useEffect(() => {
    if (!imageFile) {
      setImagePreview('');
      return undefined;
    }
    const preview = URL.createObjectURL(imageFile);
    setImagePreview(preview);
    return () => URL.revokeObjectURL(preview);
  }, [imageFile]);

  const set = (field) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setValues((current) => ({ ...current, [field]: value }));
  };

  function handleImageFileChange(event) {
    const file = event.target.files?.[0] || null;
    setErrors((previous) => {
      const { imageFile: _imageFileError, ...remaining } = previous;
      return remaining;
    });
    setImageFile(null);
    if (!file) return;

    const extension = `.${file.name.split('.').pop().toLowerCase()}`;
    if (!IMAGE_TYPES.get(file.type)?.includes(extension)) {
      event.target.value = '';
      setErrors((previous) => ({ ...previous, imageFile: 'Choose a JPG, JPEG, PNG, or WebP image.' }));
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      event.target.value = '';
      setErrors((previous) => ({ ...previous, imageFile: 'Image must be 5 MB or smaller.' }));
      return;
    }
    setImageFile(file);
  }

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
      const imageUrl = imageFile
        ? (await materialsApi.uploadImage(imageFile)).data.imageUrl
        : values.imageUrl.trim();
      await onSubmit({
        title: values.title, description: values.description, category: values.category,
        quantity: Number(values.quantity), unit: values.unit, condition: values.condition,
        location: values.location, imageUrl, isAvailable: values.isAvailable,
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
      <FormField id="imageUrl" label="Image URL (optional)" type="url" value={values.imageUrl} onChange={set('imageUrl')} error={errors.imageUrl} maxLength={500} hint="Paste a link to an existing image, or upload one below." />

      <div>
        <label htmlFor="imageFile" className="mb-1 block text-sm font-semibold text-slate-900">Upload image (optional)</label>
        <input
          id="imageFile"
          type="file"
          accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
          onChange={handleImageFileChange}
          aria-invalid={errors.imageFile ? 'true' : undefined}
          aria-describedby={errors.imageFile ? 'imageFile-error' : 'imageFile-hint'}
          className="block w-full rounded-lg border border-slate-400 bg-white px-3 py-2 text-sm"
        />
        <p id="imageFile-hint" className="mt-1 text-xs text-slate-600">JPG, JPEG, PNG, or WebP; maximum 5 MB.</p>
        {errors.imageFile && <p id="imageFile-error" role="alert" className="mt-1 text-sm text-red-700">{errors.imageFile}</p>}
        {imageFile && (
          <button type="button" onClick={() => setImageFile(null)} className="mt-2 text-sm font-semibold text-green-800 underline">
            Remove selected image
          </button>
        )}
      </div>

      {(imagePreview || (values.imageUrl.trim() && !errors.imageUrl)) && (
        <div>
          <p className="mb-1 text-sm font-semibold text-slate-900">Image preview</p>
          <MaterialImage key={imagePreview || values.imageUrl} src={imagePreview || values.imageUrl.trim()} alt="Preview of the material image" className="h-40 w-64 rounded-lg" />
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
