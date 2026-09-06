CREATE TABLE files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_key TEXT NOT NULL UNIQUE,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  extension TEXT NOT NULL,
  size_bytes BIGINT NOT NULL CHECK (size_bytes > 0),
  checksum_sha256 CHAR(64) NOT NULL,
  category VARCHAR(20) NOT NULL CHECK (category IN ('PRODUCT', 'VARIANT', 'OPTION', 'ORDER', 'PREVIEW', 'CONTENT')),
  visibility VARCHAR(10) NOT NULL CHECK (visibility IN ('PUBLIC', 'PRIVATE')),
  width INTEGER CHECK (width IS NULL OR width > 0),
  height INTEGER CHECK (height IS NULL OR height > 0),
  uploaded_by UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
