import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import Alert from '../components/Alert.jsx';
import FormField from '../components/FormField.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function RegisterPage() {
  const { user, register } = useAuth();
  const navigate = useNavigate();

  const [values, setValues] = useState({ name: '', email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/materials" replace />;

  const set = (field) => (event) => setValues({ ...values, [field]: event.target.value });

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError('');
    const found = {};
    if (values.name.trim().length < 2) found.name = 'Name must be at least 2 characters.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) found.email = 'Enter a valid email address.';
    if (values.password.length < 8) found.password = 'Password must be at least 8 characters.';
    setErrors(found);
    if (Object.keys(found).length) return;

    setSubmitting(true);
    try {
      await register({ name: values.name, email: values.email, password: values.password });
      navigate('/materials', { replace: true });
    } catch (error) {
      setFormError(error.message);
      setErrors(error.errors || {});
      setSubmitting(false);
    }
  }

  return (
    <section className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-3xl font-bold text-slate-900">Create your account</h1>
      <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-5">
        <Alert type="error">{formError}</Alert>
        <FormField id="name" label="Name" autoComplete="name" required value={values.name} onChange={set('name')} error={errors.name} />
        <FormField id="email" label="Email" type="email" autoComplete="email" required value={values.email} onChange={set('email')} error={errors.email} />
        <FormField id="password" label="Password" type="password" autoComplete="new-password" required value={values.password} onChange={set('password')} error={errors.password} hint="8–72 characters." />
        <button type="submit" disabled={submitting} className="w-full rounded-lg bg-green-700 px-6 py-2.5 font-semibold text-white hover:bg-green-800 disabled:opacity-60">
          {submitting ? 'Creating account…' : 'Register'}
        </button>
      </form>
      <p className="mt-6 text-sm text-slate-700">
        Already registered? <Link to="/login" className="font-semibold text-green-800 underline">Log in</Link>
      </p>
    </section>
  );
}
