import type { FastifyInstance } from 'fastify';
import { fileCategory, fileVisibility, uuid } from '@dollz/validation';
import { z } from 'zod';
import type { ReturnTypeOfGuards } from '../catalog/types.js';
import { CatalogError } from '../catalog/errors.js';
import { parseInput } from '../catalog/validation.js';
import type { MediaStorageService } from './storage-service.js';

const listSchema = z.object({
  category: fileCategory.optional(),
  search: z.string().trim().max(255).optional(),
  visibility: fileVisibility.optional(),
  deleted: z.enum(['true', 'false']).default('false'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(24),
});

export async function registerMediaRoutes(
  app: FastifyInstance,
  storage: MediaStorageService,
  guards: ReturnTypeOfGuards,
  maxUploadBytes: number,
) {
  app.get('/media/:fileId/:variant', async (request, reply) => {
    const params = parseInput(
      z.object({ fileId: uuid, variant: z.enum(['optimized', 'thumbnail']) }),
      request.params,
    );
    const file = await storage.openPublic(params.fileId, params.variant);
    return reply
      .header('content-type', file.mimeType)
      .header('content-length', String(file.size))
      .header(
        'cache-control',
        'public, max-age=86400, stale-while-revalidate=604800',
      )
      .header('x-content-type-options', 'nosniff')
      .send(file.stream);
  });

  app.get(
    '/admin/media',
    { preHandler: [guards.authenticate] },
    async (request) => {
      const query = parseInput(listSchema, request.query);
      return storage.list({ ...query, deleted: query.deleted === 'true' });
    },
  );

  app.get(
    '/admin/media/:fileId',
    { preHandler: [guards.authenticate] },
    async (request) => {
      const { fileId } = parseInput(z.object({ fileId: uuid }), request.params);
      return storage.get(fileId);
    },
  );

  app.post(
    '/admin/media/images',
    { preHandler: [guards.authenticate, guards.csrf] },
    async (request, reply) => {
      const upload = await request.file({
        limits: { fileSize: maxUploadBytes, files: 1, fields: 4 },
      });
      if (!upload) throw new CatalogError('INVALID_FILE', 400);
      let buffer: Buffer;
      try {
        buffer = await upload.toBuffer();
      } catch {
        throw new CatalogError('FILE_TOO_LARGE', 413);
      }
      const fields = upload.fields as Record<string, { value?: unknown }>;
      const values = parseInput(
        z.object({
          category: fileCategory,
          visibility: fileVisibility.default('PUBLIC'),
        }),
        {
          category: fields.category?.value,
          visibility: fields.visibility?.value ?? 'PUBLIC',
        },
      );
      const media = await storage.upload({
        buffer,
        mimeType: upload.mimetype,
        originalName: upload.filename,
        category: values.category,
        visibility: values.visibility,
        adminId: request.adminPrincipal!.id,
      });
      return reply.code(201).send({ media });
    },
  );

  app.delete(
    '/admin/media/:fileId',
    { preHandler: [guards.authenticate, guards.csrf] },
    async (request, reply) => {
      const { fileId } = parseInput(z.object({ fileId: uuid }), request.params);
      await storage.softDelete(fileId, request.adminPrincipal!.id);
      return reply.code(204).send();
    },
  );
}
