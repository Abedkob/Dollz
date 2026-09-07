// One-off dev script: creates the real "Build Your Own Doll" catalog product
// via the actual CatalogService/MediaStorageService (same code path the
// admin API runs on), so /customize has a real product to link to.
//
// Deliberately NOT created here (need real photography, not fabricated):
//   - Hair type (IMAGE_CARD option)
//   - Available dresses / dress style (IMAGE_CARD option)
// Add those later through the admin panel once real photos exist.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Pool } from 'pg';
import { CatalogService } from '../../../apps/api/src/modules/catalog/service.js';
import { MediaStorageService } from '../../../apps/api/src/modules/media/storage-service.js';

const ADMIN_ID = process.argv[2];
if (!ADMIN_ID) {
  console.error('Usage: tsx seed-build-your-own.ts <admin-user-id>');
  process.exit(1);
}

// Resolve paths from this file's own location, not process.cwd() -- the
// real API process always resolves STORAGE_ROOT relative to apps/api, and
// this script must write to that exact same directory regardless of which
// directory it happens to be invoked from.
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDirectory, '../../..');
const apiStorageRoot = path.join(repoRoot, 'apps/api/storage');
const referencePhotoPath = path.join(
  repoRoot,
  'apps/web/public/images/build-your-own.webp',
);

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ??
    'postgresql://dollz:dollz@localhost:55432/dollz',
});

