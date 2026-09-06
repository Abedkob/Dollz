import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { withTransaction, type Pool } from '@dollz/database';
import type { TurnstileVerifier } from '../auth/turnstile.js';
import { OrderError } from './errors.js';
import { isDatabaseCode, OrderRepository } from './repository.js';
import type { OrderNotificationType } from './notifications.js';
import type { AdminOrderListInput, OrderSubmissionInput } from './schemas.js';

const sha256 = (value: string) =>
  createHash('sha256').update(value).digest('hex');
const token = () => randomBytes(32).toString('base64url');
const jsonHash = (value: unknown) => sha256(JSON.stringify(value));
const nowIso = () => new Date().toISOString();

function safeEqualHex(first: string, second: string) {
  const a = Buffer.from(first, 'hex');
  const b = Buffer.from(second, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

function countryCode(country: string) {
  const normalized = country.trim().toUpperCase();
  const known: Record<string, string> = {
    LEBANON: 'LB',
    'UNITED STATES': 'US',
    CANADA: 'CA',
    FRANCE: 'FR',
    GERMANY: 'DE',
    'UNITED KINGDOM': 'GB',
  };
  if (/^[A-Z]{2}$/.test(normalized)) return normalized;
  const resolved = known[normalized];
  if (!resolved)
    throw new OrderError('VALIDATION_ERROR', 400, [
      {
        field: 'delivery.country',
        message: 'Use a supported country name or two-letter country code.',
      },
    ]);
  return resolved;
}

interface ValidatedSelection {
  optionId: string;
  optionValueId: string | null;
  optionCode: string;
  optionName: string;
  inputType: string;
  valueCode: string | null;
  valueLabel: string;
  colorHex: string | null;
  referenceStorageKey: string | null;
  priceAdjustmentMinor: number;
  affects3d: boolean;
  threeDProperty: string | null;
  customValue: string | null;
}

interface ValidatedItem {
  productId: string;
  variantId: string;
  productName: string;
  productSlug: string;
  variantName: string;
  variantSku: string;
  variantSize: string | null;
  modelKey: string | null;
  quantity: number;
  estimatedUnitPriceMinor: number;
  estimatedTotalMinor: number;
  currency: string;
  customerRequest: string | null;
  notes: string | null;
  previewFileId: null;
  selections: ValidatedSelection[];
}

const value = (row: Record<string, unknown>, key: string) => row[key];
const stringValue = (row: Record<string, unknown>, key: string) =>
  String(row[key]);
const numberValue = (row: Record<string, unknown>, key: string) =>
  Number(row[key]);

function orderSummary(row: Record<string, unknown>) {
  return {
    id: value(row, 'id'),
    orderNumber: value(row, 'order_number'),
    customerName: value(row, 'customer_name'),
    customerEmail: value(row, 'customer_email'),
    customerPhone: value(row, 'customer_phone'),
    dollCount: numberValue(row, 'doll_count'),
    status: value(row, 'status'),
    pricingStatus: value(row, 'pricing_status'),
    paymentStatus: value(row, 'payment_status'),
    totalMinor:
      value(row, 'final_total_minor') ?? value(row, 'estimated_subtotal_minor'),
    currency: value(row, 'currency'),
    submittedAt: value(row, 'submitted_at'),
    estimatedCompletionDate: value(row, 'estimated_completion_date'),
    version: value(row, 'version'),
    requiresAction: value(row, 'requires_action'),
  };
}

function detailContract(
  detail: NonNullable<Awaited<ReturnType<OrderRepository['detail']>>>,
  internal: boolean,
) {
  const order = detail.order as Record<string, unknown>;
  return {
    order: {
      id: internal ? value(order, 'id') : undefined,
      orderNumber: value(order, 'order_number'),
      customerName: value(order, 'customer_name'),
      customerEmail: internal ? value(order, 'customer_email') : undefined,
      customerPhone: internal ? value(order, 'customer_phone') : undefined,
      preferredContactMethod: value(order, 'preferred_contact_method'),
      delivery: {
        addressLine1: internal
          ? value(order, 'delivery_address_line1')
          : undefined,
        addressLine2: internal
          ? value(order, 'delivery_address_line2')
          : undefined,
        city: value(order, 'delivery_city'),
        region: value(order, 'delivery_region'),
        postalCode: internal ? value(order, 'delivery_postal_code') : undefined,
        countryCode: value(order, 'delivery_country_code'),
        shippingMethod: value(order, 'shipping_method'),
      },
      customerNotes: internal ? value(order, 'customer_notes') : undefined,
      status: value(order, 'status'),
      pricingStatus: value(order, 'pricing_status'),
      estimatedSubtotalMinor: value(order, 'estimated_subtotal_minor'),
      finalSubtotalMinor: value(order, 'final_subtotal_minor'),
      deliveryFeeMinor: value(order, 'delivery_fee_minor'),
      finalTotalMinor: value(order, 'final_total_minor'),
      currency: value(order, 'currency'),
      submittedAt: value(order, 'submitted_at'),
      estimatedCompletionDate: value(order, 'estimated_completion_date'),
      paymentDueAt: value(order, 'payment_due_at'),
      trackingReference: value(order, 'tracking_reference'),
      trackingUrl: value(order, 'tracking_url'),
      version: internal ? value(order, 'version') : undefined,
    },
    items: detail.items.map((raw) => {
      const item = raw as Record<string, unknown>;
      return {
        id: value(item, 'id'),
        productName: value(item, 'product_name_snapshot'),
        productSlug: value(item, 'product_slug_snapshot'),
        variantName: value(item, 'variant_name_snapshot'),
        variantSku: value(item, 'variant_sku_snapshot'),
        variantSize: value(item, 'variant_size_snapshot'),
        modelKey: value(item, 'variant_model_key_snapshot'),
        quantity: value(item, 'quantity'),
        estimatedUnitPriceMinor: value(item, 'estimated_unit_price_minor'),
        estimatedTotalMinor: value(item, 'estimated_total_minor'),
        finalUnitPriceMinor: value(item, 'final_unit_price_minor'),
        finalTotalMinor: value(item, 'final_total_minor'),
        currency: value(item, 'currency'),
        customerRequest: value(item, 'customer_request'),
        notes: internal ? value(item, 'customer_notes') : undefined,
        previewFileId: value(item, 'preview_file_id'),
        selections: (
          (value(item, 'selections') as Record<string, unknown>[]) ?? []
        ).map((selection) => ({
          optionCode: value(selection, 'option_code_snapshot'),
          optionName: value(selection, 'option_name_snapshot'),
          inputType: value(selection, 'input_type_snapshot'),
          valueCode: value(selection, 'value_code_snapshot'),
          valueLabel: value(selection, 'value_label_snapshot'),
          colorHex: value(selection, 'color_hex_snapshot'),
          priceAdjustmentMinor: value(
            selection,
            'price_adjustment_minor_snapshot',
          ),
          affects3d: value(selection, 'affects_3d_snapshot'),
          threeDProperty: value(selection, 'three_d_property_snapshot'),
          customValue: value(selection, 'custom_value_snapshot'),
        })),
      };
    }),
    messages: detail.messages.map((row) => ({
      id: row.id,
      senderType: row.sender_type,
      message: row.message,
      isInternal: internal ? row.is_internal : undefined,
      createdAt: row.created_at,
    })),
    history: detail.history.map((row) => ({
      id: row.id,
      previousStatus: row.previous_status,
      newStatus: row.new_status,
      message: row.public_message,
      internalNotes: internal ? row.internal_notes : undefined,
      createdAt: row.created_at,
    })),
    revisions: detail.revisions.map((row) => ({
      id: row.id,
      revisionNumber: row.revision_number,
      revisionType: row.revision_type,
      customerMessage: row.customer_message,
      subtotalMinor: row.proposed_subtotal_minor,
      deliveryFeeMinor: row.proposed_delivery_fee_minor,
      totalMinor: row.proposed_total_minor,
      estimatedCompletionDate: row.estimated_completion_date,
      configuration: row.configuration_snapshot,
      customerResponse: row.customer_response,
      customerResponseMessage: row.customer_response_message,
      customerRespondedAt: row.customer_responded_at,
      internalMessage: internal ? row.internal_message : undefined,
      createdAt: row.created_at,
    })),
    payments: detail.payments.map((row) => ({
      id: row.id,
      method: row.method,
      status: row.status,
      amountMinor: row.amount_minor,
      currency: row.currency,
      externalReference: internal ? row.external_reference : undefined,
      adminNotes: internal ? row.admin_notes : undefined,
      instructions:
        internal || detail.revisions[0]?.customer_response === 'ACCEPTED'
          ? row.instructions
          : undefined,
      requestedAt: row.requested_at,
      receivedAt: row.received_at,
      verifiedAt: row.verified_at,
      dueAt: row.due_at,
    })),
    access: internal
      ? detail.access.map((row) => ({
          id: row.id,
          purpose: row.purpose,
          expiresAt: row.expires_at,
          lastUsedAt: row.last_used_at,
          revokedAt: row.revoked_at,
          createdAt: row.created_at,
        }))
      : undefined,
    activity: internal
      ? detail.activity.map((row) => ({
          id: row.id,
          action: row.action,
          createdAt: row.created_at,
        }))
      : undefined,
  };
}

export class OrderService {
  constructor(
    private readonly pool: Pool,
    private readonly turnstile: TurnstileVerifier,
  ) {}

  private async validateItem(
    repository: OrderRepository,
    item: OrderSubmissionInput['items'][number],
    index: number,
  ): Promise<ValidatedItem> {
    if (item.previewFileId)
      throw new OrderError('ORDER_CONFIGURATION_INVALID', 422, [
        {
          field: `items.${index}.previewFileId`,
          message: 'Private preview uploads are not enabled yet.',
        },
      ]);
    const catalog = (await repository.catalogItem(
      item.productId,
      item.variantId,
    )) as Record<string, unknown> | undefined;
    if (!catalog || catalog.status !== 'ACTIVE' || catalog.archived_at)
      throw new OrderError('ORDER_CONFIGURATION_INVALID', 422, [
        {
          field: `items.${index}.productId`,
          message: 'This doll is not currently available.',
        },
      ]);
    if (!catalog.is_active)
      throw new OrderError('ORDER_CONFIGURATION_INVALID', 422, [
        {
          field: `items.${index}.variantId`,
          message: 'This size is not currently available.',
        },
      ]);

    const optionRows = (await repository.catalogOptions(
      item.productId,
    )) as Record<string, unknown>[];
    const options = new Map<string, Record<string, unknown>[]>();
    for (const row of optionRows) {
      const id = stringValue(row, 'option_id');
      options.set(id, [...(options.get(id) ?? []), row]);
    }
    const seen = new Set<string>();
    const selections: ValidatedSelection[] = [];
    for (const [selectionIndex, selection] of item.selections.entries()) {
      if (seen.has(selection.optionId))
        throw new OrderError('ORDER_CONFIGURATION_INVALID', 422, [
          {
            field: `items.${index}.selections.${selectionIndex}.optionId`,
            message: 'Choose this option only once.',
          },
        ]);
      seen.add(selection.optionId);
      const rows = options.get(selection.optionId);
      const option = rows?.[0];
      if (!option || !option.option_active)
        throw new OrderError('ORDER_CONFIGURATION_INVALID', 422, [
          {
            field: `items.${index}.selections.${selectionIndex}.optionId`,
            message: 'This customization option is unavailable.',
          },
        ]);
      const inputType = stringValue(option, 'input_type');
      const isText = ['TEXT', 'TEXTAREA'].includes(inputType);
      let chosen: Record<string, unknown> | undefined;
      if (selection.optionValueId)
        chosen = rows?.find((row) => row.value_id === selection.optionValueId);
      if (isText && selection.optionValueId)
        throw new OrderError('ORDER_CONFIGURATION_INVALID', 422, [
          {
            field: `items.${index}.selections.${selectionIndex}.optionValueId`,
            message: 'Enter text instead of choosing a catalog value.',
          },
        ]);
      if (selection.optionValueId && (!chosen || !chosen.value_active))
        throw new OrderError('ORDER_CONFIGURATION_INVALID', 422, [
          {
            field: `items.${index}.selections.${selectionIndex}.optionValueId`,
            message: 'This customization value is unavailable.',
          },
        ]);
      const custom = selection.customValue?.trim() || null;
      const customColor = selection.customColor ?? null;
      if (isText && !custom)
        throw new OrderError('ORDER_CONFIGURATION_INVALID', 422, [
          {
            field: `items.${index}.selections.${selectionIndex}.customValue`,
            message: 'Enter a value for this option.',
          },
        ]);
      if (!isText && !chosen && !option.allow_custom_value)
        throw new OrderError('ORDER_CONFIGURATION_INVALID', 422, [
          {
            field: `items.${index}.selections.${selectionIndex}`,
            message: 'Choose one configured value.',
          },
        ]);
      if (!isText && custom && !option.allow_custom_value)
        throw new OrderError('ORDER_CONFIGURATION_INVALID', 422, [
          {
            field: `items.${index}.selections.${selectionIndex}.customValue`,
            message: 'Custom values are not allowed for this option.',
          },
        ]);
      if (inputType === 'COLOR' && !chosen && !customColor)
        throw new OrderError('ORDER_CONFIGURATION_INVALID', 422, [
          {
            field: `items.${index}.selections.${selectionIndex}.customColor`,
            message: 'Choose a configured color or enter a valid custom color.',
          },
        ]);
      selections.push({
        optionId: selection.optionId,
        optionValueId: chosen ? stringValue(chosen, 'value_id') : null,
        optionCode: stringValue(option, 'option_code'),
        optionName: stringValue(option, 'option_name'),
        inputType,
        valueCode: chosen ? stringValue(chosen, 'value_code') : null,
        valueLabel: chosen
          ? stringValue(chosen, 'value_label')
          : (custom ?? customColor ?? ''),
        colorHex: chosen
          ? (value(chosen, 'color_hex') as string | null)
          : customColor,
        referenceStorageKey: chosen
          ? (value(chosen, 'reference_storage_key') as string | null)
          : null,
        priceAdjustmentMinor: chosen
          ? numberValue(chosen, 'price_adjustment_minor')
          : 0,
        affects3d: Boolean(option.affects_3d),
        threeDProperty: (option.three_d_property as string | null) ?? null,
        customValue: chosen ? null : (custom ?? customColor),
      });
    }
    for (const [optionId, rows] of options) {
      if (rows[0]?.is_required && !seen.has(optionId))
        throw new OrderError('ORDER_CONFIGURATION_INVALID', 422, [
          {
            field: `items.${index}.selections`,
            message: `${String(rows[0].option_name)} is required.`,
          },
        ]);
    }
    const conflicts = await repository.conflictingValueIds(
      selections.flatMap((selection) =>
        selection.optionValueId ? [selection.optionValueId] : [],
      ),
    );
    if (conflicts.length)
      throw new OrderError('ORDER_CONFIGURATION_INVALID', 422, [
        {
          field: `items.${index}.selections`,
          message: String(
            conflicts[0]!.reason || 'These choices cannot be combined.',
          ),
        },
      ]);
    const unit =
      numberValue(catalog, 'price_minor') +
      selections.reduce(
        (sum, selection) => sum + selection.priceAdjustmentMinor,
        0,
      );
    if (unit < 0)
      throw new OrderError('ORDER_CONFIGURATION_INVALID', 422, [
        {
          field: `items.${index}`,
          message: 'The configured price is invalid.',
        },
      ]);
    return {
      productId: item.productId,
      variantId: item.variantId,
      productName: stringValue(catalog, 'product_name'),
      productSlug: stringValue(catalog, 'product_slug'),
      variantName: stringValue(catalog, 'variant_name'),
      variantSku: stringValue(catalog, 'sku'),
      variantSize: (catalog.size_label as string | null) ?? null,
      modelKey: (catalog.model_key as string | null) ?? null,
      quantity: item.quantity,
      estimatedUnitPriceMinor: unit,
      estimatedTotalMinor: unit * item.quantity,
      currency: stringValue(catalog, 'currency'),
      customerRequest: item.customerRequest ?? null,
      notes: item.notes ?? null,
      previewFileId: null,
      selections,
    };
  }

  async submit(input: OrderSubmissionInput, remoteIp?: string) {
    if (!(await this.turnstile.verify(input.turnstileToken, remoteIp)))
      throw new OrderError('TURNSTILE_FAILED', 400);
    const submissionKeyHash = sha256(input.submissionKey);
    const {
      submissionKey: _key,
      turnstileToken: _turnstile,
      ...material
    } = input;
    void _key;
    void _turnstile;
    const submissionPayloadHash = jsonHash(material);
    const existing = (await new OrderRepository(this.pool).findBySubmissionKey(
      submissionKeyHash,
    )) as Record<string, unknown> | undefined;
    if (existing) return this.idempotent(existing, submissionPayloadHash);
    try {
      return await withTransaction(this.pool, async (client) => {
        const repository = new OrderRepository(client);
        const items: ValidatedItem[] = [];
        for (const [index, item] of input.items.entries())
          items.push(await this.validateItem(repository, item, index));
        const currency = items[0]!.currency;
        if (items.some((item) => item.currency !== currency))
          throw new OrderError('ORDER_CURRENCY_MISMATCH', 422);
        const estimatedSubtotalMinor = items.reduce(
          (sum, item) => sum + item.estimatedTotalMinor,
          0,
        );
        if (!Number.isSafeInteger(estimatedSubtotalMinor))
          throw new OrderError('ORDER_CONFIGURATION_INVALID', 422);
        const orderNumber = await repository.nextOrderNumber();
        const order = (await repository.createOrder({
          orderNumber,
          customerName: input.customer.fullName,
          customerEmail: input.customer.email,
          customerPhone: input.customer.phone ?? null,
          preferredContactMethod: input.customer.preferredContactMethod,
          addressLine1: input.delivery.addressLine1,
          addressLine2: input.delivery.addressLine2 ?? null,
          city: input.delivery.city,
          region: input.delivery.region ?? null,
          postalCode: input.delivery.postalCode ?? null,
          countryCode: countryCode(input.delivery.country),
          notes: input.notes ?? null,
          estimatedSubtotalMinor,
          currency,
          shippingMethod: input.delivery.shippingMethod,
          submissionKeyHash,
          submissionPayloadHash,
        })) as Record<string, unknown>;
        for (const item of items) {
          const itemId = await repository.createItem(
            stringValue(order, 'id'),
            item,
          );
          for (const selection of item.selections)
            await repository.createSelection(itemId, selection);
        }
        await repository.history(
          stringValue(order, 'id'),
          null,
          'SUBMITTED',
          'Your order request was submitted.',
        );
        const trackingToken = token();
        await repository.createAccessToken(
          stringValue(order, 'id'),
          sha256(trackingToken),
          new Date(Date.now() + 90 * 86_400_000),
        );
        await repository.notify(
          stringValue(order, 'id'),
          'ORDER_SUBMITTED',
          input.customer.email,
          { orderId: value(order, 'id'), orderNumber, submittedAt: nowIso() },
        );
        await repository.audit(
          null,
          'ORDER_SUBMITTED',
          stringValue(order, 'id'),
          undefined,
          {
            orderNumber,
            itemCount: items.length,
            estimatedSubtotalMinor,
            currency,
          },
        );
        return {
          orderNumber,
          status: 'SUBMITTED',
          pricingStatus: 'ESTIMATE',
          estimatedSubtotalMinor,
          currency,
          trackingToken,
          trackingPath: `/orders/${orderNumber}#token=${trackingToken}`,
          idempotent: false,
        };
      });
    } catch (error) {
      if (!isDatabaseCode(error, '23505')) throw error;
      const row = (await new OrderRepository(this.pool).findBySubmissionKey(
        submissionKeyHash,
      )) as Record<string, unknown> | undefined;
      if (!row) throw error;
      return this.idempotent(row, submissionPayloadHash);
    }
  }

  private idempotent(row: Record<string, unknown>, payloadHash: string) {
    if (row.submission_payload_hash !== payloadHash)
      throw new OrderError('ORDER_ALREADY_SUBMITTED', 409);
    return {
      orderNumber: row.order_number,
      status: row.status,
      pricingStatus: 'ESTIMATE',
      estimatedSubtotalMinor: row.estimated_subtotal_minor,
      currency: row.currency,
      trackingToken: null,
      trackingTokenAlreadyIssued: true,
      idempotent: true,
    };
  }

  async exchange(orderNumber: string, rawToken: string) {
    const repository = new OrderRepository(this.pool);
    const supplied = sha256(rawToken);
    const rows = (await repository.accessTokens(orderNumber)) as Record<
      string,
      unknown
    >[];
    const row = rows.find((candidate) =>
      safeEqualHex(stringValue(candidate, 'token_hash'), supplied),
    );
    if (!row) throw new OrderError('ORDER_ACCESS_DENIED', 404);
    if (row.revoked_at) throw new OrderError('ORDER_ACCESS_REVOKED', 403);
    if (new Date(String(row.expires_at)).getTime() <= Date.now())
      throw new OrderError('ORDER_ACCESS_EXPIRED', 403);
    const session = token();
    const csrf = token();
    const expiresAt = new Date(Date.now() + 30 * 60_000);
    await withTransaction(this.pool, async (client) => {
      const transactional = new OrderRepository(client);
      await transactional.touchAccessToken(stringValue(row, 'id'));
      await transactional.createGuestSession(
        stringValue(row, 'order_id'),
        sha256(session),
        sha256(csrf),
        expiresAt,
      );
    });
    return {
      session,
      csrfToken: csrf,
      expiresAt,
      order: await this.guestOrder(stringValue(row, 'order_id')),
    };
  }

  async authorizeGuest(
    rawSession: string | undefined,
    orderNumber: string,
    csrf?: string,
    requireCsrf = false,
  ) {
    if (!rawSession) throw new OrderError('ORDER_ACCESS_DENIED', 404);
    const repository = new OrderRepository(this.pool);
    const session = (await repository.guestSession(sha256(rawSession))) as
      | Record<string, unknown>
      | undefined;
    if (!session || session.order_number !== orderNumber)
      throw new OrderError('ORDER_ACCESS_DENIED', 404);
    if (session.revoked_at) throw new OrderError('ORDER_ACCESS_REVOKED', 403);
    if (new Date(String(session.expires_at)).getTime() <= Date.now())
      throw new OrderError('ORDER_ACCESS_EXPIRED', 403);
    if (
      requireCsrf &&
      (!csrf || !safeEqualHex(stringValue(session, 'csrf_hash'), sha256(csrf)))
    )
      throw new OrderError('ORDER_ACCESS_DENIED', 403);
    await repository.touchGuestSession(stringValue(session, 'id'));
    return stringValue(session, 'order_id');
  }

  async guestOrder(orderId: string) {
    const detail = await new OrderRepository(this.pool).detail(orderId, false);
    if (!detail) throw new OrderError('ORDER_NOT_FOUND', 404);
    return detailContract(detail, false);
  }

  async guestMessage(orderId: string, message: string) {
    return withTransaction(this.pool, async (client) => {
      const repository = new OrderRepository(client);
      const order = (await repository.lockOrder(orderId)) as
        | Record<string, unknown>
        | undefined;
      if (!order) throw new OrderError('ORDER_NOT_FOUND', 404);
      await repository.message(orderId, 'CUSTOMER', message, false, null);
      await repository.notify(orderId, 'CUSTOMER_MESSAGE_RECEIVED', 'ADMIN', {
        orderId,
        orderNumber: order.order_number,
      });
      await repository.incrementVersion(orderId);
      return { sent: true };
    });
  }

  async respondToRevision(
    orderId: string,
    revisionId: string,
    response: 'ACCEPT' | 'DECLINE' | 'REQUEST_CLARIFICATION' | 'RESUBMIT',
    message: string | null,
    replacements?: Array<{
      orderItemId: string;
      selections: OrderSubmissionInput['items'][number]['selections'];
    }>,
  ) {
    return withTransaction(this.pool, async (client) => {
      const repository = new OrderRepository(client);
      const order = (await repository.lockOrder(orderId)) as Record<
        string,
        unknown
      >;
      const revision = (await repository.lockRevision(orderId, revisionId)) as
        | Record<string, unknown>
        | undefined;
      if (!order || !revision || revision.customer_response)
        throw new OrderError('REVISION_NOT_ACTIONABLE', 409);
      if (
        Number(revision.revision_number) !==
        Number(order.current_revision_number)
      )
        throw new OrderError('REVISION_NOT_ACTIONABLE', 409);
      const revisionType = String(revision.revision_type);
      if ((response === 'ACCEPT' || response === 'DECLINE') && revisionType !== 'APPROVAL')
        throw new OrderError('REVISION_NOT_ACTIONABLE', 409);
      if (
        (response === 'RESUBMIT' || response === 'REQUEST_CLARIFICATION') &&
        revisionType !== 'CHANGES_REQUESTED'
      )
        throw new OrderError('REVISION_NOT_ACTIONABLE', 409);
      if (response === 'RESUBMIT' && order.status !== 'CHANGES_REQUESTED')
        throw new OrderError('ORDER_INVALID_TRANSITION', 409);
      let resubmissionRevisionId: string | undefined;
      if (response === 'RESUBMIT') {
        if (!replacements?.length)
          throw new OrderError('VALIDATION_ERROR', 400, [
            {
              field: 'replacements',
              message: 'Submit at least one replacement configuration.',
            },
          ]);
        const sourceItems = (await repository.orderItems(orderId)) as Record<
          string,
          unknown
        >[];
        const proposedItems: Array<Record<string, unknown>> = [];
        for (const [index, replacement] of replacements.entries()) {
          const source = sourceItems.find(
            (item) => item.id === replacement.orderItemId,
          );
          if (!source?.source_product_id || !source.source_variant_id)
            throw new OrderError('ORDER_CONFIGURATION_INVALID', 422);
          const validated = await this.validateItem(
            repository,
            {
              productId: String(source.source_product_id),
              variantId: String(source.source_variant_id),
              quantity: Number(source.quantity),
              customerRequest:
                (source.customer_request as string | null) ?? null,
              notes: null,
              previewFileId: null,
              selections: replacement.selections,
            },
            index,
          );
          proposedItems.push({
            orderItemId: replacement.orderItemId,
            ...validated,
          });
        }
        const revisionNumber = Number(order.current_revision_number) + 1;
        const resubmission = (await repository.createRevision({
          orderId,
          revisionNumber,
          revisionType: 'CUSTOMER_RESUBMISSION',
          customerMessage: message,
          snapshot: { items: proposedItems },
          adminId: null,
        })) as Record<string, unknown>;
        resubmissionRevisionId = String(resubmission.id);
        await repository.setCurrentRevision(orderId, revisionNumber);
      }
      if (response === 'REQUEST_CLARIFICATION' && !message)
        throw new OrderError('VALIDATION_ERROR', 400, [
          { field: 'message', message: 'Add the clarification you need.' },
        ]);
      const stored =
        response === 'ACCEPT'
          ? 'ACCEPTED'
          : response === 'DECLINE'
            ? 'DECLINED'
            : response === 'RESUBMIT'
              ? 'RESUBMITTED'
              : 'REQUEST_CLARIFICATION';
      await repository.respondRevision(revisionId, stored, message);
      if (message)
        await repository.message(orderId, 'CUSTOMER', message, false, null);
      let next = String(order.status);
      const event: OrderNotificationType =
        response === 'ACCEPT'
          ? 'APPROVAL_ACCEPTED'
          : response === 'DECLINE'
            ? 'APPROVAL_DECLINED'
            : response === 'RESUBMIT'
              ? 'ORDER_RESUBMITTED'
              : 'CUSTOMER_MESSAGE_RECEIVED';
      if (response === 'RESUBMIT') {
        next = 'UNDER_REVIEW';
        await repository.updateStatus(orderId, next);
        await repository.history(
          orderId,
          String(order.status),
          next,
          'Your changes were sent for review.',
        );
      } else if (response === 'DECLINE') {
        next = 'CANCELLED';
        await repository.updateStatus(orderId, next, {
          cancelledAt: new Date(),
          cancellationReason: 'Customer declined the approved quotation.',
        });
        await repository.cancelPayments(orderId);
        await repository.history(
          orderId,
          String(order.status),
          next,
          'The quotation was declined and the order was cancelled.',
        );
      } else {
        await repository.incrementVersion(orderId);
      }
      await repository.notify(orderId, event, 'ADMIN', {
        orderId,
        orderNumber: order.order_number,
        revisionId,
        resubmissionRevisionId,
      });
      return { response: stored, status: next, resubmissionRevisionId };
    });
  }

  async revokeOwnAccess(orderId: string) {
    await withTransaction(this.pool, async (client) => {
      const repository = new OrderRepository(client);
      await repository.revokeGuestSessions(orderId);
      await repository.revokeAccess(orderId);
    });
  }

  async list(input: AdminOrderListInput) {
    const result = await new OrderRepository(this.pool).list(input);
    return {
      ...result,
      items: result.items.map((row) =>
        orderSummary(row as Record<string, unknown>),
      ),
    };
  }

  async adminDetail(orderId: string) {
    const detail = await new OrderRepository(this.pool).detail(orderId, true);
    if (!detail) throw new OrderError('ORDER_NOT_FOUND', 404);
    return detailContract(detail, true);
  }

  private assertOrder(
    order: Record<string, unknown> | undefined,
    expectedVersion: number,
  ) {
    if (!order) throw new OrderError('ORDER_NOT_FOUND', 404);
    if (Number(order.version) !== expectedVersion)
      throw new OrderError('ORDER_VERSION_CONFLICT', 409);
  }

  private async transition(
    orderId: string,
    expectedVersion: number,
    allowed: string[],
    next: string,
    adminId: string,
    action: string,
    event: OrderNotificationType,
    message: string,
    fields: Record<string, unknown> = {},
  ) {
    return withTransaction(this.pool, async (client) => {
      const repository = new OrderRepository(client);
      const order = (await repository.lockOrder(orderId)) as
        | Record<string, unknown>
        | undefined;
      this.assertOrder(order, expectedVersion);
      if (!allowed.includes(String(order!.status)))
        throw new OrderError('ORDER_INVALID_TRANSITION', 409);
      const updated = (await repository.updateStatus(
        orderId,
        next,
        fields,
      )) as Record<string, unknown>;
      await repository.history(
        orderId,
        String(order!.status),
        next,
        message,
        adminId,
      );
      await repository.audit(
        adminId,
        action,
        orderId,
        { status: order!.status },
        { status: next },
      );
      await repository.notify(
        orderId,
        event,
        stringValue(order!, 'customer_email'),
        {
          orderId,
          orderNumber: order!.order_number,
          status: next,
        },
      );
      return { status: next, version: updated.version };
    });
  }

  startReview(orderId: string, expectedVersion: number, adminId: string) {
    return this.transition(
      orderId,
      expectedVersion,
      ['SUBMITTED'],
      'UNDER_REVIEW',
      adminId,
      'ORDER_REVIEW_STARTED',
      'ORDER_UNDER_REVIEW',
      'Your order is now under review.',
      { reviewStartedAt: new Date() },
    );
  }

  async requestChanges(
    orderId: string,
    input: {
      expectedVersion: number;
      messageToCustomer: string;
      requestedChanges: unknown[];
    },
    adminId: string,
  ) {
    return withTransaction(this.pool, async (client) => {
      const repository = new OrderRepository(client);
      const order = (await repository.lockOrder(orderId)) as
        | Record<string, unknown>
        | undefined;
      this.assertOrder(order, input.expectedVersion);
      if (order!.status !== 'UNDER_REVIEW')
        throw new OrderError('ORDER_INVALID_TRANSITION', 409);
      const snapshot = await repository.configurationSnapshot(orderId);
      const revisionNumber = Number(order!.current_revision_number) + 1;
      const revision = (await repository.createRevision({
        orderId,
        revisionNumber,
        revisionType: 'CHANGES_REQUESTED',
        customerMessage: input.messageToCustomer,
        internalMessage: JSON.stringify(input.requestedChanges),
        snapshot,
        adminId,
      })) as Record<string, unknown>;
      await repository.setCurrentRevision(orderId, revisionNumber);
      const updated = (await repository.updateStatus(
        orderId,
        'CHANGES_REQUESTED',
      )) as Record<string, unknown>;
      await repository.message(
        orderId,
        'ADMIN',
        input.messageToCustomer,
        false,
        adminId,
      );
      await repository.history(
        orderId,
        'UNDER_REVIEW',
        'CHANGES_REQUESTED',
        input.messageToCustomer,
        adminId,
      );
      await repository.audit(
        adminId,
        'ORDER_CHANGES_REQUESTED',
        orderId,
        undefined,
        { revisionId: revision.id, revisionNumber },
      );
      await repository.notify(
        orderId,
        'ORDER_CHANGES_REQUESTED',
        stringValue(order!, 'customer_email'),
        {
          orderId,
          orderNumber: order!.order_number,
          revisionId: revision.id,
        },
      );
      return {
        revisionId: revision.id,
        status: 'CHANGES_REQUESTED',
        version: updated.version,
      };
    });
  }

  async approve(
    orderId: string,
    input: {
      expectedVersion: number;
      items: Array<{ orderItemId: string; finalUnitPriceMinor: number }>;
      deliveryFeeMinor: number;
      estimatedCompletionDate: string;
      paymentMethod: string;
      paymentInstructions: string;
      messageToCustomer: string;
      paymentDueAt?: string;
    },
    adminId: string,
  ) {
    return withTransaction(this.pool, async (client) => {
      const repository = new OrderRepository(client);
      const order = (await repository.lockOrder(orderId)) as
        | Record<string, unknown>
        | undefined;
      this.assertOrder(order, input.expectedVersion);
      if (order!.status !== 'UNDER_REVIEW')
        throw new OrderError('ORDER_INVALID_TRANSITION', 409);
      const items = (await repository.orderItems(orderId)) as Record<
        string,
        unknown
      >[];
      if (
        items.length !== input.items.length ||
        new Set(input.items.map((item) => item.orderItemId)).size !==
          items.length ||
        input.items.some(
          (priced) => !items.some((item) => item.id === priced.orderItemId),
        )
      )
        throw new OrderError('ORDER_NOT_APPROVABLE', 422);
      let subtotal = 0;
      for (const priced of input.items) {
        const item = items.find(
          (candidate) => candidate.id === priced.orderItemId,
        )!;
        const total = priced.finalUnitPriceMinor * Number(item.quantity);
        if (!Number.isSafeInteger(total))
          throw new OrderError('ORDER_NOT_APPROVABLE', 422);
        subtotal += total;
        await repository.setFinalItemPrice(
          priced.orderItemId,
          priced.finalUnitPriceMinor,
          total,
        );
      }
      const total = subtotal + input.deliveryFeeMinor;
      if (!Number.isSafeInteger(total) || total < 0)
        throw new OrderError('ORDER_NOT_APPROVABLE', 422);
      await repository.finalizeOrder(
        orderId,
        subtotal,
        input.deliveryFeeMinor,
        total,
        input.estimatedCompletionDate,
        input.paymentDueAt ?? null,
      );
      const snapshot = await repository.configurationSnapshot(orderId);
      const revisionNumber = Number(order!.current_revision_number) + 1;
      const revision = (await repository.createRevision({
        orderId,
        revisionNumber,
        revisionType: 'APPROVAL',
        customerMessage: input.messageToCustomer,
        subtotal,
        deliveryFee: input.deliveryFeeMinor,
        total,
        completionDate: input.estimatedCompletionDate,
        snapshot,
        adminId,
      })) as Record<string, unknown>;
      await repository.setCurrentRevision(orderId, revisionNumber);
      const payment = (await repository.createPayment({
        orderId,
        method: input.paymentMethod,
        amountMinor: total,
        currency: order!.currency,
        instructions: input.paymentInstructions,
        dueAt: input.paymentDueAt ?? null,
      })) as Record<string, unknown>;
      const updated = (await repository.updateStatus(
        orderId,
        'AWAITING_PAYMENT',
        {
          approvedAt: new Date(),
          estimatedCompletionDate: input.estimatedCompletionDate,
          paymentDueAt: input.paymentDueAt ?? null,
        },
      )) as Record<string, unknown>;
      await repository.message(
        orderId,
        'ADMIN',
        input.messageToCustomer,
        false,
        adminId,
      );
      await repository.history(
        orderId,
        'UNDER_REVIEW',
        'AWAITING_PAYMENT',
        'Your final quotation is ready.',
        adminId,
      );
      await repository.audit(adminId, 'ORDER_APPROVED', orderId, undefined, {
        revisionId: revision.id,
        total,
        currency: order!.currency,
      });
      for (const event of ['ORDER_APPROVED', 'PAYMENT_REQUESTED'] as const)
        await repository.notify(
          orderId,
          event,
          stringValue(order!, 'customer_email'),
          {
            orderId,
            orderNumber: order!.order_number,
            revisionId: revision.id,
            paymentId: payment.id,
            amountMinor: total,
            currency: order!.currency,
          },
        );
      return {
        status: 'AWAITING_PAYMENT',
        version: updated.version,
        revisionId: revision.id,
        paymentId: payment.id,
        subtotalMinor: subtotal,
        totalMinor: total,
      };
    });
  }

  async reject(
    orderId: string,
    input: {
      expectedVersion: number;
      reason: string;
      internalReason?: string | null;
    },
    adminId: string,
  ) {
    return withTransaction(this.pool, async (client) => {
      const repository = new OrderRepository(client);
      const order = (await repository.lockOrder(orderId)) as
        | Record<string, unknown>
        | undefined;
      this.assertOrder(order, input.expectedVersion);
      if (
        ![
          'SUBMITTED',
          'UNDER_REVIEW',
          'CHANGES_REQUESTED',
          'AWAITING_PAYMENT',
        ].includes(String(order!.status))
      )
        throw new OrderError('ORDER_INVALID_TRANSITION', 409);
      await repository.cancelPayments(orderId);
      const updated = (await repository.updateStatus(orderId, 'REJECTED', {
        rejectedAt: new Date(),
        rejectionReason: input.reason,
      })) as Record<string, unknown>;
      await repository.history(
        orderId,
        String(order!.status),
        'REJECTED',
        input.reason,
        adminId,
        input.internalReason ?? null,
      );
      await repository.audit(
        adminId,
        'ORDER_REJECTED',
        orderId,
        { status: order!.status },
        {
          reason: input.internalReason ? 'Internal reason recorded' : undefined,
        },
      );
      await repository.notify(
        orderId,
        'ORDER_REJECTED',
        stringValue(order!, 'customer_email'),
        { orderId, orderNumber: order!.order_number },
      );
      return { status: 'REJECTED', version: updated.version };
    });
  }

  async cancel(
    orderId: string,
    input: {
      expectedVersion: number;
      reason: string;
      customerVisible: boolean;
      exceptional: boolean;
      auditReason?: string | null;
    },
    adminId: string,
  ) {
    return withTransaction(this.pool, async (client) => {
      const repository = new OrderRepository(client);
      const order = (await repository.lockOrder(orderId)) as
        | Record<string, unknown>
        | undefined;
      this.assertOrder(order, input.expectedVersion);
      if (
        ['DELIVERED', 'REJECTED', 'CANCELLED'].includes(String(order!.status))
      )
        throw new OrderError('ORDER_INVALID_TRANSITION', 409);
      if (
        ['PAID', 'IN_PRODUCTION', 'READY', 'SHIPPED'].includes(
          String(order!.status),
        ) &&
        (!input.exceptional || !input.auditReason)
      )
        throw new OrderError('VALIDATION_ERROR', 400, [
          {
            field: 'auditReason',
            message: 'Explain this exceptional cancellation.',
          },
        ]);
      await repository.cancelPayments(orderId);
      const updated = (await repository.updateStatus(orderId, 'CANCELLED', {
        cancelledAt: new Date(),
        cancellationReason: input.reason,
      })) as Record<string, unknown>;
      await repository.history(
        orderId,
        String(order!.status),
        'CANCELLED',
        input.customerVisible ? input.reason : 'This order was cancelled.',
        adminId,
        input.auditReason ?? null,
      );
      await repository.audit(
        adminId,
        'ORDER_CANCELLED',
        orderId,
        { status: order!.status },
        {
          exceptional: input.exceptional,
          reason: input.auditReason ? 'Recorded' : undefined,
        },
      );
      await repository.notify(
        orderId,
        'ORDER_CANCELLED',
        stringValue(order!, 'customer_email'),
        { orderId, orderNumber: order!.order_number },
      );
      return { status: 'CANCELLED', version: updated.version };
    });
  }

  async adminMessage(
    orderId: string,
    expectedVersion: number,
    message: string,
    internal: boolean,
    adminId: string,
  ) {
    return withTransaction(this.pool, async (client) => {
      const repository = new OrderRepository(client);
      const order = (await repository.lockOrder(orderId)) as
        | Record<string, unknown>
        | undefined;
      this.assertOrder(order, expectedVersion);
      await repository.message(orderId, 'ADMIN', message, internal, adminId);
      const updated = (await repository.incrementVersion(orderId)) as Record<
        string,
        unknown
      >;
      await repository.audit(
        adminId,
        internal ? 'ORDER_INTERNAL_NOTE_ADDED' : 'ORDER_MESSAGE_SENT',
        orderId,
      );
      if (!internal)
        await repository.notify(
          orderId,
          'ADMIN_MESSAGE_RECEIVED',
          stringValue(order!, 'customer_email'),
          { orderId, orderNumber: order!.order_number },
        );
      return { sent: true, version: updated.version };
    });
  }

  async requestPayment(
    orderId: string,
    input: {
      expectedVersion: number;
      amountMinor: number;
      currency: string;
      method: string;
      instructions: string;
      dueAt?: string;
    },
    adminId: string,
  ) {
    try {
      return await withTransaction(this.pool, async (client) => {
        const repository = new OrderRepository(client);
        const order = (await repository.lockOrder(orderId)) as
          | Record<string, unknown>
          | undefined;
        this.assertOrder(order, input.expectedVersion);
        if (order!.status !== 'AWAITING_PAYMENT')
          throw new OrderError('ORDER_INVALID_TRANSITION', 409);
        if (
          Number(order!.final_total_minor) !== input.amountMinor ||
          order!.currency !== input.currency
        )
          throw new OrderError('PAYMENT_AMOUNT_MISMATCH', 422);
        const payment = (await repository.createPayment({
          orderId,
          method: input.method,
          amountMinor: input.amountMinor,
          currency: input.currency,
          instructions: input.instructions,
          dueAt: input.dueAt ?? null,
        })) as Record<string, unknown>;
        const updated = (await repository.incrementVersion(orderId)) as Record<
          string,
          unknown
        >;
        await repository.audit(
          adminId,
          'PAYMENT_REQUESTED',
          orderId,
          undefined,
          {
            paymentId: payment.id,
            amountMinor: input.amountMinor,
            currency: input.currency,
          },
        );
        await repository.notify(
          orderId,
          'PAYMENT_REQUESTED',
          stringValue(order!, 'customer_email'),
          {
            orderId,
            orderNumber: order!.order_number,
            paymentId: payment.id,
            amountMinor: input.amountMinor,
            currency: input.currency,
          },
        );
        return { paymentId: payment.id, version: updated.version };
      });
    } catch (error) {
      if (isDatabaseCode(error, '23505'))
        throw new OrderError('PAYMENT_ALREADY_REQUESTED', 409);
      throw error;
    }
  }

  async verifyPayment(
    orderId: string,
    input: {
      expectedVersion: number;
      paymentId: string;
      externalReference: string;
      receivedAt: string;
      adminNotes?: string | null;
    },
    adminId: string,
  ) {
    return withTransaction(this.pool, async (client) => {
      const repository = new OrderRepository(client);
      const order = (await repository.lockOrder(orderId)) as
        | Record<string, unknown>
        | undefined;
      this.assertOrder(order, input.expectedVersion);
      if (order!.status !== 'AWAITING_PAYMENT')
        throw new OrderError('ORDER_INVALID_TRANSITION', 409);
      const payment = (await repository.lockPayment(
        orderId,
        input.paymentId,
      )) as Record<string, unknown> | undefined;
      if (!payment) throw new OrderError('PAYMENT_AMOUNT_MISMATCH', 404);
      const approval = (await repository.latestApproval(orderId)) as
        | Record<string, unknown>
        | undefined;
      if (!approval || approval.customer_response !== 'ACCEPTED')
        throw new OrderError('REVISION_NOT_ACTIONABLE', 409);
      if (payment.status === 'VERIFIED')
        throw new OrderError('PAYMENT_ALREADY_VERIFIED', 409);
      if (
        !['REQUESTED', 'PENDING'].includes(String(payment.status)) ||
        Number(payment.amount_minor) !== Number(order!.final_total_minor) ||
        payment.currency !== order!.currency
      )
        throw new OrderError('PAYMENT_AMOUNT_MISMATCH', 422);
      await repository.verifyPayment(
        input.paymentId,
        input.externalReference,
        input.receivedAt,
        input.adminNotes ?? null,
        adminId,
      );
      const updated = (await repository.updateStatus(orderId, 'PAID', {
        paidAt: new Date(),
      })) as Record<string, unknown>;
      await repository.history(
        orderId,
        'AWAITING_PAYMENT',
        'PAID',
        'Payment was confirmed.',
        adminId,
      );
      await repository.audit(adminId, 'PAYMENT_VERIFIED', orderId, undefined, {
        paymentId: input.paymentId,
      });
      await repository.notify(
        orderId,
        'PAYMENT_CONFIRMED',
        stringValue(order!, 'customer_email'),
        {
          orderId,
          orderNumber: order!.order_number,
          paymentId: input.paymentId,
        },
      );
      return { status: 'PAID', version: updated.version };
    });
  }

  async productionStatus(
    orderId: string,
    input: {
      expectedVersion: number;
      action: string;
      message?: string | null;
      shippingMethod?: string;
      trackingReference?: string | null;
      trackingUrl?: string | null;
    },
    adminId: string,
  ) {
    const rules: Record<
      string,
      {
        from: string[];
        to: string;
        event: OrderNotificationType;
        action: string;
        field: string;
      }
    > = {
      START_PRODUCTION: {
        from: ['PAID'],
        to: 'IN_PRODUCTION',
        event: 'PRODUCTION_STARTED',
        action: 'ORDER_PRODUCTION_STARTED',
        field: 'productionStartedAt',
      },
      MARK_READY: {
        from: ['IN_PRODUCTION'],
        to: 'READY',
        event: 'ORDER_READY',
        action: 'ORDER_MARKED_READY',
        field: 'readyAt',
      },
      MARK_SHIPPED: {
        from: ['READY'],
        to: 'SHIPPED',
        event: 'ORDER_SHIPPED',
        action: 'ORDER_MARKED_SHIPPED',
        field: 'shippedAt',
      },
      MARK_DELIVERED: {
        from: ['READY', 'SHIPPED'],
        to: 'DELIVERED',
        event: 'ORDER_DELIVERED',
        action: 'ORDER_MARKED_DELIVERED',
        field: 'deliveredAt',
      },
    };
    const rule = rules[input.action]!;
    if (
      input.action === 'START_PRODUCTION' &&
      !(await new OrderRepository(this.pool).hasVerifiedPayment(orderId))
    )
      throw new OrderError('PAYMENT_REQUIRED', 409);
    if (input.action === 'MARK_SHIPPED' && !input.shippingMethod)
      throw new OrderError('VALIDATION_ERROR', 400, [
        { field: 'shippingMethod', message: 'Choose the shipping method.' },
      ]);
    return this.transition(
      orderId,
      input.expectedVersion,
      rule.from,
      rule.to,
      adminId,
      rule.action,
      rule.event,
      input.message ?? `Order status changed to ${rule.to}.`,
      {
        [rule.field]: new Date(),
        ...(input.shippingMethod
          ? { shippingMethod: input.shippingMethod }
          : {}),
        ...(input.trackingReference !== undefined
          ? { trackingReference: input.trackingReference }
          : {}),
        ...(input.trackingUrl !== undefined
          ? { trackingUrl: input.trackingUrl }
          : {}),
      },
    );
  }

  async updateShipping(
    orderId: string,
    input: {
      expectedVersion: number;
      shippingMethod: string;
      trackingReference?: string | null;
      trackingUrl?: string | null;
    },
    adminId: string,
  ) {
    return withTransaction(this.pool, async (client) => {
      const repository = new OrderRepository(client);
      const order = (await repository.lockOrder(orderId)) as
        | Record<string, unknown>
        | undefined;
      this.assertOrder(order, input.expectedVersion);
      const updated = (await repository.updateStatus(
        orderId,
        String(order!.status),
        {
          shippingMethod: input.shippingMethod,
          trackingReference: input.trackingReference ?? null,
          trackingUrl: input.trackingUrl ?? null,
        },
      )) as Record<string, unknown>;
      await repository.audit(adminId, 'ORDER_SHIPPING_UPDATED', orderId);
      return { version: updated.version };
    });
  }

  async regenerateAccess(
    orderId: string,
    expectedVersion: number,
    adminId: string,
    publicBaseUrl: string,
  ) {
    return withTransaction(this.pool, async (client) => {
      const repository = new OrderRepository(client);
      const order = (await repository.lockOrder(orderId)) as
        | Record<string, unknown>
        | undefined;
      this.assertOrder(order, expectedVersion);
      await repository.revokeAccess(orderId);
      await repository.revokeGuestSessions(orderId);
      const raw = token();
      await repository.createAccessToken(
        orderId,
        sha256(raw),
        new Date(Date.now() + 90 * 86_400_000),
      );
      const updated = (await repository.incrementVersion(orderId)) as Record<
        string,
        unknown
      >;
      await repository.audit(adminId, 'ORDER_ACCESS_REGENERATED', orderId);
      await repository.notify(
        orderId,
        'ORDER_ACCESS_REGENERATED',
        stringValue(order!, 'customer_email'),
        { orderId, orderNumber: order!.order_number },
      );
      return {
        trackingLink: `${publicBaseUrl.replace(/\/$/, '')}/orders/${String(order!.order_number)}#token=${raw}`,
        version: updated.version,
      };
    });
  }
}
