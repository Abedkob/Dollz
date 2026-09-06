import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { closePool } from '@dollz/database';
import { buildApp } from './app.js';
import { readEnvironment } from './config/environment.js';
import { createDatabase } from './plugins/database.js';

config({
  path: fileURLToPath(new URL('../../../.env', import.meta.url)),
  quiet: true,
});

const environment = readEnvironment();
const pool = createDatabase({
  connectionString: environment.DATABASE_URL,
  min: environment.DATABASE_POOL_MIN,
  max: environment.DATABASE_POOL_MAX,
});
const app = buildApp({ pool, environment });
let shuttingDown = false;

async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  app.log.info({ signal }, 'Shutting down');
  await app.close();
  await closePool(pool);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

try {
  await app.listen({ port: environment.API_PORT, host: '0.0.0.0' });
} catch (error) {
  app.log.error(error);
  await closePool(pool);
  process.exitCode = 1;
}
