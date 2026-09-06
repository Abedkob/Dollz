import 'fastify';
import type { AdminPrincipal } from './auth-service.js';

declare module 'fastify' {
  interface FastifyRequest {
    adminPrincipal?: AdminPrincipal;
  }
}
