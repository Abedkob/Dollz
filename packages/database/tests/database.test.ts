import { appendFile, cp, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import {
  closePool,
  createPool,
  getMigrationStatus,
  migrate,
  readTestDatabaseConfig,
  rollbackLatest,
  withTransaction,
} from '../src/index.js';

const migrationsDirectory = fileURLToPath(
  new URL('../migrations', import.meta.url),
);
let pool: Pool;
let setupComplete = false;

async function expectConstraint(action: Promise<unknown>, code = '23514') {
  await expect(action).rejects.toMatchObject({ code });
}

async function createProduct(overrides: Record<string, unknown> = {}) {
  const values = {
    name: 'Classic Doll',
    slug: `classic-${crypto.randomUUID()}`,
    startingPrice: 1000,
    currency: 'USD',
    minDays: 2,
    maxDays: 5,
    status: 'DRAFT',
    ...overrides,
  };
  return (
    await pool.query<{ id: string }>(
      `INSERT INTO products (name, slug, starting_price_minor, currency, production_min_days, production_max_days, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [
        values.name,
        values.slug,
        values.startingPrice,
        values.currency,
        values.minDays,
        values.maxDays,
        values.status,
      ],
    )
  ).rows[0]!.id;
}

async function createFile(storageKey = `file/${crypto.randomUUID()}`) {
  return (
    await pool.query<{ id: string }>(
      `INSERT INTO files (storage_key, original_name, mime_type, extension, size_bytes, checksum_sha256, category, visibility)
       VALUES ($1,'photo.jpg','image/jpeg','jpg',10,$2,'PRODUCT','PUBLIC') RETURNING id`,
      [storageKey, 'a'.repeat(64)],
    )
  ).rows[0]!.id;
}

async function createOrder() {
  return (
    await pool.query<{ id: string }>(
      `INSERT INTO orders (order_number, customer_name, customer_email, preferred_contact_method,
        delivery_address_line1, delivery_city, delivery_country_code, currency)
       VALUES ($1,'Customer','customer@example.com','EMAIL','Street 1','Beirut','LB','USD') RETURNING id`,
      [`D-${crypto.randomUUID()}`],
    )
  ).rows[0]!.id;
}

beforeAll(async () => {
  const config = readTestDatabaseConfig();
  expect(config.connectionString).toBe(process.env.TEST_DATABASE_URL);
  expect(config.connectionString).not.toBe(process.env.DATABASE_URL);
  pool = createPool(config);
  try {
    await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
    await migrate(pool);
    setupComplete = true;
  } catch (error) {
    await closePool(pool);
    throw new Error(
      `PostgreSQL integration-test setup failed. Start it with "docker compose up -d postgres" and set TEST_DATABASE_URL. ${String(error)}`,
      { cause: error },
    );
  }
});

afterAll(async () => {
  if (pool && setupComplete) {
    await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
    await closePool(pool);
  }
});

describe('migration runner', () => {
  test('applies every migration and creates all expected tables', async () => {
    const expected = [
      'schema_migrations',
      'admin_users',
      'admin_sessions',
      'files',
      'products',
      'product_variants',
      'product_media',
      'product_options',
      'product_option_values',
      'option_value_conflicts',
      'orders',
      'order_items',
      'order_item_selections',
      'order_revisions',
      'order_access_tokens',
      'order_guest_sessions',
      'payments',
      'order_status_history',
      'order_messages',
      'notification_outbox',
      'audit_logs',
    ];
    const result = await pool.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema='public'`,
    );
    expect(result.rows.map((row) => row.table_name)).toEqual(
      expect.arrayContaining(expected),
    );
    expect(
      (await getMigrationStatus(pool)).every(
        (item) => item.state === 'applied',
      ),
    ).toBe(true);
  });

  test('is idempotent', async () => {
    expect(await migrate(pool)).toEqual([]);
  });

  test('adds editable catalog versions and managed image derivative metadata', async () => {
    const result = await pool.query<{
      table_name: string;
      column_name: string;
    }>(
      `SELECT table_name,column_name FROM information_schema.columns
       WHERE table_schema='public' AND (table_name,column_name) IN (
         ('products','version'),('products','published_at'),
         ('product_variants','version'),('product_media','caption'),('product_media','version'),
         ('product_options','version'),('product_option_values','version'),
         ('files','optimized_storage_key'),('files','thumbnail_storage_key'),
         ('files','processed_mime_type'),('files','processing_metadata'))`,
    );
    expect(result.rows).toHaveLength(11);
  });

  test('rejects a changed checksum', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'dollz-migrations-'));
    try {
      await cp(migrationsDirectory, directory, { recursive: true });
      await appendFile(
        path.join(directory, '001_extensions.up.sql'),
        '\n-- changed\n',
      );
      await expect(migrate(pool, directory)).rejects.toThrow(
        'checksum has changed',
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  test('rolls back and reapplies the latest migration', async () => {
    expect(await rollbackLatest(pool)).toBe(15);
    expect((await getMigrationStatus(pool)).at(-1)?.state).toBe('pending');
    expect(await migrate(pool)).toEqual([15]);
  });

  test('advisory lock serializes concurrent migration runs', async () => {
    const lock = await pool.connect();
    await lock.query('SELECT pg_advisory_lock($1::bigint)', [6_849_042_321]);
    const blocked = migrate(pool);
    const state = await Promise.race([
      blocked.then(() => 'finished'),
      new Promise<string>((resolve) =>
        setTimeout(() => resolve('blocked'), 100),
      ),
    ]);
    expect(state).toBe('blocked');
    await lock.query('SELECT pg_advisory_unlock($1::bigint)', [6_849_042_321]);
    lock.release();
    await expect(blocked).resolves.toEqual([]);
  });
});

