import './env.js'; // ensures DATABASE_URL is loaded and validated first
import { PrismaClient } from '@prisma/client';

// Single shared Prisma client for the whole application.
export const prisma = new PrismaClient();

/**
 * Runs a real query against PostgreSQL through Prisma.
 * Throws if the database cannot be reached.
 */
export async function checkDatabaseConnection() {
  const rows = await prisma.$queryRaw`
    SELECT current_database() AS "name", NOW() AS "serverTime"
  `;
  const { name, serverTime } = rows[0];
  return { name, serverTime: new Date(serverTime).toISOString() };
}
