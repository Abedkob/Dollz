import type { Pool, PoolClient } from '@dollz/database';
import type { AdminOrderListInput } from './schemas.js';
import type {
  OrderNotificationType,
} from './notifications.js';

type Database = Pool | PoolClient;

export class OrderRepository {
  constructor(private readonly db: Database) {}

  async findBySubmissionKey(hash: string) {
    return (
      await this.db.query(
        `SELECT id,order_number,submission_payload_hash,status,estimated_subtotal_minor,currency
         FROM orders WHERE submission_key_hash=$1`,
        [hash],
      )
    ).rows[0];
  }

  async nextOrderNumber(now = new Date()) {
    const sequence = (
      await this.db.query<{ value: string }>(
        `SELECT nextval('dollz_order_number_sequence')::text AS value`,
      )
    ).rows[0]!.value;
    return `DLZ-${now.getUTCFullYear()}-${sequence.padStart(6, '0')}`;
  }

  async createOrder(inputValue: object) {
    const input = inputValue as Record<string, unknown>;
    return (
      await this.db.query(
        `INSERT INTO orders (
          order_number,customer_name,customer_email,customer_phone,preferred_contact_method,
          delivery_address_line1,delivery_address_line2,delivery_city,delivery_region,
          delivery_postal_code,delivery_country_code,customer_notes,status,pricing_status,
          estimated_subtotal_minor,currency,submitted_at,shipping_method,source,
          submission_key_hash,submission_payload_hash)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'SUBMITTED','ESTIMATE',$13,$14,NOW(),$15,'STOREFRONT',$16,$17)
         RETURNING *`,
        [
          input.orderNumber,
          input.customerName,
          input.customerEmail,
          input.customerPhone,
          input.preferredContactMethod,
          input.addressLine1,
          input.addressLine2,
          input.city,
          input.region,
          input.postalCode,
          input.countryCode,
          input.notes,
          input.estimatedSubtotalMinor,
          input.currency,
          input.shippingMethod,
          input.submissionKeyHash,
          input.submissionPayloadHash,
        ],
      )
    ).rows[0]!;
  }

  async createItem(orderId: string, inputValue: object) {
    const input = inputValue as Record<string, unknown>;
    return (
      await this.db.query<{ id: string }>(
        `INSERT INTO order_items (
          order_id,source_product_id,source_variant_id,product_name_snapshot,product_slug_snapshot,
          variant_name_snapshot,variant_sku_snapshot,variant_size_snapshot,variant_model_key_snapshot,
          quantity,estimated_unit_price_minor,estimated_total_minor,currency,customer_request,customer_notes,preview_file_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING id`,
        [
          orderId,
          input.productId,
          input.variantId,
          input.productName,
          input.productSlug,
          input.variantName,
          input.variantSku,
          input.variantSize,
          input.modelKey,
          input.quantity,
          input.estimatedUnitPriceMinor,
          input.estimatedTotalMinor,
          input.currency,
          input.customerRequest,
          input.notes,
          input.previewFileId,
        ],
      )
    ).rows[0]!.id;
  }

