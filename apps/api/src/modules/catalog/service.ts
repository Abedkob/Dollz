import type { Pool } from '@dollz/database';
import { withTransaction } from '@dollz/database';
import {
  normalizeCatalogCode,
  type OptionValueInput,
  type OptionValueUpdateInput,
  type ProductCreateInput,
  type ProductListInput,
  type ProductOptionInput,
  type ProductOptionUpdateInput,
  type ProductUpdateInput,
  type VariantInput,
  type VariantUpdateInput,
} from '@dollz/validation';
import { CatalogError, type ErrorDetail } from './errors.js';
import {
  CatalogRepository,
  valueContract,
  variantContract,
} from './repository.js';
import {
  catalogOptionPreset,
  type CatalogOptionPresetCode,
} from './option-presets.js';

function databaseConstraint(error: unknown) {
  return typeof error === 'object' && error !== null
    ? (error as { code?: string; constraint?: string }).constraint
    : undefined;
}

function translateConstraint(error: unknown): never {
  const constraint = databaseConstraint(error);
  if (constraint === 'products_slug_key')
    throw new CatalogError('DUPLICATE_SLUG', 409);
  if (constraint === 'product_variants_sku_key')
    throw new CatalogError('DUPLICATE_SKU', 409);
  if (constraint?.includes('product_variants_product_id_name'))
    throw new CatalogError('CONFLICT', 409, [
      {
        field: 'name',
        message: 'Variant names must be unique within a product.',
      },
    ]);
  if (
    constraint?.includes('product_options_product_id_code') ||
    constraint?.includes('product_option_values_product_option_id_code')
  )
    throw new CatalogError('DUPLICATE_CODE', 409);
  if (constraint?.includes('option_value_conflicts_unordered'))
    throw new CatalogError('CONFLICT', 409, [
      { field: 'values', message: 'This conflict already exists.' },
    ]);
  throw error;
}

function normalized(value: string, field = 'code') {
  const result = normalizeCatalogCode(value);
  if (!result)
    throw new CatalogError('VALIDATION_ERROR', 400, [
      { field, message: `Enter a valid ${field}.` },
    ]);
  return result;
}

export class CatalogService {
  constructor(private readonly pool: Pool) {}

  async listPublicProducts() {
    const products = await new CatalogRepository(
      this.pool,
    ).listPublicProducts();
    return {
      items: products.map((product) => ({
        id: product.id,
        name: product.name,
        slug: product.slug,
        shortDescription: product.shortDescription,
        startingPriceMinor: product.startingPriceMinor,
        currency: product.currency,
        productionMinDays: product.productionMinDays,
        productionMaxDays: product.productionMaxDays,
        isFeatured: product.isFeatured,
        primaryThumbnailUrl: product.primaryThumbnailUrl,
      })),
    };
  }

  async getPublicProduct(slug: string) {
    const repository = new CatalogRepository(this.pool);
    const product = await repository.getPublicProductBySlug(slug);
    if (!product) throw new CatalogError('NOT_FOUND', 404);
    const [media, allVariants, allOptions, conflicts] = await Promise.all([
      repository.listMedia(product.id),
      repository.listVariants(product.id),
      repository.listOptions(product.id),
      repository.listConflicts(product.id),
    ]);
    const variants = allVariants.filter((variant) => variant.isActive);
    const options = allOptions.filter((option) => option.isActive);
    const values = new Map<
      string,
      Awaited<ReturnType<typeof repository.listValues>>
    >();
    await Promise.all(
      options.map(async (option) => {
        values.set(
          option.id,
          (await repository.listValues(product.id, option.id)).filter(
            (value) => value.isActive,
          ),
        );
      }),
    );
    const publicValueIds = new Set(
      [...values.values()].flatMap((optionValues) =>
        optionValues.map((value) => value.id),
      ),
    );
    return {
      product: {
        id: product.id,
        name: product.name,
        slug: product.slug,
        shortDescription: product.shortDescription,
        description: product.description,
        startingPriceMinor: product.startingPriceMinor,
        currency: product.currency,
        productionMinDays: product.productionMinDays,
        productionMaxDays: product.productionMaxDays,
        seoTitle: product.seoTitle,
        seoDescription: product.seoDescription,
      },
      media: media.map((item) => ({
        id: item.id,
        altText: item.altText,
        caption: item.caption,
        isPrimary: item.isPrimary,
        urls: item.urls,
      })),
      variants: variants.map((variant) => ({
        id: variant.id,
        name: variant.name,
        sizeLabel: variant.sizeLabel,
        sizeCm: variant.sizeCm,
        priceMinor: variant.priceMinor,
        currency: variant.currency,
        isDefault: variant.isDefault,
      })),
      options: options.map((option) => ({
        id: option.id,
        code: option.code,
        name: option.name,
        description: option.description,
        inputType: option.inputType,
        isRequired: option.isRequired,
        allowCustomValue: option.allowCustomValue,
        values: (values.get(option.id) ?? []).map((value) => ({
          id: value.id,
          code: value.code,
          label: value.label,
          description: value.description,
          colorHex: value.colorHex,
          referenceUrl: value.referenceUrl,
          priceAdjustmentMinor: value.priceAdjustmentMinor,
          isDefault: value.isDefault,
        })),
      })),
      conflicts: conflicts
        .filter(
          (conflict) =>
            publicValueIds.has(conflict.firstValueId) &&
            publicValueIds.has(conflict.secondValueId),
        )
        .map((conflict) => ({
          firstValueId: conflict.firstValueId,
          secondValueId: conflict.secondValueId,
          reason: conflict.reason,
        })),
    };
  }

