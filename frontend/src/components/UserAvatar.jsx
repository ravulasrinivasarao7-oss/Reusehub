import { useEffect, useState } from 'react';

export default function UserAvatar({ user, className = 'h-9 w-9' }) {
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => setImageFailed(false), [user?.avatarUrl]);
  const initials = (user?.name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  return user?.avatarUrl && !imageFailed ? (
    <img
      src={user.avatarUrl}
      alt=""
      onError={() => setImageFailed(true)}
      className={`${className} shrink-0 rounded-full border border-green-200 object-cover`}
    />
  ) : (
    <span
      aria-hidden="true"
      className={`${className} grid shrink-0 place-items-center rounded-full bg-green-100 font-semibold text-green-800`}
    >
      {initials}
    </span>
  );
}
