// Loads and validates environment variables. Import this file before anything
// that reads process.env (e.g. the Prisma client).
import dotenv from 'dotenv';

dotenv.config();

const errors = [];

const port = Number(process.env.PORT || 5000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  errors.push('PORT must be an integer between 1 and 65535.');
}

const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  errors.push('DATABASE_URL is missing. Copy backend/.env.example to backend/.env and set it.');
} else if (!/^postgres(ql)?:\/\//.test(databaseUrl)) {
  errors.push('DATABASE_URL must start with postgresql:// or postgres://.');
} else if (databaseUrl.includes('YOUR_DB_USER') || databaseUrl.includes('YOUR_DB_PASSWORD')) {
  errors.push('DATABASE_URL still contains placeholder values. Edit backend/.env.');
}

if (errors.length > 0) {
  // Print only the problems, never the values themselves.
  console.error('Invalid environment configuration:');
  errors.forEach((message) => console.error(`  - ${message}`));
  process.exit(1);
}

export const env = {
  port,
  // Comma-separated list allowed, e.g. "http://localhost:5173,http://127.0.0.1:5173"
  frontendOrigins: frontendUrl.split(',').map((origin) => origin.trim()).filter(Boolean),
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
};
