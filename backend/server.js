import { env } from './src/config/env.js';
import app from './src/app.js';
import { prisma } from './src/config/database.js';

const PORT = process.env.PORT || env.port;

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`ReUseHub backend listening on port ${PORT}`);
});

// Close the HTTP server and database connection cleanly.
async function shutdown(signal) {
  console.log(`${signal} received, shutting down...`);

  server.close(async () => {
    try {
      await prisma.$disconnect();
      process.exit(0);
    } catch (error) {
      console.error('Error disconnecting Prisma:', error);
      process.exit(1);
    }
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
