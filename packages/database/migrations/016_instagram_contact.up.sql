ALTER TABLE store_settings
ADD COLUMN instagram_url VARCHAR(500) NOT NULL DEFAULT 'https://www.instagram.com/dollz.lb/';

ALTER TABLE orders DROP CONSTRAINT orders_preferred_contact_method_check;
ALTER TABLE orders
ADD CONSTRAINT orders_preferred_contact_method_check
CHECK (preferred_contact_method IN ('EMAIL', 'PHONE', 'WHATSAPP', 'INSTAGRAM'));
