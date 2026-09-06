CREATE TABLE order_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  revision_number INTEGER NOT NULL CHECK (revision_number > 0),
  revision_type VARCHAR(30) NOT NULL CHECK (revision_type IN ('CHANGES_REQUESTED', 'PRICE_PROPOSAL', 'APPROVAL', 'REJECTION')),
  customer_message TEXT,
  internal_message TEXT,
  proposed_subtotal_minor INTEGER CHECK (proposed_subtotal_minor IS NULL OR proposed_subtotal_minor >= 0),
  proposed_delivery_fee_minor INTEGER CHECK (proposed_delivery_fee_minor IS NULL OR proposed_delivery_fee_minor >= 0),
  proposed_total_minor INTEGER CHECK (proposed_total_minor IS NULL OR proposed_total_minor >= 0),
  estimated_completion_date DATE,
  configuration_snapshot JSONB NOT NULL,
  customer_response VARCHAR(20) CHECK (customer_response IS NULL OR customer_response IN ('ACCEPTED', 'DECLINED', 'RESUBMITTED')),
  customer_response_message TEXT,
  customer_responded_at TIMESTAMPTZ,
  created_by UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (order_id, revision_number)
);

CREATE TABLE order_access_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  purpose VARCHAR(30) NOT NULL CHECK (purpose IN ('TRACK_ORDER', 'RESPOND_TO_REVISION')),
  expires_at TIMESTAMPTZ NOT NULL,
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  method VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('REQUESTED', 'PENDING', 'VERIFIED', 'FAILED', 'CANCELLED', 'REFUNDED')),
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  currency CHAR(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  external_reference TEXT,
  admin_notes TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  received_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