  async createSelection(orderItemId: string, inputValue: object) {
    const input = inputValue as Record<string, unknown>;
    await this.db.query(
      `INSERT INTO order_item_selections (
        order_item_id,source_option_id,source_option_value_id,option_code_snapshot,
        option_name_snapshot,input_type_snapshot,value_code_snapshot,value_label_snapshot,
        color_hex_snapshot,reference_storage_key_snapshot,price_adjustment_minor_snapshot,
        affects_3d_snapshot,three_d_property_snapshot,custom_value_snapshot)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [
        orderItemId,
        input.optionId,
        input.optionValueId,
        input.optionCode,
        input.optionName,
        input.inputType,
        input.valueCode,
        input.valueLabel,
        input.colorHex,
        input.referenceStorageKey,
        input.priceAdjustmentMinor,
        input.affects3d,
        input.threeDProperty,
        input.customValue,
      ],
    );
  }

  async catalogItem(productId: string, variantId: string) {
    return (
      await this.db.query(
        `SELECT p.id AS product_id,p.name AS product_name,p.slug AS product_slug,p.status,p.archived_at,
                v.id AS variant_id,v.name AS variant_name,v.sku,v.size_label,v.model_key,v.price_minor,v.currency,v.is_active
         FROM products p JOIN product_variants v ON v.product_id=p.id
         WHERE p.id=$1 AND v.id=$2`,
        [productId, variantId],
      )
    ).rows[0];
  }

  async catalogOptions(productId: string) {
    return (
      await this.db.query(
        `SELECT o.id AS option_id,o.code AS option_code,o.name AS option_name,o.input_type,o.is_required,
                o.allow_custom_value,o.affects_3d,o.three_d_property,o.is_active AS option_active,
                v.id AS value_id,v.code AS value_code,v.label AS value_label,v.color_hex,
                v.price_adjustment_minor,v.is_active AS value_active,f.storage_key AS reference_storage_key
         FROM product_options o
         LEFT JOIN product_option_values v ON v.product_option_id=o.id
         LEFT JOIN files f ON f.id=v.reference_file_id
         WHERE o.product_id=$1 ORDER BY o.sort_order,v.sort_order`,
        [productId],
      )
    ).rows;
  }

  async conflictingValueIds(valueIds: string[]) {
    if (valueIds.length < 2) return [];
    return (
      await this.db.query(
        `SELECT first_value_id,second_value_id,reason FROM option_value_conflicts
         WHERE first_value_id=ANY($1::uuid[]) AND second_value_id=ANY($1::uuid[])`,
        [valueIds],
      )
    ).rows;
  }

  history(
    orderId: string,
    previousStatus: string | null,
    newStatus: string,
    message: string | null,
    adminId: string | null = null,
    internalNotes: string | null = null,
  ) {
    return this.db.query(
      `INSERT INTO order_status_history (order_id,previous_status,new_status,public_message,internal_notes,changed_by)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [orderId, previousStatus, newStatus, message, internalNotes, adminId],
    );
  }

  notify(
    orderId: string,
    type: OrderNotificationType,
    recipient: string,
    payload: Record<string, unknown>,
  ) {
    return this.db.query(
      `INSERT INTO notification_outbox (order_id,notification_type,recipient,payload)
       VALUES ($1,$2,$3,$4::jsonb)`,
      [orderId, type, recipient, JSON.stringify(payload)],
    );
  }

  audit(
    adminId: string | null,
    action: string,
    orderId: string,
    previousData?: unknown,
    newData?: unknown,
  ) {
    return this.db.query(
      `INSERT INTO audit_logs (admin_user_id,action,entity_type,entity_id,previous_data,new_data)
       VALUES ($1,$2,'ORDER',$3,$4::jsonb,$5::jsonb)`,
      [
        adminId,
        action,
        orderId,
        previousData ? JSON.stringify(previousData) : null,
        newData ? JSON.stringify(newData) : null,
      ],
    );
  }

  createAccessToken(orderId: string, tokenHash: string, expiresAt: Date) {
    return this.db.query(
      `INSERT INTO order_access_tokens (order_id,token_hash,purpose,expires_at)
       VALUES ($1,$2,'TRACK_ORDER',$3)`,
      [orderId, tokenHash, expiresAt],
    );
  }

  async accessTokens(orderNumber: string) {
    return (
      await this.db.query(
        `SELECT t.id,t.order_id,t.token_hash,t.expires_at,t.revoked_at,o.order_number
         FROM orders o JOIN order_access_tokens t ON t.order_id=o.id
         WHERE o.order_number=$1 ORDER BY t.created_at DESC`,
        [orderNumber],
      )
    ).rows;
  }

