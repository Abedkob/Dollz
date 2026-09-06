import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from '@dollz/database';
import { withTransaction } from '@dollz/database';
import { z } from 'zod';
import { AuthError } from './errors.js';
import {
  type JwtConfiguration,
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from './jwt.js';
import {
  assertPasswordPolicy,
  hashPassword,
  verifyPassword,
} from './password.js';
import { LoginRateLimiter } from './rate-limiter.js';
import {
  csrfTokenForSession,
  hashIp,
  safeClientIp,
  sha256,
} from './security.js';
import type { TurnstileVerifier } from './turnstile.js';
import { bootstrapSuperAdmin } from './bootstrap.js';

const normalizedEmailSchema = z.string().trim().toLowerCase().email().max(320);

interface AdminRow {
  id: string;
  email: string;
  password_hash: string;
  full_name: string | null;
  role: string;
  is_active: boolean;
  failed_login_attempts: number;
  locked_until: Date | null;
  login_disabled_reason: string | null;
}

interface SessionRow extends AdminRow {
  session_id: string;
  token_family_id: string;
  refresh_token_hash: string;
  previous_refresh_token_hash: string | null;
  expires_at: Date;
  absolute_expires_at: Date;
  revoked_at: Date | null;
}

export interface SafeAdmin {
  id: string;
  email: string;
  fullName: string | null;
  role: 'SUPER_ADMIN';
}

export interface AdminPrincipal extends SafeAdmin {
  sessionId: string;
  csrfToken: string;
}

export interface AuthenticationResult {
  accessToken: string;
  refreshToken: string;
  admin: SafeAdmin;
  csrfToken: string;
}

export interface AuthServiceConfiguration {
  jwt: JwtConfiguration;
  loginMaximumAttempts: number;
  loginLockMinutes: number;
}

function safeAdmin(row: AdminRow): SafeAdmin {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: 'SUPER_ADMIN',
  };
}

