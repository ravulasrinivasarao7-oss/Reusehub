import { checkDatabaseConnection } from '../config/database.js';

export function getHealth(req, res) {
  res.json({ success: true, message: 'ReUseHub backend is running' });
}

export async function getDatabaseHealth(req, res) {
  try {
    const { name, serverTime } = await checkDatabaseConnection();
    res.json({
      success: true,
      message: 'Database connection successful',
      database: { connected: true, name, serverTime },
    });
  } catch (error) {
    // Log only non-sensitive details; never return error internals to the client.
    console.error('Database health check failed:', error.name, error.code || '');
    res.status(503).json({
      success: false,
      message: 'Unable to connect to the database',
      database: { connected: false },
    });
  }
}
