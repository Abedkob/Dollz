CREATE SEQUENCE dollz_order_number_sequence;

ALTER TABLE orders
  ADD COLUMN version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  ADD COLUMN submission_key_hash CHAR(64),
  ADD COLUMN submission_payload_hash CHAR(64),
  ADD COLUMN review_started_at TIMESTAMPTZ,
  ADD COLUMN rejected_at TIMESTAMPTZ,
  ADD COLUMN rejection_reason TEXT,
  ADD COLUMN cancellation_reason TEXT,
  ADD COLUMN current_revision_number INTEGER NOT NULL DEFAULT 0 CHECK (current_revision_number >= 0),
  ADD COLUMN payment_due_at TIMESTAMPTZ,
  ADD COLUMN estimated_completion_date DATE,
  ADD COLUMN shipping_method VARCHAR(20) NOT NULL DEFAULT 'DELIVERY' CHECK (shipping_method IN ('DELIVERY', 'PICKUP')),
  ADD COLUMN tracking_reference TEXT,
  ADD COLUMN tracking_url TEXT,
  ADD COLUMN source VARCHAR(30) NOT NULL DEFAULT 'STOREFRONT' CHECK (source IN ('STOREFRONT', 'ADMIN', 'API'));

CREATE UNIQUE INDEX orders_submission_key_unique ON orders (submission_key_hash) WHERE submission_key_hash IS NOT NULL;
CREATE INDEX orders_submitted_newest ON orders (submitted_at DESC, id);
CREATE INDEX orders_completion_due ON orders (estimated_completion_date, id) WHERE estimated_completion_date IS NOT NULL;
CREATE INDEX orders_requires_action ON orders (status, submitted_at DESC) WHERE status IN ('SUBMITTED', 'CHANGES_REQUESTED', 'AWAITING_PAYMENT');

ALTER TABLE order_items
  ADD COLUMN variant_model_key_snapshot TEXT,
  ADD COLUMN currency CHAR(3) NOT NULL DEFAULT 'USD' CHECK (currency ~ '^[A-Z]{3}$'),
  ADD COLUMN estimated_total_minor INTEGER NOT NULL DEFAULT 0 CHECK (estimated_total_minor >= 0),
  ADD COLUMN final_total_minor INTEGER CHECK (final_total_minor IS NULL OR final_total_minor >= 0);

ALTER TABLE order_item_selections
  ADD COLUMN input_type_snapshot VARCHAR(20) NOT NULL DEFAULT 'SELECT' CHECK (input_type_snapshot IN ('COLOR', 'IMAGE_CARD', 'TEXT', 'TEXTAREA', 'SELECT')),
  ADD COLUMN custom_value_snapshot TEXT;

ALTER TABLE order_revisions DROP CONSTRAINT order_revisions_customer_response_check;
ALTER TABLE order_revisions ADD CONSTRAINT order_revisions_customer_response_check
  CHECK (customer_response IS NULL OR customer_response IN ('ACCEPTED', 'DECLINED', 'RESUBMITTED', 'REQUEST_CLARIFICATION'));

ALTER TABLE payments
  ADD COLUMN due_at TIMESTAMPTZ,
  ADD COLUMN cancelled_at TIMESTAMPTZ,
  ADD COLUMN instructions TEXT;

CREATE UNIQUE INDEX payments_one_active_request ON payments (order_id) WHERE status IN ('REQUESTED', 'PENDING');

CREATE TABLE order_guest_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  session_hash CHAR(64) NOT NULL UNIQUE,
  csrf_hash CHAR(64) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  CHECK (expires_at > created_at)
);

CREATE INDEX order_guest_sessions_active ON order_guest_sessions (session_hash, expires_at) WHERE revoked_at IS NULL;
