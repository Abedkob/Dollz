import { z } from 'zod';

export const nonEmptyString = z.string().trim().min(1);
export const emailAddress = z.string().email().max(320);

export const uuid = z.string().uuid();
export const currencyCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/);
export const catalogStatus = z.enum([
  'DRAFT',
  'ACTIVE',
  'UNAVAILABLE',
  'ARCHIVED',
]);
export const fileCategory = z.enum(['PRODUCT', 'VARIANT', 'OPTION']);
export const fileVisibility = z.enum(['PUBLIC', 'PRIVATE']);
export const optionInputType = z.enum([
  'COLOR',
  'IMAGE_CARD',
  'TEXT',
  'TEXTAREA',
  'SELECT',
]);
export const approvedThreeDProperty = z.enum([
  'eyes',
  'hair',
  'dress',
  'dressName',
]);
export const hexColor = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/)
  .transform((value) => value.toUpperCase());

const optionalText = (maximum: number) =>
  z.string().trim().max(maximum).nullable().optional();
const sortOrder = z.number().int().min(0).max(100_000).default(0);

export function normalizeCatalogCode(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
}

export const productCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    slug: z.string().trim().min(1).max(200),
    shortDescription: optionalText(500),
    description: optionalText(20_000),
    startingPriceMinor: z.number().int().min(0).max(100_000_000),
    currency: currencyCode,
    productionMinDays: z.number().int().min(0).max(3650),
    productionMaxDays: z.number().int().min(0).max(3650),
    isFeatured: z.boolean().default(false),
    seoTitle: optionalText(200),
    seoDescription: optionalText(500),
  })
  .refine((value) => value.productionMaxDays >= value.productionMinDays, {
    path: ['productionMaxDays'],
    message: 'Maximum production days must not be less than the minimum.',
  });

export const productUpdateSchema = productCreateSchema.safeExtend({
  version: z.number().int().positive(),
});

export const productListSchema = z.object({
  search: z.string().trim().max(200).default(''),
  status: catalogStatus.optional(),
  featured: z.enum(['true', 'false']).optional(),
  sort: z.enum(['created', 'updated', 'name']).default('updated'),
  direction: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const variantSchema = z.object({
  sku: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1).max(150),
  sizeLabel: optionalText(100),
  sizeCm: z.number().positive().max(10_000).nullable().optional(),
  priceMinor: z.number().int().min(0).max(100_000_000),
  currency: currencyCode,
  modelKey: optionalText(200),
  previewFileId: uuid.nullable().optional(),
  isActive: z.boolean().default(true),
  sortOrder,
});
export const variantUpdateSchema = variantSchema.extend({
  version: z.number().int().positive(),
});

export const productOptionSchema = z
  .object({
    code: z.string().trim().min(1).max(100),
    name: z.string().trim().min(1).max(150),
    description: optionalText(1000),
    inputType: optionInputType,
    isRequired: z.boolean().default(false),
    isActive: z.boolean().default(true),
    affects3d: z.boolean().default(false),
    threeDProperty: approvedThreeDProperty.nullable().optional(),
    allowCustomValue: z.boolean().default(false),
    sortOrder,
  })
  .superRefine((value, context) => {
    if (value.affects3d && !value.threeDProperty)
      context.addIssue({
        code: 'custom',
        path: ['threeDProperty'],
        message: 'Choose an approved 3D property.',
      });
    if (!value.affects3d && value.threeDProperty)
      context.addIssue({
        code: 'custom',
        path: ['threeDProperty'],
        message: 'Remove the 3D property when this option does not affect 3D.',
      });
  });
export const productOptionUpdateSchema = productOptionSchema.safeExtend({
  version: z.number().int().positive(),
});

export const optionValueMetadataSchema = z
  .object({
    swatchLabel: z.string().trim().max(100).optional(),
    material: z.string().trim().max(100).optional(),
    texture: z.string().trim().max(100).optional(),
  })
  .strict();

export const optionValueSchema = z.object({
  code: z.string().trim().min(1).max(100),
  label: z.string().trim().min(1).max(150),
  description: optionalText(1000),
  colorHex: hexColor.nullable().optional(),
  referenceFileId: uuid.nullable().optional(),
  priceAdjustmentMinor: z
    .number()
    .int()
    .min(-100_000_000)
    .max(100_000_000)
    .default(0),
  metadata: optionValueMetadataSchema.default({}),
  isActive: z.boolean().default(true),
  sortOrder,
});
export const optionValueUpdateSchema = optionValueSchema.extend({
  version: z.number().int().positive(),
});

export const reorderSchema = z.object({ ids: z.array(uuid).min(1).max(500) });
export const expectedVersionSchema = z.object({
  version: z.number().int().positive(),
});
export const productMediaSchema = z.object({
  fileId: uuid,
  altText: optionalText(500),
  caption: optionalText(1000),
  sortOrder,
});
export const productMediaUpdateSchema = productMediaSchema
  .omit({ fileId: true })
  .extend({ version: z.number().int().positive() });
export const conflictSchema = z.object({
  firstValueId: uuid,
  secondValueId: uuid,
  reason: optionalText(1000),
});

export type ProductCreateInput = z.infer<typeof productCreateSchema>;
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;
export type ProductListInput = z.infer<typeof productListSchema>;
export type VariantInput = z.infer<typeof variantSchema>;
export type VariantUpdateInput = z.infer<typeof variantUpdateSchema>;
export type ProductOptionInput = z.infer<typeof productOptionSchema>;
export type ProductOptionUpdateInput = z.infer<
  typeof productOptionUpdateSchema
>;
export type OptionValueInput = z.infer<typeof optionValueSchema>;
export type OptionValueUpdateInput = z.infer<typeof optionValueUpdateSchema>;
