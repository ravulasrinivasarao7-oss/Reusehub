// End-to-end API test. It migrates the isolated test database and starts a local API server.
// Usage (from backend/):  npm run test:api
// It creates throw-away test users (emails like test-a-<timestamp>@example.com).
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { spawn, spawnSync } from 'node:child_process';
import { createServer as createHttpServer } from 'node:http';
import { createServer } from 'node:net';
import { existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const backendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: join(backendRoot, '.env.test') });

let BASE = '';
let prisma;
let apiServer;
const auxiliaryApiServers = [];
let mockCloudinaryServer;
let uploadedImageUrl = '';
let uploadedProfileImageUrl = '';
let mockCloudinaryUploadCount = 0;
let failNextCloudinaryUpload = false;
let failNextCloudinaryTransport = false;
let apiServerLogOutput = '';
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

function getTestProcessEnv(databaseUrl, port, cloudinaryPort, cloudinaryMode = 'url') {
  const childEnv = {};
  for (const key of ['PATH', 'SystemRoot', 'WINDIR', 'TEMP', 'TMP']) {
    if (process.env[key]) childEnv[key] = process.env[key];
  }

  const cloudinaryEnv = {};
  if (cloudinaryPort) {
    cloudinaryEnv.CLOUDINARY_TEST_MOCK_PORT = String(cloudinaryPort);
    if (cloudinaryMode === 'url') {
      cloudinaryEnv.CLOUDINARY_URL = 'cloudinary://test:test@mock-cloud';
    } else {
      cloudinaryEnv.CLOUDINARY_CLOUD_NAME = 'mock-cloud';
      cloudinaryEnv.CLOUDINARY_API_KEY = 'mock-api-key';
      if (cloudinaryMode === 'individual') {
        cloudinaryEnv.CLOUDINARY_API_SECRET = 'mock-api-secret';
      }
    }
  }

  return {
    ...childEnv,
    DATABASE_URL: databaseUrl,
    NODE_ENV: 'test',
    PORT: String(port),
    HOST: '127.0.0.1',
    FRONTEND_URL: 'http://127.0.0.1',
    ...cloudinaryEnv,
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

async function startMockCloudinaryServer(port) {
  const server = createHttpServer((req, res) => {
    if (req.method !== 'POST' || !req.url?.endsWith('/image/upload')) {
      res.writeHead(404);
      res.end();
      return;
    }

    const shouldFail = failNextCloudinaryUpload;
    const shouldDropConnection = failNextCloudinaryTransport;
    failNextCloudinaryUpload = false;
    failNextCloudinaryTransport = false;
    req.resume();
    req.on('end', () => {
      if (shouldDropConnection) {
        req.socket.destroy();
        return;
      }

      if (shouldFail) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { message: 'Simulated Cloudinary rejection.' } }));
        return;
      }

      mockCloudinaryUploadCount += 1;
      const publicId = `reusehub-test-${mockCloudinaryUploadCount}`;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        public_id: publicId,
        version: 1,
        format: 'png',
        resource_type: 'image',
        type: 'upload',
        secure_url: `https://res.cloudinary.com/mock-cloud/image/upload/v1/${publicId}.png`,
      }));
    });
  });

  await new Promise((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolveListen);
  });
  return server;
}

async function stopMockCloudinaryServer(server) {
  if (!server?.listening) return;
  await new Promise((resolveClose, reject) => {
    server.close((error) => error ? reject(error) : resolveClose());
  });
}

