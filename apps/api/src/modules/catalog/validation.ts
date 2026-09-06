import type { ZodType } from 'zod';
import { CatalogError } from './errors.js';

export function parseInput<T>(schema: ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  throw new CatalogError(
    'VALIDATION_ERROR',
    400,
    result.error.issues.map((issue) => ({
      field: issue.path.join('.') || 'request',
      message: issue.message,
    })),
  );
}