  listProducts(input: ProductListInput) {
    return new CatalogRepository(this.pool).listProducts(input);
  }

  async getProduct(id: string) {
    const repository = new CatalogRepository(this.pool);
    const product = await repository.getProduct(id);
    if (!product) throw new CatalogError('NOT_FOUND', 404);
    const [media, variants, options, conflicts] = await Promise.all([
      repository.listMedia(id),
      repository.listVariants(id),
      repository.listOptions(id),
      repository.listConflicts(id),
    ]);
    const values = Object.fromEntries(
      await Promise.all(
        options.map(async (option) => [
          option.id,
          await repository.listValues(id, option.id),
        ]),
      ),
    );
    return {
      product,
      media,
      variants,
      options: options.map((option) => ({
        ...option,
        values: values[option.id],
      })),
      conflicts,
    };
  }

  async createProduct(input: ProductCreateInput, adminId: string) {
    try {
      return await withTransaction(this.pool, async (client) => {
        const repository = new CatalogRepository(client);
        const product = await repository.createProduct({
          ...input,
          slug: normalized(input.slug, 'slug'),
          adminId,
        });
        await repository.audit(
          adminId,
          'PRODUCT_CREATED',
          'PRODUCT',
          product.id,
          undefined,
          product,
        );
        return product;
      });
    } catch (error) {
      translateConstraint(error);
    }
  }

  async updateProduct(id: string, input: ProductUpdateInput, adminId: string) {
    try {
      return await withTransaction(this.pool, async (client) => {
        const repository = new CatalogRepository(client);
        const previous = await repository.getProduct(id, true);
        if (!previous) throw new CatalogError('NOT_FOUND', 404);
        const product = await repository.updateProduct(id, {
          ...input,
          slug: normalized(input.slug, 'slug'),
        });
        if (!product) throw new CatalogError('CONCURRENCY_CONFLICT', 409);
        await repository.audit(
          adminId,
          'PRODUCT_UPDATED',
          'PRODUCT',
          id,
          previous,
          product,
        );
        return product;
      });
    } catch (error) {
      translateConstraint(error);
    }
  }

  private async status(
    id: string,
    status: 'DRAFT' | 'ARCHIVED',
    fromStatuses: readonly string[],
    adminId: string,
  ) {
    return withTransaction(this.pool, async (client) => {
      const repository = new CatalogRepository(client);
      const previous = await repository.getProduct(id, true);
      if (!previous) throw new CatalogError('NOT_FOUND', 404);
      if (!fromStatuses.includes(previous.status as string))
        throw new CatalogError('INVALID_STATUS_TRANSITION', 409);
      const product = await repository.setProductStatus(
        id,
        status,
        fromStatuses,
      );
      if (!product) throw new CatalogError('INVALID_STATUS_TRANSITION', 409);
      await repository.audit(
        adminId,
        status === 'ARCHIVED' ? 'PRODUCT_ARCHIVED' : 'PRODUCT_UNPUBLISHED',
        'PRODUCT',
        id,
        previous,
        product,
      );
      return product;
    });
  }
  unpublish(id: string, adminId: string) {
    return this.status(id, 'DRAFT', ['ACTIVE'], adminId);
  }
  archive(id: string, adminId: string) {
    return this.status(id, 'ARCHIVED', ['DRAFT', 'ACTIVE'], adminId);
  }

