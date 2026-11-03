import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Alert from '../components/Alert.jsx';
import FormField from '../components/FormField.jsx';
import { authApi } from '../services/api.js';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [values, setValues] = useState({ password: '', confirmPassword: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const set = (field) => (event) => setValues({ ...values, [field]: event.target.value });

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError('');
    setSuccess('');
    const found = {};
    if (!token) found.token = 'This password reset link is invalid or expired.';
    if (values.password.length < 8 || new TextEncoder().encode(values.password).length > 72) {
      found.password = 'Password must be 8–72 characters.';
    }
    if (!values.confirmPassword) found.confirmPassword = 'Please confirm your password.';
    else if (values.password !== values.confirmPassword) found.confirmPassword = 'Passwords do not match.';
    setErrors(found);
    if (Object.keys(found).length) return;

    setSubmitting(true);
    try {
      const response = await authApi.resetPassword({ token, password: values.password });
      setSuccess(response.message);
    } catch (error) {
      setFormError(error.message);
      setErrors(error.errors || {});
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-3xl font-bold text-slate-900">Set a new password</h1>
      {success ? (
        <div className="mt-6 space-y-5">
          <Alert type="success">{success}</Alert>
          <Link to="/login" className="inline-block rounded-lg bg-green-700 px-6 py-2.5 font-semibold text-white hover:bg-green-800">
            Go to login
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-5">
          <Alert type="error">{formError || errors.token}</Alert>
          <FormField
            id="password"
            label="New password"
            type="password"
            showPasswordToggle
            autoComplete="new-password"
            required
            value={values.password}
            onChange={set('password')}
            error={errors.password}
            hint="8–72 characters."
          />
          <FormField
            id="confirmPassword"
            label="Confirm new password"
            type="password"
            showPasswordToggle
            autoComplete="new-password"
            required
            value={values.confirmPassword}
            onChange={set('confirmPassword')}
            error={errors.confirmPassword}
          />
          <button type="submit" disabled={submitting} className="w-full rounded-lg bg-green-700 px-6 py-2.5 font-semibold text-white hover:bg-green-800 disabled:opacity-60">
            {submitting ? 'Updating password…' : 'Update password'}
          </button>
        </form>
      )}
    </section>
  );
}
