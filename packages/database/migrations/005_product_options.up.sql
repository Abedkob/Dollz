CREATE TABLE product_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  code VARCHAR(100) NOT NULL,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  input_type VARCHAR(20) NOT NULL CHECK (input_type IN ('COLOR', 'IMAGE_CARD', 'TEXT', 'TEXTAREA', 'SELECT')),
  is_required BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  affects_3d BOOLEAN NOT NULL DEFAULT FALSE,
  three_d_property VARCHAR(100),
  allow_custom_value BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (product_id, code),
  CHECK (NOT affects_3d OR NULLIF(BTRIM(three_d_property), '') IS NOT NULL)
);
CREATE TRIGGER product_options_updated_at BEFORE UPDATE ON product_options FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE product_option_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_option_id UUID NOT NULL REFERENCES product_options(id) ON DELETE CASCADE,
  code VARCHAR(100) NOT NULL,
  label VARCHAR(150) NOT NULL,
  description TEXT,
  color_hex CHAR(7) CHECK (color_hex IS NULL OR color_hex ~ '^#[0-9A-Fa-f]{6}$'),
  reference_file_id UUID REFERENCES files(id) ON DELETE SET NULL,
  price_adjustment_minor INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (product_option_id, code),
  CHECK (jsonb_typeof(metadata) = 'object')
);
CREATE UNIQUE INDEX product_option_values_one_active_default ON product_option_values (product_option_id) WHERE is_default AND is_active;
CREATE TRIGGER product_option_values_updated_at BEFORE UPDATE ON product_option_values FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE option_value_conflicts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_value_id UUID NOT NULL REFERENCES product_option_values(id) ON DELETE CASCADE,
  second_value_id UUID NOT NULL REFERENCES product_option_values(id) ON DELETE CASCADE,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (first_value_id <> second_value_id)
);
CREATE UNIQUE INDEX option_value_conflicts_unordered_unique ON option_value_conflicts (LEAST(first_value_id, second_value_id), GREATEST(first_value_id, second_value_id));
