import type { Pool } from '@dollz/database';
import { withTransaction } from '@dollz/database';
import { z } from 'zod';
import { AuthError } from './errors.js';
import { assertPasswordPolicy, hashPassword } from './password.js';
import type { SafeAdmin } from './auth-service.js';

const emailSchema = z.string().trim().toLowerCase().email().max(320);

export async function bootstrapSuperAdmin(
  pool: Pool,
  emailInput: string,
  password: string,
  fullName = 'Super Admin',
): Promise<SafeAdmin> {
  const email = emailSchema.parse(emailInput);
  assertPasswordPolicy(password, email);
  const passwordHash = await hashPassword(password);
  return withTransaction(pool, async (client) => {
    await client.query('SELECT pg_advisory_xact_lock($1::bigint)', [
      7_719_001_201,
    ]);
    const existing = await client.query(
      'SELECT id FROM admin_users LIMIT 1 FOR UPDATE',
    );
    if (existing.rowCount) throw new AuthError('ADMIN_ALREADY_EXISTS', 409);
    const result = await client.query<{
      id: string;
      email: string;
      full_name: string | null;
    }>(
      `INSERT INTO admin_users (email,password_hash,full_name,role)
       VALUES ($1,$2,$3,'SUPER_ADMIN') RETURNING id,email,full_name`,
      [email, passwordHash, fullName],
    );
    const admin = result.rows[0]!;
    await client.query(
      `INSERT INTO audit_logs (admin_user_id,action,entity_type,entity_id)
       VALUES ($1,'ADMIN_BOOTSTRAPPED','ADMIN_USER',$1)`,
      [admin.id],
    );
    return {
      id: admin.id,
      email: admin.email,
      fullName: admin.full_name,
      role: 'SUPER_ADMIN',
    };
  });
}
