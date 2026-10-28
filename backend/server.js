import { env } from './src/config/env.js';
import app from './src/app.js';
import { prisma } from './src/config/database.js';

const server = app.listen(env.port, () => {
  console.log(`ReUseHub backend listening on http://localhost:${env.port}`);
});

// Close the HTTP server and the database pool cleanly.
async function shutdown(signal) {
  console.log(`${signal} received, shutting down...`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