  async publishingChecklist(
    id: string,
    repositoryOverride?: CatalogRepository,
  ) {
    const repository = repositoryOverride ?? new CatalogRepository(this.pool);
    const snapshot = await repository.publishingSnapshot(id);
    if (!snapshot.product) throw new CatalogError('NOT_FOUND', 404);
    const details: ErrorDetail[] = [];
    const product = snapshot.product;
    if (!String(product.name ?? '').trim())
      details.push({ field: 'name', message: 'Add a product name.' });
    if (!String(product.slug ?? '').trim())
      details.push({ field: 'slug', message: 'Add a valid product slug.' });
    if (
      !String(product.description ?? '').trim() &&
      !String(product.short_description ?? '').trim()
    )
      details.push({
        field: 'description',
        message: 'Add a public product description.',
      });
    if (!/^[A-Z]{3}$/.test(String(product.currency)))
      details.push({ field: 'currency', message: 'Choose a valid currency.' });
    if (
      Number(product.production_max_days) < Number(product.production_min_days)
    )
      details.push({
        field: 'productionDays',
        message: 'Correct the production-day range.',
      });
    if (Number(snapshot.variants.active_count) < 1)
      details.push({
        field: 'variants',
        message: 'Add at least one active product variant.',
      });
    if (Number(snapshot.variants.default_count) !== 1)
      details.push({
        field: 'variants',
        message: 'Choose exactly one active default variant.',
      });
    if (Number(snapshot.variants.invalid_files) > 0)
      details.push({
        field: 'variants',
        message: 'Replace unavailable variant preview images.',
      });
    if (
      Number(snapshot.media.primary_count) !== 1 ||
      Number(snapshot.media.valid_primary_count) !== 1
    )
      details.push({
        field: 'media',
        message: 'Choose exactly one public primary product image.',
      });
    for (const option of snapshot.options) {
      const code = String(option.code);
      const predefined = ['COLOR', 'IMAGE_CARD', 'SELECT'].includes(
        String(option.input_type),
      );
      if (
        Boolean(option.affects_3d) &&
        !['eyes', 'hair', 'dress', 'dressName'].includes(
          String(option.three_d_property),
        )
      )
        details.push({
          field: `options.${code}`,
          message: `${String(option.name)} has an invalid 3D property.`,
        });
      if (
        ['hair-type', 'dress-style'].includes(code) &&
        Boolean(option.affects_3d)
      )
        details.push({
          field: `options.${code}`,
          message: `${String(option.name)} must not switch the 3D mesh.`,
        });
      if (predefined && Number(option.active_values) < 1)
        details.push({
          field: `options.${code}`,
          message: `${String(option.name)} needs at least one active value.`,
        });
      if (
        Boolean(option.is_required) &&
        predefined &&
        Number(option.default_values) !== 1
      )
        details.push({
          field: `options.${code}`,
          message: `${String(option.name)} needs exactly one active default value.`,
        });
      if (
        String(option.input_type) === 'IMAGE_CARD' &&
        Number(option.invalid_images) > 0
      )
        details.push({
          field: `options.${code}`,
          message: `${String(option.name)} has values without public reference images.`,
        });
      if (
        String(option.input_type) === 'COLOR' &&
        Number(option.invalid_colors) > 0
      )
        details.push({
          field: `options.${code}`,
          message: `${String(option.name)} has values without valid colors.`,
        });
    }
    return { publishable: details.length === 0, details };
  }

