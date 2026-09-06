import { SignJWT, jwtVerify } from 'jose';
import { z } from 'zod';
import { AuthError } from './errors.js';

const algorithm = 'HS256';
const accessClaimsSchema = z.object({
  sub: z.string().uuid(),
  sid: z.string().uuid(),
  jti: z.string().uuid(),
  role: z.literal('SUPER_ADMIN'),
  type: z.literal('access'),
});
const refreshClaimsSchema = z.object({
  sub: z.string().uuid(),
  sid: z.string().uuid(),
  jti: z.string().uuid(),
  family: z.string().uuid(),
  type: z.literal('refresh'),
});

export interface JwtConfiguration {
  accessSecret: string;
  refreshSecret: string;
  issuer: string;
  audience: string;
  accessTtlMinutes: number;
  refreshTtlDays: number;
}

export type AccessClaims = z.infer<typeof accessClaimsSchema>;
export type RefreshClaims = z.infer<typeof refreshClaimsSchema>;

function secret(value: string) {
  return new TextEncoder().encode(value);
}

async function sign(
  payload: Record<string, string>,
  secretValue: string,
  config: JwtConfiguration,
  ttl: string,
) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: algorithm, typ: 'JWT' })
    .setIssuedAt()
    .setIssuer(config.issuer)
    .setAudience(config.audience)
    .setExpirationTime(ttl)
    .sign(secret(secretValue));
}

export function signAccessToken(
  claims: AccessClaims,
  config: JwtConfiguration,
): Promise<string> {
  return sign(
    claims,
    config.accessSecret,
    config,
    `${config.accessTtlMinutes}m`,
  );
}

export function signRefreshToken(
  claims: RefreshClaims,
  config: JwtConfiguration,
): Promise<string> {
  return sign(
    claims,
    config.refreshSecret,
    config,
    `${config.refreshTtlDays}d`,
  );
}

async function verify(
  token: string,
  secretValue: string,
  config: JwtConfiguration,
) {
  try {
    return (
      await jwtVerify(token, secret(secretValue), {
        algorithms: [algorithm],
        issuer: config.issuer,
        audience: config.audience,
      })
    ).payload;
  } catch {
    throw new AuthError('UNAUTHORIZED');
  }
}

export async function verifyAccessToken(
  token: string,
  config: JwtConfiguration,
): Promise<AccessClaims> {
  const result = accessClaimsSchema.safeParse(
    await verify(token, config.accessSecret, config),
  );
  if (!result.success) throw new AuthError('UNAUTHORIZED');
  return result.data;
}

export async function verifyRefreshToken(
  token: string,
  config: JwtConfiguration,
): Promise<RefreshClaims> {
  const result = refreshClaimsSchema.safeParse(
    await verify(token, config.refreshSecret, config),
  );
  if (!result.success) throw new AuthError('UNAUTHORIZED');
  return result.data;
}
