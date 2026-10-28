// Error that is safe to show to API clients (status + message + optional field errors).
export class AppError extends Error {
  constructor(status, message, errors) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.errors = errors;
  }
}
