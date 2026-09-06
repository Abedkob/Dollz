import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { closePool, createPool, safeDatabaseError } from './client.js';
import { readDatabaseConfig, readTestDatabaseConfig } from './config.js';
import {
  getMigrationStatus,
  migrate,
  rollbackLatest,
} from './migration-runner.js';

config({
  path: fileURLToPath(new URL('../../../.env', import.meta.url)),
  quiet: true,
});

const command = process.argv[2];
const testOnly = command === 'reset-test';
const pool = createPool(
  testOnly ? readTestDatabaseConfig() : readDatabaseConfig(),
);

try {
  if (command === 'migrate')
    console.log('Applied migrations:', await migrate(pool));
  else if (command === 'rollback')
    console.log('Rolled back migration:', await rollbackLatest(pool));
  else if (command === 'status') {
    for (const item of await getMigrationStatus(pool))
      console.log(
        `${String(item.version).padStart(3, '0')} ${item.name}: ${item.state}`,
      );
  } else if (command === 'reset-test') {
    await pool.query(
      `DO $$ DECLARE r RECORD; BEGIN FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE'; END LOOP; FOR r IN (SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'public') LOOP EXECUTE 'DROP FUNCTION IF EXISTS public.' || quote_ident(r.routine_name) || ' CASCADE'; END LOOP; END $$`,
    );
    console.log('Test database reset complete.');
  } else throw new Error('Usage: cli.ts migrate|rollback|status|reset-test');
} catch (error) {
  console.error(safeDatabaseError(error).message);
  process.exitCode = 1;
} finally {
  await closePool(pool);
}
