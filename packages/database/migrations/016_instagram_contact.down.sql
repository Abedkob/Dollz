UPDATE orders
SET preferred_contact_method = 'EMAIL'
WHERE preferred_contact_method = 'INSTAGRAM';

ALTER TABLE orders DROP CONSTRAINT orders_preferred_contact_method_check;
ALTER TABLE orders
ADD CONSTRAINT orders_preferred_contact_method_check
CHECK (preferred_contact_method IN ('EMAIL', 'PHONE', 'WHATSAPP'));

ALTER TABLE store_settings DROP COLUMN instagram_url;
