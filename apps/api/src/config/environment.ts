import { z } from 'zod';

const booleanString = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true');

const schema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    DATABASE_URL: z
      .string()
      .url()
      .refine(
        (value) => /^postgres(ql)?:\/\//.test(value),
        'Must be a PostgreSQL URL',
      ),
    DATABASE_POOL_MIN: z.coerce.number().int().min(0).default(0),
    DATABASE_POOL_MAX: z.coerce.number().int().positive().default(10),
    STORAGE_ROOT: z.string().min(1).default('./storage'),
    IMAGE_MAX_UPLOAD_BYTES: z.coerce
      .number()
      .int()
      .min(1024)
      .max(50_000_000)
      .default(10_485_760),
    IMAGE_MAX_PIXELS: z.coerce
      .number()
      .int()
      .min(1_000_000)
      .max(200_000_000)
      .default(100_000_000),
    IMAGE_MAX_DIMENSION: z.coerce
      .number()
      .int()
      .min(1000)
      .max(20_000)
      .default(10_000),
    IMAGE_OPTIMIZED_MAX_WIDTH: z.coerce
      .number()
      .int()
      .min(400)
      .max(5000)
      .default(2000),
    IMAGE_THUMBNAIL_WIDTH: z.coerce
      .number()
      .int()
      .min(100)
      .max(1000)
      .default(400),
    API_PORT: z.coerce.number().int().min(1).max(65535).default(3001),
    JWT_ACCESS_SECRET: z.string().min(16),
    JWT_REFRESH_SECRET: z.string().min(16),
    JWT_ISSUER: z.string().min(1).default('dollz-api'),
    JWT_AUDIENCE: z.string().min(1).default('dollz-admin'),
    ACCESS_TOKEN_TTL_MINUTES: z.coerce
      .number()
      .int()
      .min(1)
      .max(60)
      .default(15),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(30).default(7),
    ADMIN_ACCESS_COOKIE_NAME: z
      .string()
      .regex(/^[A-Za-z0-9_-]+$/)
      .default('dollz_admin_access'),
    ADMIN_REFRESH_COOKIE_NAME: z
      .string()
      .regex(/^[A-Za-z0-9_-]+$/)
      .default('dollz_admin_refresh'),
    TURNSTILE_SECRET_KEY: z.string().min(1),
    ADMIN_LOGIN_MAX_ATTEMPTS: z.coerce.number().int().min(2).max(20).default(5),
    ADMIN_LOGIN_LOCK_MINUTES: z.coerce
      .number()
      .int()
      .min(1)
      .max(1440)
      .default(15),
    ALLOWED_ORIGINS: z
      .string()
      .min(1)
      .transform((value) =>
        value
          .split(',')
          .map((origin) => origin.trim())
          .filter(Boolean),
      ),
    TRUST_PROXY: booleanString.default(false),
  })
  .superRefine((value, context) => {
    if (value.DATABASE_POOL_MIN > value.DATABASE_POOL_MAX) {
      context.addIssue({
        code: 'custom',
        message: 'DATABASE_POOL_MIN must not exceed DATABASE_POOL_MAX',
        path: ['DATABASE_POOL_MIN'],
      });
    }
    if (value.JWT_ACCESS_SECRET === value.JWT_REFRESH_SECRET) {
      context.addIssue({
        code: 'custom',
        message: 'Access and refresh secrets must be different',
        path: ['JWT_REFRESH_SECRET'],
      });
    }
    if (value.NODE_ENV === 'production') {
      for (const key of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'] as const) {
        if (value[key].length < 32 || value[key].startsWith('replace-with-')) {
          context.addIssue({
            code: 'custom',
            message: `${key} must be a strong production secret`,
            path: [key],
          });
        }
      }
      if (value.TURNSTILE_SECRET_KEY.startsWith('replace-with-')) {
        context.addIssue({
          code: 'custom',
          message: 'TURNSTILE_SECRET_KEY is required in production',
          path: ['TURNSTILE_SECRET_KEY'],
        });
      }
    }
    for (const origin of value.ALLOWED_ORIGINS) {
      try {
        const parsed = new URL(origin);
        if (
          !['http:', 'https:'].includes(parsed.protocol) ||
          parsed.origin !== origin
        )
          throw new Error();
        if (value.NODE_ENV === 'production' && parsed.protocol !== 'https:') {
          context.addIssue({
            code: 'custom',
            message: `ALLOWED_ORIGINS must use https in production: ${origin}`,
            path: ['ALLOWED_ORIGINS'],
          });
        }
      } catch {
        context.addIssue({
          code: 'custom',
          message: `Invalid allowed origin: ${origin}`,
          path: ['ALLOWED_ORIGINS'],
        });
      }
    }
  });

export type Environment = z.infer<typeof schema>;

export function readEnvironment(
  source: NodeJS.ProcessEnv = process.env,
): Environment {
  const parsed = schema.safeParse(source);
  if (!parsed.success)
    throw new Error(
      `Invalid environment configuration:\n${z.prettifyError(parsed.error)}`,
    );
  return parsed.data;
}
