import { useState } from 'react';

// Accessible labelled form control (input, textarea or select) with inline error text.
export default function FormField({
  id,
  label,
  error,
  hint,
  as = 'input',
  className = '',
  children,
  showPasswordToggle = false,
  ...props
}) {
  const [passwordVisible, setPasswordVisible] = useState(false);
  const hasError = Array.isArray(error) ? error.length > 0 : Boolean(error);
  const describedBy = [hint && `${id}-hint`, hasError && `${id}-error`].filter(Boolean).join(' ') || undefined;
  const canTogglePassword = showPasswordToggle && as === 'input' && props.type === 'password';
  const common = {
    id,
    ...props,
    'aria-invalid': hasError ? 'true' : undefined,
    'aria-describedby': describedBy,
    type: canTogglePassword && passwordVisible ? 'text' : props.type,
    className: `w-full rounded-lg border bg-white px-3 py-2 text-base ${canTogglePassword ? 'pr-10' : ''} ${hasError ? 'border-red-600' : 'border-slate-400'}`,
  };

  let control;
  if (as === 'textarea') control = <textarea rows={5} {...common} />;
  else if (as === 'select') control = <select {...common}>{children}</select>;
  else {
    control = (
      <div className={canTogglePassword ? 'relative' : undefined}>
        <input {...common} />
        {canTogglePassword && (
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-green-800"
            aria-label={`${passwordVisible ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
            aria-pressed={passwordVisible}
            onClick={() => setPasswordVisible((visible) => !visible)}
          >
            {passwordVisible ? (
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                <path d="m3 3 18 18" />
                <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
                <path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c5 0 9 7 9 7a15.7 15.7 0 0 1-3.1 3.8" />
                <path d="M6.6 6.6C4.3 8.1 3 12 3 12s4 7 9 7a9.7 9.7 0 0 0 3.1-.5" />
              </svg>
            ) : (
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-sm font-semibold text-slate-900">
        {label}
        {props.required && <span aria-hidden="true" className="text-red-700"> *</span>}
      </label>
      {control}
      {hint && <p id={`${id}-hint`} className="mt-1 text-xs text-slate-600">{hint}</p>}
      {Array.isArray(error) && error.length > 0 ? (
        <ul id={`${id}-error`} role="alert" className="mt-1 space-y-1 text-sm text-red-700">
          {error.map((message) => <li key={message}>{message}</li>)}
        </ul>
      ) : typeof error === 'string' && error && (
        <p id={`${id}-error`} role="alert" className="mt-1 text-sm text-red-700">{error}</p>
      )}
    </div>
  );
}