async function main() {
  const catalog = new CatalogService(pool);
  const media = new MediaStorageService(pool, apiStorageRoot, {
    maxUploadBytes: 10_485_760,
    maxPixels: 100_000_000,
    maxDimension: 10_000,
    optimizedMaxWidth: 2000,
    thumbnailWidth: 400,
  });

  const photoBuffer = readFileSync(referencePhotoPath);
  const file = await media.upload({
    buffer: photoBuffer,
    mimeType: 'image/webp',
    originalName: 'build-your-own.webp',
    category: 'PRODUCT',
    visibility: 'PUBLIC',
    adminId: ADMIN_ID,
  });
  console.log('uploaded media', file.id);

  const product = await catalog.createProduct(
    {
      name: 'Build Your Own Doll',
      slug: 'build-your-own-doll',
      shortDescription: 'A doll designed entirely your way.',
      description:
        'Choose her name, eye color, hair color, and dress color. Every choice becomes a real, one-of-a-kind commission -- not just a preview.',
      startingPriceMinor: 6900,
      currency: 'USD',
      productionMinDays: 10,
      productionMaxDays: 21,
      isFeatured: true,
      seoTitle: null,
      seoDescription: null,
    },
    ADMIN_ID,
  );
  if (!product) throw new Error('createProduct failed');
  console.log('product', product.id, product.slug);

  await catalog.addMedia(
    product.id,
    { fileId: file.id, altText: 'A handmade Dollz doll', sortOrder: 0 },
    ADMIN_ID,
  );
  const mediaList = await catalog.listMedia(product.id);
  const primary = mediaList[0] as { id: string };
  await catalog.setPrimaryMedia(product.id, primary.id, ADMIN_ID);
  console.log('primary media set');

  const variant25 = await catalog.createVariant(
    product.id,
    {
      sku: `BUILD-YOUR-OWN-25-${Date.now()}`,
      name: 'Classic 25 cm',
      sizeLabel: '25 cm',
      sizeCm: 25,
      priceMinor: 6900,
      currency: 'USD',
      modelKey: null,
      previewFileId: null,
      isActive: true,
      sortOrder: 0,
    },
    ADMIN_ID,
  );
  const variant40 = await catalog.createVariant(
    product.id,
    {
      sku: `BUILD-YOUR-OWN-40-${Date.now()}`,
      name: 'Signature 40 cm',
      sizeLabel: '40 cm',
      sizeCm: 40,
      priceMinor: 8900,
      currency: 'USD',
      modelKey: null,
      previewFileId: null,
      isActive: true,
      sortOrder: 1,
    },
    ADMIN_ID,
  );
  if (!variant25 || !variant40) throw new Error('createVariant failed');
  await catalog.setDefaultVariant(product.id, variant40.id, ADMIN_ID);
  console.log('variants', variant25.id, variant40.id);

  // Doll name -- required text, drives the embroidered name.
  await catalog.createOption(
    product.id,
    {
      code: 'doll-name',
      name: 'Name',
      description: 'The name stitched onto the doll.',
      inputType: 'TEXT',
      isRequired: true,
      isActive: true,
      affects3d: false,
      threeDProperty: null,
      allowCustomValue: false,
      sortOrder: 0,
    },
    ADMIN_ID,
  );

  async function colorOption(
    code: string,
    name: string,
    sortOrder: number,
    values: Array<{ code: string; label: string; colorHex: string }>,
  ) {
    const option = await catalog.createOption(
      product.id,
      {
        code,
        name,
        description: `Choose the ${name.toLowerCase()}, or pick any color.`,
        inputType: 'COLOR',
        isRequired: true,
        isActive: true,
        affects3d: false,
        threeDProperty: null,
        allowCustomValue: true,
        sortOrder,
      },
      ADMIN_ID,
    );
    if (!option) throw new Error(`createOption failed for ${code}`);
    let defaultValueId = '';
    for (const [index, v] of values.entries()) {
      const value = await catalog.createValue(
        product.id,
        option.id,
        {
          code: v.code,
          label: v.label,
          description: null,
          colorHex: v.colorHex,
          referenceFileId: null,
          priceAdjustmentMinor: 0,
          metadata: {},
          isActive: true,
          sortOrder: index,
        },
        ADMIN_ID,
      );
      if (!value) throw new Error(`createValue failed for ${code}/${v.code}`);
      if (index === 0) defaultValueId = value.id;
    }
    if (defaultValueId)
      await catalog.setDefaultValue(
        product.id,
        option.id,
        defaultValueId,
        ADMIN_ID,
      );
    console.log('option', code, 'created with', values.length, 'values');
  }

  await colorOption('eye-color', 'Eye color', 1, [
    { code: 'warm-brown', label: 'Warm brown', colorHex: '#6F4A3A' },
    { code: 'soft-blue', label: 'Soft blue', colorHex: '#6F91B2' },
    { code: 'sage-green', label: 'Sage green', colorHex: '#78866B' },
    { code: 'hazel', label: 'Hazel', colorHex: '#96775A' },
  ]);

  await colorOption('hair-color', 'Hair color', 2, [
    { code: 'espresso', label: 'Espresso', colorHex: '#3B2923' },
    { code: 'chestnut', label: 'Chestnut', colorHex: '#70452F' },
    { code: 'honey-blonde', label: 'Honey blonde', colorHex: '#C9A66B' },
    { code: 'copper', label: 'Copper', colorHex: '#A95C3D' },
    { code: 'soft-black', label: 'Soft black', colorHex: '#252326' },
  ]);

  await colorOption('dress-color', 'Dress color', 3, [
    { code: 'plum', label: 'Plum', colorHex: '#6F315F' },
    { code: 'rose', label: 'Dusty rose', colorHex: '#C9828D' },
    { code: 'sage', label: 'Sage', colorHex: '#87977A' },
    { code: 'cream', label: 'Cream', colorHex: '#EDE1CC' },
    { code: 'navy', label: 'Navy', colorHex: '#34445C' },
  ]);

  await catalog.createOption(
    product.id,
    {
      code: 'missing-option-suggestion',
      name: 'Is there an option missing that you want us to add?',
      description: null,
      inputType: 'TEXTAREA',
      isRequired: false,
      isActive: true,
      affects3d: false,
      threeDProperty: null,
      allowCustomValue: false,
      sortOrder: 4,
    },
    ADMIN_ID,
  );
  console.log('option missing-option-suggestion created');

  const checklist = await catalog.publishingChecklist(product.id);
  console.log('publishable:', checklist.publishable, checklist.details);
  if (checklist.publishable) {
    await catalog.publish(product.id, ADMIN_ID);
    console.log('published, slug:', product.slug);
  } else {
    console.log('NOT published -- fix the checklist items above first.');
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
