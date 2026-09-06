import type { FastifyReply, FastifyRequest } from 'fastify';
import type { AuthService } from './auth-service.js';
import type { AdminPrincipal } from './auth-service.js';
import { AuthError } from './errors.js';
import { verifyAllowedOrigin, verifyCsrfToken } from './security.js';

declare module 'fastify' {
  interface FastifyRequest {
    adminPrincipal?: AdminPrincipal;
  }
}

export interface AuthGuardConfiguration {
  accessCookieName: string;
  allowedOrigins: readonly string[];
}

export function createAuthGuards(
  auth: AuthService,
  config: AuthGuardConfiguration,
) {
  async function authenticate(request: FastifyRequest, reply: FastifyReply) {
    void reply;
    const token = request.cookies[config.accessCookieName];
    if (!token) throw new AuthError('UNAUTHORIZED');
    request.adminPrincipal = await auth.authenticate(token);
  }

  async function csrf(request: FastifyRequest, reply: FastifyReply) {
    void reply;
    if (['GET', 'HEAD'].includes(request.method)) return;
    const principal = request.adminPrincipal;
    if (!principal) throw new AuthError('UNAUTHORIZED');
    verifyAllowedOrigin(
      request.headers.origin,
      request.headers.referer,
      config.allowedOrigins,
    );
    const header = request.headers['x-csrf-token'];
    verifyCsrfToken(
      Array.isArray(header) ? header[0] : header,
      principal.csrfToken,
    );
  }

  return { authenticate, csrf };
}
