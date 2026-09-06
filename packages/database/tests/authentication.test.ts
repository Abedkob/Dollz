import type { Pool } from 'pg';
import { randomBytes } from 'node:crypto';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from 'vitest';
import {
  closePool,
  createPool,
  migrate,
  readTestDatabaseConfig,
} from '../src/index.js';
import { buildApp } from '../../../apps/api/src/app.js';
import { readEnvironment } from '../../../apps/api/src/config/environment.js';
import { bootstrapSuperAdmin } from '../../../apps/api/src/modules/auth/bootstrap.js';
import type { TurnstileVerifier } from '../../../apps/api/src/modules/auth/turnstile.js';

class FakeTurnstile implements TurnstileVerifier {
  valid = true;
  throws = false;
  async verify() {
    if (this.throws) throw new Error('timeout');
    return this.valid;
  }
}

const origin = 'http://localhost:3000';
const accessSecret = 'test-access-secret-that-is-long-enough';
const environment = readEnvironment({
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://unused/unused',
  JWT_ACCESS_SECRET: accessSecret,
  JWT_REFRESH_SECRET: 'test-refresh-secret-that-is-different',
  TURNSTILE_SECRET_KEY: 'test-only-injected-verifier',
  ALLOWED_ORIGINS: origin,
  ADMIN_LOGIN_MAX_ATTEMPTS: '3',
  ADMIN_LOGIN_LOCK_MINUTES: '15',
});

let pool: Pool;
let app: ReturnType<typeof buildApp>;
let turnstile: FakeTurnstile;
let adminId: string;
let originalPasswordHash: string;
let setupComplete = false;

function cookieHeader(response: {
  headers: Record<string, string | string[] | number | undefined>;
}) {
  const values = response.headers['set-cookie'];
  return (Array.isArray(values) ? values : [values])
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.split(';')[0])
    .join('; ');
}

async function login(password = 'a very secure admin password') {
  return app.inject({
    method: 'POST',
    url: '/admin/auth/login',
    headers: { origin },
    payload: {
      email: 'ADMIN@example.com',
      password,
      turnstileToken: 'test-token',
    },
  });
}

async function createOrderCatalog(currency = 'USD') {
  const productId = (
    await pool.query<{ id: string }>(
      `INSERT INTO products (name,slug,short_description,description,starting_price_minor,currency,production_min_days,production_max_days,status,published_at)
       VALUES ('Order Doll',$1,'Handmade doll','A handmade order doll.',1000,$2,5,10,'ACTIVE',NOW()) RETURNING id`,
      [`order-${crypto.randomUUID()}`, currency],
    )
  ).rows[0]!.id;
  const variantId = (
    await pool.query<{ id: string }>(
      `INSERT INTO product_variants (product_id,sku,name,size_label,price_minor,currency,is_default,is_active)
       VALUES ($1,$2,'Small','25 cm',1000,$3,true,true) RETURNING id`,
      [productId, `ORDER-${crypto.randomUUID()}`, currency],
    )
  ).rows[0]!.id;
  const optionId = (
    await pool.query<{ id: string }>(
      `INSERT INTO product_options (product_id,code,name,input_type,is_required,is_active,affects_3d,three_d_property)
       VALUES ($1,'eye-color','Eye color','COLOR',true,true,true,'eyes') RETURNING id`,
      [productId],
    )
  ).rows[0]!.id;
  const optionValueId = (
    await pool.query<{ id: string }>(
      `INSERT INTO product_option_values (product_option_id,code,label,color_hex,price_adjustment_minor,is_default,is_active)
       VALUES ($1,'brown','Warm brown','#6F4A3A',250,true,true) RETURNING id`,
      [optionId],
    )
  ).rows[0]!.id;
  return { productId, variantId, optionId, optionValueId };
}

function orderPayload(
  catalog: Awaited<ReturnType<typeof createOrderCatalog>>,
  submissionKey = `submission-${crypto.randomUUID()}-${crypto.randomUUID()}`,
) {
  return {
    submissionKey,
    customer: {
      fullName: 'Maya Hassan',
      email: 'maya@example.com',
      phone: '+9611234567',
      preferredContactMethod: 'EMAIL',
    },
    delivery: {
      addressLine1: 'Private street',
      addressLine2: '',
      city: 'Beirut',
      region: 'Beirut',
      country: 'Lebanon',
      postalCode: '',
      shippingMethod: 'DELIVERY',
    },
    notes: 'Please call first.',
    items: [
      {
        productId: catalog.productId,
        variantId: catalog.variantId,
        quantity: 2,
        customerRequest: 'A birthday gift.',
        notes: '',
        previewFileId: null,
        selections: [
          {
            optionId: catalog.optionId,
            optionValueId: catalog.optionValueId,
            customValue: null,
          },
        ],
      },
    ],
    turnstileToken: 'valid-test-token',
  };
}

