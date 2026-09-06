import type { Pool, PoolClient } from '@dollz/database';
import type {
  OptionValueInput,
  OptionValueUpdateInput,
  ProductCreateInput,
  ProductListInput,
  ProductOptionInput,
  ProductOptionUpdateInput,
  ProductUpdateInput,
  VariantInput,
  VariantUpdateInput,
} from '@dollz/validation';

type Database = Pool | PoolClient;
type Row = Record<string, unknown>;

const text = (value: unknown) => (value == null ? null : String(value));

export function productContract(row: Row) {
  return {
    id: String(row.id),
    name: String(row.name),
    slug: String(row.slug),
    shortDescription: text(row.short_description),
    description: text(row.description),
    startingPriceMinor: Number(row.starting_price_minor),
    currency: String(row.currency),
    productionMinDays: Number(row.production_min_days),
    productionMaxDays: Number(row.production_max_days),
    status: String(row.status),
    isFeatured: Boolean(row.is_featured),
    seoTitle: text(row.seo_title),
    seoDescription: text(row.seo_description),
    version: Number(row.version),
    publishedAt: row.published_at,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    activeVariantCount:
      row.active_variant_count == null
        ? undefined
        : Number(row.active_variant_count),
    primaryThumbnailUrl: row.primary_file_id
      ? `/media/${String(row.primary_file_id)}/thumbnail`
      : null,
  };
}

