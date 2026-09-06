import type { FastifyInstance } from 'fastify';
import type { ReturnTypeOfGuards } from '../catalog/types.js';
import {
  atelierSettingsSchema,
  catalogDefaultsSchema,
  orderSettingsSchema,
  parseSettingsInput,
  profileSettingsSchema,
} from './schemas.js';
import type { SettingsService } from './service.js';

const admin = (request: { adminPrincipal?: { id: string } }) =>
  request.adminPrincipal!.id;

export async function registerSettingsRoutes(
  app: FastifyInstance,
  service: SettingsService,
  guards: ReturnTypeOfGuards,
) {
  const read = { preHandler: [guards.authenticate] };
  const write = { preHandler: [guards.authenticate, guards.csrf] };

  app.get('/store/settings', async () => service.publicSettings());
  app.get('/admin/settings', read, async () => service.get());
  app.get('/admin/settings/system-status', read, async () =>
    service.systemStatus(),
  );
  app.patch('/admin/settings/atelier', write, async (request) =>
    service.updateAtelier(
      parseSettingsInput(atelierSettingsSchema, request.body),
      admin(request),
    ),
  );
  app.patch('/admin/settings/orders', write, async (request) =>
    service.updateOrders(
      parseSettingsInput(orderSettingsSchema, request.body),
      admin(request),
    ),
  );
  app.patch('/admin/settings/catalog-defaults', write, async (request) =>
    service.updateCatalog(
      parseSettingsInput(catalogDefaultsSchema, request.body),
      admin(request),
    ),
  );
  app.patch('/admin/settings/profile', write, async (request) =>
    service.updateProfile(
      parseSettingsInput(profileSettingsSchema, request.body),
      admin(request),
    ),
  );
}
