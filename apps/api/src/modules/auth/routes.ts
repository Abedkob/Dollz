import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AuthService } from './auth-service.js';
import {
  clearAuthCookies,
  setAuthCookies,
  type AuthCookieConfiguration,
} from './cookies.js';
import { AuthError } from './errors.js';
import { createAuthGuards } from './guards.js';
import { verifyAllowedOrigin } from './security.js';

const loginSchema = z.object({
  email: z.string(),
  password: z.string().max(128),
  turnstileToken: z.string().min(1),
});
const passwordSchema = z.object({
  currentPassword: z.string().max(128),
  newPassword: z.string().max(128),
});

export interface AuthRoutesConfiguration extends AuthCookieConfiguration {
  allowedOrigins: readonly string[];
}

export async function registerAuthRoutes(
  app: FastifyInstance,
  auth: AuthService,
  config: AuthRoutesConfiguration,
) {
  const guards = createAuthGuards(auth, {
    accessCookieName: config.accessName,
    allowedOrigins: config.allowedOrigins,
  });

  app.post('/admin/auth/login', async (request, reply) => {
    verifyAllowedOrigin(
      request.headers.origin,
      request.headers.referer,
      config.allowedOrigins,
    );
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      if (
        typeof request.body === 'object' &&
        request.body !== null &&
        !('turnstileToken' in request.body)
      ) {
        throw new AuthError('VERIFICATION_FAILED', 400);
      }
      throw new AuthError('INVALID_CREDENTIALS');
    }
    const result = await auth.login({
      ...parsed.data,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });
    setAuthCookies(reply, config, result.accessToken, result.refreshToken);
    return { admin: result.admin, csrfToken: result.csrfToken };
  });

  app.post('/admin/auth/refresh', async (request, reply) => {
    verifyAllowedOrigin(
      request.headers.origin,
      request.headers.referer,
      config.allowedOrigins,
    );
    const token = request.cookies[config.refreshName];
    if (!token) throw new AuthError('UNAUTHORIZED');
    try {
      const result = await auth.refresh(token, request.ip);
      setAuthCookies(reply, config, result.accessToken, result.refreshToken);
      return {
        authenticated: true,
        admin: result.admin,
        csrfToken: result.csrfToken,
      };
    } catch (error) {
      clearAuthCookies(reply, config);
      throw error;
    }
  });

  app.get(
    '/admin/auth/session',
    { preHandler: [guards.authenticate] },
    async (request) => {
      const principal = request.adminPrincipal!;
      return {
        authenticated: true,
        admin: {
          id: principal.id,
          email: principal.email,
          fullName: principal.fullName,
          role: principal.role,
        },
        csrfToken: principal.csrfToken,
      };
    },
  );

  app.post('/admin/auth/logout', async (request, reply) => {
    const token = request.cookies[config.accessName];
    if (!token) {
      verifyAllowedOrigin(
        request.headers.origin,
        request.headers.referer,
        config.allowedOrigins,
      );
      const refreshToken = request.cookies[config.refreshName];
      if (refreshToken) await auth.logoutByRefreshToken(refreshToken, request.ip);
      clearAuthCookies(reply, config);
      return reply.code(204).send();
    }
    await guards.authenticate(request, reply);
    await guards.csrf(request, reply);
    await auth.logout(request.adminPrincipal!, request.ip);
    clearAuthCookies(reply, config);
    return reply.code(204).send();
  });

  app.post(
    '/admin/auth/change-password',
    { preHandler: [guards.authenticate, guards.csrf] },
    async (request, reply) => {
      const parsed = passwordSchema.safeParse(request.body);
      if (!parsed.success) throw new AuthError('INVALID_REQUEST', 400);
      await auth.changePassword(
        request.adminPrincipal!,
        parsed.data.currentPassword,
        parsed.data.newPassword,
        request.ip,
      );
      clearAuthCookies(reply, config);
      return reply.code(204).send();
    },
  );
}