  touchAccessToken(id: string) {
    return this.db.query(
      `UPDATE order_access_tokens SET last_used_at=NOW() WHERE id=$1`,
      [id],
    );
  }

  createGuestSession(
    orderId: string,
    sessionHash: string,
    csrfHash: string,
    expiresAt: Date,
  ) {
    return this.db.query(
      `INSERT INTO order_guest_sessions (order_id,session_hash,csrf_hash,expires_at)
       VALUES ($1,$2,$3,$4)`,
      [orderId, sessionHash, csrfHash, expiresAt],
    );
  }

  async guestSession(sessionHash: string) {
    return (
      await this.db.query(
        `SELECT s.id,s.order_id,s.csrf_hash,s.expires_at,s.revoked_at,o.order_number
         FROM order_guest_sessions s JOIN orders o ON o.id=s.order_id
         WHERE s.session_hash=$1`,
        [sessionHash],
      )
    ).rows[0];
  }

  touchGuestSession(id: string) {
    return this.db.query(
      `UPDATE order_guest_sessions SET last_used_at=NOW() WHERE id=$1`,
      [id],
    );
  }

  revokeGuestSessions(orderId: string) {
    return this.db.query(
      `UPDATE order_guest_sessions SET revoked_at=COALESCE(revoked_at,NOW()) WHERE order_id=$1 AND revoked_at IS NULL`,
      [orderId],
    );
  }

  revokeAccess(orderId: string) {
    return this.db.query(
      `UPDATE order_access_tokens SET revoked_at=COALESCE(revoked_at,NOW()) WHERE order_id=$1 AND revoked_at IS NULL`,
      [orderId],
    );
  }

  async lockOrder(orderId: string) {
    return (
      await this.db.query(`SELECT * FROM orders WHERE id=$1 FOR UPDATE`, [
        orderId,
      ])
    ).rows[0];
  }

  async lockOrderByNumber(orderNumber: string) {
    return (
      await this.db.query(
        `SELECT * FROM orders WHERE order_number=$1 FOR UPDATE`,
        [orderNumber],
      )
    ).rows[0];
  }

  async updateStatus(
    orderId: string,
    next: string,
    fields: Record<string, unknown> = {},
  ) {
    const allowed: Record<string, string> = {
      reviewStartedAt: 'review_started_at',
      rejectedAt: 'rejected_at',
      rejectionReason: 'rejection_reason',
      cancelledAt: 'cancelled_at',
      cancellationReason: 'cancellation_reason',
      approvedAt: 'approved_at',
      paidAt: 'paid_at',
      productionStartedAt: 'production_started_at',
      readyAt: 'ready_at',
      shippedAt: 'shipped_at',
      deliveredAt: 'delivered_at',
      trackingReference: 'tracking_reference',
      trackingUrl: 'tracking_url',
      shippingMethod: 'shipping_method',
      estimatedCompletionDate: 'estimated_completion_date',
      paymentDueAt: 'payment_due_at',
    };
    const values: unknown[] = [next];
    const assignments = ['status=$1', 'version=version+1'];
    for (const [key, value] of Object.entries(fields)) {
      const column = allowed[key];
      if (!column) continue;
      values.push(value);
      assignments.push(`${column}=$${values.length}`);
    }
    values.push(orderId);
    return (
      await this.db.query(
        `UPDATE orders SET ${assignments.join(',')} WHERE id=$${values.length} RETURNING *`,
        values,
      )
    ).rows[0]!;
  }

  async incrementVersion(orderId: string) {
    return (
      await this.db.query(
        `UPDATE orders SET version=version+1 WHERE id=$1 RETURNING *`,
        [orderId],
      )
    ).rows[0]!;
  }

  message(
    orderId: string,
    sender: 'CUSTOMER' | 'ADMIN',
    message: string,
    internal: boolean,
    adminId: string | null,
  ) {
    return this.db.query(
      `INSERT INTO order_messages (order_id,sender_type,message,is_internal,created_by_admin)
       VALUES ($1,$2,$3,$4,$5) RETURNING id,created_at`,
      [orderId, sender, message, internal, adminId],
    );
  }