function startApiServer(databaseUrl, port, cloudinaryPort, cloudinaryMode = 'url') {
  apiServerLogOutput = '';
  const startupScript = [
    "const https = require('node:https');",
    "const http = require('node:http');",
    "const originalHttpsRequest = https.request;",
    "https.request = function(options, ...args) {",
    "  if (options?.hostname === 'api.cloudinary.com' && process.env.CLOUDINARY_TEST_MOCK_PORT) {",
    "    const forwardedOptions = { ...options, protocol: 'http:', hostname: '127.0.0.1', port: process.env.CLOUDINARY_TEST_MOCK_PORT };",
    "    delete forwardedOptions.agent;",
    "    return http.request(forwardedOptions, ...args);",
    '  }',
    "  return originalHttpsRequest.call(https, options, ...args);",
    '};',
    `import(${JSON.stringify(pathToFileURL(join(backendRoot, 'server.js')).href)}).catch((error) => {`,
    "  console.error(error);",
    '  process.exit(1);',
    '});',
  ].join('\n');
  const server = spawn(process.execPath, ['--input-type=commonjs', '-e', startupScript], {
    cwd: backendRoot,
    env: getTestProcessEnv(databaseUrl, port, cloudinaryPort, cloudinaryMode),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', (data) => {
    apiServerLogOutput += data.toString();
    process.stdout.write(`[api-server] ${data}`);
  });
  server.stderr.on('data', (data) => {
    apiServerLogOutput += data.toString();
    process.stderr.write(`[api-server] ${data}`);
  });
  return server;
}

