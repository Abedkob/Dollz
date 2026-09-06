import type { FastifyReply } from 'fastify';

export interface AuthCookieConfiguration {
  accessName: string;
  refreshName: string;
  secure: boolean;
  accessMaxAgeSeconds: number;
  refreshMaxAgeSeconds: number;
}

function shared(config: AuthCookieConfiguration) {
  return {
    httpOnly: true,
    secure: config.secure,
    sameSite: 'lax' as const,
    path: '/',
  };
}

export function setAuthCookies(
  reply: FastifyReply,
  config: AuthCookieConfiguration,
  accessToken: string,
  refreshToken: string,
) {
  reply.setCookie(config.accessName, accessToken, {
    ...shared(config),
    maxAge: config.accessMaxAgeSeconds,
  });
  reply.setCookie(config.refreshName, refreshToken, {
    ...shared(config),
    maxAge: config.refreshMaxAgeSeconds,
  });
}

export function clearAuthCookies(
  reply: FastifyReply,
  config: AuthCookieConfiguration,
) {
  reply.clearCookie(config.accessName, shared(config));
  reply.clearCookie(config.refreshName, shared(config));
}
