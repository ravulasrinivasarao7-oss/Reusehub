// Reusable API client. Base URL comes from VITE_API_BASE_URL (see .env.example).
// Requests send the session cookie (credentials: 'include').
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api').replace(/\/+$/, '');

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
    if (value !== undefined && value !== null && value !== '') params.set(key, value);
  });
  const text = params.toString();
  return text ? `?${text}` : '';
}

async function request(path, { method = 'GET', body, query, timeoutMs = 10000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}${buildQuery(query)}`, {
      method,
      credentials: 'include',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
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
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request('/auth/me'),
};

// --- Materials ---
export const materialsApi = {
  list: (query) => request('/materials', { query }),
  mine: (query) => request('/materials/mine', { query }),
  get: (id) => request(`/materials/${id}`),
  create: (payload) => request('/materials', { method: 'POST', body: payload }),
  update: (id, payload) => request(`/materials/${id}`, { method: 'PUT', body: payload }),
  setAvailability: (id, isAvailable) =>
    request(`/materials/${id}/availability`, { method: 'PATCH', body: { isAvailable } }),
  remove: (id) => request(`/materials/${id}`, { method: 'DELETE' }),
};