async function waitForApiServer(server, base = BASE) {
  const healthUrl = `${base}/health`;
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
  constructor(base = BASE) {
    this.base = base;
  }

  async call(method, path, body) {
    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
    const res = await fetch(this.base + path, {
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

async function testIndividualCloudinaryConfiguration(databaseUrl, cloudinaryPort, mode, stamp) {
  const port = await getAvailableLocalPort();
  const base = `http://127.0.0.1:${port}/api`;
  const testEnv = getTestProcessEnv(databaseUrl, port, cloudinaryPort, mode);
  const server = startApiServer(databaseUrl, port, cloudinaryPort, mode);
  auxiliaryApiServers.push(server);

  try {
    check(`${mode} Cloudinary test has no CLOUDINARY_URL`,
      !Object.prototype.hasOwnProperty.call(testEnv, 'CLOUDINARY_URL'));
    await waitForApiServer(server, base);
    const client = new Client(base);
    const email = `${mode}-${stamp}@example.com`;
    let response = await client.call('POST', '/auth/register', {
      name: 'Cloudinary Config Test',
      email,
      password: PASSWORD,
    });
    check(`${mode} Cloudinary test user registers`, response.status === 201);
    response = await client.call('POST', '/auth/login', { email, password: PASSWORD });
    check(`${mode} Cloudinary test user authenticates`, response.status === 200);

    const form = new FormData();
    form.append('name', 'Cloudinary Config Test');
    form.append('email', email);
    form.append('image', new Blob([Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lfgAAAAASUVORK5CYII=',
      'base64',
    )], { type: 'image/png' }), 'avatar.png');
    response = await client.call('PUT', '/auth/profile', form);

    if (mode === 'individual') {
      check('profile image upload succeeds using only the three individual Cloudinary variables',
        response.status === 200
          && response.json?.data?.user?.avatarUrl?.startsWith('https://res.cloudinary.com/mock-cloud/image/upload/'),
        JSON.stringify(response.json));
    } else {
      check('partial individual Cloudinary configuration returns a clear 503',
        response.status === 503
          && response.json?.message?.includes('Set all three CLOUDINARY_* values.'),
        JSON.stringify(response.json));
    }
  } finally {
    await stopApiServer(server);
    const index = auxiliaryApiServers.indexOf(server);
    if (index >= 0) auxiliaryApiServers.splice(index, 1);
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
    ({ prisma } = await import('../src/config/database.js'));

    migrateTestDatabase(databaseUrl);
    const cloudinaryPort = await getAvailableLocalPort();
    mockCloudinaryServer = await startMockCloudinaryServer(cloudinaryPort);
    const port = await getAvailableLocalPort();
    BASE = `http://127.0.0.1:${port}/api`;
    apiServer = startApiServer(databaseUrl, port, cloudinaryPort, 'url');
    await waitForApiServer(apiServer);
    console.log('API test target: 127.0.0.1:5432/reusehub_api_test');
    const legacyCloudinaryEnv = getTestProcessEnv(databaseUrl, port, cloudinaryPort, 'url');
    check('legacy CLOUDINARY_URL configuration remains supported',
      Boolean(legacyCloudinaryEnv.CLOUDINARY_URL)
        && !legacyCloudinaryEnv.CLOUDINARY_CLOUD_NAME
        && !legacyCloudinaryEnv.CLOUDINARY_API_KEY
        && !legacyCloudinaryEnv.CLOUDINARY_API_SECRET);

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
  r = await anon.call('GET', '/notifications');
  check('unauthenticated notification list is rejected (401)', r.status === 401);
  r = await anon.call('GET', '/notifications/stream');
  check('unauthenticated notification stream is rejected (401)', r.status === 401);
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

  const profileNoImageForm = new FormData();
  profileNoImageForm.append('name', 'Kousalya Ravula');
  profileNoImageForm.append('email', userA.email);
  profileNoImageForm.append('phone', '');
  profileNoImageForm.append('location', '');
  r = await a.call('PUT', '/auth/profile', profileNoImageForm);
  check('profile update without an image accepts valid name and email',
    r.status === 200 && r.json?.data?.user?.name === 'Kousalya Ravula' && r.json?.data?.user?.email === userA.email,
    JSON.stringify(r.json));
  check('profile update stores empty optional phone and location as null',
    r.status === 200 && r.json?.data?.user?.phone === null && r.json?.data?.user?.location === null,
    JSON.stringify(r.json));

  r = await a.call('PUT', '/auth/profile', {
    name: 'Kousalya Ravula',
    email: 'not-an-email',
    phone: '',
    location: '',
  });
  check('profile update rejects an invalid email (400)', r.status === 400 && r.json?.errors?.email);

  const profileImageForm = new FormData();
  profileImageForm.append('name', 'Kousalya Ravula');
  profileImageForm.append('email', userA.email);
  profileImageForm.append('phone', '');
  profileImageForm.append('location', '');
  profileImageForm.append('image', new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lfgAAAAASUVORK5CYII=', 'base64')], {
    type: 'image/png',
  }), 'avatar.png');
  r = await a.call('PUT', '/auth/profile', profileImageForm);
  uploadedProfileImageUrl = r.json?.data?.user?.avatarUrl || '';
  check('authenticated profile update with an image stores the Cloudinary URL and profile fields',
    r.status === 200
      && r.json?.data?.user?.name === 'Kousalya Ravula'
      && r.json?.data?.user?.email === userA.email
      && r.json?.data?.user?.phone === null
      && r.json?.data?.user?.location === null
      && uploadedProfileImageUrl === 'https://res.cloudinary.com/mock-cloud/image/upload/v1/reusehub-test-1.png',
    JSON.stringify(r.json));
  const profileWithoutReplacementImageForm = new FormData();
  profileWithoutReplacementImageForm.append('name', 'Kousalya Ravula');
  profileWithoutReplacementImageForm.append('email', userA.email);
  profileWithoutReplacementImageForm.append('phone', '');
  profileWithoutReplacementImageForm.append('location', '');
  r = await a.call('PUT', '/auth/profile', profileWithoutReplacementImageForm);
  check('profile update without a new image preserves the existing avatar',
    r.status === 200 && r.json?.data?.user?.avatarUrl === uploadedProfileImageUrl,
    JSON.stringify(r.json));
  r = await a.call('GET', '/auth/profile');
  check('profile image is persisted on the user account', r.status === 200 && r.json?.data?.user?.avatarUrl === uploadedProfileImageUrl);
  const cloudinaryAvatarUrl = 'https://res.cloudinary.com/mock-cloud/image/upload/v1/profile-url.png';
  r = await a.call('PUT', '/auth/profile', {
    name: 'Kousalya Ravula',
    email: userA.email,
    avatarUrl: cloudinaryAvatarUrl,
  });
  check('profile validation accepts a Cloudinary HTTPS URL',
    r.status === 200 && r.json?.data?.user?.avatarUrl === cloudinaryAvatarUrl);

  const invalidProfileImageForm = new FormData();
  invalidProfileImageForm.append('name', userA.name);
  invalidProfileImageForm.append('email', userA.email);
  invalidProfileImageForm.append('image', new Blob(['not an image'], { type: 'image/png' }), 'fake.png');
  r = await a.call('PUT', '/auth/profile', invalidProfileImageForm);
  check('profile image upload verifies the file signature (400)', r.status === 400);

  const unsupportedProfileImageForm = new FormData();
  unsupportedProfileImageForm.append('name', 'Kousalya Ravula');
  unsupportedProfileImageForm.append('email', userA.email);
  unsupportedProfileImageForm.append('image', new Blob(['not an image'], { type: 'image/gif' }), 'avatar.gif');
  r = await a.call('PUT', '/auth/profile', unsupportedProfileImageForm);
  check('profile image upload rejects unsupported formats (400)', r.status === 400);

  const oversizedProfileImageForm = new FormData();
  oversizedProfileImageForm.append('name', 'Kousalya Ravula');
  oversizedProfileImageForm.append('email', userA.email);
  oversizedProfileImageForm.append('image', new Blob([Buffer.alloc(5 * 1024 * 1024 + 1)], {
    type: 'image/png',
  }), 'large.png');
  r = await a.call('PUT', '/auth/profile', oversizedProfileImageForm);
  check('profile image upload rejects files larger than 5 MB (413)', r.status === 413);

  const cloudinaryFailureForm = new FormData();
  cloudinaryFailureForm.append('name', 'Must Not Be Saved');
  cloudinaryFailureForm.append('email', userA.email);
  cloudinaryFailureForm.append('image', new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lfgAAAAASUVORK5CYII=', 'base64')], {
    type: 'image/png',
  }), 'avatar.png');
  failNextCloudinaryUpload = true;
  r = await a.call('PUT', '/auth/profile', cloudinaryFailureForm);
  check('profile update reports Cloudinary upload failure as 502', r.status === 502);
  check('Cloudinary API failure logs its message and HTTP status safely',
    apiServerLogOutput.includes('Simulated Cloudinary rejection.')
      && apiServerLogOutput.includes('cloudinaryHttpStatus: 401')
      && !apiServerLogOutput.includes('mock-api-secret')
      && !apiServerLogOutput.includes('mock-api-key'));

  const cloudinaryTransportFailureForm = new FormData();
  cloudinaryTransportFailureForm.append('name', 'Must Not Be Saved');
  cloudinaryTransportFailureForm.append('email', userA.email);
  cloudinaryTransportFailureForm.append('image', new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lfgAAAAASUVORK5CYII=', 'base64')], {
    type: 'image/png',
  }), 'avatar.png');
  failNextCloudinaryTransport = true;
  r = await a.call('PUT', '/auth/profile', cloudinaryTransportFailureForm);
  check('profile update handles a Cloudinary transport failure (502)', r.status === 502);
  check('Cloudinary transport failure logs nested error details',
    apiServerLogOutput.includes('socket hang up') && apiServerLogOutput.includes('ECONNRESET'));
  r = await a.call('GET', '/auth/profile');
  check('profile remains unchanged after Cloudinary upload failure',
    r.status === 200
      && r.json?.data?.user?.name === 'Kousalya Ravula'
      && r.json?.data?.user?.avatarUrl === cloudinaryAvatarUrl,
    JSON.stringify(r.json));

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
  check('authenticated user can upload a PNG to Cloudinary (201)',
    r.status === 201
      && uploadedImageUrl === 'https://res.cloudinary.com/mock-cloud/image/upload/v1/reusehub-test-2.png',
    JSON.stringify(r.json));
  const invalidImageForm = new FormData();
  invalidImageForm.append('image', new Blob(['not an image'], { type: 'image/png' }), 'fake.png');
  r = await a.call('POST', '/materials/images', invalidImageForm);
  check('image upload verifies the file signature (400)', r.status === 400);
  const oversizedImageForm = new FormData();
  oversizedImageForm.append('image', new Blob([Buffer.alloc(5 * 1024 * 1024 + 1)], { type: 'image/png' }), 'large.png');
  r = await a.call('POST', '/materials/images', oversizedImageForm);
  check('image upload rejects files larger than 5 MB (413)', r.status === 413);
  check('API uploads were sent only to the local Cloudinary mock', mockCloudinaryUploadCount === 2);
  await testIndividualCloudinaryConfiguration(databaseUrl, cloudinaryPort, 'individual', stamp);
  await testIndividualCloudinaryConfiguration(databaseUrl, cloudinaryPort, 'partial', stamp);

  r = await a.call('POST', '/materials', { ...validMaterial, imageUrl: uploadedImageUrl, ownerId: userB?.id });
  check('create material (201)', r.status === 201 && r.json?.data?.id, JSON.stringify(r.json));
  check('material stores its uploaded Cloudinary HTTPS URL', r.json?.data?.imageUrl === uploadedImageUrl);
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
  check('public material response includes its Cloudinary HTTPS URL', r.json?.data?.imageUrl === uploadedImageUrl);
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
  r = await a.call('GET', '/notifications');
  const firstOwnerNotification = r.json?.data?.find((notification) =>
    notification.requestId === requestId && notification.type === 'NEW_MATERIAL_REQUEST');
  check('new material request creates one owner notification',
    r.status === 200 && Boolean(firstOwnerNotification) && r.json?.data?.filter((notification) =>
      notification.requestId === requestId && notification.type === 'NEW_MATERIAL_REQUEST').length === 1);
  r = await a.call('GET', '/notifications/unread-count');
  check('owner unread count includes the new request notification',
    r.status === 200 && r.json?.data?.unreadCount === 1);
  r = await b.call('GET', '/notifications');
  check('request notifications are isolated to the recipient',
    r.status === 200 && !r.json?.data?.some((notification) => notification.id === firstOwnerNotification?.id));
  r = await b.call('PATCH', `/notifications/${firstOwnerNotification?.id}/read`);
  check('user cannot mark another user notification as read (404)', r.status === 404);
  r = await b.call('DELETE', `/notifications/${firstOwnerNotification?.id}`);
  check('user cannot delete another user notification (404)', r.status === 404);

  const notificationStream = await fetch(`${BASE}/notifications/stream`, {
    headers: { Cookie: a.cookie },
  });
  const streamReader = notificationStream.body.getReader();
  const streamDecoder = new TextDecoder();
  let streamText = '';
  while (!streamText.includes('event: unread-count')) {
    const { value, done } = await streamReader.read();
    if (done) break;
    streamText += streamDecoder.decode(value);
  }
  await streamReader.cancel();
  check('authenticated notification stream sends the unread count',
    notificationStream.status === 200 && streamText.includes('"unreadCount":1'));

  r = await c.call('POST', `/requests/materials/${id}`);