  async configurationSnapshot(orderId: string) {
    const detail = await this.detail(orderId, true);
    if (!detail) return { items: [] };
    return { items: detail.items };
  }

  async createRevision(inputValue: object) {
    const input = inputValue as Record<string, unknown>;
    return (
      await this.db.query(
        `INSERT INTO order_revisions (
          order_id,revision_number,revision_type,customer_message,internal_message,
          proposed_subtotal_minor,proposed_delivery_fee_minor,proposed_total_minor,
          estimated_completion_date,configuration_snapshot,created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11) RETURNING *`,
        [
          input.orderId,
          input.revisionNumber,
          input.revisionType,
          input.customerMessage,
          input.internalMessage,
          input.subtotal,
          input.deliveryFee,
          input.total,
          input.completionDate,
          JSON.stringify(input.snapshot),
          input.adminId,
        ],
      )
    ).rows[0]!;
  }

  setCurrentRevision(orderId: string, revisionNumber: number) {
    return this.db.query(
      `UPDATE orders SET current_revision_number=$2 WHERE id=$1`,
      [orderId, revisionNumber],
    );
  }

  async lockRevision(orderId: string, revisionId: string) {
    return (
      await this.db.query(
        `SELECT * FROM order_revisions WHERE id=$1 AND order_id=$2 FOR UPDATE`,
        [revisionId, orderId],
      )
    ).rows[0];
  }

  async latestApproval(orderId: string) {
    return (
      await this.db.query(
        `SELECT id,customer_response FROM order_revisions
         WHERE order_id=$1 AND revision_type='APPROVAL'
         ORDER BY revision_number DESC LIMIT 1`,
        [orderId],
      )
    ).rows[0];
  }

  respondRevision(
    revisionId: string,
    response: string,
    message: string | null,
  ) {
    return this.db.query(
      `UPDATE order_revisions SET customer_response=$2,customer_response_message=$3,customer_responded_at=NOW()
       WHERE id=$1 AND customer_response IS NULL`,
      [revisionId, response, message],
    );
  }

  async orderItems(orderId: string) {
    return (
      await this.db.query(
        `SELECT * FROM order_items WHERE order_id=$1 ORDER BY created_at,id`,
        [orderId],
      )
    ).rows;
  }

  setFinalItemPrice(id: string, unit: number, total: number) {
    return this.db.query(
      `UPDATE order_items SET final_unit_price_minor=$2,final_total_minor=$3 WHERE id=$1`,
      [id, unit, total],
    );
  }

  finalizeOrder(
    orderId: string,
    subtotal: number,
    fee: number,
    total: number,
    completionDate: string,
    dueAt: string | null,
  ) {
    return this.db.query(
      `UPDATE orders SET pricing_status='FINAL',final_subtotal_minor=$2,delivery_fee_minor=$3,
       final_total_minor=$4,estimated_completion_date=$5,payment_due_at=$6 WHERE id=$1`,
      [orderId, subtotal, fee, total, completionDate, dueAt],
    );
  }

  async createPayment(inputValue: object) {
    const input = inputValue as Record<string, unknown>;
    return (
      await this.db.query(
        `INSERT INTO payments (order_id,method,status,amount_minor,currency,instructions,due_at)
         VALUES ($1,$2,'REQUESTED',$3,$4,$5,$6) RETURNING *`,
        [
          input.orderId,
          input.method,
          input.amountMinor,
          input.currency,
          input.instructions,
          input.dueAt,
        ],
      )
    ).rows[0]!;
  }

  async lockPayment(orderId: string, paymentId: string) {
    return (
      await this.db.query(
        `SELECT * FROM payments WHERE id=$1 AND order_id=$2 FOR UPDATE`,
        [paymentId, orderId],
      )
    ).rows[0];
  }