  async publish(id: string, adminId: string) {
    return withTransaction(this.pool, async (client) => {
      const repository = new CatalogRepository(client);
      const previous = await repository.getProduct(id, true);
      if (!previous) throw new CatalogError('NOT_FOUND', 404);
      if (previous.status !== 'DRAFT')
        throw new CatalogError('INVALID_STATUS_TRANSITION', 409);
      // Re-validate inside the transaction, after locking the product row, so a
      // concurrent edit that invalidates publishability cannot slip in between
      // this check and the status flip below.
      const checklist = await this.publishingChecklist(id, repository);
      if (!checklist.publishable)
        throw new CatalogError(
          'PRODUCT_NOT_PUBLISHABLE',
          422,
          checklist.details,
        );
      const product = await repository.setProductStatus(id, 'ACTIVE', [
        'DRAFT',
      ]);
      if (!product) throw new CatalogError('INVALID_STATUS_TRANSITION', 409);
      await repository.audit(
        adminId,
        'PRODUCT_PUBLISHED',
        'PRODUCT',
        id,
        previous,
        product,
      );
      return product;
    });
  }

  listVariants(productId: string) {
    return new CatalogRepository(this.pool).listVariants(productId);
  }
  async createVariant(productId: string, input: VariantInput, adminId: string) {
    try {
      return await withTransaction(this.pool, async (client) => {
        const r = new CatalogRepository(client);
        if (!(await r.getProduct(productId)))
          throw new CatalogError('NOT_FOUND', 404);
        if (
          input.previewFileId &&
          !(await r.validFile(input.previewFileId, 'VARIANT'))
        )
          throw new CatalogError('INVALID_FILE', 400);
        const value = await r.createVariant(productId, input);
        await r.audit(
          adminId,
          'VARIANT_CREATED',
          'PRODUCT_VARIANT',
          value.id,
          undefined,
          value,
        );
        return value;
      });
    } catch (error) {
      translateConstraint(error);
    }
  }
  async updateVariant(
    productId: string,
    id: string,
    input: VariantUpdateInput,
    adminId: string,
  ) {
    try {
      return await withTransaction(this.pool, async (client) => {
        const r = new CatalogRepository(client);
        if (
          input.previewFileId &&
          !(await r.validFile(input.previewFileId, 'VARIANT'))
        )
          throw new CatalogError('INVALID_FILE', 400);
        const value = await r.updateVariant(productId, id, input);
        if (!value) throw new CatalogError('CONCURRENCY_CONFLICT', 409);
        await r.audit(
          adminId,
          'VARIANT_UPDATED',
          'PRODUCT_VARIANT',
          id,
          undefined,
          value,
        );
        return value;
      });
    } catch (error) {
      translateConstraint(error);
    }
  }

