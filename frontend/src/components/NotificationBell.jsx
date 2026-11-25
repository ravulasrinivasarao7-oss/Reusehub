import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Alert from './Alert.jsx';
import { notificationsApi } from '../services/api.js';

function notificationPath(notification) {
  if (notification.materialId) return `/materials/${notification.materialId}`;
  return ['REQUEST_ACCEPTED', 'REQUEST_REJECTED'].includes(notification.type)
    ? '/my-requests'
    : '/received-requests';
}

export default function NotificationBell({ userId }) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [updatingId, setUpdatingId] = useState(null);
  const [updatingAll, setUpdatingAll] = useState(false);
  const panelRef = useRef(null);
  const buttonRef = useRef(null);
  const openRef = useRef(false);
  const previousCountRef = useRef(null);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await notificationsApi.list();
      setNotifications(result.data);
      setUnreadCount(result.meta.unreadCount);
      previousCountRef.current = result.meta.unreadCount;
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    notificationsApi.unreadCount()
      .then((result) => {
        if (active) {
          setUnreadCount(result.data.unreadCount);
          previousCountRef.current = result.data.unreadCount;
        }
      })
      .catch((requestError) => active && setError(requestError.message));

    const stream = notificationsApi.subscribeUnreadCount((count) => {
      const changed = previousCountRef.current !== count;
      previousCountRef.current = count;
      setUnreadCount(count);
      if (changed && openRef.current) loadNotifications();
    });
    return () => {
      active = false;
      stream.close();
    };
  }, [loadNotifications, userId]);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnOutsideClick = (event) => {
      if (!panelRef.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  async function toggleNotifications() {
    const nextOpen = !open;
    setOpen(nextOpen);
    if (nextOpen) await loadNotifications();
  }

  async function markRead(notification) {
    if (notification.isRead) return;
    setUpdatingId(notification.id);
    setError('');
    try {
      const result = await notificationsApi.markRead(notification.id);
      setNotifications((current) => current.map((item) =>
        item.id === notification.id ? result.data : item));
      setUnreadCount((current) => Math.max(0, current - 1));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setUpdatingId(null);
    }
  }

  async function markAllRead() {
    setUpdatingAll(true);
    setError('');
    try {
      await notificationsApi.markAllRead();
      setNotifications((current) => current.map((item) => ({ ...item, isRead: true })));
      setUnreadCount(0);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setUpdatingAll(false);
    }
  }

  async function deleteNotification(notification) {
    setUpdatingId(notification.id);
    setError('');
    try {
      await notificationsApi.remove(notification.id);
      setNotifications((current) => current.filter((item) => item.id !== notification.id));
      if (!notification.isRead) setUnreadCount((current) => Math.max(0, current - 1));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        ref={buttonRef}
        type="button"
        aria-label={unreadCount ? `${unreadCount} unread notifications` : 'Notifications'}
        aria-expanded={open}
        aria-controls="notification-panel"
        onClick={toggleNotifications}
        className="relative grid h-10 w-10 place-items-center rounded-lg text-slate-700 hover:bg-green-50 focus-visible:outline-green-700"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6">
          <path strokeLinecap="round" strokeLinejoin="round" d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
        </svg>
        {unreadCount > 0 && (
          <span aria-hidden="true" className="absolute -right-0.5 -top-0.5 min-w-5 rounded-full bg-red-600 px-1 text-center text-xs font-bold leading-5 text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <section
          id="notification-panel"
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 z-50 mt-2 max-h-[min(80vh,36rem)] w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-green-100 bg-white shadow-xl sm:w-96"
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h2 className="font-bold text-slate-900">Notifications</h2>
            <button
              type="button"
              onClick={markAllRead}
              disabled={updatingAll || unreadCount === 0}
              className="text-xs font-semibold text-green-800 underline disabled:text-slate-400"
            >
              {updatingAll ? 'Marking…' : 'Mark all read'}
            </button>
          </div>
          {error && <div className="px-3 pt-3"><Alert type="error">{error}</Alert></div>}
          <div className="max-h-[min(70vh,30rem)] overflow-y-auto">
            {loading ? (
              <p role="status" className="p-5 text-center text-sm text-slate-600">Loading notifications…</p>
            ) : notifications.length ? (
              <ul>
                {notifications.map((notification) => (
                  <li
                    key={notification.id}
                    className={`border-b border-slate-100 p-4 last:border-b-0 ${notification.isRead ? 'bg-white' : 'bg-green-50'}`}
                  >
                    <div className="flex items-start gap-3">
                      <Link
                        to={notificationPath(notification)}
                        onClick={() => setOpen(false)}
                        className="min-w-0 flex-1 rounded focus-visible:outline-green-700"
                      >
                        <span className="flex items-center gap-2">
                          <span className={`text-sm ${notification.isRead ? 'font-medium text-slate-800' : 'font-bold text-slate-900'}`}>
                            {notification.title}
                          </span>
                          {!notification.isRead && <span className="h-2 w-2 shrink-0 rounded-full bg-green-700" aria-label="Unread" />}
                        </span>
                        <span className="mt-1 block text-sm text-slate-700">{notification.message}</span>
                        <time className="mt-2 block text-xs text-slate-500" dateTime={notification.createdAt}>
                          {new Date(notification.createdAt).toLocaleString()}
                        </time>
                      </Link>
                      <div className="flex shrink-0 flex-col gap-2">
                        {!notification.isRead && (
                          <button
                            type="button"
                            onClick={() => markRead(notification)}
                            disabled={updatingId === notification.id}
                            aria-label={`Mark as read: ${notification.title}`}
                            className="text-xs font-semibold text-green-800 underline disabled:opacity-50"
                          >
                            Mark read
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => deleteNotification(notification)}
                          disabled={updatingId === notification.id}
                          aria-label={`Delete notification: ${notification.title}`}
                          className="text-xs font-semibold text-red-700 underline disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="p-6 text-center text-sm text-slate-600">You’re all caught up.</p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