  verifyPayment(
    paymentId: string,
    reference: string,
    receivedAt: string,
    notes: string | null,
    adminId: string,
  ) {
    return this.db.query(
      `UPDATE payments SET status='VERIFIED',external_reference=$2,received_at=$3,
       admin_notes=$4,verified_at=NOW(),verified_by=$5 WHERE id=$1`,
      [paymentId, reference, receivedAt, notes, adminId],
    );
  }

  cancelPayments(orderId: string) {
    return this.db.query(
      `UPDATE payments SET
         status=CASE WHEN status='VERIFIED' THEN 'REFUNDED' ELSE 'CANCELLED' END,
         cancelled_at=CASE WHEN status IN ('REQUESTED','PENDING') THEN NOW() ELSE cancelled_at END,
         refunded_at=CASE WHEN status='VERIFIED' THEN NOW() ELSE refunded_at END
       WHERE order_id=$1 AND status IN ('REQUESTED','PENDING','VERIFIED')`,
      [orderId],
    );
  }

  async hasVerifiedPayment(orderId: string) {
    return Boolean(
      (
        await this.db.query(
          `SELECT 1 FROM payments WHERE order_id=$1 AND status='VERIFIED' LIMIT 1`,
          [orderId],
        )
      ).rowCount,
    );
  }

