import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { SESSION_COOKIE, getUserBySessionToken } from '../services/session.service.js';

// Verifies the session cookie against the database and sets req.user.
// The user identity ALWAYS comes from here, never from the request body.
export const requireAuth = asyncHandler(async (req, res, next) => {
  const user = await getUserBySessionToken(req.cookies?.[SESSION_COOKIE]);
  if (!user) throw new AppError(401, 'Please log in to continue.');
  req.user = user;
  next();
});
