import crypto from 'node:crypto';
import { prisma } from '../config/database.js';
import { env } from '../config/env.js';

export const SESSION_COOKIE = 'reusehub_session';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
const isValidTokenShape = (token) => typeof token === 'string' && /^[0-9a-f]{64}$/.test(token);

export async function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  await prisma.session.create({
    data: { tokenHash: hashToken(token), userId, expiresAt: new Date(Date.now() + SESSION_TTL_MS) },
  });
  // Opportunistic cleanup of expired sessions.
  void prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } }).catch((error) => {
    console.error('Expired session cleanup failed:', error.name, error.code || '');
  });
  return token;
}

/** Returns { id, name, email } for a valid, unexpired session token, otherwise null. */
export async function getUserBySessionToken(token) {
  if (!isValidTokenShape(token)) return null;
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  if (!session) return null;
  if (session.expiresAt <= new Date()) {
    await prisma.session.deleteMany({ where: { id: session.id } });
    return null;
  }
  return session.user;
}

export async function destroySession(token) {
  if (!isValidTokenShape(token)) return;
  await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
}

const baseCookieOptions = () => ({ httpOnly: true, sameSite: 'lax', secure: env.isProduction, path: '/' });

export function setSessionCookie(res, token) {
  res.cookie(SESSION_COOKIE, token, { ...baseCookieOptions(), maxAge: SESSION_TTL_MS });
}

export function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE, baseCookieOptions());
}
