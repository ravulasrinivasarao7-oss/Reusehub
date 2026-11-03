import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Alert from '../components/Alert.jsx';
import FormField from '../components/FormField.jsx';
import Spinner from '../components/Spinner.jsx';
import UserAvatar from '../components/UserAvatar.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { authApi } from '../services/api.js';

const EMPTY_PROFILE = { name: '', email: '', phone: '', location: '', avatarUrl: '' };

export default function ProfilePage() {
  const { updateProfile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [profile, setProfile] = useState(null);
  const [values, setValues] = useState(EMPTY_PROFILE);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(searchParams.get('edit') === '1');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    let cancelled = false;
    authApi.profile()
      .then((response) => {
        if (cancelled) return;
        const user = response.data.user;
        setProfile(user);
        setValues({
          name: user.name || '',
          email: user.email || '',
          phone: user.phone || '',
          location: user.location || '',
          avatarUrl: user.avatarUrl || '',
        });
      })
      .catch((error) => !cancelled && setFormError(error.message))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    setEditing(searchParams.get('edit') === '1');
  }, [searchParams]);

  function startEditing() {
    setErrors({});
    setFormError('');
    setSuccess('');
    setEditing(true);
    navigate('/profile?edit=1', { replace: true });
  }

  function cancelEditing() {
    setValues({
      name: profile.name || '',
      email: profile.email || '',
      phone: profile.phone || '',
      location: profile.location || '',
      avatarUrl: profile.avatarUrl || '',
    });
    setErrors({});
    setFormError('');
    setEditing(false);
    navigate('/profile', { replace: true });
  }

  const set = (field) => (event) => {
    setValues((current) => ({ ...current, [field]: event.target.value }));
    setErrors((current) => {
      const { [field]: _error, ...remaining } = current;
      return remaining;
    });
    setFormError('');
    setSuccess('');
  };

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setFormError('');
    setSuccess('');
    setErrors({});
    try {
      const user = await updateProfile(values);
      setProfile(user);
      setValues({
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || '',
        location: user.location || '',
        avatarUrl: user.avatarUrl || '',
      });
      setEditing(false);
      navigate('/profile', { replace: true });
      setSuccess('Your profile has been updated.');
    } catch (error) {
      setFormError(error.message);
      setErrors(error.errors || {});
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Spinner label="Loading your profile…" />;

  return (
    <section className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-3xl font-bold text-slate-900">Your profile</h1>
      <div className="mt-6 space-y-4">
        <Alert type="error">{formError}</Alert>
        <Alert type="success">{success}</Alert>
      </div>

      {editing ? (
        <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-5 rounded-xl border border-green-100 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex items-center gap-4">
            <UserAvatar user={{ ...profile, ...values }} className="h-16 w-16 text-lg" />
            <p className="text-sm text-slate-600">Add a public image URL or leave blank to use your initials.</p>
          </div>
          <FormField id="name" label="Full name" autoComplete="name" required maxLength={80} value={values.name} onChange={set('name')} error={errors.name} />
          <FormField id="email" label="Email address" type="email" autoComplete="email" required maxLength={254} value={values.email} onChange={set('email')} error={errors.email} />
          <FormField id="phone" label="Phone number (optional)" type="tel" autoComplete="tel" maxLength={30} value={values.phone} onChange={set('phone')} error={errors.phone} />
          <FormField id="location" label="Location (optional)" autoComplete="address-level2" maxLength={120} value={values.location} onChange={set('location')} error={errors.location} />
          <FormField id="avatarUrl" label="Profile picture URL (optional)" type="url" maxLength={500} value={values.avatarUrl} onChange={set('avatarUrl')} error={errors.avatarUrl} />
          <div className="flex flex-wrap gap-3 pt-1">
            <button type="submit" disabled={saving} className="rounded-lg bg-green-700 px-5 py-2.5 font-semibold text-white hover:bg-green-800 disabled:opacity-60">
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
            <button type="button" onClick={cancelEditing} disabled={saving} className="rounded-lg border border-slate-300 px-5 py-2.5 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
              Cancel
            </button>
          </div>
        </form>
      ) : profile ? (
        <div className="mt-6 rounded-xl border border-green-100 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-5">
            <div className="flex min-w-0 items-center gap-4">
              <UserAvatar user={profile} className="h-16 w-16 text-lg" />
              <div className="min-w-0">
                <h2 className="truncate text-xl font-semibold text-slate-900">{profile.name}</h2>
                <p className="truncate text-sm text-slate-600">{profile.email}</p>
              </div>
            </div>
            <button type="button" onClick={startEditing} className="rounded-lg border border-green-700 px-4 py-2 text-sm font-semibold text-green-800 hover:bg-green-50">
              Edit Profile
            </button>
          </div>
          <dl className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Phone number</dt>
              <dd className="mt-1 text-sm text-slate-800">{profile.phone || 'Not provided'}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Location</dt>
              <dd className="mt-1 text-sm text-slate-800">{profile.location || 'Not provided'}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Member since</dt>
              <dd className="mt-1 text-sm text-slate-800">
                {profile.createdAt ? new Date(profile.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : 'Not available'}
              </dd>
            </div>
          </dl>
        </div>
      ) : null}
    </section>
  );
}
