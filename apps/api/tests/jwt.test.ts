import { SignJWT } from 'jose';
import { describe, expect, test } from 'vitest';
import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  type JwtConfiguration,
} from '../src/modules/auth/jwt.js';

const config: JwtConfiguration = {
  accessSecret: 'access-secret-that-is-long-and-private',
  refreshSecret: 'refresh-secret-that-is-long-and-different',
  issuer: 'dollz-api',
  audience: 'dollz-admin',
  accessTtlMinutes: 15,
  refreshTtlDays: 7,
};
const sub = '9a4e572c-f874-4861-9df0-d5d6ebbf244c';
const sid = '2fe970d1-4f52-4a85-93ed-899ea863035c';
const jti = 'bb05a085-c6fb-4584-ac45-b714a17ea66d';
const family = '42b22f40-6583-4862-b7f1-bcf55c6d3d68';

describe('JWT contracts', () => {
  test('issues and verifies access and refresh token types', async () => {
    const access = await signAccessToken(
      { sub, sid, jti, role: 'SUPER_ADMIN', type: 'access' },
      config,
    );
    const refresh = await signRefreshToken(
      { sub, sid, jti, family, type: 'refresh' },
      config,
    );
    await expect(verifyAccessToken(access, config)).resolves.toMatchObject({
      sub,
      sid,
      type: 'access',
    });
    await expect(verifyRefreshToken(refresh, config)).resolves.toMatchObject({
      family,
      type: 'refresh',
    });
    await expect(verifyAccessToken(refresh, config)).rejects.toThrow();
    await expect(verifyRefreshToken(access, config)).rejects.toThrow();
  });

  test.each([
    [
      'wrong secret',
      { ...config, accessSecret: 'different-access-secret-value' },
    ],
    ['wrong issuer', { ...config, issuer: 'other-issuer' }],
    ['wrong audience', { ...config, audience: 'other-audience' }],
  ])('rejects %s', async (_name, invalidConfig) => {
    const token = await signAccessToken(
      { sub, sid, jti, role: 'SUPER_ADMIN', type: 'access' },
      config,
    );
    await expect(verifyAccessToken(token, invalidConfig)).rejects.toThrow();
  });

  test('rejects expired, unsupported-algorithm, and tampered tokens', async () => {
    const key = new TextEncoder().encode(config.accessSecret);
    const expired = await new SignJWT({
      sub,
      sid,
      jti,
      role: 'SUPER_ADMIN',
      type: 'access',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer(config.issuer)
      .setAudience(config.audience)
      .setIssuedAt()
      .setExpirationTime('1 second ago')
      .sign(key);
    const unsupported = await new SignJWT({
      sub,
      sid,
      jti,
      role: 'SUPER_ADMIN',
      type: 'access',
    })
      .setProtectedHeader({ alg: 'HS512' })
      .setIssuer(config.issuer)
      .setAudience(config.audience)
      .setIssuedAt()
      .setExpirationTime('15m')
      .sign(key);
    const valid = await signAccessToken(
      { sub, sid, jti, role: 'SUPER_ADMIN', type: 'access' },
      config,
    );
    await expect(verifyAccessToken(expired, config)).rejects.toThrow();
    await expect(verifyAccessToken(unsupported, config)).rejects.toThrow();
    await expect(
      verifyAccessToken(`${valid.slice(0, -1)}x`, config),
    ).rejects.toThrow();
  });
});
