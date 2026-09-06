import { z, type ZodType } from 'zod';
import { currencyCode, hexColor, uuid } from '@dollz/validation';
import { OrderError } from './errors.js';

const optionalText = (max: number) =>
  z.string().trim().max(max).nullable().optional();
const expectedVersion = z.object({
  expectedVersion: z.number().int().positive(),
});

export const orderSubmissionSchema = z.object({
  submissionKey: z.string().min(32).max(256),
  customer: z.object({
    fullName: z.string().trim().min(2).max(200),
    email: z.string().trim().toLowerCase().email().max(320),
    phone: optionalText(50),
    preferredContactMethod: z.enum(['EMAIL', 'PHONE', 'WHATSAPP']),
  }),
  delivery: z.object({
    addressLine1: z.string().trim().min(1).max(500),
    addressLine2: optionalText(500),
    city: z.string().trim().min(1).max(150),
    region: optionalText(150),
    country: z.string().trim().min(2).max(100),
    postalCode: optionalText(30),
    shippingMethod: z.enum(['DELIVERY', 'PICKUP']),
  }),
  notes: optionalText(4000),
  items: z
    .array(
      z.object({
        productId: uuid,
        variantId: uuid,
        quantity: z.number().int().min(1).max(100),
        customerRequest: optionalText(4000),
        notes: optionalText(4000),
        previewFileId: uuid.nullable().optional(),
        selections: z
          .array(
            z.object({
              optionId: uuid,
              optionValueId: uuid.nullable(),
              customValue: optionalText(1000),
              customColor: hexColor.nullable().optional(),
            }),
          )
          .max(100),
      }),
    )
    .min(1)
    .max(20),
  turnstileToken: z.string().min(1).max(4096),
});

export const exchangeSchema = z.object({
  orderNumber: z.string().trim().min(1).max(50),
  token: z.string().min(32).max(1024),
});
export const orderNumberParams = z.object({
  orderNumber: z.string().trim().min(1).max(50),
});
export const orderIdParams = z.object({ orderId: uuid });
export const revisionParams = orderNumberParams.extend({ revisionId: uuid });
export const guestMessageSchema = z.object({
  message: z.string().trim().min(1).max(4000),
});
export const revisionResponseSchema = z.object({
  response: z.enum(['ACCEPT', 'DECLINE', 'REQUEST_CLARIFICATION', 'RESUBMIT']),
  message: optionalText(4000),
  replacements: z
    .array(
      z.object({
        orderItemId: uuid,
        selections: z
          .array(
            z.object({
              optionId: uuid,
              optionValueId: uuid.nullable(),
              customValue: optionalText(1000),
              customColor: hexColor.nullable().optional(),
            }),
          )
          .max(100),
      }),
    )
    .max(20)
    .optional(),
});

export const adminOrderListSchema = z.object({
  search: z.string().trim().max(200).default(''),
  status: z
    .enum([
      'SUBMITTED',
      'UNDER_REVIEW',
      'CHANGES_REQUESTED',
      'AWAITING_PAYMENT',
      'PAID',
      'IN_PRODUCTION',
      'READY',
      'SHIPPED',
      'DELIVERED',
      'REJECTED',
      'CANCELLED',
    ])
    .optional(),
  pricingStatus: z.enum(['ESTIMATE', 'FINAL']).optional(),
  paymentStatus: z
    .enum(['NONE', 'REQUESTED', 'PENDING', 'VERIFIED', 'CANCELLED'])
    .optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  dueBefore: z.coerce.date().optional(),
  requiresAction: z.enum(['true', 'false']).optional(),
  sort: z.enum(['newest', 'oldest', 'completion']).default('newest'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const versionSchema = expectedVersion;
export const requestChangesSchema = expectedVersion.extend({
  messageToCustomer: z.string().trim().min(1).max(4000),
  requestedChanges: z
    .array(
      z.object({
        orderItemId: uuid,
        optionCode: z.string().trim().min(1).max(100),
        message: z.string().trim().min(1).max(1000),
      }),
    )
    .max(100),
});
export const approveSchema = expectedVersion.extend({
  items: z
    .array(
      z.object({
        orderItemId: uuid,
        finalUnitPriceMinor: z.number().int().min(0).max(100_000_000),
      }),
    )
    .min(1)
    .max(20),
  deliveryFeeMinor: z.number().int().min(0).max(100_000_000),
  estimatedCompletionDate: z.iso.date(),
  paymentMethod: z.string().trim().min(1).max(50).default('MANUAL'),
  paymentInstructions: z.string().trim().min(1).max(4000),
  messageToCustomer: z.string().trim().min(1).max(4000),
  paymentDueAt: z.iso.datetime().optional(),
});
export const rejectSchema = expectedVersion.extend({
  reason: z.string().trim().min(1).max(4000),
  internalReason: optionalText(4000),
});
export const cancelSchema = expectedVersion.extend({
  reason: z.string().trim().min(1).max(4000),
  customerVisible: z.boolean(),
  exceptional: z.boolean().default(false),
  auditReason: optionalText(4000),
});
export const adminMessageSchema = expectedVersion.extend({
  message: z.string().trim().min(1).max(4000),
});
export const paymentRequestSchema = expectedVersion.extend({
  amountMinor: z.number().int().positive().max(100_000_000),
  currency: currencyCode,
  method: z.string().trim().min(1).max(50).default('MANUAL'),
  instructions: z.string().trim().min(1).max(4000),
  dueAt: z.iso.datetime().optional(),
});
export const paymentVerifySchema = expectedVersion.extend({
  paymentId: uuid,
  externalReference: z.string().trim().min(1).max(500),
  receivedAt: z.iso.datetime(),
  adminNotes: optionalText(4000),
});
export const statusSchema = expectedVersion.extend({
  action: z.enum([
    'START_PRODUCTION',
    'MARK_READY',
    'MARK_SHIPPED',
    'MARK_DELIVERED',
  ]),
  message: optionalText(4000),
  shippingMethod: z.enum(['DELIVERY', 'PICKUP']).optional(),
  trackingReference: optionalText(500),
  trackingUrl: z.string().url().max(2000).nullable().optional(),
});
export const shippingSchema = expectedVersion.extend({
  shippingMethod: z.enum(['DELIVERY', 'PICKUP']),
  trackingReference: optionalText(500),
  trackingUrl: z.string().url().max(2000).nullable().optional(),
});

export function parseOrderInput<T>(schema: ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  throw new OrderError(
    'VALIDATION_ERROR',
    400,
    result.error.issues.map((issue) => ({
      field: issue.path.join('.') || 'request',
      message: issue.message,
    })),
  );
}

export type OrderSubmissionInput = z.infer<typeof orderSubmissionSchema>;
export type AdminOrderListInput = z.infer<typeof adminOrderListSchema>;
