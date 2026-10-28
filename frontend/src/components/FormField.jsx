// Accessible labelled form control (input, textarea or select) with inline error text.
export default function FormField({ id, label, error, hint, as = 'input', className = '', children, ...props }) {
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined;
  const common = {
    id,
    'aria-invalid': error ? 'true' : undefined,
    'aria-describedby': describedBy,
    className: `w-full rounded-lg border bg-white px-3 py-2 text-base ${error ? 'border-red-600' : 'border-slate-400'}`,
    ...props,
  };

  let control;
  if (as === 'textarea') control = <textarea rows={5} {...common} />;
  else if (as === 'select') control = <select {...common}>{children}</select>;
  else control = <input {...common} />;

  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-sm font-semibold text-slate-900">
        {label}
        {props.required && <span aria-hidden="true" className="text-red-700"> *</span>}
      </label>
      {control}
      {hint && <p id={`${id}-hint`} className="mt-1 text-xs text-slate-600">{hint}</p>}
      {error && <p id={`${id}-error`} className="mt-1 text-sm text-red-700">{error}</p>}
    </div>
  );
}
