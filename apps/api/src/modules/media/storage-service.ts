import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, mkdtemp, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Pool } from '@dollz/database';
import { withTransaction } from '@dollz/database';
import sharp from 'sharp';
import { CatalogError } from '../catalog/errors.js';

export type MediaCategory = 'PRODUCT' | 'VARIANT' | 'OPTION';
export type MediaVisibility = 'PUBLIC' | 'PRIVATE';

export interface ImageLimits {
  maxUploadBytes: number;
  maxPixels: number;
  maxDimension: number;
  optimizedMaxWidth: number;
  thumbnailWidth: number;
}

const supportedMime = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
} as const;

function signatureFormat(input: Buffer): keyof typeof supportedMime | null {
  if (
    input.length >= 3 &&
    input[0] === 0xff &&
    input[1] === 0xd8 &&
    input[2] === 0xff
  )
    return 'jpeg';
  if (
    input.length >= 8 &&
    input.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return 'png';
  if (
    input.length >= 12 &&
    input.toString('ascii', 0, 4) === 'RIFF' &&
    input.toString('ascii', 8, 12) === 'WEBP'
  )
    return 'webp';
  return null;
}

export interface ProcessedImage {
  original: Buffer;
  optimized: Buffer;
  thumbnail: Buffer;
  width: number;
  height: number;
  sourceFormat: string;
}

export async function processImage(
  input: Buffer,
  declaredMime: string,
  limits: ImageLimits,
): Promise<ProcessedImage> {
  if (input.length > limits.maxUploadBytes)
    throw new CatalogError('FILE_TOO_LARGE', 413);
  const signature = signatureFormat(input);
  if (!signature) throw new CatalogError('UNSUPPORTED_FILE_TYPE', 415);
  if (supportedMime[signature] !== declaredMime)
    throw new CatalogError('INVALID_FILE', 400);

  let metadata: sharp.Metadata;
  try {
    metadata = await sharp(input, {
      limitInputPixels: limits.maxPixels,
      failOn: 'error',
    }).metadata();
  } catch {
    throw new CatalogError('IMAGE_DECODE_FAILED', 400);
  }
  if (metadata.format !== signature || !metadata.width || !metadata.height)
    throw new CatalogError('INVALID_FILE', 400);
  if (
    metadata.width > limits.maxDimension ||
    metadata.height > limits.maxDimension
  )
    throw new CatalogError('IMAGE_TOO_LARGE', 413);

  try {
    const normalized = sharp(input, {
      limitInputPixels: limits.maxPixels,
      failOn: 'error',
    }).rotate();
    const original = await normalized.clone().webp({ quality: 92 }).toBuffer();
    const optimized = await normalized
      .clone()
      .resize({ width: limits.optimizedMaxWidth, withoutEnlargement: true })
      .webp({ quality: 84 })
      .toBuffer();
    const thumbnail = await normalized
      .clone()
      .resize({
        width: limits.thumbnailWidth,
        height: limits.thumbnailWidth,
        fit: 'cover',
        withoutEnlargement: true,
      })
      .webp({ quality: 78 })
      .toBuffer();
    const finalMetadata = await sharp(original).metadata();
    return {
      original,
      optimized,
      thumbnail,
      width: finalMetadata.width ?? metadata.width,
      height: finalMetadata.height ?? metadata.height,
      sourceFormat: signature,
    };
  } catch (error) {
    if (error instanceof CatalogError) throw error;
    throw new CatalogError('IMAGE_DECODE_FAILED', 400);
  }
}

export function safeOriginalName(value: string) {
  const printable = Array.from(path.basename(value))
    .filter((character) => character.charCodeAt(0) >= 32)
    .join('');
  return printable.slice(0, 255) || 'image';
}

export function keyFor(
  category: MediaCategory,
  variant: 'original' | 'optimized' | 'thumbnails',
  id: string,
) {
  const now = new Date();
  return `${category.toLowerCase()}s/${variant}/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${id}.webp`;
}

function inside(root: string, storageKey: string) {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, ...storageKey.split('/'));
  if (!resolved.startsWith(`${resolvedRoot}${path.sep}`))
    throw new CatalogError('INVALID_FILE', 400);
  return resolved;
}

