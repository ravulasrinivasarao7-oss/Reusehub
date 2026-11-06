import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import Alert from '../components/Alert.jsx';
import FormField from '../components/FormField.jsx';
import Spinner from '../components/Spinner.jsx';
import { authApi } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function ForgotPasswordPage() {
  const { user, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (loading) return <Spinner label="Checking your session…" />;
  if (user) return <Navigate to="/materials" replace />;

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setMessage('');
    setFieldError('');

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setFieldError('Enter a valid email address.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await authApi.requestPasswordReset({ email });
      setMessage(response.message);
    } catch (requestError) {
      setError(requestError.message);
      setFieldError(requestError.errors?.email || '');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-3xl font-bold text-slate-900">Forgot your password?</h1>
      <p className="mt-3 text-sm text-slate-700">Enter your account email and we’ll send a password reset link if an account exists.</p>
      <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-5">
        <Alert type="error">{error}</Alert>
        <Alert type="success">{message}</Alert>
        <FormField
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={fieldError}
        />
        <button type="submit" disabled={submitting} className="w-full rounded-lg bg-green-700 px-6 py-2.5 font-semibold text-white hover:bg-green-800 disabled:opacity-60">
          {submitting ? 'Sending link…' : 'Send reset link'}
        </button>
      </form>
      <p className="mt-6 text-sm text-slate-700">
        Remembered your password? <Link to="/login" className="font-semibold text-green-800 underline">Log in</Link>
      </p>
    </section>
  );
}