describe('catalog constraints', () => {
  test('enforces unique slugs and SKUs', async () => {
    const productId = await createProduct({ slug: 'unique-slug' });
    await expectConstraint(createProduct({ slug: 'unique-slug' }), '23505');
    await pool.query(
      `INSERT INTO product_variants (product_id,sku,name,price_minor,currency) VALUES ($1,'SKU-1','Small',1000,'USD')`,
      [productId],
    );
    const other = await createProduct();
    await expectConstraint(
      pool.query(
        `INSERT INTO product_variants (product_id,sku,name,price_minor,currency) VALUES ($1,'SKU-1','Large',1200,'USD')`,
        [other],
      ),
      '23505',
    );
  });

  test('allows only one active default variant and one primary media item', async () => {
    const productId = await createProduct();
    await pool.query(
      `INSERT INTO product_variants (product_id,sku,name,price_minor,currency,is_default) VALUES ($1,$2,'A',100,'USD',true)`,
      [productId, crypto.randomUUID()],
    );
    await expectConstraint(
      pool.query(
        `INSERT INTO product_variants (product_id,sku,name,price_minor,currency,is_default) VALUES ($1,$2,'B',100,'USD',true)`,
        [productId, crypto.randomUUID()],
      ),
      '23505',
    );
    const file1 = await createFile();
    const file2 = await createFile();
    await pool.query(
      `INSERT INTO product_media (product_id,file_id,media_type,is_primary) VALUES ($1,$2,'IMAGE',true)`,
      [productId, file1],
    );
    await expectConstraint(
      pool.query(
        `INSERT INTO product_media (product_id,file_id,media_type,is_primary) VALUES ($1,$2,'IMAGE',true)`,
        [productId, file2],
      ),
      '23505',
    );
  });

  test('validates options, colors, defaults, and unordered conflicts', async () => {
    const productId = await createProduct();
    await expectConstraint(
      pool.query(
        `INSERT INTO product_options (product_id,code,name,input_type,affects_3d) VALUES ($1,'hair','Hair','SELECT',true)`,
        [productId],
      ),
    );
    const optionId = (
      await pool.query<{ id: string }>(
        `INSERT INTO product_options (product_id,code,name,input_type) VALUES ($1,'eyes','Eyes','COLOR') RETURNING id`,
        [productId],
      )
    ).rows[0]!.id;
    await expectConstraint(
      pool.query(
        `INSERT INTO product_option_values (product_option_id,code,label,color_hex) VALUES ($1,'bad','Bad','123456')`,
        [optionId],
      ),
    );
    const first = (
      await pool.query<{ id: string }>(
        `INSERT INTO product_option_values (product_option_id,code,label,color_hex,is_default) VALUES ($1,'brown','Brown','#AABBCC',true) RETURNING id`,
        [optionId],
      )
    ).rows[0]!.id;
    await expectConstraint(
      pool.query(
        `INSERT INTO product_option_values (product_option_id,code,label,is_default) VALUES ($1,'blue','Blue',true)`,
        [optionId],
      ),
      '23505',
    );
    const second = (
      await pool.query<{ id: string }>(
        `INSERT INTO product_option_values (product_option_id,code,label) VALUES ($1,'green','Green') RETURNING id`,
        [optionId],
      )
    ).rows[0]!.id;
    await expectConstraint(
      pool.query(
        `INSERT INTO option_value_conflicts (first_value_id,second_value_id) VALUES ($1,$1)`,
        [first],
      ),
    );
    await pool.query(
      `INSERT INTO option_value_conflicts (first_value_id,second_value_id) VALUES ($1,$2)`,
      [first, second],
    );
    await expectConstraint(
      pool.query(
        `INSERT INTO option_value_conflicts (first_value_id,second_value_id) VALUES ($1,$2)`,
        [second, first],
      ),
      '23505',
    );
  });

  test('rejects invalid catalog states, prices, and production ranges', async () => {
    await expectConstraint(createProduct({ status: 'BROKEN' }));
    await expectConstraint(createProduct({ startingPrice: -1 }));
    await expectConstraint(createProduct({ minDays: 5, maxDays: 2 }));
  });

  test('maintains updated_at in PostgreSQL', async () => {
    const id = await createProduct();
    const before = (
      await pool.query<{ updated_at: Date }>(
        'SELECT updated_at FROM products WHERE id=$1',
        [id],
      )
    ).rows[0]!.updated_at;
    await pool.query('SELECT pg_sleep(0.01)');
    const after = (
      await pool.query<{ updated_at: Date }>(
        `UPDATE products SET name='Changed' WHERE id=$1 RETURNING updated_at`,
        [id],
      )
    ).rows[0]!.updated_at;
    expect(after.getTime()).toBeGreaterThan(before.getTime());
  });
});

