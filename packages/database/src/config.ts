import { z } from 'zod';

const poolSize = z.coerce.number().int().min(0);
const databaseUrl = z
  .string()
  .url()
  .refine(
    (value) =>
      value.startsWith('postgresql://') || value.startsWith('postgres://'),
    'Must be a PostgreSQL URL',
  );

const environmentSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    DATABASE_URL: databaseUrl.optional(),
    TEST_DATABASE_URL: databaseUrl.optional(),
    DATABASE_POOL_MIN: poolSize.default(0),
    DATABASE_POOL_MAX: poolSize.min(1).default(10),
  })
  .superRefine((env, ctx) => {
    const key = env.NODE_ENV === 'test' ? 'TEST_DATABASE_URL' : 'DATABASE_URL';
    if (!env[key])
      ctx.addIssue({
        code: 'custom',
        path: [key],
        message: `${key} is required`,
      });
    if (env.DATABASE_POOL_MIN > env.DATABASE_POOL_MAX)
      ctx.addIssue({
        code: 'custom',
        path: ['DATABASE_POOL_MIN'],
        message: 'Must not exceed DATABASE_POOL_MAX',
      });
  });

export function readDatabaseConfig(
  environment: NodeJS.ProcessEnv = process.env,
) {
  const parsed = environmentSchema.safeParse(environment);
  if (!parsed.success) {
    throw new Error(
      `Invalid database environment:\n${z.prettifyError(parsed.error)}`,
    );
  }
  const url =
    parsed.data.NODE_ENV === 'test'
      ? parsed.data.TEST_DATABASE_URL
      : parsed.data.DATABASE_URL;
  return {
    connectionString: url!,
    min: parsed.data.DATABASE_POOL_MIN,
    max: parsed.data.DATABASE_POOL_MAX,
  };
}

export function readTestDatabaseConfig(
  environment: NodeJS.ProcessEnv = process.env,
) {
  const parsed = databaseUrl.safeParse(environment.TEST_DATABASE_URL);
  if (!parsed.success)
    throw new Error(
      'TEST_DATABASE_URL is required and must be a valid PostgreSQL URL',
    );
  if (environment.DATABASE_URL && parsed.data === environment.DATABASE_URL)
    throw new Error('TEST_DATABASE_URL must not equal DATABASE_URL');
  const databaseName = new URL(parsed.data).pathname.replace(/^\//, '');
  if (!/(^|[_-])test($|[_-])/i.test(databaseName))
    throw new Error(
      'Refusing test operation: TEST_DATABASE_URL database name must contain "test"',
    );
  return { connectionString: parsed.data, min: 0, max: 10 };
}
