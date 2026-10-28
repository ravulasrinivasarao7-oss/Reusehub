import { useState } from 'react';

// Shows the listing image, or a placeholder when there is no URL or it fails to load.
// Use key={src} on the parent usage so a changed URL resets the failed state.
export default function MaterialImage({ src, alt = '', className = '' }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div role="img" aria-label="No image available" className={`grid place-items-center bg-green-50 text-4xl text-green-700 ${className}`}>
        <span aria-hidden="true">♻</span>
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`object-cover ${className}`}
    />
  );
}
