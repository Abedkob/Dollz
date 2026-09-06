DROP TABLE IF EXISTS order_guest_sessions;
DROP INDEX IF EXISTS payments_one_active_request;
ALTER TABLE payments DROP COLUMN IF EXISTS instructions, DROP COLUMN IF EXISTS cancelled_at, DROP COLUMN IF EXISTS due_at;
ALTER TABLE order_revisions DROP CONSTRAINT IF EXISTS order_revisions_customer_response_check;
ALTER TABLE order_revisions ADD CONSTRAINT order_revisions_customer_response_check
  CHECK (customer_response IS NULL OR customer_response IN ('ACCEPTED', 'DECLINED', 'RESUBMITTED'));
ALTER TABLE order_item_selections DROP COLUMN IF EXISTS custom_value_snapshot, DROP COLUMN IF EXISTS input_type_snapshot;
ALTER TABLE order_items DROP COLUMN IF EXISTS final_total_minor, DROP COLUMN IF EXISTS estimated_total_minor, DROP COLUMN IF EXISTS currency, DROP COLUMN IF EXISTS variant_model_key_snapshot;
DROP INDEX IF EXISTS orders_requires_action;
DROP INDEX IF EXISTS orders_completion_due;
DROP INDEX IF EXISTS orders_submitted_newest;
DROP INDEX IF EXISTS orders_submission_key_unique;
ALTER TABLE orders
  DROP COLUMN IF EXISTS source,
  DROP COLUMN IF EXISTS tracking_url,
  DROP COLUMN IF EXISTS tracking_reference,
  DROP COLUMN IF EXISTS shipping_method,
  DROP COLUMN IF EXISTS estimated_completion_date,
  DROP COLUMN IF EXISTS payment_due_at,
  DROP COLUMN IF EXISTS current_revision_number,
  DROP COLUMN IF EXISTS cancellation_reason,
  DROP COLUMN IF EXISTS rejection_reason,
  DROP COLUMN IF EXISTS rejected_at,
  DROP COLUMN IF EXISTS review_started_at,
  DROP COLUMN IF EXISTS submission_payload_hash,
  DROP COLUMN IF EXISTS submission_key_hash,
  DROP COLUMN IF EXISTS version;
DROP SEQUENCE IF EXISTS dollz_order_number_sequence;