beforeAll(async () => {
  pool = createPool(readTestDatabaseConfig());
  try {
    await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
    await migrate(pool);
    const admin = await bootstrapSuperAdmin(
      pool,
      'admin@example.com',
      'a very secure admin password',
    );
    adminId = admin.id;
    originalPasswordHash = (
      await pool.query('SELECT password_hash FROM admin_users WHERE id=$1', [
        adminId,
      ])
    ).rows[0].password_hash;
    turnstile = new FakeTurnstile();
    app = buildApp({
      pool,
      environment,
      turnstileVerifier: turnstile,
      logger: false,
    });
    await app.ready();
    setupComplete = true;
  } catch (error) {
    await closePool(pool);
    throw new Error(
      `Authentication integration-test setup failed. Start PostgreSQL with "docker compose up -d postgres" and set TEST_DATABASE_URL. ${String(error)}`,
      { cause: error },
    );
  }
});

beforeEach(async () => {
  if (app) await app.close();
  turnstile = new FakeTurnstile();
  app = buildApp({
    pool,
    environment,
    turnstileVerifier: turnstile,
    logger: false,
  });
  await app.ready();
  turnstile.valid = true;
  turnstile.throws = false;
  await pool.query('DELETE FROM admin_sessions');
  await pool.query('DELETE FROM audit_logs WHERE action <> $1', [
    'ADMIN_BOOTSTRAPPED',
  ]);
  await pool.query(
    `UPDATE admin_users SET is_active=TRUE,failed_login_attempts=0,locked_until=NULL,password_hash=$2 WHERE id=$1`,
    [adminId, originalPasswordHash],
  );
});

afterAll(async () => {
  if (app) await app.close();
  if (pool && setupComplete) {
    await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
    await closePool(pool);
  }
});

describe('bootstrap and login', () => {
  test('rejects duplicate bootstrap without exposing a password', async () => {
    await expect(
      bootstrapSuperAdmin(pool, 'other@example.com', 'another secure password'),
    ).rejects.toThrow('already exists');
  });

  test('logs in, normalizes email, resets failures, and sets hardened cookies', async () => {
    await pool.query(
      'UPDATE admin_users SET failed_login_attempts=2 WHERE id=$1',
      [adminId],
    );
    const response = await login();
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      admin: { email: 'admin@example.com', role: 'SUPER_ADMIN' },
    });
    expect(response.body).not.toMatch(
      /password|argon2|refreshToken|accessToken/i,
    );
    const cookies = response.headers['set-cookie']!;
    const text = Array.isArray(cookies) ? cookies.join('\n') : cookies;
    expect(text).toContain('HttpOnly');
    expect(text).toContain('SameSite=Lax');
    expect(text).not.toContain('Secure');
    expect(
      (
        await pool.query(
          'SELECT failed_login_attempts FROM admin_users WHERE id=$1',
          [adminId],
        )
      ).rows[0].failed_login_attempts,
    ).toBe(0);
  });

  test('uses the same credential response for invalid email, password, inactive, and locked accounts', async () => {
    const invalidEmail = await app.inject({
      method: 'POST',
      url: '/admin/auth/login',
      headers: { origin },
      payload: {
        email: 'bad',
        password: 'wrong password',
        turnstileToken: 'ok',
      },
    });
    const wrong = await login('wrong password');
    await pool.query('UPDATE admin_users SET is_active=FALSE WHERE id=$1', [
      adminId,
    ]);
    const inactive = await login();
    await pool.query(
      `UPDATE admin_users SET is_active=TRUE,locked_until=NOW()+INTERVAL '1 hour' WHERE id=$1`,
      [adminId],
    );
    const locked = await login();
    for (const response of [invalidEmail, wrong, inactive, locked]) {
      expect(response.statusCode).toBe(401);
      expect(response.json()).toEqual({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'The email or password is incorrect.',
        },
      });
    }
  });

  test('handles invalid, missing, and timed-out Turnstile verification generically', async () => {
    turnstile.valid = false;
    expect((await login()).json().error.code).toBe('VERIFICATION_FAILED');
    turnstile.throws = true;
    expect((await login()).json().error.code).toBe('VERIFICATION_FAILED');
    const missing = await app.inject({
      method: 'POST',
      url: '/admin/auth/login',
      headers: { origin },
      payload: { email: 'admin@example.com', password: 'anything' },
    });
    expect(missing.json().error.code).toBe('VERIFICATION_FAILED');
  });

  test('increments failures and temporarily locks the account', async () => {
    await login('wrong password');
    await login('wrong password');
    await login('wrong password');
    const row = (
      await pool.query(
        'SELECT failed_login_attempts,locked_until FROM admin_users WHERE id=$1',
        [adminId],
      )
    ).rows[0];
    expect(row.failed_login_attempts).toBe(3);
    expect(row.locked_until).toBeInstanceOf(Date);
  });
});