  async list(input: AdminOrderListInput) {
    const conditions: string[] = [];
    const values: unknown[] = [];
    const add = (sql: string, value: unknown) => {
      values.push(value);
      conditions.push(sql.replace('?', `$${values.length}`));
    };
    if (input.search) {
      values.push(input.search);
      const parameter = `$${values.length}`;
      conditions.push(
        `(o.order_number ILIKE '%'||${parameter}||'%' OR o.customer_name ILIKE '%'||${parameter}||'%' OR o.customer_email ILIKE '%'||${parameter}||'%' OR COALESCE(o.customer_phone,'') ILIKE '%'||${parameter}||'%')`,
      );
    }
    if (input.status) add('o.status=?', input.status);
    if (input.pricingStatus) add('o.pricing_status=?', input.pricingStatus);
    if (input.from) add('o.created_at>=?', input.from);
    if (input.to) add('o.created_at<=?', input.to);
    if (input.dueBefore) add('o.estimated_completion_date<=?', input.dueBefore);
    if (input.requiresAction === 'true')
      conditions.push(
        `o.status IN ('SUBMITTED','CHANGES_REQUESTED','AWAITING_PAYMENT')`,
      );
    if (input.requiresAction === 'false')
      conditions.push(
        `o.status NOT IN ('SUBMITTED','CHANGES_REQUESTED','AWAITING_PAYMENT')`,
      );
    if (input.paymentStatus) {
      if (input.paymentStatus === 'NONE')
        conditions.push(
          'NOT EXISTS (SELECT 1 FROM payments px WHERE px.order_id=o.id)',
        );
      else
        add(
          `(SELECT status FROM payments px WHERE px.order_id=o.id ORDER BY created_at DESC LIMIT 1)=?`,
          input.paymentStatus,
        );
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const order =
      input.sort === 'oldest'
        ? 'o.created_at ASC,o.id ASC'
        : input.sort === 'completion'
          ? 'o.estimated_completion_date ASC NULLS LAST,o.id'
          : 'o.created_at DESC,o.id DESC';
    values.push(input.pageSize, (input.page - 1) * input.pageSize);
    const limit = `$${values.length - 1}`;
    const offset = `$${values.length}`;
    const result = await this.db.query(
      `SELECT o.id,o.order_number,o.customer_name,o.customer_email,o.customer_phone,o.status,o.pricing_status,
        o.estimated_subtotal_minor,o.final_total_minor,o.currency,o.submitted_at,o.estimated_completion_date,o.version,
        COALESCE(SUM(i.quantity),0)::int AS doll_count,
        COALESCE((SELECT status FROM payments p WHERE p.order_id=o.id ORDER BY created_at DESC LIMIT 1),'NONE') AS payment_status,
        o.status IN ('SUBMITTED','CHANGES_REQUESTED','AWAITING_PAYMENT') AS requires_action,
        COUNT(*) OVER()::int AS total_count
       FROM orders o LEFT JOIN order_items i ON i.order_id=o.id ${where}
       GROUP BY o.id ORDER BY ${order} LIMIT ${limit} OFFSET ${offset}`,
      values,
    );
    return {
      items: result.rows,
      total: Number(result.rows[0]?.total_count ?? 0),
      page: input.page,
      pageSize: input.pageSize,
    };
  }

  async detail(orderId: string, includeInternal: boolean) {
    const order = (
      await this.db.query(`SELECT * FROM orders WHERE id=$1`, [orderId])
    ).rows[0];
    if (!order) return null;
    const items = (
      await this.db.query(
        `SELECT * FROM order_items WHERE order_id=$1 ORDER BY created_at,id`,
        [orderId],
      )
    ).rows;
    const itemIds = items.map((item) => item.id as string);
    const selections = itemIds.length
      ? (
          await this.db.query(
            `SELECT * FROM order_item_selections WHERE order_item_id=ANY($1::uuid[]) ORDER BY created_at,id`,
            [itemIds],
          )
        ).rows
      : [];
    for (const item of items)
      (item as Record<string, unknown>).selections = selections.filter(
        (selection) => selection.order_item_id === item.id,
      );
    const messages = (
      await this.db.query(
        `SELECT id,sender_type,message,is_internal,created_at FROM order_messages
         WHERE order_id=$1 ${includeInternal ? '' : 'AND NOT is_internal'} ORDER BY created_at,id`,
        [orderId],
      )
    ).rows;
    const history = (
      await this.db.query(
        `SELECT id,previous_status,new_status,public_message,${includeInternal ? 'internal_notes,' : ''}created_at
         FROM order_status_history WHERE order_id=$1 ${includeInternal ? '' : 'AND customer_visible'} ORDER BY created_at,id`,
        [orderId],
      )
    ).rows;
    const revisions = (
      await this.db.query(
        `SELECT id,revision_number,revision_type,customer_message,proposed_subtotal_minor,
         proposed_delivery_fee_minor,proposed_total_minor,estimated_completion_date,configuration_snapshot,
         customer_response,customer_response_message,customer_responded_at,${includeInternal ? 'internal_message,' : ''}created_at
         FROM order_revisions WHERE order_id=$1 ORDER BY revision_number DESC`,
        [orderId],
      )
    ).rows;
    const payments = (
      await this.db.query(
        `SELECT id,method,status,amount_minor,currency,instructions,${includeInternal ? 'external_reference,admin_notes,' : ''}
         requested_at,received_at,verified_at,due_at FROM payments WHERE order_id=$1 ORDER BY created_at DESC`,
        [orderId],
      )
    ).rows;
    const access = includeInternal
      ? (
          await this.db.query(
            `SELECT id,purpose,expires_at,last_used_at,revoked_at,created_at
             FROM order_access_tokens WHERE order_id=$1 ORDER BY created_at DESC`,
            [orderId],
          )
        ).rows
      : [];
    const activity = includeInternal
      ? (
          await this.db.query(
            `SELECT id,action,created_at FROM audit_logs
             WHERE entity_type='ORDER' AND entity_id=$1 ORDER BY created_at DESC LIMIT 100`,
            [orderId],
          )
        ).rows
      : [];
    return {
      order,
      items,
      messages,
      history,
      revisions,
      payments,
      access,
      activity,
    };
  }
}

export function isDatabaseCode(error: unknown, code: string) {
  return Boolean(
    typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: unknown }).code === code,
  );
}
