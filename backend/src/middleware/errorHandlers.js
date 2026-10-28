import { AppError } from '../utils/AppError.js';

export function notFoundHandler(req, res) {
  res.status(404).json({ success: false, message: 'Route not found' });
}

const DB_UNAVAILABLE_CODES = ['P1001', 'P1002', 'P1008', 'P1017'];

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
    console.error('Database unavailable:', err.name, err.code || '');
    return res.status(503).json({ success: false, message: 'The service is temporarily unavailable. Please try again.' });
  }

  // Log only the error name/code: messages can contain connection details.
  console.error('Unhandled error:', err.name, err.code || '');
  res.status(500).json({ success: false, message: 'Internal server error' });
}
