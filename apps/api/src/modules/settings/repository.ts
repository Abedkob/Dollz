import type { Pool, PoolClient } from '@dollz/database';
import type {
  AtelierSettingsInput,
  CatalogDefaultsInput,
  OrderSettingsInput,
} from './schemas.js';

type Database = Pool | PoolClient;
type Row = Record<string, unknown>;
const nullable = (value: unknown) => (value == null ? null : String(value));

export function settingsContract(row: Row) {
  return {
    atelierName: String(row.atelier_name),
    publicEmail: nullable(row.public_email),
    publicPhone: nullable(row.public_phone),
    whatsappNumber: nullable(row.whatsapp_number),
    locationLabel: String(row.location_label),
    storefrontDescription: String(row.storefront_description),
    deliveryEnabled: Boolean(row.delivery_enabled),
    pickupEnabled: Boolean(row.pickup_enabled),
    pickupLabel: String(row.pickup_label),
    pickupAddress: nullable(row.pickup_address),
    pickupCity: String(row.pickup_city),
    pickupCountry: String(row.pickup_country),
    supportedCountryCodes: row.supported_country_codes as string[],
    defaultCountry: String(row.default_country),
    checkoutNotice: String(row.checkout_notice),
    defaultCurrency: String(row.default_currency),
    defaultProductionMinDays: Number(row.default_production_min_days),
    defaultProductionMaxDays: Number(row.default_production_max_days),
    version: Number(row.version),
    updatedAt: row.updated_at,
  };
}

export class SettingsRepository {
  constructor(private readonly database: Database) {}

  async get() {
    const result = await this.database.query(
      'SELECT * FROM store_settings WHERE id=TRUE',
    );
    return result.rowCount ? settingsContract(result.rows[0] as Row) : null;
  }

  async updateAtelier(input: AtelierSettingsInput, adminId: string) {
    const result = await this.database.query(
      `UPDATE store_settings SET atelier_name=$1,public_email=$2,public_phone=$3,whatsapp_number=$4,
       location_label=$5,storefront_description=$6,updated_by=$7,version=version+1
       WHERE id=TRUE AND version=$8 RETURNING *`,
      [
        input.atelierName,
        input.publicEmail,
        input.publicPhone ?? null,
        input.whatsappNumber ?? null,
        input.locationLabel,
        input.storefrontDescription,
        adminId,
        input.version,
      ],
    );
    return result.rowCount ? settingsContract(result.rows[0] as Row) : null;
  }

  async updateOrders(input: OrderSettingsInput, adminId: string) {
    const result = await this.database.query(
      `UPDATE store_settings SET delivery_enabled=$1,pickup_enabled=$2,pickup_label=$3,pickup_address=$4,
       pickup_city=$5,pickup_country=$6,supported_country_codes=$7,default_country=$8,checkout_notice=$9,
       updated_by=$10,version=version+1 WHERE id=TRUE AND version=$11 RETURNING *`,
      [
        input.deliveryEnabled,
        input.pickupEnabled,
        input.pickupLabel,
        input.pickupAddress ?? null,
        input.pickupCity,
        input.pickupCountry,
        [...new Set(input.supportedCountryCodes)],
        input.defaultCountry,
        input.checkoutNotice,
        adminId,
        input.version,
      ],
    );
    return result.rowCount ? settingsContract(result.rows[0] as Row) : null;
  }

  async updateCatalog(input: CatalogDefaultsInput, adminId: string) {
    const result = await this.database.query(
      `UPDATE store_settings SET default_currency=$1,default_production_min_days=$2,default_production_max_days=$3,
       updated_by=$4,version=version+1 WHERE id=TRUE AND version=$5 RETURNING *`,
      [
        input.defaultCurrency,
        input.defaultProductionMinDays,
        input.defaultProductionMaxDays,
        adminId,
        input.version,
      ],
    );
    return result.rowCount ? settingsContract(result.rows[0] as Row) : null;
  }

  async updateProfile(adminId: string, fullName: string | null) {
    const result = await this.database.query(
      'UPDATE admin_users SET full_name=$2 WHERE id=$1 RETURNING id,email,full_name,role',
      [adminId, fullName],
    );
    return result.rowCount
      ? {
          id: String(result.rows[0].id),
          email: String(result.rows[0].email),
          fullName: nullable(result.rows[0].full_name),
          role: 'SUPER_ADMIN' as const,
        }
      : null;
  }

  audit(adminId: string, action: string, previous: unknown, next: unknown) {
    return this.database.query(
      `INSERT INTO audit_logs(admin_user_id,action,entity_type,previous_data,new_data)
       VALUES($1,$2,'STORE_SETTINGS',$3,$4)`,
      [adminId, action, previous, next],
    );
  }
}
