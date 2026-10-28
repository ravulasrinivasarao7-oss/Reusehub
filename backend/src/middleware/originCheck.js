import { env } from '../config/env.js';

// Lightweight CSRF defence for cookie sessions: reject state-changing requests
// whose Origin header is present but not one of the configured frontend origins.
// (Non-browser clients such as curl send no Origin header and are unaffected.)
export function originCheck(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.get('origin');
  if (origin && !env.frontendOrigins.includes(origin)) {
    return res.status(403).json({ success: false, message: 'Cross-origin request blocked.' });
  }
  next();
}
