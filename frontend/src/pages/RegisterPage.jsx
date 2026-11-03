import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import Alert from '../components/Alert.jsx';
import FormField from '../components/FormField.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function RegisterPage() {
  const { user, register } = useAuth();
  const navigate = useNavigate();

  const [values, setValues] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const passwordBytes = new TextEncoder().encode(values.password).length;
  const passwordLength = [...values.password].length;
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);
  const passwordErrors = [
    [passwordLength >= 8, 'Password must contain at least 8 characters.'],
    [/[A-Z]/.test(values.password), 'Password must contain at least one uppercase letter.'],
    [/[a-z]/.test(values.password), 'Password must contain at least one lowercase letter.'],
    [/[0-9]/.test(values.password), 'Password must contain at least one number.'],
    [/[^A-Za-z0-9\s]/.test(values.password), 'Password must contain at least one special character.'],
    [passwordBytes <= 72, 'Password must not exceed 72 UTF-8 bytes.'],
  ].filter(([valid]) => !valid).map(([, message]) => message);
  const passwordError = passwordErrors.length
    ? passwordErrors
    : errors.password;
  const confirmPasswordError = values.confirmPassword
    ? (values.password !== values.confirmPassword ? 'Passwords do not match.' : undefined)
    : errors.confirmPassword;

  if (user) return <Navigate to="/materials" replace />;

  const set = (field) => (event) => {
    setValues({ ...values, [field]: event.target.value });
    setErrors((previous) => {
      const { [field]: _error, ...remaining } = previous;
      return remaining;
    });
  };

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError('');
    setHasAttemptedSubmit(true);
    const found = {};
    if (values.name.trim().length < 2) found.name = 'Name must be at least 2 characters.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) found.email = 'Enter a valid email address.';
    if (passwordErrors.length) found.password = passwordErrors;
    if (!values.confirmPassword) found.confirmPassword = 'Please confirm your password.';
    else if (values.password !== values.confirmPassword) found.confirmPassword = 'Passwords do not match.';
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
        <FormField id="password" label="Password" type="password" showPasswordToggle autoComplete="new-password" required value={values.password} onChange={set('password')} error={hasAttemptedSubmit ? passwordError : undefined} />
        <FormField id="confirmPassword" label="Confirm password" type="password" showPasswordToggle autoComplete="new-password" required value={values.confirmPassword} onChange={set('confirmPassword')} error={confirmPasswordError} />
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
