import { z } from 'zod';
import { SettingsError } from './errors.js';

const optionalText = (max: number) =>
  z.string().trim().max(max).nullable().optional();
const version = z.number().int().positive();
const country = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2}$/);

export const atelierSettingsSchema = z.object({
  version,
  atelierName: z.string().trim().min(1).max(120),
  publicEmail: z.string().trim().toLowerCase().email().max(320).nullable(),
  publicPhone: optionalText(50),
  whatsappNumber: optionalText(50),
  locationLabel: z.string().trim().min(1).max(200),
  storefrontDescription: z.string().trim().min(1).max(500),
});

export const orderSettingsSchema = z
  .object({
    version,
    deliveryEnabled: z.boolean(),
    pickupEnabled: z.boolean(),
    pickupLabel: z.string().trim().min(1).max(150),
    pickupAddress: optionalText(500),
    pickupCity: z.string().trim().min(1).max(150),
    pickupCountry: country,
    supportedCountryCodes: z.array(country).min(1).max(50),
    defaultCountry: country,
    checkoutNotice: z.string().trim().min(1).max(500),
  })
  .superRefine((value, context) => {
    if (!value.deliveryEnabled && !value.pickupEnabled)
      context.addIssue({
        code: 'custom',
        path: ['deliveryEnabled'],
        message: 'Enable delivery, pickup, or both.',
      });
    if (!value.supportedCountryCodes.includes(value.defaultCountry))
      context.addIssue({
        code: 'custom',
        path: ['defaultCountry'],
        message: 'The default country must be supported.',
      });
  });

export const catalogDefaultsSchema = z
  .object({
    version,
    defaultCurrency: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{3}$/),
    defaultProductionMinDays: z.number().int().min(1).max(365),
    defaultProductionMaxDays: z.number().int().min(1).max(365),
  })
  .refine(
    (value) => value.defaultProductionMaxDays >= value.defaultProductionMinDays,
    {
      path: ['defaultProductionMaxDays'],
      message: 'Maximum days must be at least the minimum.',
    },
  );

export const profileSettingsSchema = z.object({
  fullName: z.string().trim().min(2).max(150).nullable(),
});

export function parseSettingsInput<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  throw new SettingsError(
    'VALIDATION_ERROR',
    400,
    result.error.issues.map((issue) => ({
      field: issue.path.join('.') || 'request',
      message: issue.message,
    })),
  );
}

export type AtelierSettingsInput = z.infer<typeof atelierSettingsSchema>;
export type OrderSettingsInput = z.infer<typeof orderSettingsSchema>;
export type CatalogDefaultsInput = z.infer<typeof catalogDefaultsSchema>;
export type ProfileSettingsInput = z.infer<typeof profileSettingsSchema>;