describe('sessions, refresh, and CSRF', () => {
  test('retrieves a valid session and rejects missing or revoked sessions', async () => {
    const signedIn = await login();
    const cookie = cookieHeader(signedIn);
    expect(
      (
        await app.inject({
          method: 'GET',
          url: '/admin/auth/session',
          headers: { cookie },
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (await app.inject({ method: 'GET', url: '/admin/auth/session' }))
        .statusCode,
    ).toBe(401);
    await pool.query(
      `UPDATE admin_sessions SET revoked_at=NOW() WHERE admin_user_id=$1`,
      [adminId],
    );
    expect(
      (
        await app.inject({
          method: 'GET',
          url: '/admin/auth/session',
          headers: { cookie },
        })
      ).statusCode,
    ).toBe(401);
  });

  test('rotates refresh tokens and reuse revokes the token family', async () => {
    const signedIn = await login();
    const oldCookies = cookieHeader(signedIn);
    const refreshed = await app.inject({
      method: 'POST',
      url: '/admin/auth/refresh',
      headers: { cookie: oldCookies, origin },
    });
    expect(refreshed.statusCode).toBe(200);
    const newCookies = cookieHeader(refreshed);
    const reuse = await app.inject({
      method: 'POST',
      url: '/admin/auth/refresh',
      headers: { cookie: oldCookies, origin },
    });
    expect(reuse.statusCode).toBe(401);
    expect(
      (
        await app.inject({
          method: 'GET',
          url: '/admin/auth/session',
          headers: { cookie: newCookies },
        })
      ).statusCode,
    ).toBe(401);
  });

  test('allows only one concurrent refresh to remain successful', async () => {
    const signedIn = await login();
    const cookie = cookieHeader(signedIn);
    const responses = await Promise.all([
      app.inject({
        method: 'POST',
        url: '/admin/auth/refresh',
        headers: { cookie, origin },
      }),
      app.inject({
        method: 'POST',
        url: '/admin/auth/refresh',
        headers: { cookie, origin },
      }),
    ]);
    expect(responses.map((response) => response.statusCode).sort()).toEqual([
      200, 401,
    ]);
  });

  test('requires valid origin and CSRF for logout while safe GET stays exempt', async () => {
    const signedIn = await login();
    const cookie = cookieHeader(signedIn);
    const csrfToken = signedIn.json().csrfToken as string;
    expect(
      (
        await app.inject({
          method: 'GET',
          url: '/admin/auth/session',
          headers: { cookie },
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/admin/auth/logout',
          headers: { cookie, origin },
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/admin/auth/logout',
          headers: {
            cookie,
            origin: 'https://evil.example',
            'x-csrf-token': csrfToken,
          },
        })
      ).statusCode,
    ).toBe(403);
    const logout = await app.inject({
      method: 'POST',
      url: '/admin/auth/logout',
      headers: { cookie, origin, 'x-csrf-token': csrfToken },
    });
    expect(logout.statusCode).toBe(204);
    expect(
      (
        await app.inject({
          method: 'GET',
          url: '/admin/auth/session',
          headers: { cookie },
        })
      ).statusCode,
    ).toBe(401);
  });
});

describe('password change', () => {
  test('rejects wrong, weak, and reused passwords', async () => {
    const signedIn = await login();
    const cookie = cookieHeader(signedIn);
    const headers = {
      cookie,
      origin,
      'x-csrf-token': signedIn.json().csrfToken as string,
    };
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/admin/auth/change-password',
          headers,
          payload: {
            currentPassword: 'wrong password',
            newPassword: 'another valid password',
          },
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/admin/auth/change-password',
          headers,
          payload: {
            currentPassword: 'a very secure admin password',
            newPassword: 'short',
          },
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/admin/auth/change-password',
          headers,
          payload: {
            currentPassword: 'a very secure admin password',
            newPassword: 'a very secure admin password',
          },
        })
      ).statusCode,
    ).toBe(400);
  });

  test('changes the password, revokes every session, and clears cookies', async () => {
    const first = await login();
    await login();
    const cookie = cookieHeader(first);
    const response = await app.inject({
      method: 'POST',
      url: '/admin/auth/change-password',
      headers: {
        cookie,
        origin,
        'x-csrf-token': first.json().csrfToken as string,
      },
      payload: {
        currentPassword: 'a very secure admin password',
        newPassword: 'a completely new secure password',
      },
    });
    expect(response.statusCode).toBe(204);
    expect(
      Number(
        (
          await pool.query(
            'SELECT COUNT(*) FROM admin_sessions WHERE revoked_at IS NULL',
          )
        ).rows[0].count,
      ),
    ).toBe(0);
    expect(
      Array.isArray(response.headers['set-cookie'])
        ? response.headers['set-cookie'].join('')
        : response.headers['set-cookie'],
    ).toContain('Max-Age=0');
    expect(
      (
        await app.inject({
          method: 'GET',
          url: '/admin/auth/session',
          headers: { cookie },
        })
      ).statusCode,
    ).toBe(401);
  });
});

