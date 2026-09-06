import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Pool, PoolClient } from 'pg';

const MIGRATION_LOCK_ID = 6_849_042_321;
const defaultMigrationsDirectory = fileURLToPath(
  new URL('../migrations', import.meta.url),
);

export interface Migration {
  version: number;
  name: string;
  upPath: string;
  downPath: string;
  checksum: string;
}

export interface MigrationStatus extends Migration {
  appliedAt: Date | null;
  appliedChecksum: string | null;
  state: 'pending' | 'applied' | 'modified';
}

async function ensureMigrationTable(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      checksum CHAR(64) NOT NULL,
      executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

export async function loadMigrations(
  directory = defaultMigrationsDirectory,
): Promise<Migration[]> {
  const files = await readdir(directory);
  const upFiles = files
    .filter((file) => /^\d{3}_.+\.up\.sql$/.test(file))
    .sort();
  return Promise.all(
    upFiles.map(async (file) => {
      const match = /^(\d{3})_(.+)\.up\.sql$/.exec(file);
      if (!match) throw new Error(`Invalid migration filename: ${file}`);
      const downFile = file.replace('.up.sql', '.down.sql');
      if (!files.includes(downFile))
        throw new Error(`Missing down migration: ${downFile}`);
      const sql = await readFile(path.join(directory, file), 'utf8');
      return {
        version: Number(match[1]),
        name: match[2]!,
        upPath: path.join(directory, file),
        downPath: path.join(directory, downFile),
        checksum: createHash('sha256').update(sql).digest('hex'),
      };
    }),
  );
}

async function withMigrationLock<T>(
  pool: Pool,
  action: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1::bigint)', [
      MIGRATION_LOCK_ID,
    ]);
    return await action(client);
  } finally {
    try {
      await client.query('SELECT pg_advisory_unlock($1::bigint)', [
        MIGRATION_LOCK_ID,
      ]);
    } finally {
      client.release();
    }
  }
}

export async function getMigrationStatus(
  pool: Pool,
  directory?: string,
): Promise<MigrationStatus[]> {
  return withMigrationLock(pool, async (client) => {
    await ensureMigrationTable(client);
    const migrations = await loadMigrations(directory);
    const applied = await client.query<{
      version: number;
      checksum: string;
      executed_at: Date;
    }>(
      'SELECT version, checksum, executed_at FROM schema_migrations ORDER BY version',
    );
    const byVersion = new Map(applied.rows.map((row) => [row.version, row]));
    return migrations.map((migration) => {
      const record = byVersion.get(migration.version);
      return {
        ...migration,
        appliedAt: record?.executed_at ?? null,
        appliedChecksum: record?.checksum ?? null,
        state: !record
          ? 'pending'
          : record.checksum === migration.checksum
            ? 'applied'
            : 'modified',
      };
    });
  });
}

export async function migrate(
  pool: Pool,
  directory?: string,
): Promise<number[]> {
  return withMigrationLock(pool, async (client) => {
    await ensureMigrationTable(client);
    const migrations = await loadMigrations(directory);
    const result = await client.query<{ version: number; checksum: string }>(
      'SELECT version, checksum FROM schema_migrations ORDER BY version',
    );
    const applied = new Map(
      result.rows.map((row) => [row.version, row.checksum]),
    );
    for (const migration of migrations) {
      const checksum = applied.get(migration.version);
      if (checksum && checksum !== migration.checksum) {
        throw new Error(
          `Applied migration ${migration.version} checksum has changed`,
        );
      }
    }
    const executed: number[] = [];
    for (const migration of migrations) {
      if (applied.has(migration.version)) continue;
      const sql = await readFile(migration.upPath, 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (version, name, checksum) VALUES ($1, $2, $3)',
          [migration.version, migration.name, migration.checksum],
        );
        await client.query('COMMIT');
        executed.push(migration.version);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
    return executed;
  });
}

export async function rollbackLatest(
  pool: Pool,
  directory?: string,
): Promise<number | null> {
  return withMigrationLock(pool, async (client) => {
    await ensureMigrationTable(client);
    const latest = await client.query<{ version: number; checksum: string }>(
      'SELECT version, checksum FROM schema_migrations ORDER BY version DESC LIMIT 1',
    );
    const record = latest.rows[0];
    if (!record) return null;
    const migration = (await loadMigrations(directory)).find(
      (item) => item.version === record.version,
    );
    if (!migration)
      throw new Error(`Missing files for applied migration ${record.version}`);
    if (migration.checksum !== record.checksum) {
      throw new Error(
        `Applied migration ${record.version} checksum has changed`,
      );
    }
    const sql = await readFile(migration.downPath, 'utf8');
    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query('DELETE FROM schema_migrations WHERE version = $1', [
        record.version,
      ]);
      await client.query('COMMIT');
      return record.version;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });
}
