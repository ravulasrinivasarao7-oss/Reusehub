import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import Alert from '../components/Alert.jsx';
import FormField from '../components/FormField.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = location.state?.from?.pathname || '/materials';

  const [values, setValues] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to={redirectTo} replace />;

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError('');
    const found = {};
    if (!values.email.trim()) found.email = 'Email is required.';
    if (!values.password) found.password = 'Password is required.';
    setErrors(found);
    if (Object.keys(found).length) return;

    setSubmitting(true);
    try {
      await login({ email: values.email, password: values.password });
      navigate(redirectTo, { replace: true });
    } catch (error) {
      setFormError(error.message);
      setErrors(error.errors || {});
      setSubmitting(false);
    }
  }

  return (
    <section className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-3xl font-bold text-slate-900">Log in</h1>
      <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-5">
        <Alert type="error">{formError}</Alert>
        <FormField id="email" label="Email" type="email" autoComplete="email" required value={values.email} onChange={(e) => setValues({ ...values, email: e.target.value })} error={errors.email} />
        <FormField id="password" label="Password" type="password" autoComplete="current-password" required value={values.password} onChange={(e) => setValues({ ...values, password: e.target.value })} error={errors.password} />
        <button type="submit" disabled={submitting} className="w-full rounded-lg bg-green-700 px-6 py-2.5 font-semibold text-white hover:bg-green-800 disabled:opacity-60">
          {submitting ? 'Logging in…' : 'Log in'}
        </button>
      </form>
      <p className="mt-6 text-sm text-slate-700">
        New to ReUseHub? <Link to="/register" className="font-semibold text-green-800 underline">Create an account</Link>
      </p>
    </section>
  );
}