describe('catalog administration', () => {
  test('protects catalog reads and requires CSRF on every mutation', async () => {
    expect(
      (await app.inject({ method: 'GET', url: '/admin/products' })).statusCode,
    ).toBe(401);
    const signedIn = await login();
    const cookie = cookieHeader(signedIn);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/admin/products',
          headers: { cookie, origin },
          payload: {},
        })
      ).statusCode,
    ).toBe(403);
  });

  test('applies a reusable customization preset and rejects duplicates', async () => {
    const signedIn = await login();
    const headers = {
      cookie: cookieHeader(signedIn),
      origin,
      'x-csrf-token': signedIn.json().csrfToken as string,
    };
    const created = await app.inject({
      method: 'POST',
      url: '/admin/products',
      headers,
      payload: {
        name: 'Preset Doll',
        slug: `preset-${crypto.randomUUID()}`,
        shortDescription: 'A doll for testing reusable options.',
        description: 'A doll for testing reusable customization options.',
        startingPriceMinor: 6900,
        currency: 'USD',
        productionMinDays: 5,
        productionMaxDays: 10,
        isFeatured: false,
        seoTitle: null,
        seoDescription: null,
      },
    });
    expect(created.statusCode).toBe(201);
    const productId = created.json().product.id as string;

    const applied = await app.inject({
      method: 'POST',
      url: `/admin/products/${productId}/options/presets/eye-color`,
      headers,
    });
    expect(applied.statusCode).toBe(201);
    expect(applied.json().option).toMatchObject({
      code: 'eye-color',
      name: 'Eye color',
      inputType: 'COLOR',
      isRequired: true,
      affects3d: true,
      threeDProperty: 'eyes',
    });
    expect(applied.json().option.values).toHaveLength(4);
    expect(applied.json().option.values[0]).toMatchObject({
      code: 'warm-brown',
      label: 'Warm brown',
      colorHex: '#6F4A3A',
      isDefault: true,
    });

    const duplicate = await app.inject({
      method: 'POST',
      url: `/admin/products/${productId}/options/presets/eye-color`,
      headers,
    });
    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.json().error.code).toBe('DUPLICATE_CODE');
  });

  test('creates a complete product configuration and publishes only after the checklist passes', async () => {
    const signedIn = await login();
    const headers = {
      cookie: cookieHeader(signedIn),
      origin,
      'x-csrf-token': signedIn.json().csrfToken as string,
    };
    const slug = `catalog-${crypto.randomUUID()}`;
    const created = await app.inject({
      method: 'POST',
      url: '/admin/products',
      headers,
      payload: {
        name: 'Classic Doll',
        slug,
        shortDescription: 'A handmade cloth doll.',
        description: 'Made to order with carefully selected details.',
        startingPriceMinor: 7900,
        currency: 'usd',
        productionMinDays: 5,
        productionMaxDays: 10,
        isFeatured: true,
        seoTitle: null,
        seoDescription: null,
      },
    });
    expect(created.statusCode).toBe(201);
    const productId = created.json().product.id as string;

    const rejectedPublish = await app.inject({
      method: 'POST',
      url: `/admin/products/${productId}/publish`,
      headers,
    });
    expect(rejectedPublish.statusCode).toBe(422);
    expect(rejectedPublish.json().error.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'variants' }),
        expect.objectContaining({ field: 'media' }),
      ]),
    );

    const variantResponse = await app.inject({
      method: 'POST',
      url: `/admin/products/${productId}/variants`,
      headers,
      payload: {
        sku: `SKU-${crypto.randomUUID()}`,
        name: '25 cm',
        sizeLabel: '25 cm',
        sizeCm: 25,
        priceMinor: 7900,
        currency: 'USD',
        modelKey: 'classic-25',
        previewFileId: null,
        isActive: true,
        sortOrder: 0,
      },
    });
    expect(variantResponse.statusCode).toBe(201);
    const variantId = variantResponse.json().variant.id as string;
    expect(
      (
        await app.inject({
          method: 'POST',
          url: `/admin/products/${productId}/variants/${variantId}/set-default`,
          headers,
        })
      ).statusCode,
    ).toBe(200);

    const fileId = (
      await pool.query<{ id: string }>(
        `INSERT INTO files (storage_key,optimized_storage_key,thumbnail_storage_key,original_name,mime_type,processed_mime_type,extension,size_bytes,checksum_sha256,category,visibility)
         VALUES ($1,$2,$3,'classic.webp','image/webp','image/webp','webp',100,$4,'PRODUCT','PUBLIC') RETURNING id`,
        [
          `products/original/${crypto.randomUUID()}.webp`,
          `products/optimized/${crypto.randomUUID()}.webp`,
          `products/thumbnails/${crypto.randomUUID()}.webp`,
          randomBytes(32).toString('hex'),
        ],
      )
    ).rows[0]!.id;
    const mediaResponse = await app.inject({
      method: 'POST',
      url: `/admin/products/${productId}/media`,
      headers,
      payload: { fileId, altText: 'Classic handmade doll', sortOrder: 0 },
    });
    expect(mediaResponse.statusCode).toBe(201);
    const mediaId = mediaResponse.json().media.id as string;
    expect(
      (
        await app.inject({
          method: 'POST',
          url: `/admin/products/${productId}/media/${mediaId}/set-primary`,
          headers,
        })
      ).statusCode,
    ).toBe(200);
    const referencedDelete = await app.inject({
      method: 'DELETE',
      url: `/admin/media/${fileId}`,
      headers,
    });
    expect(referencedDelete.statusCode).toBe(409);
    expect(referencedDelete.json().error).toMatchObject({
      code: 'FILE_REFERENCED',
      details: [{ field: 'references', message: 'Used by product media.' }],
    });

    const optionResponse = await app.inject({
      method: 'POST',
      url: `/admin/products/${productId}/options`,
      headers,
      payload: {
        code: 'Eye Color',
        name: 'Eye color',
        description: null,
        inputType: 'COLOR',
        isRequired: true,
        isActive: true,
        affects3d: true,
        threeDProperty: 'eyes',
        allowCustomValue: false,
        sortOrder: 0,
      },
    });
    expect(optionResponse.statusCode).toBe(201);
    expect(optionResponse.json().option.code).toBe('eye-color');
    const optionId = optionResponse.json().option.id as string;
    const valueResponse = await app.inject({
      method: 'POST',
      url: `/admin/products/${productId}/options/${optionId}/values`,
      headers,
      payload: {
        code: 'Warm Brown',
        label: 'Warm brown',
        description: null,
        colorHex: '#6f315f',
        referenceFileId: null,
        priceAdjustmentMinor: 0,
        metadata: { swatchLabel: 'Plum brown' },
        isActive: true,
        sortOrder: 0,
      },
    });
    expect(valueResponse.statusCode).toBe(201);
    const valueId = valueResponse.json().value.id as string;
    expect(
      (
        await app.inject({
          method: 'POST',
          url: `/admin/products/${productId}/options/${optionId}/values/${valueId}/set-default`,
          headers,
        })
      ).statusCode,
    ).toBe(200);

    const checklist = await app.inject({
      method: 'GET',
      url: `/admin/products/${productId}/publishing-checklist`,
      headers: { cookie: headers.cookie },
    });
    expect(checklist.json()).toEqual({ publishable: true, details: [] });
    const published = await app.inject({
      method: 'POST',
      url: `/admin/products/${productId}/publish`,
      headers,
    });
    expect(published.statusCode).toBe(200);
    expect(published.json().product).toMatchObject({
      id: productId,
      status: 'ACTIVE',
    });
    const listed = await app.inject({
      method: 'GET',
      url: `/admin/products?search=${encodeURIComponent(slug)}&status=ACTIVE&featured=true&sort=name&direction=asc&page=1&pageSize=10`,
      headers: { cookie: headers.cookie },
    });
    expect(listed.statusCode).toBe(200);
    expect(listed.json()).toMatchObject({ total: 1, page: 1, pageSize: 10 });
    expect(listed.json().items[0]).toMatchObject({
      id: productId,
      status: 'ACTIVE',
    });

    const staleUpdate = await app.inject({
      method: 'PATCH',
      url: `/admin/products/${productId}`,
      headers,
      payload: {
        name: 'Stale edit',
        slug,
        shortDescription: 'Stale',
        description: 'Stale update',
        startingPriceMinor: 7900,
        currency: 'USD',
        productionMinDays: 5,
        productionMaxDays: 10,
        isFeatured: true,
        seoTitle: null,
        seoDescription: null,
        version: 1,
      },
    });
    expect(staleUpdate.statusCode).toBe(409);
    expect(staleUpdate.json().error.code).toBe('CONCURRENCY_CONFLICT');

    expect(
      (
        await app.inject({
          method: 'POST',
          url: `/admin/products/${productId}/unpublish`,
          headers,
        })
      ).json().product.status,
    ).toBe('DRAFT');
    expect(
      (
        await app.inject({
          method: 'DELETE',
          url: `/admin/products/${productId}`,
          headers,
        })
      ).json().product.status,
    ).toBe('ARCHIVED');
    expect(
      Number(
        (
          await pool.query(
            'SELECT COUNT(*) FROM product_variants WHERE product_id=$1',
            [productId],
          )
        ).rows[0].count,
      ),
    ).toBe(1);
    expect(
      Number(
        (
          await pool.query(
            `SELECT COUNT(*) FROM audit_logs WHERE entity_id=$1 AND action LIKE 'PRODUCT_%'`,
            [productId],
          )
        ).rows[0].count,
      ),
    ).toBeGreaterThanOrEqual(2);
  });
});

