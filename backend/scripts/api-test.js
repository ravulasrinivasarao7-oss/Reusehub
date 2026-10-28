// End-to-end API test. Requires the backend running AND a migrated database.
// Usage (from backend/):  npm run test:api
// It creates two throw-away test users (emails like test-a-<timestamp>@example.com).
import bcrypt from 'bcryptjs';
import { prisma } from '../src/config/database.js';

const BASE = (process.env.API_BASE_URL || 'http://localhost:5000/api').replace(/\/+$/, '');
const PASSWORD = 'TestPassw0rd!'; // throw-away test-account password

let passed = 0;
let failed = 0;
function check(name, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`FAIL  ${name} ${detail}`);
  }
}

class Client {
  cookie = '';
  async call(method, path, body) {
    const res = await fetch(BASE + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(this.cookie && { Cookie: this.cookie }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const setCookies = res.headers.getSetCookie?.() ?? [];
    const session = setCookies.find((c) => c.startsWith('reusehub_session='));
    if (session) {
      const pair = session.split(';')[0];
      this.cookie = pair === 'reusehub_session=' ? '' : pair;
    }
    let json = null;
    try { json = await res.json(); } catch { /* non-JSON body */ }
    return { status: res.status, json, setCookies };
  }
}

const validMaterial = {
  title: 'Test cardboard boxes',
  description: 'Flattened corrugated boxes from a shipment, clean and dry.',
  category: 'CARDBOARD',
  quantity: 20,
  unit: 'pieces',
  condition: 'GOOD',
  location: 'Guntur',
  imageUrl: 'https://example.com/box.jpg',
};

async function main() {
  const stamp = Date.now();
  const a = new Client();
  const b = new Client();
  const anon = new Client();
  const invalidSession = new Client();

  let r = await anon.call('GET', '/health');
  check('health endpoint responds 200', r.status === 200 && r.json?.success === true);

  r = await anon.call('GET', '/materials');
  check('unauthenticated list is rejected (401)', r.status === 401);
  r = await anon.call('POST', '/materials', validMaterial);
  check('unauthenticated create is rejected (401)', r.status === 401);
  invalidSession.cookie = 'reusehub_session=invalid';
  r = await invalidSession.call('GET', '/auth/me');
  check('invalid session token is rejected (401)', r.status === 401);

  r = await a.call('POST', '/auth/register', { name: 'Test A', email: `test-a-${stamp}@example.com`, password: PASSWORD });
  check('register user A (201)', r.status === 201 && r.json?.data?.user?.id, JSON.stringify(r.json));
  check('session cookie is httpOnly', r.setCookies.some((c) => /httponly/i.test(c)));
  check('register response excludes password data', !('password' in (r.json?.data?.user || {})) && !('passwordHash' in (r.json?.data?.user || {})));
  const storedUser = await prisma.user.findUnique({
    where: { email: `test-a-${stamp}@example.com` },
    select: { passwordHash: true },
  });
  check(
    'registered password is stored as a bcrypt hash',
    Boolean(storedUser?.passwordHash) && storedUser.passwordHash !== PASSWORD && await bcrypt.compare(PASSWORD, storedUser.passwordHash),
  );
  const userA = r.json?.data?.user;

  r = await anon.call('POST', '/auth/register', { name: 'Dup', email: `test-a-${stamp}@example.com`, password: PASSWORD });
  check('duplicate email rejected (409)', r.status === 409);
  r = await anon.call('POST', '/auth/register', { name: 'Weak', email: `weak-${stamp}@example.com`, password: 'short' });
  check('weak password rejected (400)', r.status === 400 && r.json?.errors?.password);
  r = await anon.call('POST', '/auth/login', {});
  check('login with missing credentials rejected (400)', r.status === 400 && r.json?.errors?.email && r.json?.errors?.password);

  r = await a.call('GET', '/auth/me');
  check('GET /auth/me returns user A', r.status === 200 && r.json?.data?.user?.email === `test-a-${stamp}@example.com`);

  r = await b.call('POST', '/auth/register', { name: 'Test B', email: `test-b-${stamp}@example.com`, password: PASSWORD });
  check('register user B (201)', r.status === 201);
  const userB = r.json?.data?.user;

  r = await a.call('POST', '/materials', { ...validMaterial, title: 'x', quantity: 0 });
  check('create with invalid data rejected (400) with field errors', r.status === 400 && r.json?.errors?.title && r.json?.errors?.quantity);
  r = await a.call('POST', '/materials', { ...validMaterial, imageUrl: 'javascript:alert(1)' });
  check('javascript: image URL rejected (400)', r.status === 400 && r.json?.errors?.imageUrl);

  r = await a.call('POST', '/materials', { ...validMaterial, ownerId: userB?.id });
  check('create material (201)', r.status === 201 && r.json?.data?.id, JSON.stringify(r.json));
  check('owner comes from session, not from request body', r.json?.data?.owner?.id === userA?.id && r.json?.data?.ownerId === userA?.id);
  const id = r.json?.data?.id;

  r = await b.call('GET', '/materials?search=cardboard&category=cardboard&condition=good&location=guntur');
  check('list with search + category + condition + location filters', r.status === 200 && r.json?.data?.some((m) => m.id === id));
  r = await b.call('GET', '/materials?category=METAL');
  check('category filter excludes non-matching listing', r.status === 200 && !r.json?.data?.some((m) => m.id === id));
  r = await b.call('GET', '/materials?category=NOPE');
  check('unknown category filter rejected (400)', r.status === 400);

  r = await b.call('GET', `/materials/${id}`);
  check('get single material (200)', r.status === 200 && r.json?.data?.id === id);
  r = await b.call('GET', '/materials/abc');
  check('non-numeric id rejected (400)', r.status === 400);
  r = await b.call('GET', '/materials/2147483000');
  check('missing material returns 404', r.status === 404);

  r = await a.call('GET', '/materials/mine');
  check("user A's listings include the material", r.status === 200 && r.json?.data?.some((m) => m.id === id));
  r = await b.call('GET', '/materials/mine');
  check("user B's listings do not include it", r.status === 200 && !r.json?.data?.some((m) => m.id === id));

  r = await b.call('PUT', `/materials/${id}`, { ...validMaterial, title: 'Hijacked listing' });
  check('user B cannot update A\'s listing (403)', r.status === 403);
  r = await b.call('PATCH', `/materials/${id}/availability`, { isAvailable: false });
  check('user B cannot change A\'s availability (403)', r.status === 403);
  r = await b.call('DELETE', `/materials/${id}`);
  check('user B cannot delete A\'s listing (403)', r.status === 403);

  r = await a.call('PUT', `/materials/${id}`, { ...validMaterial, title: 'Updated cardboard boxes', quantity: 25 });
  check('owner can update listing (200)', r.status === 200 && r.json?.data?.title === 'Updated cardboard boxes' && r.json?.data?.quantity === 25);

  r = await a.call('PATCH', `/materials/${id}/availability`, { isAvailable: false });
  check('owner can mark unavailable (200)', r.status === 200 && r.json?.data?.isAvailable === false);
  r = await b.call('GET', '/materials?search=Updated cardboard');
  check('unavailable listing hidden from default list', !r.json?.data?.some((m) => m.id === id));
  r = await b.call('GET', '/materials?availability=unavailable&search=Updated cardboard');
  check('availability=unavailable filter shows it', r.json?.data?.some((m) => m.id === id));
  r = await a.call('PATCH', `/materials/${id}/availability`, { isAvailable: 'yes' });
  check('non-boolean availability rejected (400)', r.status === 400);

  r = await a.call('DELETE', `/materials/${id}`);
  check('owner can delete listing (200)', r.status === 200);
  r = await a.call('GET', `/materials/${id}`);
  check('deleted listing returns 404', r.status === 404);

  r = await a.call('POST', '/auth/logout');
  check('logout (200)', r.status === 200);
  r = await a.call('GET', '/auth/me');
  check('session is invalid after logout (401)', r.status === 401);
  r = await anon.call('POST', '/auth/login', { email: `test-a-${stamp}@example.com`, password: 'WrongPassword1' });
  check('login with wrong password rejected (401)', r.status === 401);
  r = await a.call('POST', '/auth/login', { email: `test-a-${stamp}@example.com`, password: PASSWORD });
  check('login with correct password (200)', r.status === 200);

  console.log(`\n${passed} passed, ${failed} failed`);
  await prisma.$disconnect();
  process.exit(failed ? 1 : 0);
}

main().catch(async (error) => {
  console.error('Test run aborted. Is the backend running and the database migrated?', error.message);
  await prisma.$disconnect();
  process.exit(1);
});
