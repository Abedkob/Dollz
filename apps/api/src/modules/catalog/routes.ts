import type { FastifyInstance, FastifyReply } from 'fastify';
import {
  conflictSchema,
  optionValueSchema,
  optionValueUpdateSchema,
  productCreateSchema,
  productListSchema,
  productMediaSchema,
  productMediaUpdateSchema,
  productOptionSchema,
  productOptionUpdateSchema,
  productUpdateSchema,
  reorderSchema,
  uuid,
  variantSchema,
  variantUpdateSchema,
} from '@dollz/validation';
import { z } from 'zod';
import type { ReturnTypeOfGuards } from './types.js';
import { parseInput } from './validation.js';
import type { CatalogService } from './service.js';

const productParams = z.object({ productId: uuid });
const publicProductParams = z.object({
  slug: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
});
const variantParams = productParams.extend({ variantId: uuid });
const mediaParams = productParams.extend({ mediaId: uuid });
const optionParams = productParams.extend({ optionId: uuid });
const valueParams = optionParams.extend({ valueId: uuid });
const conflictParams = productParams.extend({ conflictId: uuid });
const presetParams = productParams.extend({
  presetCode: z.enum(['eye-color', 'hair-color', 'skin-tone', 'outfit-color']),
});
const admin = (request: { adminPrincipal?: { id: string } }) =>
  request.adminPrincipal!.id;
const noContent = (reply: FastifyReply) => reply.code(204).send();