export function mediaContract(row: Record<string, unknown>) {
  const id = String(row.id);
  return {
    id,
    originalName: row.original_name,
    mimeType: row.processed_mime_type ?? row.mime_type,
    sizeBytes: Number(row.size_bytes),
    checksumSha256: row.checksum_sha256,
    category: row.category,
    visibility: row.visibility,
    width: row.width,
    height: row.height,
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
    urls: {
      optimized: `/media/${id}/optimized`,
      thumbnail: `/media/${id}/thumbnail`,
    },
  };
}

export class MediaStorageService {
  constructor(
    private readonly pool: Pool,
    private readonly storageRoot: string,
    private readonly limits: ImageLimits,
  ) {}

  async upload(input: {
    buffer: Buffer;
    mimeType: string;
    originalName: string;
    category: MediaCategory;
    visibility: MediaVisibility;
    adminId: string;
  }) {
    const image = await processImage(input.buffer, input.mimeType, this.limits);
    const id = randomUUID();
    const keys = {
      original: keyFor(input.category, 'original', id),
      optimized: keyFor(input.category, 'optimized', id),
      thumbnail: keyFor(input.category, 'thumbnails', id),
    };
    const temporaryRoot = path.resolve(this.storageRoot, '.tmp');
    await mkdir(temporaryRoot, { recursive: true });
    const temporaryDirectory = await mkdtemp(
      path.join(temporaryRoot, 'image-'),
    );
    const temporaryFiles = {
      original: path.join(temporaryDirectory, 'original.webp'),
      optimized: path.join(temporaryDirectory, 'optimized.webp'),
      thumbnail: path.join(temporaryDirectory, 'thumbnail.webp'),
    };
    const finalFiles = {
      original: inside(this.storageRoot, keys.original),
      optimized: inside(this.storageRoot, keys.optimized),
      thumbnail: inside(this.storageRoot, keys.thumbnail),
    };
    const moved: string[] = [];
    try {
      await Promise.all([
        writeFile(temporaryFiles.original, image.original, { flag: 'wx' }),
        writeFile(temporaryFiles.optimized, image.optimized, { flag: 'wx' }),
        writeFile(temporaryFiles.thumbnail, image.thumbnail, { flag: 'wx' }),
      ]);
      for (const destination of Object.values(finalFiles))
        await mkdir(path.dirname(destination), { recursive: true });
      const row = await withTransaction(this.pool, async (client) => {
        for (const variant of ['original', 'optimized', 'thumbnail'] as const) {
          await rename(temporaryFiles[variant], finalFiles[variant]);
          moved.push(finalFiles[variant]);
        }
        const result = await client.query(
          `INSERT INTO files
            (id, storage_key, optimized_storage_key, thumbnail_storage_key, original_name, mime_type,
             processed_mime_type, extension, size_bytes, checksum_sha256, category, visibility,
             width, height, uploaded_by, processing_metadata)
           VALUES ($1,$2,$3,$4,$5,'image/webp','image/webp','webp',$6,$7,$8,$9,$10,$11,$12,$13)
           RETURNING *`,
          [
            id,
            keys.original,
            keys.optimized,
            keys.thumbnail,
            safeOriginalName(input.originalName),
            image.original.length,
            createHash('sha256').update(image.original).digest('hex'),
            input.category,
            input.visibility,
            image.width,
            image.height,
            input.adminId,
            {
              sourceMimeType: input.mimeType,
              sourceFormat: image.sourceFormat,
            },
          ],
        );
        await client.query(
          `INSERT INTO audit_logs (admin_user_id, action, entity_type, entity_id, new_data)
           VALUES ($1, 'MEDIA_UPLOADED', 'FILE', $2, $3)`,
          [
            input.adminId,
            id,
            {
              category: input.category,
              visibility: input.visibility,
              originalName: safeOriginalName(input.originalName),
            },
          ],
        );
        return result.rows[0] as Record<string, unknown>;
      });
      return mediaContract(row);
    } catch (error) {
      await Promise.all(
        moved.map((file) => rm(file, { force: true }).catch(() => undefined)),
      );
      throw error;
    } finally {
      await rm(temporaryDirectory, { recursive: true, force: true }).catch(
        () => undefined,
      );
    }
  }