  listOptions(productId: string) {
    return new CatalogRepository(this.pool).listOptions(productId);
  }
  private validateOption(input: ProductOptionInput | ProductOptionUpdateInput) {
    const code = normalized(input.code);
    if (['hair-type', 'dress-style'].includes(code) && input.affects3d)
      throw new CatalogError('VALIDATION_ERROR', 400, [
        {
          field: 'affects3d',
          message: 'Hair type and dress style do not switch the 3D mesh.',
        },
      ]);
    return code;
  }
  async createOption(
    productId: string,
    input: ProductOptionInput,
    adminId: string,
  ) {
    try {
      return await withTransaction(this.pool, async (client) => {
        const r = new CatalogRepository(client);
        if (!(await r.getProduct(productId)))
          throw new CatalogError('NOT_FOUND', 404);
        const value = await r.createOption(productId, {
          ...input,
          code: this.validateOption(input),
        });
        await r.audit(
          adminId,
          'OPTION_CREATED',
          'PRODUCT_OPTION',
          value.id,
          undefined,
          value,
        );
        return value;
      });
    } catch (error) {
      translateConstraint(error);
    }
  }
  async applyOptionPreset(
    productId: string,
    presetCode: CatalogOptionPresetCode,
    adminId: string,
  ) {
    const preset = catalogOptionPreset(presetCode);
    try {
      return await withTransaction(this.pool, async (client) => {
        const repository = new CatalogRepository(client);
        if (!(await repository.getProduct(productId)))
          throw new CatalogError('NOT_FOUND', 404);
        const existing = await repository.listOptions(productId);
        if (existing.some((option) => option.code === preset.code))
          throw new CatalogError('DUPLICATE_CODE', 409, [
            {
              field: 'preset',
              message: `${preset.name} is already part of this product.`,
            },
          ]);
        const option = await repository.createOption(productId, {
          code: preset.code,
          name: preset.name,
          description: preset.description,
          inputType: preset.inputType,
          isRequired: preset.isRequired,
          isActive: true,
          affects3d: preset.affects3d,
          threeDProperty: preset.threeDProperty,
          allowCustomValue: false,
          sortOrder: existing.length,
        });
        let defaultValueId = '';
        for (const [index, presetValue] of preset.values.entries()) {
          const value = await repository.createValue(productId, option.id, {
            ...presetValue,
            description: null,
            referenceFileId: null,
            priceAdjustmentMinor: 0,
            metadata: { swatchLabel: presetValue.label },
            isActive: true,
            sortOrder: index,
          });
          if (!value) throw new CatalogError('NOT_FOUND', 404);
          if (index === 0) defaultValueId = value.id;
        }
        if (defaultValueId)
          await repository.setDefault(
            'product_option_values',
            'product_option_id',
            option.id,
            defaultValueId,
          );
        const result = {
          ...option,
          values: await repository.listValues(productId, option.id),
        };
        await repository.audit(
          adminId,
          'OPTION_PRESET_APPLIED',
          'PRODUCT_OPTION',
          option.id,
          undefined,
          result,
        );
        return result;
      });
    } catch (error) {
      translateConstraint(error);
    }
  }
  async updateOption(
    productId: string,
    id: string,
    input: ProductOptionUpdateInput,
    adminId: string,
  ) {
    try {
      return await withTransaction(this.pool, async (client) => {
        const r = new CatalogRepository(client);
        const previous = await r.getOption(productId, id);
        if (!previous) throw new CatalogError('NOT_FOUND', 404);
        const nextCode = this.validateOption(input);
        if (previous.code !== nextCode && (await r.optionCodeIsHistorical(id)))
          throw new CatalogError('OPTION_CODE_LOCKED_BY_ORDER_HISTORY', 409);
        const value = await r.updateOption(productId, id, {
          ...input,
          code: nextCode,
        });
        if (!value) throw new CatalogError('CONCURRENCY_CONFLICT', 409);
        await r.audit(
          adminId,
          'OPTION_UPDATED',
          'PRODUCT_OPTION',
          id,
          undefined,
          value,
        );
        return value;
      });
    } catch (error) {
      translateConstraint(error);
    }
  }

  listValues(productId: string, optionId: string) {
    return new CatalogRepository(this.pool).listValues(productId, optionId);
  }
  private async validateValue(
    repository: CatalogRepository,
    productId: string,
    optionId: string,
    input: OptionValueInput | OptionValueUpdateInput,
  ) {
    const option = await repository.getOption(productId, optionId);
    if (!option) throw new CatalogError('NOT_FOUND', 404);
    if (option.inputType === 'COLOR' && !input.colorHex)
      throw new CatalogError('VALIDATION_ERROR', 400, [
        { field: 'colorHex', message: 'Choose a color for this value.' },
      ]);
    if (
      input.referenceFileId &&
      !(await repository.validFile(input.referenceFileId, 'OPTION'))
    )
      throw new CatalogError('INVALID_FILE', 400);
    return normalized(input.code);
  }
  async createValue(
    productId: string,
    optionId: string,
    input: OptionValueInput,
    adminId: string,
  ) {
    try {
      return await withTransaction(this.pool, async (client) => {
        const r = new CatalogRepository(client);
        const code = await this.validateValue(r, productId, optionId, input);
        const value = await r.createValue(productId, optionId, {
          ...input,
          code,
        });
        if (!value) throw new CatalogError('NOT_FOUND', 404);
        await r.audit(
          adminId,
          'OPTION_VALUE_CREATED',
          'PRODUCT_OPTION_VALUE',
          value.id,
          undefined,
          value,
        );
        return value;
      });
    } catch (error) {
      translateConstraint(error);
    }
  }
  async updateValue(
    productId: string,
    optionId: string,
    id: string,
    input: OptionValueUpdateInput,
    adminId: string,
  ) {
    try {
      return await withTransaction(this.pool, async (client) => {
        const r = new CatalogRepository(client);
        const code = await this.validateValue(r, productId, optionId, input);
        const value = await r.updateValue(productId, optionId, id, {
          ...input,
          code,
        });
        if (!value) throw new CatalogError('CONCURRENCY_CONFLICT', 409);
        await r.audit(
          adminId,
          'OPTION_VALUE_UPDATED',
          'PRODUCT_OPTION_VALUE',
          id,
          undefined,
          value,
        );
        return value;
      });
    } catch (error) {
      translateConstraint(error);
    }
  }

