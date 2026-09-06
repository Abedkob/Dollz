import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import {
  closePool,
  createPool,
  readDatabaseConfig,
  safeDatabaseError,
} from '@dollz/database';
import { z } from 'zod';
import { bootstrapSuperAdmin } from './bootstrap.js';
import { AuthError } from './errors.js';

config({
  path: fileURLToPath(new URL('../../../../../.env', import.meta.url)),
  quiet: true,
});

const inputSchema = z.object({
  ADMIN_BOOTSTRAP_EMAIL: z.string().email(),
  ADMIN_BOOTSTRAP_PASSWORD: z.string().min(1),
  ADMIN_BOOTSTRAP_FULL_NAME: z.string().min(1).max(150).default('Super Admin'),
});

const input = inputSchema.safeParse(process.env);
if (!input.success) {
  console.error(
    'Set ADMIN_BOOTSTRAP_EMAIL and ADMIN_BOOTSTRAP_PASSWORD in the current shell.',
  );
  process.exitCode = 1;
} else {
  const pool = createPool(readDatabaseConfig());
  try {
    const admin = await bootstrapSuperAdmin(
      pool,
      input.data.ADMIN_BOOTSTRAP_EMAIL,
      input.data.ADMIN_BOOTSTRAP_PASSWORD,
      input.data.ADMIN_BOOTSTRAP_FULL_NAME,
    );
    console.log(`Super Admin created for ${admin.email}.`);
  } catch (error) {
    if (error instanceof AuthError) console.error(error.message);
    else if (error instanceof z.ZodError) console.error(z.prettifyError(error));
    else console.error(safeDatabaseError(error).message);
    process.exitCode = 1;
  } finally {
    await closePool(pool);
  }
}
