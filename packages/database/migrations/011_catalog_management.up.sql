ALTER TABLE files
  ADD COLUMN optimized_storage_key TEXT,
  ADD COLUMN thumbnail_storage_key TEXT,
  ADD COLUMN processed_mime_type TEXT,
  ADD COLUMN processing_metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  ADD CONSTRAINT files_processing_metadata_object CHECK (jsonb_typeof(processing_metadata) = 'object');

CREATE UNIQUE INDEX files_optimized_storage_key_unique ON files (optimized_storage_key) WHERE optimized_storage_key IS NOT NULL;
CREATE UNIQUE INDEX files_thumbnail_storage_key_unique ON files (thumbnail_storage_key) WHERE thumbnail_storage_key IS NOT NULL;
CREATE INDEX files_admin_listing ON files (category, visibility, created_at DESC);

ALTER TABLE products
  ADD COLUMN version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  ADD COLUMN published_at TIMESTAMPTZ;

ALTER TABLE product_variants
  ADD COLUMN version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0);

ALTER TABLE product_media
  ADD COLUMN caption TEXT,
  ADD COLUMN version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0);

ALTER TABLE product_options
  ADD COLUMN version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0);

ALTER TABLE product_option_values
  ADD COLUMN version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0);

CREATE INDEX products_admin_listing ON products (status, is_featured, updated_at DESC, id);
CREATE INDEX product_media_order ON product_media (product_id, sort_order, id);
CREATE INDEX product_variants_order ON product_variants (product_id, sort_order, id);
CREATE INDEX product_options_order ON product_options (product_id, sort_order, id);
CREATE INDEX product_option_values_order ON product_option_values (product_option_id, sort_order, id);
