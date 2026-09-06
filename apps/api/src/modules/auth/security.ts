import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { AuthError } from './errors.js';

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function hashIp(ip: string | undefined, secret: string): string | null {
  if (!ip) return null;
  return createHmac('sha256', secret).update(ip).digest('hex');
}

export function csrfTokenForSession(sessionId: string, secret: string): string {
  return createHmac('sha256', secret)
    .update(`csrf:${sessionId}`)
    .digest('base64url');
}

export function verifyCsrfToken(
  actual: string | undefined,
  expected: string,
): void {
  if (!actual) throw new AuthError('CSRF_INVALID', 403);
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    throw new AuthError('CSRF_INVALID', 403);
  }
}

export function requestOrigin(
  origin: string | undefined,
  referer: string | undefined,
): string | null {
  if (origin) {
    try {
      return new URL(origin).origin;
    } catch {
      return null;
    }
  }
  if (referer) {
    try {
      return new URL(referer).origin;
    } catch {
      return null;
    }
  }
  return null;
}

export function verifyAllowedOrigin(
  origin: string | undefined,
  referer: string | undefined,
  allowedOrigins: readonly string[],
): void {
  const resolved = requestOrigin(origin, referer);
  if (!resolved || !allowedOrigins.includes(resolved))
    throw new AuthError('CSRF_INVALID', 403);
}

export function safeClientIp(ip: string): string | undefined {
  if (/^(127\.|::1$|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip))
    return undefined;
  return ip;
}
