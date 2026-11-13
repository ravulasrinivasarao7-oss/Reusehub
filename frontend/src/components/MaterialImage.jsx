import { useState } from 'react';
import { resolveMaterialImageUrl } from '../services/api.js';

// Shows the listing image, or a placeholder when there is no URL or it fails to load.
// Use key={src} on the parent usage so a changed URL resets the failed state.
export default function MaterialImage({ src, alt = '', className = '' }) {
  const [failed, setFailed] = useState(false);
  const imageSrc = resolveMaterialImageUrl(src);
  if (!imageSrc || failed) {
    return (
      <div role="img" aria-label="No image available" className={`grid place-items-center bg-green-50 text-4xl text-green-700 ${className}`}>
        <span aria-hidden="true">♻</span>
      </div>
    );
  }
  return (
    <img
      src={imageSrc}
      alt={alt}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`object-cover ${className}`}
    />
  );
}