export function variantContract(row: Row) {
  return {
    id: String(row.id),
    productId: String(row.product_id),
    sku: String(row.sku),
    name: String(row.name),
    sizeLabel: text(row.size_label),
    sizeCm: row.size_cm == null ? null : Number(row.size_cm),
    priceMinor: Number(row.price_minor),
    currency: String(row.currency),
    modelKey: text(row.model_key),
    previewFileId: text(row.preview_file_id),
    previewUrl: row.preview_file_id
      ? `/media/${String(row.preview_file_id)}/thumbnail`
      : null,
    isDefault: Boolean(row.is_default),
    isActive: Boolean(row.is_active),
    sortOrder: Number(row.sort_order),
    version: Number(row.version),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function optionContract(row: Row) {
  return {
    id: String(row.id),
    productId: String(row.product_id),
    code: String(row.code),
    name: String(row.name),
    description: text(row.description),
    inputType: String(row.input_type),
    isRequired: Boolean(row.is_required),
    isActive: Boolean(row.is_active),
    affects3d: Boolean(row.affects_3d),
    threeDProperty: text(row.three_d_property),
    allowCustomValue: Boolean(row.allow_custom_value),
    sortOrder: Number(row.sort_order),
    version: Number(row.version),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function valueContract(row: Row) {
  return {
    id: String(row.id),
    optionId: String(row.product_option_id),
    code: String(row.code),
    label: String(row.label),
    description: text(row.description),
    colorHex: text(row.color_hex),
    referenceFileId: text(row.reference_file_id),
    referenceUrl: row.reference_file_id
      ? `/media/${String(row.reference_file_id)}/thumbnail`
      : null,
    priceAdjustmentMinor: Number(row.price_adjustment_minor),
    metadata: row.metadata as Record<string, string>,
    isDefault: Boolean(row.is_default),
    isActive: Boolean(row.is_active),
    sortOrder: Number(row.sort_order),
    version: Number(row.version),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function productMediaContract(row: Row) {
  return {
    id: String(row.id),
    productId: String(row.product_id),
    fileId: String(row.file_id),
    altText: text(row.alt_text),
    caption: text(row.caption),
    isPrimary: Boolean(row.is_primary),
    sortOrder: Number(row.sort_order),
    version: Number(row.version),
    createdAt: row.created_at,
    originalName: text(row.original_name),
    width: row.width == null ? null : Number(row.width),
    height: row.height == null ? null : Number(row.height),
    urls: {
      optimized: `/media/${String(row.file_id)}/optimized`,
      thumbnail: `/media/${String(row.file_id)}/thumbnail`,
    },
  };
}

export class CatalogRepository {
  constructor(private readonly database: Database) {}

  async listPublicProducts() {
    const result = await this.database.query(
      `SELECT p.*,
        COUNT(DISTINCT v.id) FILTER (WHERE v.is_active)::integer AS active_variant_count,
        MAX(pm.file_id::text) FILTER (WHERE pm.is_primary)::uuid AS primary_file_id,
        MIN(v.price_minor) FILTER (WHERE v.is_active)::integer AS public_starting_price_minor
       FROM products p
       JOIN product_variants v ON v.product_id=p.id AND v.is_active
       LEFT JOIN product_media pm ON pm.product_id=p.id
       WHERE p.status='ACTIVE' AND p.archived_at IS NULL
       GROUP BY p.id
       ORDER BY p.is_featured DESC,p.published_at DESC,p.name ASC`,
    );
    return result.rows.map((row) => ({
      ...productContract(row as Row),
      startingPriceMinor: Number(row.public_starting_price_minor),
    }));
  }

  async getPublicProductBySlug(slug: string) {
    const result = await this.database.query(
      `SELECT p.* FROM products p
       WHERE p.slug=$1 AND p.status='ACTIVE' AND p.archived_at IS NULL`,
      [slug],
    );
    return result.rowCount ? productContract(result.rows[0] as Row) : null;
  }

  async listProducts(input: ProductListInput) {
    const clauses: string[] = [];
    const values: unknown[] = [];
    const add = (sql: string, value: unknown) => {
      values.push(value);
      clauses.push(sql.replace('?', `$${values.length}`));
    };
    if (input.search) {
      values.push(input.search, input.search);
      clauses.push(
        `(p.name ILIKE '%' || $${values.length - 1} || '%' OR p.slug ILIKE '%' || $${values.length} || '%')`,
      );
    }
    if (input.status) add('p.status = ?', input.status);
    if (input.featured) add('p.is_featured = ?', input.featured === 'true');
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const orderColumn = {
      created: 'p.created_at',
      updated: 'p.updated_at',
      name: 'p.name',
    }[input.sort];
    const offset = (input.page - 1) * input.pageSize;
    values.push(input.pageSize, offset);
    const rows = await this.database.query(
      `SELECT p.*,
        COUNT(DISTINCT v.id) FILTER (WHERE v.is_active)::integer AS active_variant_count,
        MAX(pm.file_id::text) FILTER (WHERE pm.is_primary)::uuid AS primary_file_id
       FROM products p
       LEFT JOIN product_variants v ON v.product_id = p.id
       LEFT JOIN product_media pm ON pm.product_id = p.id
       ${where}
       GROUP BY p.id
       ORDER BY ${orderColumn} ${input.direction.toUpperCase()}, p.id ${input.direction.toUpperCase()}
       LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values,
    );
    const count = await this.database.query(
      `SELECT COUNT(*)::integer AS total FROM products p ${where}`,
      values.slice(0, -2),
    );
    return {
      items: rows.rows.map((row) => productContract(row as Row)),
      total: count.rows[0].total as number,
      page: input.page,
      pageSize: input.pageSize,
    };
  }

  async getProduct(id: string, lock = false) {
    const result = await this.database.query(
      `SELECT * FROM products WHERE id = $1${lock ? ' FOR UPDATE' : ''}`,
      [id],
    );
    return result.rowCount ? productContract(result.rows[0] as Row) : null;
  }

  async createProduct(
    input: ProductCreateInput & { slug: string; adminId: string },
  ) {
    const result = await this.database.query(
      `INSERT INTO products (name, slug, short_description, description, starting_price_minor, currency,
        production_min_days, production_max_days, is_featured, seo_title, seo_description, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [
        input.name,
        input.slug,
        input.shortDescription ?? null,
        input.description ?? null,
        input.startingPriceMinor,
        input.currency,
        input.productionMinDays,
        input.productionMaxDays,
        input.isFeatured,
        input.seoTitle ?? null,
        input.seoDescription ?? null,
        input.adminId,
      ],
    );
    return productContract(result.rows[0] as Row);
  }

  async updateProduct(
    id: string,
    input: ProductUpdateInput & { slug: string },
  ) {
    const result = await this.database.query(
      `UPDATE products SET name=$2, slug=$3, short_description=$4, description=$5, starting_price_minor=$6,
        currency=$7, production_min_days=$8, production_max_days=$9, is_featured=$10, seo_title=$11,
        seo_description=$12, version=version+1
       WHERE id=$1 AND version=$13 AND status <> 'ARCHIVED' RETURNING *`,
      [
        id,
        input.name,
        input.slug,
        input.shortDescription ?? null,
        input.description ?? null,
        input.startingPriceMinor,
        input.currency,
        input.productionMinDays,
        input.productionMaxDays,
        input.isFeatured,
        input.seoTitle ?? null,
        input.seoDescription ?? null,
        input.version,
      ],
    );
    return result.rowCount ? productContract(result.rows[0] as Row) : null;
  }

  async setProductStatus(
    id: string,
    status: 'ACTIVE' | 'DRAFT' | 'ARCHIVED',
    fromStatuses: readonly string[],
  ) {
    const result = await this.database.query(
      `UPDATE products SET status=$2::varchar, published_at=CASE WHEN $2::varchar='ACTIVE' THEN COALESCE(published_at,NOW()) ELSE published_at END,
       archived_at=CASE WHEN $2::varchar='ARCHIVED' THEN NOW() ELSE archived_at END, is_featured=CASE WHEN $2::varchar='ARCHIVED' THEN FALSE ELSE is_featured END,
       version=version+1 WHERE id=$1 AND status = ANY($3::varchar[]) RETURNING *`,
      [id, status, fromStatuses],
    );
    return result.rowCount ? productContract(result.rows[0] as Row) : null;
  }

  async listVariants(productId: string) {
    const result = await this.database.query(
      'SELECT * FROM product_variants WHERE product_id=$1 ORDER BY sort_order,id',
      [productId],
    );
    return result.rows.map((row) => variantContract(row as Row));
  }
  async validFile(id: string, category: 'PRODUCT' | 'VARIANT' | 'OPTION') {
    // Locks the file row until the caller's transaction commits, so a
    // concurrent soft-delete (which also locks the row FOR UPDATE before
    // checking references) cannot delete this file between this check and
    // the reference the caller is about to create.
    const result = await this.database.query(
      "SELECT 1 FROM files WHERE id=$1 AND category=$2 AND visibility='PUBLIC' AND deleted_at IS NULL FOR UPDATE",
      [id, category],
    );
    return Boolean(result.rowCount);
  }
  async createVariant(productId: string, input: VariantInput) {
    const result = await this.database.query(
      `INSERT INTO product_variants (product_id,sku,name,size_label,size_cm,price_minor,currency,model_key,preview_file_id,is_active,sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [
        productId,
        input.sku,
        input.name,
        input.sizeLabel ?? null,
        input.sizeCm ?? null,
        input.priceMinor,
        input.currency,
        input.modelKey ?? null,
        input.previewFileId ?? null,
        input.isActive,
        input.sortOrder,
      ],
    );
    return variantContract(result.rows[0] as Row);
  }
  async updateVariant(
    productId: string,
    id: string,
    input: VariantUpdateInput,
  ) {
    const result = await this.database.query(
      `UPDATE product_variants SET sku=$3,name=$4,size_label=$5,size_cm=$6,price_minor=$7,currency=$8,model_key=$9,
       preview_file_id=$10,is_active=$11,sort_order=$12,version=version+1
       WHERE product_id=$1 AND id=$2 AND version=$13 RETURNING *`,
      [
        productId,
        id,
        input.sku,
        input.name,
        input.sizeLabel ?? null,
        input.sizeCm ?? null,
        input.priceMinor,
        input.currency,
        input.modelKey ?? null,
        input.previewFileId ?? null,
        input.isActive,
        input.sortOrder,
        input.version,
      ],
    );
    return result.rowCount ? variantContract(result.rows[0] as Row) : null;
  }

  async listOptions(productId: string) {
    const result = await this.database.query(
      'SELECT * FROM product_options WHERE product_id=$1 ORDER BY sort_order,id',
      [productId],
    );
    return result.rows.map((row) => optionContract(row as Row));
  }
  async getOption(productId: string, id: string) {
    const result = await this.database.query(
      'SELECT * FROM product_options WHERE product_id=$1 AND id=$2',
      [productId, id],
    );
    return result.rowCount ? optionContract(result.rows[0] as Row) : null;
  }

  async optionCodeIsHistorical(id: string) {
    const result = await this.database.query(
      'SELECT EXISTS(SELECT 1 FROM order_item_selections WHERE source_option_id=$1) AS historical',
      [id],
    );
    return Boolean(result.rows[0]?.historical);
  }
  async createOption(
    productId: string,
    input: ProductOptionInput & { code: string },
  ) {
    const result = await this.database.query(
      `INSERT INTO product_options (product_id,code,name,description,input_type,is_required,is_active,affects_3d,three_d_property,allow_custom_value,sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [
        productId,
        input.code,
        input.name,
        input.description ?? null,
        input.inputType,
        input.isRequired,
        input.isActive,
        input.affects3d,
        input.threeDProperty ?? null,
        input.allowCustomValue,
        input.sortOrder,
      ],
    );
    return optionContract(result.rows[0] as Row);
  }
  async updateOption(
    productId: string,
    id: string,
    input: ProductOptionUpdateInput & { code: string },
  ) {
    const result = await this.database.query(
      `UPDATE product_options SET code=$3,name=$4,description=$5,input_type=$6,is_required=$7,is_active=$8,affects_3d=$9,
       three_d_property=$10,allow_custom_value=$11,sort_order=$12,version=version+1
       WHERE product_id=$1 AND id=$2 AND version=$13 RETURNING *`,
      [
        productId,
        id,
        input.code,
        input.name,
        input.description ?? null,
        input.inputType,
        input.isRequired,
        input.isActive,
        input.affects3d,
        input.threeDProperty ?? null,
        input.allowCustomValue,
        input.sortOrder,
        input.version,
      ],
    );
    return result.rowCount ? optionContract(result.rows[0] as Row) : null;
  }

  async listValues(productId: string, optionId: string) {
    const result = await this.database.query(
      `SELECT v.* FROM product_option_values v JOIN product_options o ON o.id=v.product_option_id
       WHERE o.product_id=$1 AND o.id=$2 ORDER BY v.sort_order,v.id`,
      [productId, optionId],
    );
    return result.rows.map((row) => valueContract(row as Row));
  }
  async createValue(
    productId: string,
    optionId: string,
    input: OptionValueInput & { code: string },
  ) {
    const result = await this.database.query(
      `INSERT INTO product_option_values (product_option_id,code,label,description,color_hex,reference_file_id,price_adjustment_minor,metadata,is_active,sort_order)
       SELECT o.id,$3,$4,$5,$6,$7,$8,$9,$10,$11 FROM product_options o WHERE o.id=$2 AND o.product_id=$1 RETURNING *`,
      [
        productId,
        optionId,
        input.code,
        input.label,
        input.description ?? null,
        input.colorHex ?? null,
        input.referenceFileId ?? null,
        input.priceAdjustmentMinor,
        input.metadata,
        input.isActive,
        input.sortOrder,
      ],
    );
    return result.rowCount ? valueContract(result.rows[0] as Row) : null;
  }
  async updateValue(
    productId: string,
    optionId: string,
    id: string,
    input: OptionValueUpdateInput & { code: string },
  ) {
    const result = await this.database.query(
      `UPDATE product_option_values v SET code=$4,label=$5,description=$6,color_hex=$7,reference_file_id=$8,
       price_adjustment_minor=$9,metadata=$10,is_active=$11,sort_order=$12,version=v.version+1
       FROM product_options o WHERE v.id=$3 AND v.product_option_id=$2 AND o.id=$2 AND o.product_id=$1 AND v.version=$13 RETURNING v.*`,
      [
        productId,
        optionId,
        id,
        input.code,
        input.label,
        input.description ?? null,
        input.colorHex ?? null,
        input.referenceFileId ?? null,
        input.priceAdjustmentMinor,
        input.metadata,
        input.isActive,
        input.sortOrder,
        input.version,
      ],
    );
    return result.rowCount ? valueContract(result.rows[0] as Row) : null;
  }

  async listMedia(productId: string) {
    const result = await this.database.query(
      `SELECT pm.*,f.original_name,f.width,f.height FROM product_media pm JOIN files f ON f.id=pm.file_id
       WHERE pm.product_id=$1 ORDER BY pm.sort_order,pm.id`,
      [productId],
    );
    return result.rows.map((row) => productMediaContract(row as Row));
  }
  async addMedia(
    productId: string,
    input: {
      fileId: string;
      altText?: string | null;
      caption?: string | null;
      sortOrder: number;
    },
  ) {
    const result = await this.database.query(
      `INSERT INTO product_media (product_id,file_id,media_type,alt_text,caption,sort_order)
       SELECT $1,f.id,'IMAGE',$3,$4,$5 FROM files f
       WHERE f.id=$2 AND f.category='PRODUCT' AND f.visibility='PUBLIC' AND f.deleted_at IS NULL
       FOR UPDATE OF f RETURNING *`,
      [
        productId,
        input.fileId,
        input.altText ?? null,
        input.caption ?? null,
        input.sortOrder,
      ],
    );
    return result.rowCount ? productMediaContract(result.rows[0] as Row) : null;
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
  ) {
    const result = await this.database.query(
      `UPDATE product_media SET alt_text=$3,caption=$4,sort_order=$5,version=version+1
       WHERE product_id=$1 AND id=$2 AND version=$6 RETURNING *`,
      [
        productId,
        id,
        input.altText ?? null,
        input.caption ?? null,
        input.sortOrder,
        input.version,
      ],
    );
    return result.rowCount ? productMediaContract(result.rows[0] as Row) : null;
  }

  async verifyOwnedIds(
    table: 'product_media' | 'product_variants' | 'product_options',
    ownerColumn: 'product_id',
    ownerId: string,
    ids: string[],
  ) {
    const result = await this.database.query(
      `SELECT id::text FROM ${table} WHERE ${ownerColumn}=$1 AND id=ANY($2::uuid[])`,
      [ownerId, ids],
    );
    return result.rows.length === ids.length;
  }
  async reorder(
    table:
      | 'product_media'
      | 'product_variants'
      | 'product_options'
      | 'product_option_values',
    ids: string[],
  ) {
    for (let index = 0; index < ids.length; index++)
      await this.database.query(
        `UPDATE ${table} SET sort_order=$2 WHERE id=$1`,
        [ids[index], index],
      );
  }
  async verifyValueIds(optionId: string, ids: string[]) {
    const result = await this.database.query(
      'SELECT id FROM product_option_values WHERE product_option_id=$1 AND id=ANY($2::uuid[])',
      [optionId, ids],
    );
    return result.rows.length === ids.length;
  }

  async deactivate(
    table: 'product_variants' | 'product_options' | 'product_option_values',
    id: string,
    ownerColumn: string,
    ownerId: string,
  ) {
    const result = await this.database.query(
      `UPDATE ${table} SET is_active=FALSE,is_default=FALSE,version=version+1 WHERE id=$1 AND ${ownerColumn}=$2 RETURNING *`,
      [id, ownerId],
    );
    return result.rowCount ? (result.rows[0] as Row) : null;
  }
  async removeMedia(productId: string, id: string) {
    return Boolean(
      (
        await this.database.query(
          'DELETE FROM product_media WHERE product_id=$1 AND id=$2 RETURNING id',
          [productId, id],
        )
      ).rowCount,
    );
  }

  async setDefault(
    table: 'product_variants' | 'product_option_values',
    ownerColumn: 'product_id' | 'product_option_id',
    ownerId: string,
    id: string,
  ) {
    await this.database.query(
      `UPDATE ${table} SET is_default=FALSE,version=version+1 WHERE ${ownerColumn}=$1 AND is_default`,
      [ownerId],
    );
    const result = await this.database.query(
      `UPDATE ${table} SET is_default=TRUE,is_active=TRUE,version=version+1 WHERE ${ownerColumn}=$1 AND id=$2 RETURNING *`,
      [ownerId, id],
    );
    return result.rowCount ? (result.rows[0] as Row) : null;
  }
  async setPrimaryMedia(productId: string, id: string) {
    await this.database.query(
      'UPDATE product_media SET is_primary=FALSE,version=version+1 WHERE product_id=$1 AND is_primary',
      [productId],
    );
    const result = await this.database.query(
      'UPDATE product_media SET is_primary=TRUE,version=version+1 WHERE product_id=$1 AND id=$2 RETURNING *',
      [productId, id],
    );
    return result.rowCount ? productMediaContract(result.rows[0] as Row) : null;
  }

  async listConflicts(productId: string) {
    const result = await this.database.query(
      `SELECT c.id,c.reason,c.created_at,c.first_value_id,c.second_value_id,
       fv.label first_label,fo.name first_option,sv.label second_label,so.name second_option
       FROM option_value_conflicts c
       JOIN product_option_values fv ON fv.id=c.first_value_id JOIN product_options fo ON fo.id=fv.product_option_id
       JOIN product_option_values sv ON sv.id=c.second_value_id JOIN product_options so ON so.id=sv.product_option_id
       WHERE fo.product_id=$1 AND so.product_id=$1 ORDER BY c.created_at DESC`,
      [productId],
    );
    return result.rows.map((r) => ({
      id: String(r.id),
      reason: text(r.reason),
      firstValueId: String(r.first_value_id),
      secondValueId: String(r.second_value_id),
      firstLabel: String(r.first_label),
      firstOption: String(r.first_option),
      secondLabel: String(r.second_label),
      secondOption: String(r.second_option),
      createdAt: r.created_at,
    }));
  }
  async createConflict(
    productId: string,
    input: {
      firstValueId: string;
      secondValueId: string;
      reason?: string | null;
    },
  ) {
    const result = await this.database.query(
      `INSERT INTO option_value_conflicts(first_value_id,second_value_id,reason)
       SELECT $2,$3,$4 WHERE $2<>$3 AND EXISTS(
         SELECT 1 FROM product_option_values v JOIN product_options o ON o.id=v.product_option_id WHERE v.id=$2 AND o.product_id=$1)
       AND EXISTS(SELECT 1 FROM product_option_values v JOIN product_options o ON o.id=v.product_option_id WHERE v.id=$3 AND o.product_id=$1)
       RETURNING id`,
      [
        productId,
        input.firstValueId,
        input.secondValueId,
        input.reason ?? null,
      ],
    );
    return result.rowCount ? String(result.rows[0].id) : null;
  }
  async deleteConflict(productId: string, id: string) {
    const result = await this.database.query(
      `DELETE FROM option_value_conflicts c USING product_option_values v,product_options o
       WHERE c.id=$2 AND v.id=c.first_value_id AND o.id=v.product_option_id AND o.product_id=$1 RETURNING c.id`,
      [productId, id],
    );
    return Boolean(result.rowCount);
  }

  async publishingSnapshot(productId: string) {
    const [product, variants, media, options] = await Promise.all([
      this.database.query('SELECT * FROM products WHERE id=$1', [productId]),
      this.database.query(
        'SELECT COUNT(*) FILTER(WHERE is_active)::integer active_count,COUNT(*) FILTER(WHERE is_active AND is_default)::integer default_count,COUNT(*) FILTER(WHERE preview_file_id IS NOT NULL AND (f.id IS NULL OR f.deleted_at IS NOT NULL))::integer invalid_files FROM product_variants v LEFT JOIN files f ON f.id=v.preview_file_id WHERE product_id=$1',
        [productId],
      ),
      this.database.query(
        "SELECT COUNT(*) FILTER(WHERE pm.is_primary)::integer primary_count,COUNT(*) FILTER(WHERE pm.is_primary AND f.visibility='PUBLIC' AND f.deleted_at IS NULL)::integer valid_primary_count FROM product_media pm JOIN files f ON f.id=pm.file_id WHERE product_id=$1",
        [productId],
      ),
      this.database.query(
        `SELECT o.id,o.code,o.name,o.input_type,o.is_required,o.affects_3d,o.three_d_property,
         COUNT(v.id) FILTER(WHERE v.is_active)::integer active_values,
         COUNT(v.id) FILTER(WHERE v.is_active AND v.is_default)::integer default_values,
         COUNT(v.id) FILTER(WHERE v.is_active AND o.input_type='COLOR' AND v.color_hex IS NULL)::integer invalid_colors,
         COUNT(v.id) FILTER(WHERE v.is_active AND o.input_type='IMAGE_CARD' AND (v.reference_file_id IS NULL OR f.id IS NULL OR f.deleted_at IS NOT NULL OR f.visibility<>'PUBLIC'))::integer invalid_images
         FROM product_options o LEFT JOIN product_option_values v ON v.product_option_id=o.id LEFT JOIN files f ON f.id=v.reference_file_id
         WHERE o.product_id=$1 AND o.is_active GROUP BY o.id ORDER BY o.sort_order`,
        [productId],
      ),
    ]);
    return {
      product: product.rows[0] as Row | undefined,
      variants: variants.rows[0] as Row,
      media: media.rows[0] as Row,
      options: options.rows as Row[],
    };
  }

  async audit(
    adminId: string,
    action: string,
    entityType: string,
    entityId: string,
    previousData?: unknown,
    newData?: unknown,
  ) {
    await this.database.query(
      'INSERT INTO audit_logs(admin_user_id,action,entity_type,entity_id,previous_data,new_data) VALUES($1,$2,$3,$4,$5,$6)',
      [
        adminId,
        action,
        entityType,
        entityId,
        previousData ?? null,
        newData ?? null,
      ],
    );
  }
}
