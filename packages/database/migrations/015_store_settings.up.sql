CREATE TABLE store_settings (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
  atelier_name VARCHAR(120) NOT NULL DEFAULT 'Dollz',
  public_email VARCHAR(320),
  public_phone VARCHAR(50),
  whatsapp_number VARCHAR(50),
  location_label VARCHAR(200) NOT NULL DEFAULT 'Beirut, Lebanon',
  storefront_description VARCHAR(500) NOT NULL DEFAULT 'Handmade dolls, personalized for one unforgettable person.',
  delivery_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  pickup_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  pickup_label VARCHAR(150) NOT NULL DEFAULT 'Dollz atelier pickup',
  pickup_address VARCHAR(500),
  pickup_city VARCHAR(150) NOT NULL DEFAULT 'Beirut',
  pickup_country CHAR(2) NOT NULL DEFAULT 'LB',
  supported_country_codes TEXT[] NOT NULL DEFAULT ARRAY['LB']::TEXT[],
  default_country CHAR(2) NOT NULL DEFAULT 'LB',
  checkout_notice VARCHAR(500) NOT NULL DEFAULT 'No payment is taken now. Dollz reviews your request and confirms the final price before production.',
  default_currency CHAR(3) NOT NULL DEFAULT 'USD',
  default_production_min_days INTEGER NOT NULL DEFAULT 14 CHECK (default_production_min_days BETWEEN 1 AND 365),
  default_production_max_days INTEGER NOT NULL DEFAULT 30 CHECK (default_production_max_days BETWEEN 1 AND 365),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  updated_by UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (default_production_max_days >= default_production_min_days),
  CHECK (cardinality(supported_country_codes) > 0)
);

CREATE TRIGGER store_settings_updated_at BEFORE UPDATE ON store_settings
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

INSERT INTO store_settings (id) VALUES (TRUE);