const competingRequestId = r.json?.data?.id;

check(
  'a second user can request while the material is available',
  r.status === 201 && r.json?.data?.status === 'PENDING',
  JSON.stringify(r.json)
);
r = await b.call('PATCH', `/requests/${competingRequestId}/status`, { status: 'CANCELLED' });
check('requester cannot cancel another user request (403)', r.status === 403);
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
  r = await b.call('GET', '/notifications');
  const acceptedNotification = r.json?.data?.find((notification) =>
    notification.requestId === requestId && notification.type === 'REQUEST_ACCEPTED');
  check('accepted request notifies the requester', r.status === 200 && Boolean(acceptedNotification));
  r = await c.call('GET', '/notifications');
  const unavailableNotification = r.json?.data?.find((notification) =>
    notification.requestId === competingRequestId && notification.type === 'MATERIAL_UNAVAILABLE');
  check('accepting a request notifies other pending requesters that material is unavailable',
    r.status === 200 && Boolean(unavailableNotification));

  r = await b.call('PATCH', `/notifications/${acceptedNotification?.id}/read`);
  check('recipient can mark their notification as read',
    r.status === 200 && r.json?.data?.isRead === true);
  r = await b.call('GET', '/notifications/unread-count');
  check('marking one notification read updates unread count',
    r.status === 200 && r.json?.data?.unreadCount === 0);

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
  r = await b.call('GET', '/notifications');
  check('rejected request notifies the requester',
    r.status === 200 && r.json?.data?.some((notification) =>
      notification.requestId === rejectedRequestId && notification.type === 'REQUEST_REJECTED'));
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
  r = await a.call('GET', '/notifications');
  check('cancelled request notifies the material owner',
    r.status === 200 && r.json?.data?.some((notification) =>
      notification.requestId === cancelledRequestId && notification.type === 'REQUEST_CANCELLED'));
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

  r = await a.call('POST', '/materials', { ...validMaterial, title: 'Manual unavailability notification test' });
  const manualUnavailableMaterialId = r.json?.data?.id;
  r = await c.call('POST', `/requests/materials/${manualUnavailableMaterialId}`);
  const manualUnavailableRequestId = r.json?.data?.id;
  r = await a.call('PATCH', `/materials/${manualUnavailableMaterialId}/availability`, { isAvailable: false });
  check('marking material unavailable notifies its pending requester', r.status === 200);
  r = await c.call('GET', '/notifications');
  check('manual unavailability notification references the pending request',
    r.status === 200 && r.json?.data?.some((notification) =>
      notification.requestId === manualUnavailableRequestId && notification.type === 'MATERIAL_UNAVAILABLE'));
  r = await a.call('PATCH', `/materials/${manualUnavailableMaterialId}/availability`, { isAvailable: false });
  check('repeating unavailable state does not create another notification', r.status === 200);
  r = await c.call('GET', '/notifications');
  check('manual unavailability event is not duplicated',
    r.status === 200 && r.json?.data?.filter((notification) =>
      notification.requestId === manualUnavailableRequestId && notification.type === 'MATERIAL_UNAVAILABLE').length === 1);

  r = await a.call('PATCH', '/notifications/read-all');
  check('recipient can mark all notifications as read',
    r.status === 200 && r.json?.data?.updatedCount > 0);
  r = await a.call('GET', '/notifications/unread-count');
  check('mark-all-read clears the recipient unread count',
    r.status === 200 && r.json?.data?.unreadCount === 0);
  r = await c.call('DELETE', `/notifications/${unavailableNotification?.id}`);
  check('recipient can delete their own notification', r.status === 200 && r.json?.data?.deleted === true);
  r = await c.call('GET', '/notifications');
  check('deleted notification is removed from the recipient list',
    r.status === 200 && !r.json?.data?.some((notification) => notification.id === unavailableNotification?.id));

  r = await a.call('POST', '/materials', { ...validMaterial, title: 'Concurrent acceptance test material' });
  const concurrentMaterialId = r.json?.data?.id;
  r = await b.call('POST', `/requests/materials/${concurrentMaterialId}`);
  const concurrentRequestB = r.json?.data?.id;
  r = await c.call('POST', `/requests/materials/${concurrentMaterialId}`);
  const concurrentRequestC = r.json?.data?.id;
  const concurrentAcceptResults = await Promise.all([
    a.call('PATCH', `/requests/${concurrentRequestB}/status`, { status: 'ACCEPTED' }),
    a.call('PATCH', `/requests/${concurrentRequestC}/status`, { status: 'ACCEPTED' }),
  ]);
  const acceptedResults = concurrentAcceptResults.filter((result) => result.status === 200);
  const conflictResults = concurrentAcceptResults.filter((result) => result.status === 409);
  check('concurrent acceptance permits exactly one winner',
    acceptedResults.length === 1 && conflictResults.length === 1,
    JSON.stringify(concurrentAcceptResults.map((result) => ({ status: result.status, json: result.json }))));
  const winningRequestId = acceptedResults[0]?.json?.data?.id;
  const losingRequestId = winningRequestId === concurrentRequestB ? concurrentRequestC : concurrentRequestB;
  const winningRequester = winningRequestId === concurrentRequestB ? b : c;
  const losingRequester = winningRequestId === concurrentRequestB ? c : b;
  r = await winningRequester.call('GET', '/notifications');
  check('concurrent acceptance notifies the winning requester',
    r.status === 200 && r.json?.data?.some((notification) =>
      notification.requestId === winningRequestId && notification.type === 'REQUEST_ACCEPTED'));
  r = await losingRequester.call('GET', '/notifications');
  check('concurrent acceptance notifies the other requester that the material is unavailable',
    r.status === 200 && r.json?.data?.some((notification) =>
      notification.requestId === losingRequestId && notification.type === 'MATERIAL_UNAVAILABLE'));

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
    await stopApiServer(apiServer);
    await Promise.all(auxiliaryApiServers.map((server) => stopApiServer(server)));
    await stopMockCloudinaryServer(mockCloudinaryServer);
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
