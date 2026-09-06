import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Pool } from '@dollz/database';
import sharp from 'sharp';
import { describe, expect, test } from 'vitest';
import type { CatalogError } from '../src/modules/catalog/errors.js';
import {
  keyFor,
  MediaStorageService,
  processImage,
  safeOriginalName,
} from '../src/modules/media/storage-service.js';

const limits = {
  maxUploadBytes: 1_000_000,
  maxPixels: 1_000_000,
  maxDimension: 1_000,
  optimizedMaxWidth: 800,
  thumbnailWidth: 64,
};
const sourceSvg = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><rect width="1" height="1" fill="#6f315f"/></svg>',
);
const makePng = () => sharp(sourceSvg).png().toBuffer();

function fakePool(failInsert = false) {
  let insertParameters: unknown[] = [];
  const client = {
    async query(sql: string, parameters: unknown[] = []) {
      if (sql.includes('INSERT INTO files')) {
        if (failInsert) throw new Error('database unavailable');
        insertParameters = parameters;
        return {
          rowCount: 1,
          rows: [
            {
              id: parameters[0],
              storage_key: parameters[1],
              optimized_storage_key: parameters[2],
              thumbnail_storage_key: parameters[3],
              original_name: parameters[4],
              mime_type: 'image/webp',
              processed_mime_type: 'image/webp',
              size_bytes: parameters[5],
              checksum_sha256: parameters[6],
              category: parameters[7],
              visibility: parameters[8],
              width: parameters[9],
              height: parameters[10],
              deleted_at: null,
              created_at: new Date(),
            },
          ],
        };
      }
      return { rowCount: 1, rows: [] };
    },
    release() {},
  };
  return {
    pool: { connect: async () => client } as unknown as Pool,
    parameters: () => insertParameters,
  };
}

async function filesBelow(root: string) {
  const entries = await readdir(root, { recursive: true, withFileTypes: true });
  return entries.filter((entry) => entry.isFile());
}

async function expectCode(action: Promise<unknown>, code: string) {
  await expect(action).rejects.toMatchObject<CatalogError>({ code });
}

describe('secure image processing', () => {
  test.each([
    ['image/png', () => sharp(sourceSvg).png().toBuffer()],
    ['image/jpeg', () => sharp(sourceSvg).jpeg().toBuffer()],
    ['image/webp', () => sharp(sourceSvg).webp().toBuffer()],
  ])(
    'decodes %s and emits normalized WebP renditions',
    async (mime, source) => {
      const processed = await processImage(await source(), mime, limits);
      expect(processed.width).toBe(1);
      expect(processed.height).toBe(1);
      for (const rendition of [
        processed.original,
        processed.optimized,
        processed.thumbnail,
      ]) {
        expect(await sharp(rendition).metadata()).toMatchObject({
          format: 'webp',
        });
      }
    },
  );

  test('rejects spoofed, unsupported, corrupt, oversized, and over-dimension images', async () => {
    const png = await makePng();
    await expectCode(processImage(png, 'image/jpeg', limits), 'INVALID_FILE');
    await expectCode(
      processImage(Buffer.from('<svg/>'), 'image/svg+xml', limits),
      'UNSUPPORTED_FILE_TYPE',
    );
    await expectCode(
      processImage(
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
        'image/png',
        limits,
      ),
      'IMAGE_DECODE_FAILED',
    );
    await expectCode(
      processImage(png, 'image/png', { ...limits, maxUploadBytes: 4 }),
      'FILE_TOO_LARGE',
    );
    const larger = await sharp(
      Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="#6f315f"/></svg>',
      ),
    )
      .png()
      .toBuffer();
    await expectCode(
      processImage(larger, 'image/png', { ...limits, maxDimension: 10 }),
      'IMAGE_TOO_LARGE',
    );
  });

  test('removes client paths and generates server-controlled random keys', () => {
    expect(safeOriginalName('../../secret\u0000 photo.png')).toBe(
      'secret photo.png',
    );
    const first = keyFor('PRODUCT', 'optimized', crypto.randomUUID());
    const second = keyFor('PRODUCT', 'optimized', crypto.randomUUID());
    expect(first).toMatch(
      /^products\/optimized\/\d{4}\/\d{2}\/[0-9a-f-]+\.webp$/,
    );
    expect(second).not.toBe(first);
    expect(first).not.toContain('secret');
  });

  test('writes three derivatives with metadata and checksum, then clears temporary files', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'dollz-storage-'));
    const database = fakePool();
    try {
      const service = new MediaStorageService(database.pool, root, limits);
      const media = await service.upload({
        buffer: await makePng(),
        mimeType: 'image/png',
        originalName: '../../classic.png',
        category: 'PRODUCT',
        visibility: 'PUBLIC',
        adminId: crypto.randomUUID(),
      });
      expect(media).toMatchObject({
        originalName: 'classic.png',
        mimeType: 'image/webp',
        width: 1,
        height: 1,
      });
      expect(String(database.parameters()[6])).toMatch(/^[0-9a-f]{64}$/);
      expect((await filesBelow(root)).length).toBe(3);
      expect((await readdir(path.join(root, '.tmp'))).length).toBe(0);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test('removes only new derivatives after a database failure', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'dollz-storage-fail-'));
    try {
      const service = new MediaStorageService(
        fakePool(true).pool,
        root,
        limits,
      );
      await expect(
        service.upload({
          buffer: await makePng(),
          mimeType: 'image/png',
          originalName: 'classic.png',
          category: 'PRODUCT',
          visibility: 'PUBLIC',
          adminId: crypto.randomUUID(),
        }),
      ).rejects.toThrow('database unavailable');
      expect(await filesBelow(root)).toHaveLength(0);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test('creates no storage artifacts when processing fails', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'dollz-storage-bad-'));
    try {
      const service = new MediaStorageService(fakePool().pool, root, limits);
      await expectCode(
        service.upload({
          buffer: Buffer.from('<svg/>'),
          mimeType: 'image/svg+xml',
          originalName: 'unsafe.svg',
          category: 'PRODUCT',
          visibility: 'PUBLIC',
          adminId: crypto.randomUUID(),
        }),
        'UNSUPPORTED_FILE_TYPE',
      );
      expect(await readdir(root)).toHaveLength(0);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test('serves only resolved public derivatives and rejects unavailable records', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'dollz-delivery-'));
    try {
      const bytes = await sharp(sourceSvg).webp().toBuffer();
      await writeFile(path.join(root, 'image.webp'), bytes);
      const publicPool = {
        query: async () => ({
          rowCount: 1,
          rows: [
            {
              storage_key: 'image.webp',
              processed_mime_type: 'image/webp',
            },
          ],
        }),
      } as unknown as Pool;
      const result = await new MediaStorageService(
        publicPool,
        root,
        limits,
      ).openPublic(crypto.randomUUID(), 'thumbnail');
      expect(result).toMatchObject({
        size: bytes.length,
        mimeType: 'image/webp',
      });
      result.stream.destroy();

      const unavailablePool = {
        query: async () => ({ rowCount: 0, rows: [] }),
      } as unknown as Pool;
      await expectCode(
        new MediaStorageService(unavailablePool, root, limits).openPublic(
          crypto.randomUUID(),
          'optimized',
        ),
        'NOT_FOUND',
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
