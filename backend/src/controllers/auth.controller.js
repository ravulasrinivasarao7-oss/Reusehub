import bcrypt from 'bcryptjs';
import { prisma } from '../config/database.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validateLogin, validateRegister } from '../utils/validation.js';
import {
  SESSION_COOKIE,
  clearSessionCookie,
  createSession,
  destroySession,
  setSessionCookie,
} from '../services/session.service.js';

const BCRYPT_ROUNDS = 12;
// Compared against when the email is unknown so login timing does not reveal which emails exist.
const dummyHash = bcrypt.hashSync('reusehub-timing-placeholder', BCRYPT_ROUNDS);

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

export const logout = asyncHandler(async (req, res) => {
  await destroySession(req.cookies?.[SESSION_COOKIE]);
  clearSessionCookie(res);
  res.json({ success: true, message: 'Logged out.' });
});

export const me = (req, res) => {
  res.json({ success: true, data: { user: req.user } });
};
