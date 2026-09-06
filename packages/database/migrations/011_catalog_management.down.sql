DROP INDEX IF EXISTS product_option_values_order;
DROP INDEX IF EXISTS product_options_order;
DROP INDEX IF EXISTS product_variants_order;
DROP INDEX IF EXISTS product_media_order;
DROP INDEX IF EXISTS products_admin_listing;

ALTER TABLE product_option_values DROP COLUMN IF EXISTS version;
ALTER TABLE product_options DROP COLUMN IF EXISTS version;
ALTER TABLE product_media DROP COLUMN IF EXISTS version, DROP COLUMN IF EXISTS caption;
ALTER TABLE product_variants DROP COLUMN IF EXISTS version;
ALTER TABLE products DROP COLUMN IF EXISTS published_at, DROP COLUMN IF EXISTS version;

DROP INDEX IF EXISTS files_admin_listing;
DROP INDEX IF EXISTS files_thumbnail_storage_key_unique;
DROP INDEX IF EXISTS files_optimized_storage_key_unique;
ALTER TABLE files
  DROP CONSTRAINT IF EXISTS files_processing_metadata_object,
  DROP COLUMN IF EXISTS processing_metadata,
  DROP COLUMN IF EXISTS processed_mime_type,
  DROP COLUMN IF EXISTS thumbnail_storage_key,
  DROP COLUMN IF EXISTS optimized_storage_key;
