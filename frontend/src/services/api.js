// Reusable API client. Base URL comes from VITE_API_BASE_URL (see .env.example).
// Requests send the session cookie (credentials: 'include').
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api').replace(/\/+$/, '');

export function resolveMaterialImageUrl(src) {
  if (typeof src !== 'string' || !src.trim()) return '';
  try {
    const url = new URL(src, `${new URL(API_BASE_URL, window.location.origin).origin}/`);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

export class ApiError extends Error {
  constructor(message, { status = 0, errors = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors; // field -> message, from server validation
  }
}

function buildQuery(query) {
  const params = new URLSearchParams();
  Object.entries(query || {}).forEach(([key, value]) => {
    const normalized = key === 'search' && typeof value === 'string' ? value.trim() : value;
    if (normalized !== undefined && normalized !== null && normalized !== '') params.set(key, normalized);
  });
  const text = params.toString();
  return text ? `?${text}` : '';
}

async function request(path, { method = 'GET', body, query, timeoutMs = 10000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}${buildQuery(query)}`, {
      method,
      credentials: 'include',
      headers: body === undefined || isFormData ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : isFormData ? body : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch {
    throw new ApiError('Unable to reach the server. Check that the backend is running and try again.');
  } finally {
    clearTimeout(timer);
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    // Non-JSON response; handled below.
  }

  if (!response.ok || !data?.success) {
    // Tell the app that the session ended (not for the auth endpoints themselves).
    if (response.status === 401 && !path.startsWith('/auth/')) {
      window.dispatchEvent(new Event('reusehub:unauthorized'));
    }
    throw new ApiError(data?.message || `Request failed with status ${response.status}`, {
      status: response.status,
      errors: data?.errors || null,
    });
  }
  return data;
}

// --- Health (Part 1) ---
export const getBackendHealth = () => request('/health');
export const getDatabaseHealth = () => request('/health/database');

// --- Authentication ---
export const authApi = {
  register: (payload) => request('/auth/register', { method: 'POST', body: payload }),
  login: (payload) => request('/auth/login', { method: 'POST', body: payload }),
  requestPasswordReset: (payload) => request('/auth/forgot-password', { method: 'POST', body: payload }),
  resetPassword: (payload) => request('/auth/reset-password', { method: 'POST', body: payload }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: (() => {
    let pending;
    return () => {
      if (!pending) {
        pending = request('/auth/me').finally(() => {
          pending = null;
        });
      }
      return pending;
    };
  })(),
  profile: () => request('/auth/profile'),
  updateProfile: (payload) => request('/auth/profile', { method: 'PUT', body: payload }),
};

// --- Materials ---
export const materialsApi = {
  list: (query) => request('/materials', { query }),
  mine: (query) => request('/materials/mine', { query }),
  get: (id) => request(`/materials/${id}`),
  create: (payload) => request('/materials', { method: 'POST', body: payload }),
  uploadImage: (file) => {
    const formData = new FormData();
    formData.append('image', file);
    return request('/materials/images', { method: 'POST', body: formData });
  },
  update: (id, payload) => request(`/materials/${id}`, { method: 'PUT', body: payload }),
  setAvailability: (id, isAvailable) =>
    request(`/materials/${id}/availability`, { method: 'PATCH', body: { isAvailable } }),
  remove: (id) => request(`/materials/${id}`, { method: 'DELETE' }),
};

// --- Material requests ---
export const requestsApi = {
  create: (materialId, message) => request(`/requests/materials/${materialId}`, {
    method: 'POST',
    body: message === undefined ? {} : { message },
  }),
  mine: () => request('/requests/mine'),
  received: () => request('/requests/received'),
  updateStatus: (id, status) =>
    request(`/requests/${id}/status`, { method: 'PATCH', body: { status } }),
};

export const notificationsApi = {
  list: () => request('/notifications'),
  unreadCount: () => request('/notifications/unread-count'),
  markRead: (id) => request(`/notifications/${id}/read`, { method: 'PATCH' }),
  markAllRead: () => request('/notifications/read-all', { method: 'PATCH' }),
  remove: (id) => request(`/notifications/${id}`, { method: 'DELETE' }),
  subscribeUnreadCount: (onUpdate) => {
    const stream = new EventSource(`${API_BASE_URL}/notifications/stream`, { withCredentials: true });
    stream.addEventListener('unread-count', (event) => {
      const { unreadCount } = JSON.parse(event.data);
      if (Number.isInteger(unreadCount) && unreadCount >= 0) onUpdate(unreadCount);
    });
    return stream;
  },
};
