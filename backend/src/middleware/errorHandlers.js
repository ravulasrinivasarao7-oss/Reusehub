import { AppError } from '../utils/AppError.js';

export function notFoundHandler(req, res) {
  res.status(404).json({ success: false, message: 'Route not found' });
}

const DB_UNAVAILABLE_CODES = ['P1001', 'P1002', 'P1008', 'P1017'];

function getSafeErrorDetails(err) {
  const errorName = typeof err?.name === 'string' && /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/.test(err.name)
    ? err.name
    : 'Error';
  const errorCode = typeof err?.code === 'string' && /^[A-Za-z0-9_.-]{1,40}$/.test(err.code)
    ? err.code
    : undefined;
  const httpStatus = [err?.http_code, err?.statusCode]
    .find((value) => Number.isInteger(value) && value >= 100 && value <= 599);
  return {
    errorName,
    ...(errorCode && { errorCode }),
    ...(httpStatus && { httpStatus }),
  };
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  if (err instanceof AppError) {
    return res.status(err.status).json({
      success: false,
      message: err.message,
      ...(err.errors && { errors: err.errors }),
    });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, message: 'Request body is not valid JSON.' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ success: false, message: 'Request body is too large.' });
  }
  if (err.code === 'P2025') {
    return res.status(404).json({ success: false, message: 'Record not found.' });
  }
  if (err.name === 'PrismaClientInitializationError' || DB_UNAVAILABLE_CODES.includes(err.code)) {
    console.error('Database unavailable:', {
      ...getSafeErrorDetails(err),
      method: req.method,
      route: typeof req.route?.path === 'string' ? req.route.path : 'unmatched',
    });
    return res.status(503).json({ success: false, message: 'The service is temporarily unavailable. Please try again.' });
  }

  console.error('Unhandled error:', {
    ...getSafeErrorDetails(err),
    method: req.method,
    route: typeof req.route?.path === 'string' ? req.route.path : 'unmatched',
  });
  res.status(500).json({ success: false, message: 'Internal server error' });
}
