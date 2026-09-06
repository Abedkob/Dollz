import Fastify from 'fastify';
import type { Pool } from '@dollz/database';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import type { Environment } from './config/environment.js';
import { AuthService } from './modules/auth/auth-service.js';
import { publicAuthError } from './modules/auth/errors.js';
import { createAuthGuards } from './modules/auth/guards.js';
import { registerAuthRoutes } from './modules/auth/routes.js';
import {
  CloudflareTurnstileVerifier,
  type TurnstileVerifier,
} from './modules/auth/turnstile.js';
import {
  catalogErrorResponse,
  CatalogError,
} from './modules/catalog/errors.js';
import { registerCatalogRoutes } from './modules/catalog/routes.js';
import { CatalogService } from './modules/catalog/service.js';
import { registerMediaRoutes } from './modules/media/routes.js';
import { MediaStorageService } from './modules/media/storage-service.js';
import { OrderError, orderErrorResponse } from './modules/orders/errors.js';
import { registerOrderRoutes } from './modules/orders/routes.js';
import { OrderService } from './modules/orders/service.js';
import {
  settingsErrorResponse,
  SettingsError,
} from './modules/settings/errors.js';
import { registerSettingsRoutes } from './modules/settings/routes.js';
import { SettingsService } from './modules/settings/service.js';

export interface AppOptions {
  pool: Pool;
  environment: Environment;
  turnstileVerifier?: TurnstileVerifier;
  logger?: boolean;
}

export function buildApp({
  pool,
  environment,
  turnstileVerifier,
  logger = true,
}: AppOptions) {
  const app = Fastify({ logger, trustProxy: environment.TRUST_PROXY });
  const turnstile =
    turnstileVerifier ??
    new CloudflareTurnstileVerifier(environment.TURNSTILE_SECRET_KEY);
  const auth = new AuthService(
    pool,
    {
      jwt: {
        accessSecret: environment.JWT_ACCESS_SECRET,
        refreshSecret: environment.JWT_REFRESH_SECRET,
        issuer: environment.JWT_ISSUER,
        audience: environment.JWT_AUDIENCE,
        accessTtlMinutes: environment.ACCESS_TOKEN_TTL_MINUTES,
        refreshTtlDays: environment.REFRESH_TOKEN_TTL_DAYS,
      },
      loginMaximumAttempts: environment.ADMIN_LOGIN_MAX_ATTEMPTS,
      loginLockMinutes: environment.ADMIN_LOGIN_LOCK_MINUTES,
    },
    turnstile,
  );

  void app.register(cookie);
  void app.register(multipart, {
    limits: {
      fileSize: environment.IMAGE_MAX_UPLOAD_BYTES,
      files: 1,
      fields: 4,
    },
  });
  void app.register(cors, {
    credentials: true,
    origin(origin, callback) {
      callback(null, !origin || environment.ALLOWED_ORIGINS.includes(origin));
    },
  });

  app.get('/health', async () => ({ status: 'ok' as const }));
  app.get('/health/database', async (_request, reply) => {
    try {
      await pool.query('SELECT 1');
      return { status: 'ok' as const };
    } catch {
      reply.code(503);
      return { status: 'unavailable' as const };
    }
  });

  void app.register(async (instance) => {
    const cookieConfiguration = {
      accessName: environment.ADMIN_ACCESS_COOKIE_NAME,
      refreshName: environment.ADMIN_REFRESH_COOKIE_NAME,
      secure: environment.NODE_ENV === 'production',
      accessMaxAgeSeconds: environment.ACCESS_TOKEN_TTL_MINUTES * 60,
      refreshMaxAgeSeconds: environment.REFRESH_TOKEN_TTL_DAYS * 86_400,
      allowedOrigins: environment.ALLOWED_ORIGINS,
    };
    const guards = createAuthGuards(auth, {
      accessCookieName: environment.ADMIN_ACCESS_COOKIE_NAME,
      allowedOrigins: environment.ALLOWED_ORIGINS,
    });
    await registerAuthRoutes(instance, auth, cookieConfiguration);
    await registerMediaRoutes(
      instance,
      new MediaStorageService(pool, environment.STORAGE_ROOT, {
        maxUploadBytes: environment.IMAGE_MAX_UPLOAD_BYTES,
        maxPixels: environment.IMAGE_MAX_PIXELS,
        maxDimension: environment.IMAGE_MAX_DIMENSION,
        optimizedMaxWidth: environment.IMAGE_OPTIMIZED_MAX_WIDTH,
        thumbnailWidth: environment.IMAGE_THUMBNAIL_WIDTH,
      }),
      guards,
      environment.IMAGE_MAX_UPLOAD_BYTES,
    );
    await registerCatalogRoutes(instance, new CatalogService(pool), guards);
    await registerSettingsRoutes(
      instance,
      new SettingsService(pool, environment),
      guards,
    );
    await registerOrderRoutes(
      instance,
      new OrderService(pool, turnstile),
      guards,
      {
        allowedOrigins: environment.ALLOWED_ORIGINS,
        secureCookies: environment.NODE_ENV === 'production',
        publicBaseUrl: environment.ALLOWED_ORIGINS[0]!,
      },
    );
  });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof CatalogError) {
      const response = catalogErrorResponse(error);
      return reply.code(response.statusCode).send(response.body);
    }
    if (error instanceof OrderError) {
      const response = orderErrorResponse(error);
      return reply.code(response.statusCode).send(response.body);
    }
    if (error instanceof SettingsError) {
      const response = settingsErrorResponse(error);
      return reply.code(response.statusCode).send(response.body);
    }
    app.log.error(error);
    const response = publicAuthError(error);
    return reply.code(response.statusCode).send(response.body);
  });

  return app;
}