  async reorder(
    productId: string,
    type: 'product_media' | 'product_variants' | 'product_options',
    ids: string[],
    adminId: string,
  ) {
    return withTransaction(this.pool, async (client) => {
      const r = new CatalogRepository(client);
      if (!(await r.verifyOwnedIds(type, 'product_id', productId, ids)))
        throw new CatalogError('CONFLICT', 409, [
          {
            field: 'ids',
            message: 'Every record must belong to this product.',
          },
        ]);
      await r.reorder(type, ids);
      await r.audit(
        adminId,
        'CATALOG_REORDERED',
        'PRODUCT',
        productId,
        undefined,
        { type, ids },
      );
    });
  }
  async reorderValues(
    productId: string,
    optionId: string,
    ids: string[],
    adminId: string,
  ) {
    return withTransaction(this.pool, async (client) => {
      const r = new CatalogRepository(client);
      if (!(await r.getOption(productId, optionId)))
        throw new CatalogError('NOT_FOUND', 404);
      if (!(await r.verifyValueIds(optionId, ids)))
        throw new CatalogError('CONFLICT', 409, [
          { field: 'ids', message: 'Every value must belong to this option.' },
        ]);
      await r.reorder('product_option_values', ids);
      await r.audit(
        adminId,
        'OPTION_VALUES_REORDERED',
        'PRODUCT_OPTION',
        optionId,
        undefined,
        { ids },
      );
    });
  }

  async deactivate(
    productId: string,
    type: 'product_variants' | 'product_options',
    id: string,
    adminId: string,
  ) {
    return withTransaction(this.pool, async (client) => {
      const r = new CatalogRepository(client);
      if (
        type === 'product_options' &&
        (await r.optionCodeIsHistorical(id))
      )
        throw new CatalogError('OPTION_CODE_LOCKED_BY_ORDER_HISTORY', 409);
      const row = await r.deactivate(type, id, 'product_id', productId);
      if (!row) throw new CatalogError('NOT_FOUND', 404);
      await r.audit(
        adminId,
        type === 'product_variants'
          ? 'VARIANT_DEACTIVATED'
          : 'OPTION_DEACTIVATED',
        type === 'product_variants' ? 'PRODUCT_VARIANT' : 'PRODUCT_OPTION',
        id,
      );
    });
  }
  async deactivateValue(
    productId: string,
    optionId: string,
    id: string,
    adminId: string,
  ) {
    return withTransaction(this.pool, async (client) => {
      const r = new CatalogRepository(client);
      if (!(await r.getOption(productId, optionId)))
        throw new CatalogError('NOT_FOUND', 404);
      const row = await r.deactivate(
        'product_option_values',
        id,
        'product_option_id',
        optionId,
      );
      if (!row) throw new CatalogError('NOT_FOUND', 404);
      await r.audit(
        adminId,
        'OPTION_VALUE_DEACTIVATED',
        'PRODUCT_OPTION_VALUE',
        id,
      );
    });
  }

  async setDefaultVariant(productId: string, id: string, adminId: string) {
    return withTransaction(this.pool, async (client) => {
      const r = new CatalogRepository(client);
      const row = await r.setDefault(
        'product_variants',
        'product_id',
        productId,
        id,
      );
      if (!row) throw new CatalogError('NOT_FOUND', 404);
      const value = variantContract(row);
      await r.audit(
        adminId,
        'VARIANT_DEFAULT_SET',
        'PRODUCT_VARIANT',
        id,
        undefined,
        value,
      );
      return value;
    });
  }
  async setDefaultValue(
    productId: string,
    optionId: string,
    id: string,
    adminId: string,
  ) {
    return withTransaction(this.pool, async (client) => {
      const r = new CatalogRepository(client);
      if (!(await r.getOption(productId, optionId)))
        throw new CatalogError('NOT_FOUND', 404);
      const row = await r.setDefault(
        'product_option_values',
        'product_option_id',
        optionId,
        id,
      );
      if (!row) throw new CatalogError('NOT_FOUND', 404);
      const value = valueContract(row);
      await r.audit(
        adminId,
        'OPTION_VALUE_DEFAULT_SET',
        'PRODUCT_OPTION_VALUE',
        id,
        undefined,
        value,
      );
      return value;
    });
  }