describe('order management', () => {
  test('submits immutable authoritative snapshots and protects concurrent retries', async () => {
    const catalog = await createOrderCatalog();
    const payload = orderPayload(catalog);
    const responses = await Promise.all(
      Array.from({ length: 4 }, () =>
        app.inject({ method: 'POST', url: '/orders', payload }),
      ),
    );
    expect(
      responses.filter((response) => response.statusCode === 201),
    ).toHaveLength(1);
    expect(
      responses.every((response) => [200, 201].includes(response.statusCode)),
    ).toBe(true);
    const created = responses.find((response) => response.statusCode === 201)!;
    expect(created.json()).toMatchObject({
      status: 'SUBMITTED',
      pricingStatus: 'ESTIMATE',
      estimatedSubtotalMinor: 2500,
      currency: 'USD',
      idempotent: false,
    });
    expect(created.json().trackingToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const orderNumber = created.json().orderNumber as string;
    expect(orderNumber).toMatch(/^DLZ-\d{4}-\d{6}$/);
    expect(
      Number(
        (
          await pool.query(
            `SELECT COUNT(*) FROM orders WHERE submission_key_hash IS NOT NULL AND order_number=$1`,
            [orderNumber],
          )
        ).rows[0].count,
      ),
    ).toBe(1);
    const snapshot = (
      await pool.query(
        `SELECT i.product_name_snapshot,i.variant_sku_snapshot,i.estimated_unit_price_minor,
                i.estimated_total_minor,s.option_name_snapshot,s.value_label_snapshot,s.color_hex_snapshot,
                s.price_adjustment_minor_snapshot,s.affects_3d_snapshot
         FROM orders o JOIN order_items i ON i.order_id=o.id
         JOIN order_item_selections s ON s.order_item_id=i.id WHERE o.order_number=$1`,
        [orderNumber],
      )
    ).rows[0];
    expect(snapshot).toMatchObject({
      product_name_snapshot: 'Order Doll',
      estimated_unit_price_minor: 1250,
      estimated_total_minor: 2500,
      option_name_snapshot: 'Eye color',
      value_label_snapshot: 'Warm brown',
      color_hex_snapshot: '#6F4A3A',
      price_adjustment_minor_snapshot: 250,
      affects_3d_snapshot: true,
    });
    await pool.query(`UPDATE products SET name='Changed later' WHERE id=$1`, [
      catalog.productId,
    ]);
    expect(snapshot.product_name_snapshot).toBe('Order Doll');
    const storedToken = (
      await pool.query<{ token_hash: string }>(
        `SELECT t.token_hash FROM order_access_tokens t JOIN orders o ON o.id=t.order_id WHERE o.order_number=$1`,
        [orderNumber],
      )
    ).rows[0]!.token_hash;
    expect(storedToken).toMatch(/^[a-f0-9]{64}$/);
    expect(storedToken).not.toBe(created.json().trackingToken);
    const outbox = (
      await pool.query<{ payload: Record<string, unknown> }>(
        `SELECT payload FROM notification_outbox WHERE order_id=(SELECT id FROM orders WHERE order_number=$1)`,
        [orderNumber],
      )
    ).rows[0]!.payload;
    expect(JSON.stringify(outbox)).not.toMatch(/token|address/i);

    const changed = structuredClone(payload);
    changed.items[0]!.quantity = 3;
    const conflict = await app.inject({
      method: 'POST',
      url: '/orders',
      payload: changed,
    });
    expect(conflict.statusCode).toBe(409);
    expect(conflict.json().error.code).toBe('ORDER_ALREADY_SUBMITTED');

    const concurrent = await Promise.all(
      Array.from({ length: 5 }, () =>
        app.inject({
          method: 'POST',
          url: '/orders',
          payload: orderPayload(catalog),
        }),
      ),
    );
    expect(concurrent.every((response) => response.statusCode === 201)).toBe(
      true,
    );
    expect(
      new Set(concurrent.map((response) => response.json().orderNumber)).size,
    ).toBe(5);
  });

  test('rejects failed verification and invalid required configuration', async () => {
    const catalog = await createOrderCatalog();
    const payload = orderPayload(catalog);
    turnstile.valid = false;
    const verification = await app.inject({
      method: 'POST',
      url: '/orders',
      payload,
    });
    expect(verification.statusCode).toBe(400);
    expect(verification.json().error.code).toBe('TURNSTILE_FAILED');
    turnstile.valid = true;
    payload.items[0]!.selections = [];
    const invalid = await app.inject({
      method: 'POST',
      url: '/orders',
      payload: {
        ...payload,
        submissionKey: `submission-${crypto.randomUUID()}-${crypto.randomUUID()}`,
      },
    });
    expect(invalid.statusCode).toBe(422);
    expect(invalid.json().error).toMatchObject({
      code: 'ORDER_CONFIGURATION_INVALID',
      details: [expect.objectContaining({ field: 'items.0.selections' })],
    });
  });

  test('exchanges guest access without exposing internal data and prevents IDOR', async () => {
    const catalog = await createOrderCatalog();
    const submitted = await app.inject({
      method: 'POST',
      url: '/orders',
      payload: orderPayload(catalog),
    });
    const result = submitted.json();
    const exchange = await app.inject({
      method: 'POST',
      url: '/orders/access/exchange',
      payload: { orderNumber: result.orderNumber, token: result.trackingToken },
    });
    expect(exchange.statusCode).toBe(200);
    const guestCookie = cookieHeader(exchange);
    expect(String(exchange.headers['set-cookie'])).toContain('HttpOnly');
    expect(String(exchange.headers['set-cookie'])).toContain('SameSite=Strict');
    const orderId = (
      await pool.query<{ id: string }>(
        `SELECT id FROM orders WHERE order_number=$1`,
        [result.orderNumber],
      )
    ).rows[0]!.id;
    await pool.query(
      `INSERT INTO order_messages (order_id,sender_type,message,is_internal,created_by_admin)
       VALUES ($1,'ADMIN','private note',true,$2)`,
      [orderId, adminId],
    );
    const tracked = await app.inject({
      method: 'GET',
      url: `/orders/${result.orderNumber}`,
      headers: { cookie: guestCookie },
    });
    expect(tracked.statusCode).toBe(200);
    expect(tracked.body).not.toContain('private note');
    expect(tracked.body).not.toMatch(/submission_key|token_hash|admin_notes/i);
    const other = await app.inject({
      method: 'GET',
      url: '/orders/DLZ-2099-999999',
      headers: { cookie: guestCookie },
    });
    expect(other.statusCode).toBe(404);
    expect(other.json().error.code).toBe('ORDER_ACCESS_DENIED');
    const withoutCsrf = await app.inject({
      method: 'POST',
      url: `/orders/${result.orderNumber}/messages`,
      headers: { cookie: guestCookie, origin },
      payload: { message: '<script>alert(1)</script>' },
    });
    expect(withoutCsrf.statusCode).toBe(403);
    const sent = await app.inject({
      method: 'POST',
      url: `/orders/${result.orderNumber}/messages`,
      headers: {
        cookie: guestCookie,
        origin,
        'x-csrf-token': exchange.json().csrfToken,
      },
      payload: { message: '<script>alert(1)</script>' },
    });
    expect(sent.statusCode).toBe(200);
  });

  test('enforces versioned review, approval, payment, production and delivery transitions', async () => {
    const catalog = await createOrderCatalog();
    const submitted = await app.inject({
      method: 'POST',
      url: '/orders',
      payload: orderPayload(catalog),
    });
    const orderNumber = submitted.json().orderNumber as string;
    const orderId = (
      await pool.query<{ id: string }>(
        `SELECT id FROM orders WHERE order_number=$1`,
        [orderNumber],
      )
    ).rows[0]!.id;
    const signedIn = await login();
    const headers = {
      cookie: cookieHeader(signedIn),
      origin,
      'x-csrf-token': signedIn.json().csrfToken as string,
    };
    const review = await app.inject({
      method: 'POST',
      url: `/admin/orders/${orderId}/start-review`,
      headers,
      payload: { expectedVersion: 1 },
    });
    expect(review.json()).toMatchObject({ status: 'UNDER_REVIEW', version: 2 });
    const stale = await app.inject({
      method: 'POST',
      url: `/admin/orders/${orderId}/start-review`,
      headers,
      payload: { expectedVersion: 1 },
    });
    expect(stale.statusCode).toBe(409);
    expect(stale.json().error.code).toBe('ORDER_VERSION_CONFLICT');
    const changes = await app.inject({
      method: 'POST',
      url: `/admin/orders/${orderId}/request-changes`,
      headers,
      payload: {
        expectedVersion: 2,
        messageToCustomer: 'Please confirm the eye color.',
        requestedChanges: [
          {
            orderItemId: (
              await pool.query<{ id: string }>(
                `SELECT id FROM order_items WHERE order_id=$1`,
                [orderId],
              )
            ).rows[0]!.id,
            optionCode: 'eye-color',
            message: 'Confirm this selection.',
          },
        ],
      },
    });
    expect(changes.json()).toMatchObject({
      status: 'CHANGES_REQUESTED',
      version: 3,
    });
    const exchangeBeforeReview = await app.inject({
      method: 'POST',
      url: '/orders/access/exchange',
      payload: {
        orderNumber,
        token: submitted.json().trackingToken,
      },
    });
    const resubmitted = await app.inject({
      method: 'POST',
      url: `/orders/${orderNumber}/revisions/${changes.json().revisionId}/respond`,
      headers: {
        cookie: cookieHeader(exchangeBeforeReview),
        origin,
        'x-csrf-token': exchangeBeforeReview.json().csrfToken,
      },
      payload: {
        response: 'RESUBMIT',
        message: 'The warm brown choice is correct.',
        replacements: [
          {
            orderItemId: (
              await pool.query<{ id: string }>(
                `SELECT id FROM order_items WHERE order_id=$1`,
                [orderId],
              )
            ).rows[0]!.id,
            selections: [
              {
                optionId: catalog.optionId,
                optionValueId: catalog.optionValueId,
                customValue: null,
              },
            ],
          },
        ],
      },
    });
    expect(resubmitted.json()).toMatchObject({
      response: 'RESUBMITTED',
      status: 'UNDER_REVIEW',
    });
    const detail = await app.inject({
      method: 'GET',
      url: `/admin/orders/${orderId}`,
      headers,
    });
    const itemId = detail.json().items[0].id as string;
    const approval = await app.inject({
      method: 'POST',
      url: `/admin/orders/${orderId}/approve`,
      headers,
      payload: {
        expectedVersion: 4,
        items: [{ orderItemId: itemId, finalUnitPriceMinor: 1500 }],
        deliveryFeeMinor: 500,
        estimatedCompletionDate: '2026-10-20',
        paymentMethod: 'MANUAL',
        paymentInstructions: 'Pay by bank transfer using the order number.',
        messageToCustomer: 'Your design is ready for approval.',
      },
    });
    expect(approval.json()).toMatchObject({
      status: 'AWAITING_PAYMENT',
      version: 5,
      subtotalMinor: 3000,
      totalMinor: 3500,
    });
    const accepted = await app.inject({
      method: 'POST',
      url: `/orders/${orderNumber}/revisions/${approval.json().revisionId}/respond`,
      headers: {
        cookie: cookieHeader(exchangeBeforeReview),
        origin,
        'x-csrf-token': exchangeBeforeReview.json().csrfToken,
      },
      payload: { response: 'ACCEPT', message: null },
    });
    expect(accepted.json()).toMatchObject({
      response: 'ACCEPTED',
      status: 'AWAITING_PAYMENT',
    });
    const verify = await app.inject({
      method: 'POST',
      url: `/admin/orders/${orderId}/payments/verify`,
      headers,
      payload: {
        expectedVersion: 6,
        paymentId: approval.json().paymentId,
        externalReference: 'manual-123',
        receivedAt: '2026-09-10T12:00:00Z',
        adminNotes: '',
      },
    });
    expect(verify.json()).toMatchObject({ status: 'PAID', version: 7 });
    let version = 7;
    for (const [action, status, extra] of [
      ['START_PRODUCTION', 'IN_PRODUCTION', {}],
      ['MARK_READY', 'READY', {}],
      [
        'MARK_SHIPPED',
        'SHIPPED',
        {
          shippingMethod: 'DELIVERY',
          trackingReference: 'TRACK-1',
          trackingUrl: 'https://example.com/track/1',
        },
      ],
      ['MARK_DELIVERED', 'DELIVERED', {}],
    ] as const) {
      const response = await app.inject({
        method: 'POST',
        url: `/admin/orders/${orderId}/status`,
        headers,
        payload: { expectedVersion: version, action, ...extra },
      });
      expect(response.json()).toMatchObject({ status, version: version + 1 });
      version += 1;
    }
    const history = await pool.query(
      `SELECT new_status FROM order_status_history WHERE order_id=$1 ORDER BY created_at,id`,
      [orderId],
    );
    expect(history.rows.map((row) => row.new_status)).toEqual([
      'SUBMITTED',
      'UNDER_REVIEW',
      'CHANGES_REQUESTED',
      'UNDER_REVIEW',
      'AWAITING_PAYMENT',
      'PAID',
      'IN_PRODUCTION',
      'READY',
      'SHIPPED',
      'DELIVERED',
    ]);
  });
});
