import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Pool } from 'pg';
import { CatalogService } from '../../../apps/api/src/modules/catalog/service.js';
import { MediaStorageService } from '../../../apps/api/src/modules/media/storage-service.js';

const adminId = process.argv[2];
const imagePath = process.argv[3];

if (!adminId || !imagePath) {
  console.error('Usage: tsx seed-rita-maria.ts <admin-user-id> <image-path>');
  process.exit(1);
}

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDirectory, '../../..');
const apiStorageRoot = path.join(repoRoot, 'apps/api/storage');
const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ??
    'postgresql://dollz:dollz@localhost:55432/dollz',
});

async function main() {
  const existing = await pool.query<{ id: string }>(
    'SELECT id FROM products WHERE slug=$1',
    ['rita-maria'],
  );
  if (existing.rowCount) {
    console.log(`Rita Maria already exists (${existing.rows[0].id}).`);
    return;
  }

  const catalog = new CatalogService(pool);
  const media = new MediaStorageService(pool, apiStorageRoot, {
    maxUploadBytes: 10_485_760,
    maxPixels: 100_000_000,
    maxDimension: 10_000,
    optimizedMaxWidth: 2000,
    thumbnailWidth: 400,
  });

  const file = await media.upload({
    buffer: readFileSync(imagePath),
    mimeType: 'image/png',
    originalName: 'rita-maria.png',
    category: 'PRODUCT',
    visibility: 'PUBLIC',
    adminId,
  });

  const product = await catalog.createProduct(
    {
      name: 'Rita Maria',
      slug: 'rita-maria',
      shortDescription:
        'A sweet handmade doll with brunette curls, a matching pink bow, and a heart-detailed dress.',
      description:
        'Meet Rita Maria, a handmade cloth doll with glossy brunette curls, delicate embroidered features, and a matching pink bow. Her soft rose dress is scattered with tiny hearts and finished with a name embroidered especially for its recipient.',
      startingPriceMinor: 7900,
      currency: 'USD',
      productionMinDays: 10,
      productionMaxDays: 21,
      isFeatured: true,
      seoTitle: 'Rita Maria personalized handmade doll',
      seoDescription:
        'Personalize Rita Maria, a handmade cloth doll with brunette curls, a pink bow, a heart-detailed dress, and an embroidered name.',
    },
    adminId,
  );
  if (!product) throw new Error('Could not create Rita Maria.');

  await catalog.addMedia(
    product.id,
    {
      fileId: file.id,
      altText:
        'Rita Maria handmade doll in a pink heart-detailed dress with brunette curls and a matching bow',
      sortOrder: 0,
    },
    adminId,
  );
  const [primaryMedia] = await catalog.listMedia(product.id);
  if (!primaryMedia) throw new Error('Could not attach Rita Maria media.');
  await catalog.setPrimaryMedia(product.id, primaryMedia.id, adminId);

  const classic = await catalog.createVariant(
    product.id,
    {
      sku: 'RITA-MARIA-25',
      name: 'Classic 25 cm',
      sizeLabel: '25 cm',
      sizeCm: 25,
      priceMinor: 7900,
      currency: 'USD',
      modelKey: null,
      previewFileId: null,
      isActive: true,
      sortOrder: 0,
    },
    adminId,
  );
  const signature = await catalog.createVariant(
    product.id,
    {
      sku: 'RITA-MARIA-40',
      name: 'Signature 40 cm',
      sizeLabel: '40 cm',
      sizeCm: 40,
      priceMinor: 9900,
      currency: 'USD',
      modelKey: null,
      previewFileId: null,
      isActive: true,
      sortOrder: 1,
    },
    adminId,
  );
  if (!classic || !signature) {
    throw new Error('Could not create Rita Maria sizes.');
  }
  await catalog.setDefaultVariant(product.id, signature.id, adminId);

  await catalog.createOption(
    product.id,
    {
      code: 'embroidered-name',
      name: 'Embroidered name',
      description:
        'The name stitched onto Rita Maria’s dress, up to 20 characters.',
      inputType: 'TEXT',
      isRequired: true,
      isActive: true,
      affects3d: false,
      threeDProperty: null,
      allowCustomValue: false,
      sortOrder: 0,
    },
    adminId,
  );

  const checklist = await catalog.publishingChecklist(product.id);
  if (!checklist.publishable) {
    throw new Error(
      `Rita Maria is not publishable: ${JSON.stringify(checklist.details)}`,
    );
  }
  await catalog.publish(product.id, adminId);
  console.log(`Published Rita Maria (${product.id}) with media ${file.id}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
