import { createPool, type DatabaseConfig } from '@dollz/database';

export function createDatabase(config: DatabaseConfig) {
  return createPool(config);
}