describe('order history and constraints', () => {
  test('rejects invalid order/payment states, negative money, and internal customer messages', async () => {
    await expectConstraint(
      pool.query(
        `INSERT INTO orders (order_number,customer_name,customer_email,preferred_contact_method,delivery_address_line1,delivery_city,delivery_country_code,currency,status) VALUES ('BAD','C','c@e.com','EMAIL','x','x','LB','USD','BAD')`,
      ),
    );
    await expectConstraint(createProduct({ startingPrice: -10 }));
    const orderId = await createOrder();
    await expectConstraint(
      pool.query(
        `INSERT INTO payments (order_id,method,status,amount_minor,currency) VALUES ($1,'CASH','BAD',100,'USD')`,
        [orderId],
      ),
    );
    await expectConstraint(
      pool.query(
        `INSERT INTO payments (order_id,method,status,amount_minor,currency) VALUES ($1,'CASH','PENDING',-1,'USD')`,
        [orderId],
      ),
    );
    await expectConstraint(
      pool.query(
        `INSERT INTO order_messages (order_id,sender_type,message,is_internal) VALUES ($1,'CUSTOMER','secret',true)`,
        [orderId],
      ),
    );
  });

  test('cascades owned order data on deletion', async () => {
    const orderId = await createOrder();
    const itemId = (
      await pool.query<{ id: string }>(
        `INSERT INTO order_items (order_id,product_name_snapshot,product_slug_snapshot,variant_name_snapshot,variant_sku_snapshot,quantity,estimated_unit_price_minor) VALUES ($1,'Doll','doll','Small','SKU',1,100) RETURNING id`,
        [orderId],
      )
    ).rows[0]!.id;
    await pool.query(
      `INSERT INTO order_item_selections (order_item_id,option_code_snapshot,option_name_snapshot,value_label_snapshot) VALUES ($1,'name','Name','Lina')`,
      [itemId],
    );
    await pool.query(
      `INSERT INTO order_revisions (order_id,revision_number,revision_type,configuration_snapshot) VALUES ($1,1,'APPROVAL','{}')`,
      [orderId],
    );
    await pool.query(
      `INSERT INTO order_access_tokens (order_id,token_hash,purpose,expires_at) VALUES ($1,$2,'TRACK_ORDER',NOW()+INTERVAL '1 day')`,
      [orderId, crypto.randomUUID()],
    );
    await pool.query(
      `INSERT INTO order_messages (order_id,sender_type,message) VALUES ($1,'CUSTOMER','Hello')`,
      [orderId],
    );
    await pool.query(
      `INSERT INTO order_status_history (order_id,new_status) VALUES ($1,'SUBMITTED')`,
      [orderId],
    );
    await pool.query('DELETE FROM orders WHERE id=$1', [orderId]);
    for (const table of [
      'order_items',
      'order_item_selections',
      'order_revisions',
      'order_access_tokens',
      'order_messages',
      'order_status_history',
    ]) {
      expect(
        Number(
          (await pool.query(`SELECT COUNT(*) FROM ${table}`)).rows[0].count,
        ),
      ).toBe(0);
    }
  });

  test('restricts deletion with payments', async () => {
    const orderId = await createOrder();
    await pool.query(
      `INSERT INTO payments (order_id,method,status,amount_minor,currency) VALUES ($1,'CASH','PENDING',100,'USD')`,
      [orderId],
    );
    await expectConstraint(
      pool.query('DELETE FROM orders WHERE id=$1', [orderId]),
      '23503',
    );
  });

  test('catalog deletion preserves order snapshots', async () => {
    const productId = await createProduct();
    const variantId = (
      await pool.query<{ id: string }>(
        `INSERT INTO product_variants (product_id,sku,name,price_minor,currency) VALUES ($1,$2,'Small',100,'USD') RETURNING id`,
        [productId, crypto.randomUUID()],
      )
    ).rows[0]!.id;
    const orderId = await createOrder();
    const itemId = (
      await pool.query<{ id: string }>(
        `INSERT INTO order_items (order_id,source_product_id,source_variant_id,product_name_snapshot,product_slug_snapshot,variant_name_snapshot,variant_sku_snapshot,quantity,estimated_unit_price_minor) VALUES ($1,$2,$3,'Doll','doll','Small','SKU',1,100) RETURNING id`,
        [orderId, productId, variantId],
      )
    ).rows[0]!.id;
    await pool.query('DELETE FROM products WHERE id=$1', [productId]);
    const item = (
      await pool.query('SELECT * FROM order_items WHERE id=$1', [itemId])
    ).rows[0];
    expect(item.product_name_snapshot).toBe('Doll');
    expect(item.source_product_id).toBeNull();
    expect(item.source_variant_id).toBeNull();
  });

  test('administrator deletion nulls historical references', async () => {
    const adminId = (
      await pool.query<{ id: string }>(
        `INSERT INTO admin_users (email,password_hash) VALUES ($1,'hash') RETURNING id`,
        [`${crypto.randomUUID()}@example.com`],
      )
    ).rows[0]!.id;
    const orderId = await createOrder();
    const auditId = (
      await pool.query<{ id: string }>(
        `INSERT INTO audit_logs (admin_user_id,action,entity_type) VALUES ($1,'CREATE','ORDER') RETURNING id`,
        [adminId],
      )
    ).rows[0]!.id;
    const historyId = (
      await pool.query<{ id: string }>(
        `INSERT INTO order_status_history (order_id,new_status,changed_by) VALUES ($1,'SUBMITTED',$2) RETURNING id`,
        [orderId, adminId],
      )
    ).rows[0]!.id;
    await pool.query('DELETE FROM admin_users WHERE id=$1', [adminId]);
    expect(
      (
        await pool.query('SELECT admin_user_id FROM audit_logs WHERE id=$1', [
          auditId,
        ])
      ).rows[0].admin_user_id,
    ).toBeNull();
    expect(
      (
        await pool.query(
          'SELECT changed_by FROM order_status_history WHERE id=$1',
          [historyId],
        )
      ).rows[0].changed_by,
    ).toBeNull();
  });
});

test('transaction helper rolls back all partial work', async () => {
  const slug = `rollback-${crypto.randomUUID()}`;
  await expect(
    withTransaction(pool, async (client) => {
      await client.query(
        `INSERT INTO products (name,slug,starting_price_minor,currency,production_min_days,production_max_days) VALUES ('Rollback',$1,100,'USD',1,2)`,
        [slug],
      );
      throw new Error('stop');
    }),
  ).rejects.toThrow('stop');
  expect(
    Number(
      (await pool.query('SELECT COUNT(*) FROM products WHERE slug=$1', [slug]))
        .rows[0].count,
    ),
  ).toBe(0);
});

test('all monetary columns use integer database types', async () => {
  const result = await pool.query<{
    table_name: string;
    column_name: string;
    data_type: string;
  }>(`
    SELECT table_name,column_name,data_type FROM information_schema.columns
    WHERE table_schema='public' AND (column_name LIKE '%_minor' OR column_name LIKE '%_minor_snapshot')
  `);
  expect(result.rows.length).toBeGreaterThan(0);
  expect(
    result.rows.every((row) =>
      ['integer', 'bigint', 'smallint'].includes(row.data_type),
    ),
  ).toBe(true);
});
