import {
  Pool,
  type PoolConfig,
  type QueryResult,
  type QueryResultRow,
} from 'pg';

export interface DatabaseConfig {
  connectionString: string;
  min?: number;
  max?: number;
}

export function createPool(config: DatabaseConfig): Pool {
  const poolConfig: PoolConfig = {
    connectionString: config.connectionString,
    min: config.min ?? 0,
    max: config.max ?? 10,
  };
  return new Pool(poolConfig);
}

export async function query<Row extends QueryResultRow = QueryResultRow>(
  pool: Pool,
  text: string,
  values: readonly unknown[] = [],
): Promise<QueryResult<Row>> {
  return pool.query<Row>(text, [...values]);
}

export async function closePool(pool: Pool): Promise<void> {
  await pool.end();
}

export function safeDatabaseError(error: unknown): Error {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String(error.code)
      : 'UNKNOWN';
  return new Error(`Database operation failed (code: ${code})`, {
    cause: error,
  });
}
