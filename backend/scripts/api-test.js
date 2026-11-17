// End-to-end API test. It migrates the isolated test database and starts a local API server.
// Usage (from backend/):  npm run test:api
// It creates throw-away test users (emails like test-a-<timestamp>@example.com).
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { existsSync } from 'node:fs';
import { unlink } from 'node:fs/promises';
import { basename, join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const backendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const testUploadDir = join(backendRoot, 'uploads', 'api-test');
dotenv.config({ path: join(backendRoot, '.env.test') });

let BASE = '';
let prisma;
let apiServer;
let uploadedImageUrl = '';
let uploadedProfileImageUrl = '';
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

function getTestDatabaseUrl() {
  const configuredUrl = process.env.API_TEST_DATABASE_URL;
  if (!configuredUrl) {
    throw new Error('API_TEST_DATABASE_URL is missing. Configure backend/.env.test; DATABASE_URL is never used by this test runner.');
  }

  let url;
  try {
    url = new URL(configuredUrl);
  } catch {
    throw new Error('API_TEST_DATABASE_URL is not a valid PostgreSQL URL.');
  }

  if (
    url.protocol !== 'postgresql:'
    || url.hostname !== '127.0.0.1'
    || url.port !== '5432'
    || url.username !== 'reusehub_test'
    || !url.password
    || url.pathname !== '/reusehub_api_test'
    || url.search !== '?schema=public'
    || url.hash
  ) {
    throw new Error('API tests are restricted to reusehub_test@127.0.0.1:5432/reusehub_api_test with a configured password and exactly schema=public.');
  }

  return url.toString();
}

function getTestProcessEnv(databaseUrl, port) {
  const childEnv = {};
  for (const key of ['PATH', 'SystemRoot', 'WINDIR', 'TEMP', 'TMP']) {
    if (process.env[key]) childEnv[key] = process.env[key];
  }

  return {
    ...childEnv,
    DATABASE_URL: databaseUrl,
    NODE_ENV: 'test',
    PORT: String(port),
    HOST: '127.0.0.1',
    FRONTEND_URL: 'http://127.0.0.1',
    MATERIAL_UPLOAD_DIR: testUploadDir,
    PRISMA_HIDE_UPDATE_MESSAGE: '1',
  };
}

async function getAvailableLocalPort() {
  const listener = createServer();
  await new Promise((resolveListen, rejectListen) => {
    listener.once('error', rejectListen);
    listener.listen(0, '127.0.0.1', resolveListen);
  });
  const { port } = listener.address();
  await new Promise((resolveClose, rejectClose) => {
    listener.close((error) => error ? rejectClose(error) : resolveClose());
  });
  return port;
}

function migrateTestDatabase(databaseUrl) {
  const prismaCli = join(backendRoot, 'node_modules', 'prisma', 'build', 'index.js');
  if (!existsSync(prismaCli)) {
    throw new Error('Prisma CLI is not installed. Run npm install in backend/ before the API tests.');
  }

  const result = spawnSync(process.execPath, [prismaCli, 'migrate', 'deploy'], {
    cwd: backendRoot,
    env: getTestProcessEnv(databaseUrl, 0),
    encoding: 'utf8',
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error || result.status !== 0) {
    throw new Error(`Could not migrate the isolated API test database${result.error ? `: ${result.error.message}` : ''}.`);
  }
}

function startApiServer(databaseUrl, port) {
  const server = spawn(process.execPath, [join(backendRoot, 'server.js')], {
    cwd: backendRoot,
    env: getTestProcessEnv(databaseUrl, port),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', (data) => process.stdout.write(`[api-server] ${data}`));
  server.stderr.on('data', (data) => process.stderr.write(`[api-server] ${data}`));
  return server;
}

async function waitForApiServer(server) {
  const healthUrl = `${BASE}/health`;
  let lastError = 'no health response';
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (server.exitCode !== null) {
      throw new Error(`Isolated API server exited before becoming ready (code ${server.exitCode}).`);
    }

    try {
      const response = await fetch(healthUrl, { signal: AbortSignal.timeout(1000) });
      if (response.ok) return;
      lastError = `health endpoint returned ${response.status}`;
    } catch (error) {
      lastError = error.message;
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 250));
  }
  throw new Error(`Isolated API server did not become ready: ${lastError}.`);
}

async function stopApiServer(server) {
  if (!server || server.exitCode !== null) return;
  const exited = new Promise((resolveExit) => server.once('exit', resolveExit));
  server.kill('SIGTERM');
  await Promise.race([exited, new Promise((resolveDelay) => setTimeout(resolveDelay, 5000))]);
  if (server.exitCode === null) {
    server.kill('SIGKILL');
    await Promise.race([exited, new Promise((resolveDelay) => setTimeout(resolveDelay, 2000))]);
  }
}

class Client {
  cookie = '';
  async call(method, path, body) {
    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
    const res = await fetch(BASE + path, {
      method,
      headers: {
        ...(!isFormData && body !== undefined && { 'Content-Type': 'application/json' }),
        ...(this.cookie && { Cookie: this.cookie }),
      },
      body: body === undefined ? undefined : isFormData ? body : JSON.stringify(body),
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
  try {
    const databaseUrl = getTestDatabaseUrl();
    process.env.DATABASE_URL = databaseUrl;
    process.env.NODE_ENV = 'test';
    process.env.MATERIAL_UPLOAD_DIR = testUploadDir;
    ({ prisma } = await import('../src/config/database.js'));

    migrateTestDatabase(databaseUrl);
    const port = await getAvailableLocalPort();
    BASE = `http://127.0.0.1:${port}/api`;
    apiServer = startApiServer(databaseUrl, port);
    await waitForApiServer(apiServer);
    console.log('API test target: 127.0.0.1:5432/reusehub_api_test');

    const stamp = Date.now();
    const a = new Client();
    const b = new Client();
    const anon = new Client();
    const publicClient = new Client();
    const invalidSession = new Client();

  let r = await publicClient.call('GET', '/health');
  check('health endpoint responds 200', r.status === 200 && r.json?.success === true);

  r = await publicClient.call('GET', '/materials');
  check('unauthenticated visitor can browse available materials (200)', r.status === 200 && Array.isArray(r.json?.data));
  r = await anon.call('POST', '/materials', validMaterial);
  check('unauthenticated create is rejected (401)', r.status === 401);
  invalidSession.cookie = 'reusehub_session=invalid';
  r = await invalidSession.call('GET', '/auth/me');
  check('invalid session token is rejected (401)', r.status === 401);

  r = await a.call('POST', '/auth/register', { name: 'Test A', email: `test-a-${stamp}@example.com`, password: PASSWORD });
  check('register user A without starting a session (201)', r.status === 201 && r.json?.data?.user?.id && !r.setCookies.some((c) => c.startsWith('reusehub_session=')), JSON.stringify(r.json));
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
  r = await a.call('GET', '/auth/me');
  check('registration alone does not authenticate the user (401)', r.status === 401);
  r = await a.call('POST', '/auth/login', { email: `test-a-${stamp}@example.com`, password: PASSWORD });
  check('user A can log in after registration (200)', r.status === 200 && r.json?.data?.user?.id === userA?.id);
  check('login session cookie is httpOnly', r.setCookies.some((c) => /httponly/i.test(c)));

  r = await anon.call('POST', '/auth/register', { name: 'Dup', email: `test-a-${stamp}@example.com`, password: PASSWORD });
  check('duplicate email rejected (409)', r.status === 409);
  r = await anon.call('POST', '/auth/register', { name: 'Weak', email: `weak-${stamp}@example.com`, password: 'short' });
  check('weak password rejected with consolidated message (400)',
    r.status === 400 && r.json?.errors?.password === 'Password must contain at least 8 characters, an uppercase letter, a lowercase letter, and a special character.');
  r = await anon.call('POST', '/auth/register', { name: 'No Number', email: `no-number-${stamp}@example.com`, password: 'StrongPass!' });
  check('registration continues to require a number in the password (400)', r.status === 400 && r.json?.errors?.password);
  r = await anon.call('POST', '/auth/login', {});
  check('login with missing credentials rejected (400)', r.status === 400 && r.json?.errors?.email && r.json?.errors?.password);
  r = await anon.call('POST', '/auth/forgot-password', { email: `missing-${stamp}@example.com` });
  check(
    'forgot password does not reveal unknown email addresses',
    r.status === 200 && r.json?.message === 'If an account exists for that email, a password reset link has been sent.',
  );
  r = await anon.call('POST', '/auth/forgot-password', {});
  check('forgot password rejects missing email (400)', r.status === 400 && r.json?.errors?.email);
  r = await anon.call('POST', '/auth/reset-password', { token: 'invalid', password: PASSWORD });
  check('password reset rejects invalid token (400)', r.status === 400 && r.json?.errors?.token);

  r = await a.call('GET', '/auth/me');
  check('GET /auth/me returns logged-in user A', r.status === 200 && r.json?.data?.user?.email === `test-a-${stamp}@example.com`);
  r = await anon.call('PUT', '/auth/profile');
  check('unauthenticated profile update is rejected (401)', r.status === 401);

  const profileImageForm = new FormData();
  profileImageForm.append('name', userA.name);
  profileImageForm.append('email', userA.email);
  profileImageForm.append('phone', '');
  profileImageForm.append('location', '');
  profileImageForm.append('image', new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lfgAAAAASUVORK5CYII=', 'base64')], {
    type: 'image/png',
  }), 'avatar.png');
  r = await a.call('PUT', '/auth/profile', profileImageForm);
  uploadedProfileImageUrl = r.json?.data?.user?.avatarUrl || '';
  check('authenticated profile update stores a profile image',
    r.status === 200 && /^\/uploads\/[a-z0-9-]+\.png$/i.test(uploadedProfileImageUrl), JSON.stringify(r.json));
  r = await a.call('GET', '/auth/profile');
  check('profile image is persisted on the user account', r.status === 200 && r.json?.data?.user?.avatarUrl === uploadedProfileImageUrl);

  const invalidProfileImageForm = new FormData();
  invalidProfileImageForm.append('name', userA.name);
  invalidProfileImageForm.append('email', userA.email);
  invalidProfileImageForm.append('image', new Blob(['not an image'], { type: 'image/png' }), 'fake.png');
  r = await a.call('PUT', '/auth/profile', invalidProfileImageForm);
  check('profile image upload verifies the file signature (400)', r.status === 400);

  r = await b.call('POST', '/auth/register', { name: 'Test B', email: `test-b-${stamp}@example.com`, password: PASSWORD });
  check('register user B (201)', r.status === 201);
  const userB = r.json?.data?.user;
  r = await b.call('POST', '/auth/login', { email: `test-b-${stamp}@example.com`, password: PASSWORD });
  check('user B can log in after registration (200)', r.status === 200 && r.json?.data?.user?.id === userB?.id);
  r = await anon.call('POST', '/auth/register', { name: 'Test C', email: `test-c-${stamp}@example.com`, password: PASSWORD });
  check('register user C (201)', r.status === 201);
  const c = new Client();
  r = await c.call('POST', '/auth/login', { email: `test-c-${stamp}@example.com`, password: PASSWORD });
  check('login user C (200)', r.status === 200);

  r = await a.call('POST', '/materials', { ...validMaterial, title: 'x', quantity: 0 });
  check('create with invalid data rejected (400) with field errors', r.status === 400 && r.json?.errors?.title && r.json?.errors?.quantity);
  r = await a.call('POST', '/materials', { ...validMaterial, imageUrl: 'javascript:alert(1)' });
  check('javascript: image URL rejected (400)', r.status === 400 && r.json?.errors?.imageUrl);

  r = await anon.call('POST', '/materials/images');
  check('unauthenticated image upload is rejected (401)', r.status === 401);
  const imageForm = new FormData();
  imageForm.append('image', new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lfgAAAAASUVORK5CYII=', 'base64')], {
    type: 'image/png',
  }), 'pixel.png');
  r = await a.call('POST', '/materials/images', imageForm);
  uploadedImageUrl = r.json?.data?.imageUrl || '';
  check('authenticated user can upload a PNG to persistent storage (201)',
    r.status === 201 && /^\/uploads\/[a-z0-9-]+\.png$/i.test(uploadedImageUrl), JSON.stringify(r.json));
  if (uploadedImageUrl) {
    const imageResponse = await fetch(new URL(uploadedImageUrl, BASE));
    check('uploaded image is publicly retrievable from its returned URL',
      imageResponse.status === 200 && imageResponse.headers.get('content-type')?.startsWith('image/png'));
  }
  const invalidImageForm = new FormData();
  invalidImageForm.append('image', new Blob(['not an image'], { type: 'image/png' }), 'fake.png');
  r = await a.call('POST', '/materials/images', invalidImageForm);
  check('image upload verifies the file signature (400)', r.status === 400);
  const oversizedImageForm = new FormData();
  oversizedImageForm.append('image', new Blob([Buffer.alloc(5 * 1024 * 1024 + 1)], { type: 'image/png' }), 'large.png');
  r = await a.call('POST', '/materials/images', oversizedImageForm);
  check('image upload rejects files larger than 5 MB (413)', r.status === 413);

  r = await a.call('POST', '/materials', { ...validMaterial, imageUrl: uploadedImageUrl, ownerId: userB?.id });
  check('create material (201)', r.status === 201 && r.json?.data?.id, JSON.stringify(r.json));
  check('material stores its uploaded image path', r.json?.data?.imageUrl === uploadedImageUrl);
  check('owner comes from session, not from request body', r.json?.data?.owner?.id === userA?.id && r.json?.data?.ownerId === userA?.id);
  const id = r.json?.data?.id;
  r = await a.call('POST', '/materials', {
    ...validMaterial,
    title: 'Wood planks',
    description: 'Clean boards with different sizes.',
    category: 'WOOD',
  });
  check('create wood search regression material (201)', r.status === 201 && r.json?.data?.id);
  const woodId = r.json?.data?.id;
  r = await anon.call('PUT', `/materials/${id}`, validMaterial);
  check('unauthenticated edit is rejected (401)', r.status === 401);
  r = await anon.call('PATCH', `/materials/${id}/availability`, { isAvailable: false });
  check('unauthenticated availability change is rejected (401)', r.status === 401);
  r = await anon.call('DELETE', `/materials/${id}`);
  check('unauthenticated delete is rejected (401)', r.status === 401);
  r = await publicClient.call('GET', `/materials?search=cardboard&category=CARDBOARD`);
  check('signed-out visitor can search and filter materials', r.status === 200 && r.json?.data?.some((m) => m.id === id));
  check('public listing omits owner identifiers', !('ownerId' in (r.json?.data?.find((m) => m.id === id) || {})) && !('id' in (r.json?.data?.find((m) => m.id === id)?.owner || {})));
  r = await b.call('GET', '/materials?search=wood');
  check('search finds a matching material title', r.status === 200 && r.json?.data?.some((m) => m.id === woodId));
  r = await b.call('GET', '/materials?search=wo');
  check('search supports partial title matches', r.status === 200 && r.json?.data?.some((m) => m.id === woodId));
  r = await b.call('GET', '/materials?search=w');
  check('single-letter search finds a matching title', r.status === 200 && r.json?.data?.some((m) => m.id === woodId));
  r = await b.call('GET', '/materials?search=WOOD');
  check('search is case-insensitive', r.status === 200 && r.json?.data?.some((m) => m.id === woodId));
  r = await b.call('GET', '/materials?search=%20%20wood%20%20');
  check('search trims leading and trailing spaces', r.status === 200 && r.json?.data?.some((m) => m.id === woodId));
  r = await b.call('GET', '/materials?search=z');
  check('single-letter search does not match incidental description text', r.status === 200 && !r.json?.data?.some((m) => m.id === woodId));
  r = await b.call('GET', '/materials?search=xyz123');
  check('non-matching search returns an empty result', r.status === 200 && r.json?.data?.length === 0);
  r = await b.call('GET', '/materials?search=wood&category=WOOD&availability=available');
  check('search combines with category and availability filters', r.status === 200 && r.json?.data?.some((m) => m.id === woodId));
  r = await b.call('GET', '/materials?category=WOOD&availability=available');
  check('empty search preserves the selected category and availability filters', r.status === 200 && r.json?.data?.some((m) => m.id === woodId));
  r = await publicClient.call('GET', `/materials/${id}`);
  check('signed-out visitor can view an available material', r.status === 200 && r.json?.data?.id === id && !('ownerId' in r.json.data));
  check('public material response includes its uploaded image path', r.json?.data?.imageUrl === uploadedImageUrl);
  // Test multiple material filters BEFORE accepting the request
  r = await b.call(
    'GET',
    '/materials?search=cardboard&category=cardboard&condition=good&location=guntur'
  );

  check(
    'list with search + category + condition + location filters',
    r.status === 200 && r.json?.data?.some((m) => m.id === id)
  );
 const noSession = new Client();

r = await noSession.call('POST', `/requests/materials/${id}`);

check(
  'unauthenticated material request is rejected (401)',
  r.status === 401,
  JSON.stringify(r.json)
);
  r = await a.call('POST', `/requests/materials/${id}`);
  check('owner cannot request their own material (403)', r.status === 403);
  r = await b.call('POST', `/requests/materials/${id}`, { message: 'I can reuse these boxes for community donations.' });
  const requestId = r.json?.data?.id;
  check('request material with an optional message (201, Pending)', r.status === 201 && r.json?.data?.status === 'PENDING' && r.json?.data?.message === 'I can reuse these boxes for community donations.');
  r = await b.call('POST', `/requests/materials/${id}`, { message: 'x'.repeat(501) });
  check('request message over 500 characters is rejected (400)', r.status === 400 && r.json?.errors?.message);
  r = await b.call('POST', `/requests/materials/${id}`);
  check('duplicate request is rejected (409)', r.status === 409);
  r = await c.call('POST', `/requests/materials/${id}`);
const competingRequestId = r.json?.data?.id;

check(
  'a second user can request while the material is available',
  r.status === 201 && r.json?.data?.status === 'PENDING',
  JSON.stringify(r.json)
);
  r = await b.call('GET', '/requests/mine');
  check('My Requests returns the requester’s material and Pending status',
    r.status === 200 && r.json?.data?.some((request) => request.id === requestId && request.material.id === id && request.status === 'PENDING'));
  r = await a.call('GET', '/requests/received');
  check('owner sees request message in received requests',
    r.status === 200 && r.json?.data?.some((request) => request.id === requestId && request.requester.id === userB?.id && request.message === 'I can reuse these boxes for community donations.'));
  r = await b.call('PATCH', `/requests/${requestId}/status`, { status: 'ACCEPTED' });
  check('requester cannot accept their own request (403)', r.status === 403);
  r = await a.call('PATCH', `/requests/${requestId}/status`, { status: 'ACCEPTED' });
  check('owner can accept a pending request and material becomes unavailable',
    r.status === 200 && r.json?.data?.status === 'ACCEPTED' && r.json?.data?.material?.isAvailable === false);
  r = await b.call('GET', '/requests/mine');
  check('requester sees Accepted status after owner accepts',
    r.status === 200 && r.json?.data?.some((request) => request.id === requestId && request.status === 'ACCEPTED' && request.material.isAvailable === false));
  r = await c.call('GET', '/requests/mine');
  check('competing request remains pending after another request is accepted',
    r.status === 200 && r.json?.data?.some((request) => request.id === competingRequestId && request.status === 'PENDING'));
  r = await a.call('PATCH', `/requests/${competingRequestId}/status`, { status: 'ACCEPTED' });
  check('owner cannot accept a second request for the same material (409)', r.status === 409);
  r = await c.call('POST', `/requests/materials/${id}`);
  check('unavailable material cannot be requested (409)', r.status === 409);
  for (const term of ['<', '>', '&', '"']) {
    const query = new URLSearchParams({ search: term });
    r = await b.call('GET', `/materials?${query}`);
    check(`search handles special character ${JSON.stringify(term)}`, r.status === 200 && !r.json?.data?.some((m) => m.id === woodId));
  }
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
  r = await publicClient.call('GET', '/materials?availability=unavailable&search=Updated cardboard');
  check('signed-out visitors cannot browse unavailable listings', r.status === 200 && !r.json?.data?.some((m) => m.id === id));
  r = await publicClient.call('GET', `/materials/${id}`);
  check('signed-out visitors cannot view unavailable listing details (404)', r.status === 404);
  r = await a.call('PATCH', `/materials/${woodId}/availability`, { isAvailable: false });
  check('wood search regression listing can be marked unavailable', r.status === 200);
  r = await b.call('GET', '/materials?search=wood&category=WOOD&availability=available');
  check('available filter excludes unavailable search matches', r.status === 200 && !r.json?.data?.some((m) => m.id === woodId));
  r = await b.call('GET', '/materials?search=wood&category=WOOD&availability=unavailable');
  check('unavailable filter includes matching search results', r.status === 200 && r.json?.data?.some((m) => m.id === woodId));
  r = await a.call('PATCH', `/materials/${id}/availability`, { isAvailable: 'yes' });
  check('non-boolean availability rejected (400)', r.status === 400);

  r = await a.call('POST', '/materials', { ...validMaterial, title: 'Request rejection test material' });
  const rejectMaterialId = r.json?.data?.id;
  r = await b.call('POST', `/requests/materials/${rejectMaterialId}`);
  const rejectedRequestId = r.json?.data?.id;
  r = await a.call('PATCH', `/requests/${rejectedRequestId}/status`, { status: 'REJECTED' });
  check('owner can reject a pending request', r.status === 200 && r.json?.data?.status === 'REJECTED');
  r = await b.call('POST', `/requests/materials/${rejectMaterialId}`);
  const afterRejectedRequestId = r.json?.data?.id;
  check('requester can request again after rejection', r.status === 201 && r.json?.data?.status === 'PENDING');
  r = await b.call('POST', `/requests/materials/${rejectMaterialId}`);
  check('second active request after rejection is prevented', r.status === 409);

  r = await a.call('POST', '/materials', { ...validMaterial, title: 'Request cancellation test material' });
  const cancelMaterialId = r.json?.data?.id;
  r = await b.call('POST', `/requests/materials/${cancelMaterialId}`);
  const cancelledRequestId = r.json?.data?.id;
  check('request without a message is accepted and stored as null', r.status === 201 && r.json?.data?.message === null);
  r = await b.call('PATCH', `/requests/${cancelledRequestId}/status`, { status: 'CANCELLED' });
  check('requester can cancel their own pending request', r.status === 200 && r.json?.data?.status === 'CANCELLED');
  r = await b.call('POST', `/requests/materials/${cancelMaterialId}`);
  const reRequestedId = r.json?.data?.id;
  check('requester can request again after cancellation', r.status === 201 && r.json?.data?.status === 'PENDING');
  r = await b.call('POST', `/requests/materials/${cancelMaterialId}`);
  check('duplicate active request after cancellation is prevented', r.status === 409);
  r = await b.call('GET', '/requests/mine');
  check('cancelled and replacement requests remain in history',
    r.status === 200
      && r.json?.data?.some((request) => request.id === cancelledRequestId && request.status === 'CANCELLED')
      && r.json?.data?.some((request) => request.id === reRequestedId && request.status === 'PENDING'));

  r = await a.call('DELETE', `/materials/${id}`);
  check('owner can delete listing (200)', r.status === 200);
  r = await a.call('DELETE', `/materials/${woodId}`);
  check('owner can delete wood search regression listing (200)', r.status === 200);
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
    return failed ? 1 : 0;
  } finally {
    for (const imageUrl of [uploadedImageUrl, uploadedProfileImageUrl]) {
      if (imageUrl) {
        await unlink(join(testUploadDir, basename(imageUrl))).catch((error) => {
          if (error.code !== 'ENOENT') throw error;
        });
      }
    }
    await stopApiServer(apiServer);
    if (prisma) await prisma.$disconnect();
  }
}

main().then((exitCode) => {
  process.exitCode = exitCode;
}).catch((error) => {
  console.error(`Test run aborted: ${error.message}`);
  console.error(`${passed} passed, ${failed} failed (incomplete run)`);
  process.exitCode = 1;
});
