import { readFileSync } from 'node:fs';
import { copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Pool } from 'pg';
import { CatalogService } from '../../../apps/api/src/modules/catalog/service.js';
import { MediaStorageService } from '../../../apps/api/src/modules/media/storage-service.js';

const adminId = process.argv[2];
const imagePath = process.argv[3];

if (!adminId || !imagePath) {
  console.error(
    'Usage: tsx replace-build-your-own-image.ts <admin-user-id> <image-path>',
  );
  process.exit(1);
}

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDirectory, '../../..');
const apiStorageRoot = path.join(repoRoot, 'apps/api/storage');
const storefrontImagePath = path.join(
  repoRoot,
  'apps/web/public/images/build-your-own.webp',
);
const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ??
    'postgresql://dollz:dollz@localhost:55432/dollz',
});

async function main() {
  const productResult = await pool.query<{ id: string }>(
    'SELECT id FROM products WHERE slug=$1',
    ['build-your-own-doll'],
  );
  const product = productResult.rows[0];
  if (!product) throw new Error('Build Your Own Doll was not found.');

  const catalog = new CatalogService(pool);
  const storage = new MediaStorageService(pool, apiStorageRoot, {
    maxUploadBytes: 10_485_760,
    maxPixels: 100_000_000,
    maxDimension: 10_000,
    optimizedMaxWidth: 2000,
    thumbnailWidth: 400,
  });
  const previousMedia = await catalog.listMedia(product.id);
  const file = await storage.upload({
    buffer: readFileSync(imagePath),
    mimeType: 'image/png',
    originalName: 'build-your-own-collection.png',
    category: 'PRODUCT',
    visibility: 'PUBLIC',
    adminId,
  });
  const newMedia = await catalog.addMedia(
    product.id,
    {
      fileId: file.id,
      altText:
        'A collection of luxury handmade personalized dolls displayed with Dollz gift packaging',
      sortOrder: 0,
    },
    adminId,
  );
  await catalog.setPrimaryMedia(product.id, newMedia.id, adminId);

  for (const media of previousMedia) {
    await catalog.removeMedia(product.id, media.id, adminId);
  }

  const keyResult = await pool.query<{ optimized_storage_key: string }>(
    'SELECT optimized_storage_key FROM files WHERE id=$1',
    [file.id],
  );
  const optimizedKey = keyResult.rows[0]?.optimized_storage_key;
  if (!optimizedKey) throw new Error('Optimized storefront image was not created.');
  const optimizedPath = path.resolve(
    apiStorageRoot,
    ...optimizedKey.split('/'),
  );
  await copyFile(optimizedPath, storefrontImagePath);

  console.log(
    `Replaced Build Your Own Doll image with media ${file.id} and updated ${storefrontImagePath}.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