  async list(filters: {
    category?: MediaCategory;
    search?: string;
    visibility?: MediaVisibility;
    deleted?: boolean;
    page: number;
    pageSize: number;
  }) {
    const clauses: string[] = [];
    const values: unknown[] = [];
    const add = (sql: string, value: unknown) => {
      values.push(value);
      clauses.push(sql.replace('?', `$${values.length}`));
    };
    if (filters.category) add('category = ?', filters.category);
    if (filters.search)
      add("original_name ILIKE '%' || ? || '%'", filters.search);
    if (filters.visibility) add('visibility = ?', filters.visibility);
    clauses.push(
      filters.deleted ? 'deleted_at IS NOT NULL' : 'deleted_at IS NULL',
    );
    const where = `WHERE ${clauses.join(' AND ')}`;
    const offset = (filters.page - 1) * filters.pageSize;
    values.push(filters.pageSize, offset);
    const [rows, count] = await Promise.all([
      this.pool.query(
        `SELECT * FROM files ${where} ORDER BY created_at DESC, id DESC LIMIT $${values.length - 1} OFFSET $${values.length}`,
        values,
      ),
      this.pool.query(
        `SELECT COUNT(*)::integer AS total FROM files ${where}`,
        values.slice(0, -2),
      ),
    ]);
    return {
      items: rows.rows.map((row) =>
        mediaContract(row as Record<string, unknown>),
      ),
      total: count.rows[0].total as number,
      page: filters.page,
      pageSize: filters.pageSize,
    };
  }

  async get(id: string) {
    const result = await this.pool.query('SELECT * FROM files WHERE id = $1', [
      id,
    ]);
    if (!result.rowCount) throw new CatalogError('NOT_FOUND', 404);
    return mediaContract(result.rows[0] as Record<string, unknown>);
  }

  async softDelete(id: string, adminId: string) {
    return withTransaction(this.pool, async (client) => {
      const locked = await client.query(
        'SELECT id, deleted_at FROM files WHERE id = $1 FOR UPDATE',
        [id],
      );
      if (!locked.rowCount) throw new CatalogError('NOT_FOUND', 404);
      if (locked.rows[0].deleted_at) return;
      const references = await client.query(
        `SELECT ARRAY_REMOVE(ARRAY[
          CASE WHEN EXISTS (SELECT 1 FROM product_media WHERE file_id = $1) THEN 'product media' END,
          CASE WHEN EXISTS (SELECT 1 FROM product_variants WHERE preview_file_id = $1) THEN 'variant preview' END,
          CASE WHEN EXISTS (SELECT 1 FROM product_option_values WHERE reference_file_id = $1) THEN 'option value' END,
          CASE WHEN EXISTS (SELECT 1 FROM order_items WHERE preview_file_id = $1) THEN 'order history' END
        ], NULL) AS types`,
        [id],
      );
      const types = references.rows[0].types as string[];
      if (types.length)
        throw new CatalogError(
          'FILE_REFERENCED',
          409,
          types.map((type) => ({
            field: 'references',
            message: `Used by ${type}.`,
          })),
        );
      await client.query('UPDATE files SET deleted_at = NOW() WHERE id = $1', [
        id,
      ]);
      await client.query(
        `INSERT INTO audit_logs (admin_user_id, action, entity_type, entity_id)
         VALUES ($1, 'MEDIA_SOFT_DELETED', 'FILE', $2)`,
        [adminId, id],
      );
    });
  }

  async openPublic(id: string, variant: 'optimized' | 'thumbnail') {
    const column =
      variant === 'optimized'
        ? 'optimized_storage_key'
        : 'thumbnail_storage_key';
    const result = await this.pool.query(
      `SELECT ${column} AS storage_key, processed_mime_type FROM files WHERE id = $1 AND visibility = 'PUBLIC' AND deleted_at IS NULL`,
      [id],
    );
    if (!result.rowCount || !result.rows[0].storage_key)
      throw new CatalogError('NOT_FOUND', 404);
    const filePath = inside(
      this.storageRoot,
      result.rows[0].storage_key as string,
    );
    try {
      const details = await stat(filePath);
      return {
        stream: createReadStream(filePath),
        size: details.size,
        mimeType: result.rows[0].processed_mime_type as string,
      };
    } catch {
      throw new CatalogError('NOT_FOUND', 404);
    }
  }
}