export async function registerCatalogRoutes(
  app: FastifyInstance,
  service: CatalogService,
  guards: ReturnTypeOfGuards,
) {
  const read = { preHandler: [guards.authenticate] };
  const write = { preHandler: [guards.authenticate, guards.csrf] };

  app.get('/catalog/products', async () => service.listPublicProducts());
  app.get('/catalog/products/:slug', async (request) =>
    service.getPublicProduct(
      parseInput(publicProductParams, request.params).slug,
    ),
  );

  app.get('/admin/products', read, async (request) =>
    service.listProducts(parseInput(productListSchema, request.query)),
  );
  app.post('/admin/products', write, async (request, reply) =>
    reply.code(201).send({
      product: await service.createProduct(
        parseInput(productCreateSchema, request.body),
        admin(request),
      ),
    }),
  );
  app.get('/admin/products/:productId', read, async (request) =>
    service.getProduct(parseInput(productParams, request.params).productId),
  );
  app.patch('/admin/products/:productId', write, async (request) => ({
    product: await service.updateProduct(
      parseInput(productParams, request.params).productId,
      parseInput(productUpdateSchema, request.body),
      admin(request),
    ),
  }));
  app.delete('/admin/products/:productId', write, async (request) => ({
    product: await service.archive(
      parseInput(productParams, request.params).productId,
      admin(request),
    ),
  }));
  app.post('/admin/products/:productId/archive', write, async (request) => ({
    product: await service.archive(
      parseInput(productParams, request.params).productId,
      admin(request),
    ),
  }));
  app.post('/admin/products/:productId/unpublish', write, async (request) => ({
    product: await service.unpublish(
      parseInput(productParams, request.params).productId,
      admin(request),
    ),
  }));
  app.get(
    '/admin/products/:productId/publishing-checklist',
    read,
    async (request) =>
      service.publishingChecklist(
        parseInput(productParams, request.params).productId,
      ),
  );
  app.post('/admin/products/:productId/publish', write, async (request) => ({
    product: await service.publish(
      parseInput(productParams, request.params).productId,
      admin(request),
    ),
  }));

  app.get('/admin/products/:productId/media', read, async (request) => ({
    items: await service.listMedia(
      parseInput(productParams, request.params).productId,
    ),
  }));
  app.post(
    '/admin/products/:productId/media',
    write,
    async (request, reply) => {
      const { productId } = parseInput(productParams, request.params);
      return reply.code(201).send({
        media: await service.addMedia(
          productId,
          parseInput(productMediaSchema, request.body),
          admin(request),
        ),
      });
    },
  );
  app.patch(
    '/admin/products/:productId/media/:mediaId',
    write,
    async (request) => {
      const p = parseInput(mediaParams, request.params);
      return {
        media: await service.updateMedia(
          p.productId,
          p.mediaId,
          parseInput(productMediaUpdateSchema, request.body),
          admin(request),
        ),
      };
    },
  );
  app.delete(
    '/admin/products/:productId/media/:mediaId',
    write,
    async (request, reply) => {
      const p = parseInput(mediaParams, request.params);
      await service.removeMedia(p.productId, p.mediaId, admin(request));
      return noContent(reply);
    },
  );
  app.post(
    '/admin/products/:productId/media/reorder',
    write,
    async (request, reply) => {
      const { productId } = parseInput(productParams, request.params);
      await service.reorder(
        productId,
        'product_media',
        parseInput(reorderSchema, request.body).ids,
        admin(request),
      );
      return noContent(reply);
    },
  );
  app.post(
    '/admin/products/:productId/media/:mediaId/set-primary',
    write,
    async (request) => {
      const p = parseInput(mediaParams, request.params);
      return {
        media: await service.setPrimaryMedia(
          p.productId,
          p.mediaId,
          admin(request),
        ),
      };
    },
  );

  app.get('/admin/products/:productId/variants', read, async (request) => ({
    items: await service.listVariants(
      parseInput(productParams, request.params).productId,
    ),
  }));
  app.post(
    '/admin/products/:productId/variants',
    write,
    async (request, reply) => {
      const { productId } = parseInput(productParams, request.params);
      return reply.code(201).send({
        variant: await service.createVariant(
          productId,
          parseInput(variantSchema, request.body),
          admin(request),
        ),
      });
    },
  );
  app.patch(
    '/admin/products/:productId/variants/:variantId',
    write,
    async (request) => {
      const p = parseInput(variantParams, request.params);
      return {
        variant: await service.updateVariant(
          p.productId,
          p.variantId,
          parseInput(variantUpdateSchema, request.body),
          admin(request),
        ),
      };
    },
  );
  app.delete(
    '/admin/products/:productId/variants/:variantId',
    write,
    async (request, reply) => {
      const p = parseInput(variantParams, request.params);
      await service.deactivate(
        p.productId,
        'product_variants',
        p.variantId,
        admin(request),
      );
      return noContent(reply);
    },
  );
  app.post(
    '/admin/products/:productId/variants/reorder',
    write,
    async (request, reply) => {
      const { productId } = parseInput(productParams, request.params);
      await service.reorder(
        productId,
        'product_variants',
        parseInput(reorderSchema, request.body).ids,
        admin(request),
      );
      return noContent(reply);
    },
  );
  app.post(
    '/admin/products/:productId/variants/:variantId/set-default',
    write,
    async (request) => {
      const p = parseInput(variantParams, request.params);
      return {
        variant: await service.setDefaultVariant(
          p.productId,
          p.variantId,
          admin(request),
        ),
      };
    },
  );

  app.get('/admin/products/:productId/options', read, async (request) => ({
    items: await service.listOptions(
      parseInput(productParams, request.params).productId,
    ),
  }));
  app.post(
    '/admin/products/:productId/options',
    write,
    async (request, reply) => {
      const { productId } = parseInput(productParams, request.params);
      return reply.code(201).send({
        option: await service.createOption(
          productId,
          parseInput(productOptionSchema, request.body),
          admin(request),
        ),
      });
    },
  );
  app.post(
    '/admin/products/:productId/options/presets/:presetCode',
    write,
    async (request, reply) => {
      const params = parseInput(presetParams, request.params);
      return reply.code(201).send({
        option: await service.applyOptionPreset(
          params.productId,
          params.presetCode,
          admin(request),
        ),
      });
    },
  );
  app.patch(
    '/admin/products/:productId/options/:optionId',
    write,
    async (request) => {
      const p = parseInput(optionParams, request.params);
      return {
        option: await service.updateOption(
          p.productId,
          p.optionId,
          parseInput(productOptionUpdateSchema, request.body),
          admin(request),
        ),
      };
    },
  );
  app.delete(
    '/admin/products/:productId/options/:optionId',
    write,
    async (request, reply) => {
      const p = parseInput(optionParams, request.params);
      await service.deactivate(
        p.productId,
        'product_options',
        p.optionId,
        admin(request),
      );
      return noContent(reply);
    },
  );
  app.post(
    '/admin/products/:productId/options/reorder',
    write,
    async (request, reply) => {
      const { productId } = parseInput(productParams, request.params);
      await service.reorder(
        productId,
        'product_options',
        parseInput(reorderSchema, request.body).ids,
        admin(request),
      );
      return noContent(reply);
    },
  );

  app.get(
    '/admin/products/:productId/options/:optionId/values',
    read,
    async (request) => {
      const p = parseInput(optionParams, request.params);
      return { items: await service.listValues(p.productId, p.optionId) };
    },
  );
  app.post(
    '/admin/products/:productId/options/:optionId/values',
    write,
    async (request, reply) => {
      const p = parseInput(optionParams, request.params);
      return reply.code(201).send({
        value: await service.createValue(
          p.productId,
          p.optionId,
          parseInput(optionValueSchema, request.body),
          admin(request),
        ),
      });
    },
  );
  app.patch(
    '/admin/products/:productId/options/:optionId/values/:valueId',
    write,
    async (request) => {
      const p = parseInput(valueParams, request.params);
      return {
        value: await service.updateValue(
          p.productId,
          p.optionId,
          p.valueId,
          parseInput(optionValueUpdateSchema, request.body),
          admin(request),
        ),
      };
    },
  );
  app.delete(
    '/admin/products/:productId/options/:optionId/values/:valueId',
    write,
    async (request, reply) => {
      const p = parseInput(valueParams, request.params);
      await service.deactivateValue(
        p.productId,
        p.optionId,
        p.valueId,
        admin(request),
      );
      return noContent(reply);
    },
  );
  app.post(
    '/admin/products/:productId/options/:optionId/values/reorder',
    write,
    async (request, reply) => {
      const p = parseInput(optionParams, request.params);
      await service.reorderValues(
        p.productId,
        p.optionId,
        parseInput(reorderSchema, request.body).ids,
        admin(request),
      );
      return noContent(reply);
    },
  );
  app.post(
    '/admin/products/:productId/options/:optionId/values/:valueId/set-default',
    write,
    async (request) => {
      const p = parseInput(valueParams, request.params);
      return {
        value: await service.setDefaultValue(
          p.productId,
          p.optionId,
          p.valueId,
          admin(request),
        ),
      };
    },
  );

  app.get(
    '/admin/products/:productId/option-conflicts',
    read,
    async (request) => ({
      items: await service.listConflicts(
        parseInput(productParams, request.params).productId,
      ),
    }),
  );
  app.post(
    '/admin/products/:productId/option-conflicts',
    write,
    async (request, reply) => {
      const { productId } = parseInput(productParams, request.params);
      return reply.code(201).send({
        conflict: await service.createConflict(
          productId,
          parseInput(conflictSchema, request.body),
          admin(request),
        ),
      });
    },
  );
  app.delete(
    '/admin/products/:productId/option-conflicts/:conflictId',
    write,
    async (request, reply) => {
      const p = parseInput(conflictParams, request.params);
      await service.deleteConflict(p.productId, p.conflictId, admin(request));
      return noContent(reply);
    },
  );
}
