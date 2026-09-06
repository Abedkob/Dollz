import { withTransaction, type Pool } from '@dollz/database';
import type { Environment } from '../../config/environment.js';
import { SettingsError } from './errors.js';
import { SettingsRepository } from './repository.js';
import type {
  AtelierSettingsInput,
  CatalogDefaultsInput,
  OrderSettingsInput,
  ProfileSettingsInput,
} from './schemas.js';

export class SettingsService {
  constructor(
    private readonly pool: Pool,
    private readonly environment: Environment,
  ) {}

  async get() {
    const value = await new SettingsRepository(this.pool).get();
    if (!value) throw new SettingsError('NOT_FOUND', 404);
    return { settings: value };
  }

  async publicSettings() {
    const { settings } = await this.get();
    return {
      settings: {
        atelierName: settings.atelierName,
        publicEmail: settings.publicEmail,
        publicPhone: settings.publicPhone,
        whatsappNumber: settings.whatsappNumber,
        locationLabel: settings.locationLabel,
        storefrontDescription: settings.storefrontDescription,
        deliveryEnabled: settings.deliveryEnabled,
        pickupEnabled: settings.pickupEnabled,
        pickupLabel: settings.pickupLabel,
        pickupAddress: settings.pickupAddress,
        pickupCity: settings.pickupCity,
        pickupCountry: settings.pickupCountry,
        supportedCountryCodes: settings.supportedCountryCodes,
        defaultCountry: settings.defaultCountry,
        checkoutNotice: settings.checkoutNotice,
      },
    };
  }

  systemStatus() {
    return {
      environment: this.environment.NODE_ENV,
      checks: [
        {
          key: 'security',
          label: 'Human verification',
          ready:
            !this.environment.TURNSTILE_SECRET_KEY.startsWith('replace-with-'),
          detail: 'Protects login and customer requests.',
        },
        {
          key: 'storage',
          label: 'Media storage',
          ready: Boolean(this.environment.STORAGE_ROOT),
          detail: 'Product image storage is configured.',
        },
        {
          key: 'notifications',
          label: 'Notification delivery',
          ready: false,
          detail:
            'Events are queued, but no email or messaging provider is connected yet.',
        },
      ],
    };
  }

  private async update(
    adminId: string,
    action: string,
    updater: (repository: SettingsRepository) => Promise<unknown>,
  ) {
    return withTransaction(this.pool, async (client) => {
      const repository = new SettingsRepository(client);
      const previous = await repository.get();
      if (!previous) throw new SettingsError('NOT_FOUND', 404);
      const next = await updater(repository);
      if (!next) throw new SettingsError('CONCURRENCY_CONFLICT', 409);
      await repository.audit(adminId, action, previous, next);
      return { settings: next };
    });
  }

  updateAtelier(input: AtelierSettingsInput, adminId: string) {
    return this.update(adminId, 'ATELIER_SETTINGS_UPDATED', (repository) =>
      repository.updateAtelier(input, adminId),
    );
  }

  updateOrders(input: OrderSettingsInput, adminId: string) {
    return this.update(adminId, 'ORDER_SETTINGS_UPDATED', (repository) =>
      repository.updateOrders(input, adminId),
    );
  }

  updateCatalog(input: CatalogDefaultsInput, adminId: string) {
    return this.update(adminId, 'CATALOG_DEFAULTS_UPDATED', (repository) =>
      repository.updateCatalog(input, adminId),
    );
  }

  async updateProfile(input: ProfileSettingsInput, adminId: string) {
    return withTransaction(this.pool, async (client) => {
      const repository = new SettingsRepository(client);
      const profile = await repository.updateProfile(adminId, input.fullName);
      if (!profile) throw new SettingsError('NOT_FOUND', 404);
      await repository.audit(adminId, 'ADMIN_PROFILE_UPDATED', undefined, {
        fullName: profile.fullName,
      });
      return { profile };
    });
  }
}
