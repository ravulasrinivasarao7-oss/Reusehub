import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { prisma } from '../config/database.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  validateLogin,
  validatePasswordReset,
  validatePasswordResetRequest,
  validateRegister,
} from '../utils/validation.js';
import {
  assertPasswordResetEmailConfigured,
  sendPasswordResetEmail,
} from '../services/password-reset-email.service.js';
import {
  SESSION_COOKIE,
  clearSessionCookie,
  createSession,
  destroySession,
  setSessionCookie,
} from '../services/session.service.js';

const BCRYPT_ROUNDS = 12;
const PASSWORD_RESET_TTL_MS = 30 * 60 * 1000;
// Compared against when the email is unknown so login timing does not reveal which emails exist.
const dummyHash = bcrypt.hashSync('reusehub-timing-placeholder', BCRYPT_ROUNDS);
const hashResetToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
const passwordResetMessage = 'If an account exists for that email, a password reset link has been sent.';

export const register = asyncHandler(async (req, res) => {
  const { data, errors } = validateRegister(req.body);
  if (Object.keys(errors).length) throw new AppError(400, 'Please correct the highlighted fields.', errors);

  const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);
  let user;
  try {
    user = await prisma.user.create({
      data: { name: data.name, email: data.email, passwordHash },
      select: { id: true, name: true, email: true },
    });
  } catch (error) {
    if (error.code === 'P2002') {
      throw new AppError(409, 'An account with this email already exists.', { email: 'This email is already registered.' });
    }
    throw error;
  }

  setSessionCookie(res, await createSession(user.id));
  res.status(201).json({ success: true, data: { user } });
});

export const login = asyncHandler(async (req, res) => {
  const { data, errors } = validateLogin(req.body);
  if (Object.keys(errors).length) throw new AppError(400, 'Email and password are required.', errors);

  const record = await prisma.user.findUnique({ where: { email: data.email } });
  const matches = await bcrypt.compare(data.password, record ? record.passwordHash : dummyHash);
  if (!record || !matches) throw new AppError(401, 'Invalid email or password.');

  setSessionCookie(res, await createSession(record.id));
  res.json({ success: true, data: { user: { id: record.id, name: record.name, email: record.email } } });
});

export const requestPasswordReset = asyncHandler(async (req, res) => {
  const { data, errors } = validatePasswordResetRequest(req.body);
  if (Object.keys(errors).length) throw new AppError(400, 'Please enter a valid email address.', errors);
  assertPasswordResetEmailConfigured();

  const user = await prisma.user.findUnique({
    where: { email: data.email },
    select: { id: true, email: true },
  });
  if (!user) {
    res.json({ success: true, message: passwordResetMessage });
    return;
  }

  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashResetToken(token);
  await prisma.$transaction(async (tx) => {
    await tx.passwordResetToken.deleteMany({ where: { userId: user.id } });
    await tx.passwordResetToken.create({
      data: {
        tokenHash,
        userId: user.id,
        expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
      },
    });
  });

  try {
    await sendPasswordResetEmail(user.email, token);
  } catch (error) {
    await prisma.passwordResetToken.deleteMany({ where: { tokenHash } });
    throw error;
  }

  res.json({ success: true, message: passwordResetMessage });
});

export const resetPassword = asyncHandler(async (req, res) => {
  const { data, errors } = validatePasswordReset(req.body);
  if (Object.keys(errors).length) throw new AppError(400, 'Please check the reset link and password.', errors);

  const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);
  const tokenHash = hashResetToken(data.token);

  await prisma.$transaction(async (tx) => {
    const resetToken = await tx.passwordResetToken.findUnique({ where: { tokenHash } });
    const now = new Date();
    if (!resetToken || resetToken.expiresAt <= now) {
      throw new AppError(400, 'This password reset link is invalid or expired.');
    }

    const claimed = await tx.passwordResetToken.deleteMany({
      where: { id: resetToken.id, expiresAt: { gt: now } },
    });
    if (claimed.count !== 1) {
      throw new AppError(400, 'This password reset link is invalid or expired.');
    }

    await tx.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash },
    });
    await tx.passwordResetToken.deleteMany({ where: { userId: resetToken.userId } });
    await tx.session.deleteMany({ where: { userId: resetToken.userId } });
  });

  clearSessionCookie(res);
  res.json({ success: true, message: 'Password updated. Please log in with your new password.' });
});

export const logout = asyncHandler(async (req, res) => {
  await destroySession(req.cookies?.[SESSION_COOKIE]);
  clearSessionCookie(res);
  res.json({ success: true, message: 'Logged out.' });
});

export const me = (req, res) => {
  res.json({ success: true, data: { user: req.user } });
};
