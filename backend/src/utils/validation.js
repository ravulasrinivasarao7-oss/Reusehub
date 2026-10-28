// Dependency-free input validation and sanitisation.
// Every function returns cleaned values plus an `errors` object keyed by field name.

export const CATEGORIES = ['CARDBOARD', 'WOOD', 'PAPER', 'PLASTIC', 'METAL', 'FABRIC', 'GLASS', 'OTHER'];
export const CONDITIONS = ['NEW', 'LIKE_NEW', 'GOOD', 'FAIR', 'USED'];
const AVAILABILITY = ['available', 'unavailable', 'all'];

// Remove control characters (keeps tab, newline, carriage return).
const stripControl = (v) => v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
const singleLine = (v) => (typeof v === 'string' ? stripControl(v).replace(/\s+/g, ' ').trim() : '');
const multiLine = (v) => (typeof v === 'string' ? stripControl(v).replace(/\r\n?/g, '\n').trim() : '');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateRegister(body) {
  const src = body && typeof body === 'object' ? body : {};
  const errors = {};
  const name = singleLine(src.name);
  const email = singleLine(src.email).toLowerCase();
  const password = typeof src.password === 'string' ? src.password : '';

  if (name.length < 2 || name.length > 80) errors.name = 'Name must be 2–80 characters.';
  if (!EMAIL_RE.test(email) || email.length > 254) errors.email = 'Enter a valid email address.';
  // bcrypt only uses the first 72 bytes, so cap the length.
  if (password.length < 8 || Buffer.byteLength(password) > 72) errors.password = 'Password must be 8–72 characters.';
  return { data: { name, email, password }, errors };
}

export function validateLogin(body) {
  const src = body && typeof body === 'object' ? body : {};
  const errors = {};
  const email = singleLine(src.email).toLowerCase();
  const password = typeof src.password === 'string' ? src.password : '';
  if (!email) errors.email = 'Email is required.';
  if (!password) errors.password = 'Password is required.';
  return { data: { email, password }, errors };
}

function parseImageUrl(raw) {
  if (raw === undefined || raw === null) return { value: null };
  if (typeof raw !== 'string') return { error: 'Image URL must be text.' };
  const trimmed = stripControl(raw).trim();
  if (trimmed === '') return { value: null };
  if (trimmed.length > 500) return { error: 'Image URL must be at most 500 characters.' };
  let url;
  try {
    url = new URL(trimmed);
  } catch {
    return { error: 'Enter a valid image URL starting with http:// or https://.' };
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { error: 'Image URL must start with http:// or https://.' };
  }
  if (url.username || url.password) return { error: 'Image URL must not contain a username or password.' };
  return { value: url.href };
}

// Validates a full material payload (used for create and update).
// ownerId is deliberately never read from the body.
export function validateMaterialInput(body) {
  const src = body && typeof body === 'object' ? body : {};
  const errors = {};
  const data = {};

  data.title = singleLine(src.title);
  if (data.title.length < 3 || data.title.length > 120) errors.title = 'Title must be 3–120 characters.';

  data.description = multiLine(src.description);
  if (data.description.length < 10 || data.description.length > 2000) {
    errors.description = 'Description must be 10–2000 characters.';
  }

  data.category = typeof src.category === 'string' ? src.category.trim().toUpperCase() : '';
  if (!CATEGORIES.includes(data.category)) errors.category = 'Choose a valid category.';

  const rawQty = typeof src.quantity === 'string' && src.quantity.trim() !== '' ? Number(src.quantity) : src.quantity;
  if (!Number.isInteger(rawQty) || rawQty < 1 || rawQty > 1000000) {
    errors.quantity = 'Quantity must be a whole number between 1 and 1,000,000.';
  }
  data.quantity = rawQty;

  data.unit = singleLine(src.unit);
  if (data.unit.length < 1 || data.unit.length > 30) errors.unit = 'Unit must be 1–30 characters.';

  data.condition = typeof src.condition === 'string' ? src.condition.trim().toUpperCase() : '';
  if (!CONDITIONS.includes(data.condition)) errors.condition = 'Choose a valid condition.';

  data.location = singleLine(src.location);
  if (data.location.length < 2 || data.location.length > 120) errors.location = 'Location must be 2–120 characters.';

  const image = parseImageUrl(src.imageUrl);
  if (image.error) errors.imageUrl = image.error;
  else data.imageUrl = image.value;

  if (src.isAvailable !== undefined) {
    if (typeof src.isAvailable === 'boolean') data.isAvailable = src.isAvailable;
    else errors.isAvailable = 'Availability must be true or false.';
  }
  return { data, errors };
}

export function validateAvailabilityInput(body) {
  if (body && typeof body.isAvailable === 'boolean') return { data: { isAvailable: body.isAvailable }, errors: {} };
  return { data: {}, errors: { isAvailable: 'isAvailable must be true or false.' } };
}

// Parses ?search=&category=&condition=&location=&availability=&page=&limit=
export function parseListQuery(query, { defaultAvailability = 'available' } = {}) {
  const errors = {};
  const filters = {};

  const text = (key, max) => {
    const v = query[key];
    if (v === undefined || v === '') return undefined;
    if (typeof v !== 'string') {
      errors[key] = 'Must be a single value.';
      return undefined;
    }
    const cleaned = singleLine(v);
    if (cleaned.length > max) {
      errors[key] = `Must be at most ${max} characters.`;
      return undefined;
    }
    return cleaned || undefined;
  };

  filters.search = text('search', 100);
  filters.location = text('location', 100);

  const category = text('category', 30)?.toUpperCase();
  if (category) {
    if (CATEGORIES.includes(category)) filters.category = category;
    else errors.category = 'Unknown category.';
  }
  const condition = text('condition', 30)?.toUpperCase();
  if (condition) {
    if (CONDITIONS.includes(condition)) filters.condition = condition;
    else errors.condition = 'Unknown condition.';
  }

  const availability = text('availability', 20)?.toLowerCase() ?? defaultAvailability;
  if (AVAILABILITY.includes(availability)) filters.availability = availability;
  else errors.availability = 'Must be available, unavailable or all.';

  const intParam = (key, fallback, min, max) => {
    const v = query[key];
    if (v === undefined || v === '') return fallback;
    const n = typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : NaN;
    if (!Number.isInteger(n) || n < min || n > max) {
      errors[key] = `Must be a whole number between ${min} and ${max}.`;
      return fallback;
    }
    return n;
  };
  filters.page = intParam('page', 1, 1, 100000);
  filters.limit = intParam('limit', 12, 1, 50);

  return { filters, errors };
}

// Parses a numeric :id route parameter (PostgreSQL INT range).
export function parseId(value) {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return null;
  const n = Number(value);
  return n >= 1 && n <= 2147483647 ? n : null;
}