async function audit(
  client: Pool | PoolClient,
  input: {
    adminId?: string | null;
    action: string;
    entityType: string;
    entityId?: string | null;
    data?: Record<string, unknown>;
    ipHash?: string | null;
  },
) {
  await client.query(
    `INSERT INTO audit_logs (admin_user_id, action, entity_type, entity_id, new_data, ip_hash)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [
      input.adminId ?? null,
      input.action,
      input.entityType,
      input.entityId ?? null,
      input.data ?? null,
      input.ipHash ?? null,
    ],
  );
}

export class AuthService {
  private readonly rateLimiter: LoginRateLimiter;
  private dummyPasswordHash?: Promise<string>;

  constructor(
    private readonly pool: Pool,
    private readonly config: AuthServiceConfiguration,
    private readonly turnstile: TurnstileVerifier,
  ) {
    this.rateLimiter = new LoginRateLimiter(
      config.loginMaximumAttempts,
      config.loginLockMinutes * 60_000,
    );
  }

  private dummyHash() {
    this.dummyPasswordHash ??= hashPassword('Dollz timing-only password');
    return this.dummyPasswordHash;
  }

  private async issueTokens(
    adminId: string,
    sessionId: string,
    familyId: string,
  ) {
    const accessJti = randomUUID();
    const refreshJti = randomUUID();
    const [accessToken, refreshToken] = await Promise.all([
      signAccessToken(
        {
          sub: adminId,
          sid: sessionId,
          jti: accessJti,
          role: 'SUPER_ADMIN',
          type: 'access',
        },
        this.config.jwt,
      ),
      signRefreshToken(
        {
          sub: adminId,
          sid: sessionId,
          jti: refreshJti,
          family: familyId,
          type: 'refresh',
        },
        this.config.jwt,
      ),
    ]);
    return { accessToken, refreshToken };
  }

  async bootstrap(
    emailInput: string,
    password: string,
    fullName = 'Super Admin',
  ): Promise<SafeAdmin> {
    return bootstrapSuperAdmin(this.pool, emailInput, password, fullName);
  }

  async login(input: {
    email: string;
    password: string;
    turnstileToken: string;
    ip?: string;
    userAgent?: string;
  }): Promise<AuthenticationResult> {
    const parsedEmail = normalizedEmailSchema.safeParse(input.email);
    const email = parsedEmail.success ? parsedEmail.data : '';
    const ipHash = hashIp(input.ip, this.config.jwt.accessSecret);
    const emailHash = sha256(email || 'invalid');
    const rateKeys = [`ip:${ipHash ?? 'unknown'}`, `email:${emailHash}`];
    if (rateKeys.some((key) => this.rateLimiter.isBlocked(key))) {
      throw new AuthError('INVALID_CREDENTIALS');
    }

    let turnstileValid = false;
    if (input.turnstileToken.length > 0) {
      try {
        turnstileValid = await this.turnstile.verify(
          input.turnstileToken,
          input.ip ? safeClientIp(input.ip) : undefined,
        );
      } catch {
        turnstileValid = false;
      }
    }
    if (!turnstileValid) {
      for (const key of rateKeys) this.rateLimiter.recordFailure(key);
      await audit(this.pool, {
        action: 'ADMIN_LOGIN_FAILED',
        entityType: 'ADMIN_USER',
        data: { reason: 'verification', identifierHash: emailHash },
        ipHash,
      });
      throw new AuthError('VERIFICATION_FAILED', 400);
    }

    const result = parsedEmail.success
      ? await this.pool.query<AdminRow>(
          'SELECT * FROM admin_users WHERE LOWER(email)=$1 LIMIT 1',
          [email],
        )
      : { rows: [] as AdminRow[] };
    const admin = result.rows[0];
    const passwordValid = await verifyPassword(
      admin?.password_hash ?? (await this.dummyHash()),
      input.password,
    );
    const accountAllowed =
      admin?.is_active === true &&
      admin.role === 'SUPER_ADMIN' &&
      !admin.login_disabled_reason &&
      (!admin.locked_until || admin.locked_until.getTime() <= Date.now());

    if (!admin || !passwordValid || !accountAllowed) {
      const limiterLocked = rateKeys
        .map((key) => this.rateLimiter.recordFailure(key))
        .some(Boolean);
      if (admin) {
        await withTransaction(this.pool, async (client) => {
          const updated = await client.query<{ locked_until: Date | null }>(
            `UPDATE admin_users SET
               failed_login_attempts = failed_login_attempts + 1,
               locked_until = CASE WHEN failed_login_attempts + 1 >= $2
                 THEN NOW() + ($3 * INTERVAL '1 minute') ELSE locked_until END
             WHERE id=$1 RETURNING locked_until`,
            [
              admin.id,
              this.config.loginMaximumAttempts,
              this.config.loginLockMinutes,
            ],
          );
          await audit(client, {
            adminId: admin.id,
            action: 'ADMIN_LOGIN_FAILED',
            entityType: 'ADMIN_USER',
            entityId: admin.id,
            data: {
              locked: Boolean(updated.rows[0]?.locked_until) || limiterLocked,
            },
            ipHash,
          });
          if (updated.rows[0]?.locked_until) {
            await audit(client, {
              adminId: admin.id,
              action: 'ADMIN_ACCOUNT_LOCKED',
              entityType: 'ADMIN_USER',
              entityId: admin.id,
              ipHash,
            });
          }
        });
      } else {
        await audit(this.pool, {
          action: 'ADMIN_LOGIN_FAILED',
          entityType: 'ADMIN_USER',
          data: { reason: 'credentials', identifierHash: emailHash },
          ipHash,
        });
      }
      throw new AuthError('INVALID_CREDENTIALS');
    }

    const sessionId = randomUUID();
    const familyId = randomUUID();
    const tokens = await this.issueTokens(admin.id, sessionId, familyId);
    const expiresAt = new Date(
      Date.now() + this.config.jwt.refreshTtlDays * 86_400_000,
    );
    await withTransaction(this.pool, async (client) => {
      await client.query(
        `UPDATE admin_users SET failed_login_attempts=0, locked_until=NULL, last_login_at=NOW() WHERE id=$1`,
        [admin.id],
      );
      await client.query(
        `INSERT INTO admin_sessions
          (id,admin_user_id,token_family_id,refresh_token_hash,user_agent,ip_hash,expires_at,absolute_expires_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$7)`,
        [
          sessionId,
          admin.id,
          familyId,
          sha256(tokens.refreshToken),
          input.userAgent ?? null,
          ipHash,
          expiresAt,
        ],
      );
      await audit(client, {
        adminId: admin.id,
        action: 'ADMIN_LOGIN_SUCCEEDED',
        entityType: 'ADMIN_SESSION',
        entityId: sessionId,
        ipHash,
      });
    });
    for (const key of rateKeys) this.rateLimiter.reset(key);
    return {
      ...tokens,
      admin: safeAdmin(admin),
      csrfToken: csrfTokenForSession(sessionId, this.config.jwt.accessSecret),
    };
  }

  async authenticate(accessToken: string): Promise<AdminPrincipal> {
    const claims = await verifyAccessToken(accessToken, this.config.jwt);
    const result = await this.pool.query<SessionRow>(
      `SELECT s.id AS session_id,s.token_family_id,s.refresh_token_hash,s.previous_refresh_token_hash,
        s.expires_at,s.absolute_expires_at,s.revoked_at,
        a.id,a.email,a.password_hash,a.full_name,a.role,a.is_active,a.failed_login_attempts,a.locked_until,a.login_disabled_reason
       FROM admin_sessions s JOIN admin_users a ON a.id=s.admin_user_id
       WHERE s.id=$1 AND s.admin_user_id=$2 LIMIT 1`,
      [claims.sid, claims.sub],
    );
    const row = result.rows[0];
    if (
      !row ||
      row.revoked_at ||
      row.expires_at.getTime() <= Date.now() ||
      row.absolute_expires_at.getTime() <= Date.now() ||
      !row.is_active ||
      row.role !== 'SUPER_ADMIN' ||
      Boolean(row.login_disabled_reason) ||
      Boolean(row.locked_until && row.locked_until.getTime() > Date.now())
    )
      throw new AuthError('UNAUTHORIZED');
    return {
      ...safeAdmin(row),
      sessionId: row.session_id,
      csrfToken: csrfTokenForSession(
        row.session_id,
        this.config.jwt.accessSecret,
      ),
    };
  }

  async refresh(
    refreshToken: string,
    ip?: string,
  ): Promise<AuthenticationResult> {
    const claims = await verifyRefreshToken(refreshToken, this.config.jwt);
    const presentedHash = sha256(refreshToken);
    const ipHash = hashIp(ip, this.config.jwt.accessSecret);
    const outcome = await withTransaction(this.pool, async (client) => {
      const result = await client.query<SessionRow>(
        `SELECT s.id AS session_id,s.token_family_id,s.refresh_token_hash,s.previous_refresh_token_hash,
          s.expires_at,s.absolute_expires_at,s.revoked_at,
          a.id,a.email,a.password_hash,a.full_name,a.role,a.is_active,a.failed_login_attempts,a.locked_until,a.login_disabled_reason
         FROM admin_sessions s JOIN admin_users a ON a.id=s.admin_user_id
         WHERE s.id=$1 FOR UPDATE OF s`,
        [claims.sid],
      );
      const row = result.rows[0];
      if (
        !row ||
        row.token_family_id !== claims.family ||
        row.id !== claims.sub
      ) {
        throw new AuthError('UNAUTHORIZED');
      }
      if (row.previous_refresh_token_hash === presentedHash) {
        await client.query(
          `UPDATE admin_sessions SET revoked_at=NOW(),revoke_reason='REFRESH_TOKEN_REUSE'
           WHERE token_family_id=$1 AND revoked_at IS NULL`,
          [row.token_family_id],
        );
        await audit(client, {
          adminId: row.id,
          action: 'REFRESH_TOKEN_REUSE_DETECTED',
          entityType: 'ADMIN_SESSION',
          entityId: row.session_id,
          ipHash,
        });
        await audit(client, {
          adminId: row.id,
          action: 'ADMIN_SESSION_FAMILY_REVOKED',
          entityType: 'ADMIN_SESSION',
          entityId: row.session_id,
          ipHash,
        });
        return { reuse: true as const };
      }
      if (
        row.refresh_token_hash !== presentedHash ||
        row.revoked_at ||
        row.expires_at.getTime() <= Date.now() ||
        row.absolute_expires_at.getTime() <= Date.now() ||
        !row.is_active ||
        row.role !== 'SUPER_ADMIN' ||
        Boolean(row.login_disabled_reason) ||
        Boolean(row.locked_until && row.locked_until.getTime() > Date.now())
      )
        throw new AuthError('UNAUTHORIZED');

      const tokens = await this.issueTokens(
        row.id,
        row.session_id,
        row.token_family_id,
      );
      await client.query(
        `UPDATE admin_sessions SET previous_refresh_token_hash=refresh_token_hash,
          refresh_token_hash=$2,last_rotated_at=NOW(),last_used_at=NOW() WHERE id=$1`,
        [row.session_id, sha256(tokens.refreshToken)],
      );
      await audit(client, {
        adminId: row.id,
        action: 'ADMIN_TOKEN_REFRESHED',
        entityType: 'ADMIN_SESSION',
        entityId: row.session_id,
        ipHash,
      });
      return { reuse: false as const, tokens, admin: safeAdmin(row) };
    });
    if (outcome.reuse) throw new AuthError('UNAUTHORIZED');
    return {
      ...outcome.tokens,
      admin: outcome.admin,
      csrfToken: csrfTokenForSession(claims.sid, this.config.jwt.accessSecret),
    };
  }

  async logout(principal: AdminPrincipal, ip?: string): Promise<void> {
    await withTransaction(this.pool, async (client) => {
      const result = await client.query(
        `UPDATE admin_sessions SET revoked_at=COALESCE(revoked_at,NOW()),
          revoke_reason=COALESCE(revoke_reason,'LOGOUT') WHERE id=$1 RETURNING id`,
        [principal.sessionId],
      );
      if (result.rowCount) {
        await audit(client, {
          adminId: principal.id,
          action: 'ADMIN_LOGGED_OUT',
          entityType: 'ADMIN_SESSION',
          entityId: principal.sessionId,
          ipHash: hashIp(ip, this.config.jwt.accessSecret),
        });
        await audit(client, {
          adminId: principal.id,
          action: 'ADMIN_SESSION_REVOKED',
          entityType: 'ADMIN_SESSION',
          entityId: principal.sessionId,
        });
      }
    });
  }

  async logoutByRefreshToken(refreshToken: string, ip?: string): Promise<void> {
    let claims;
    try {
      claims = await verifyRefreshToken(refreshToken, this.config.jwt);
    } catch {
      return;
    }
    await withTransaction(this.pool, async (client) => {
      const result = await client.query(
        `UPDATE admin_sessions SET revoked_at=COALESCE(revoked_at,NOW()),
          revoke_reason=COALESCE(revoke_reason,'LOGOUT') WHERE id=$1 AND token_family_id=$2 RETURNING id`,
        [claims.sid, claims.family],
      );
      if (result.rowCount) {
        await audit(client, {
          adminId: claims.sub,
          action: 'ADMIN_LOGGED_OUT',
          entityType: 'ADMIN_SESSION',
          entityId: claims.sid,
          ipHash: hashIp(ip, this.config.jwt.accessSecret),
        });
        await audit(client, {
          adminId: claims.sub,
          action: 'ADMIN_SESSION_REVOKED',
          entityType: 'ADMIN_SESSION',
          entityId: claims.sid,
        });
      }
    });
  }

  async changePassword(
    principal: AdminPrincipal,
    currentPassword: string,
    newPassword: string,
    ip?: string,
  ): Promise<void> {
    const result = await this.pool.query<AdminRow>(
      'SELECT * FROM admin_users WHERE id=$1',
      [principal.id],
    );
    const admin = result.rows[0];
    if (
      !admin ||
      !(await verifyPassword(admin.password_hash, currentPassword))
    ) {
      throw new AuthError('CURRENT_PASSWORD_INVALID', 400);
    }
    assertPasswordPolicy(newPassword, admin.email.toLowerCase());
    if (await verifyPassword(admin.password_hash, newPassword))
      throw new AuthError('PASSWORD_REUSE', 400);
    const nextHash = await hashPassword(newPassword);
    await withTransaction(this.pool, async (client) => {
      await client.query(
        `UPDATE admin_users SET password_hash=$2,password_changed_at=NOW() WHERE id=$1`,
        [admin.id, nextHash],
      );
      await client.query(
        `UPDATE admin_sessions SET revoked_at=COALESCE(revoked_at,NOW()),
          revoke_reason=COALESCE(revoke_reason,'PASSWORD_CHANGED') WHERE admin_user_id=$1`,
        [admin.id],
      );
      const ipHash = hashIp(ip, this.config.jwt.accessSecret);
      await audit(client, {
        adminId: admin.id,
        action: 'ADMIN_PASSWORD_CHANGED',
        entityType: 'ADMIN_USER',
        entityId: admin.id,
        ipHash,
      });
      await audit(client, {
        adminId: admin.id,
        action: 'ADMIN_SESSIONS_REVOKED',
        entityType: 'ADMIN_USER',
        entityId: admin.id,
        ipHash,
      });
    });
  }
}