  listMedia(productId: string) {
    return new CatalogRepository(this.pool).listMedia(productId);
  }
  async addMedia(
    productId: string,
    input: {
      fileId: string;
      altText?: string | null;
      caption?: string | null;
      sortOrder: number;
    },
    adminId: string,
  ) {
    return withTransaction(this.pool, async (client) => {
      const r = new CatalogRepository(client);
      if (!(await r.getProduct(productId)))
        throw new CatalogError('NOT_FOUND', 404);
      if (!(await r.validFile(input.fileId, 'PRODUCT')))
        throw new CatalogError('INVALID_FILE', 400);
      const value = await r.addMedia(productId, input);
      if (!value) throw new CatalogError('INVALID_FILE', 400);
      await r.audit(
        adminId,
        'PRODUCT_MEDIA_ADDED',
        'PRODUCT_MEDIA',
        value.id,
        undefined,
        value,
      );
      return value;
    });
  }
  async updateMedia(
    productId: string,
    id: string,
    input: {
      altText?: string | null;
      caption?: string | null;
      sortOrder: number;
      version: number;
    },
    adminId: string,
  ) {
    return withTransaction(this.pool, async (client) => {
      const r = new CatalogRepository(client);
      const value = await r.updateMedia(productId, id, input);
      if (!value) throw new CatalogError('CONCURRENCY_CONFLICT', 409);
      await r.audit(
        adminId,
        'PRODUCT_MEDIA_UPDATED',
        'PRODUCT_MEDIA',
        id,
        undefined,
        value,
      );
      return value;
    });
  }
  async removeMedia(productId: string, id: string, adminId: string) {
    return withTransaction(this.pool, async (client) => {
      const r = new CatalogRepository(client);
      if (!(await r.removeMedia(productId, id)))
        throw new CatalogError('NOT_FOUND', 404);
      await r.audit(adminId, 'PRODUCT_MEDIA_REMOVED', 'PRODUCT_MEDIA', id);
    });
  }
  async setPrimaryMedia(productId: string, id: string, adminId: string) {
    return withTransaction(this.pool, async (client) => {
      const r = new CatalogRepository(client);
      const value = await r.setPrimaryMedia(productId, id);
      if (!value) throw new CatalogError('NOT_FOUND', 404);
      await r.audit(
        adminId,
        'PRODUCT_MEDIA_PRIMARY_SET',
        'PRODUCT_MEDIA',
        id,
        undefined,
        value,
      );
      return value;
    });
  }

  listConflicts(productId: string) {
    return new CatalogRepository(this.pool).listConflicts(productId);
  }
  async createConflict(
    productId: string,
    input: {
      firstValueId: string;
      secondValueId: string;
      reason?: string | null;
    },
    adminId: string,
  ) {
    if (input.firstValueId === input.secondValueId)
      throw new CatalogError('VALIDATION_ERROR', 400, [
        { field: 'values', message: 'A value cannot conflict with itself.' },
      ]);
    try {
      return await withTransaction(this.pool, async (client) => {
        const r = new CatalogRepository(client);
        const id = await r.createConflict(productId, input);
        if (!id)
          throw new CatalogError('CONFLICT', 409, [
            {
              field: 'values',
              message: 'Both values must belong to this product.',
            },
          ]);
        await r.audit(
          adminId,
          'OPTION_CONFLICT_CREATED',
          'OPTION_VALUE_CONFLICT',
          id,
          undefined,
          input,
        );
        return { id };
      });
    } catch (error) {
      translateConstraint(error);
    }
  }
  async deleteConflict(productId: string, id: string, adminId: string) {
    return withTransaction(this.pool, async (client) => {
      const r = new CatalogRepository(client);
      if (!(await r.deleteConflict(productId, id)))
        throw new CatalogError('NOT_FOUND', 404);
      await r.audit(
        adminId,
        'OPTION_CONFLICT_REMOVED',
        'OPTION_VALUE_CONFLICT',
        id,
      );
    });
  }
}
