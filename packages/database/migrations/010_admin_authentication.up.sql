ALTER TABLE admin_users
  ADD COLUMN failed_login_attempts INTEGER NOT NULL DEFAULT 0 CHECK (failed_login_attempts >= 0),
  ADD COLUMN locked_until TIMESTAMPTZ,
  ADD COLUMN login_disabled_reason TEXT;

ALTER TABLE admin_sessions
  ADD COLUMN previous_refresh_token_hash CHAR(64),
  ADD COLUMN last_rotated_at TIMESTAMPTZ,
  ADD COLUMN absolute_expires_at TIMESTAMPTZ;

UPDATE admin_sessions
SET absolute_expires_at = expires_at
WHERE absolute_expires_at IS NULL;

ALTER TABLE admin_sessions
  ALTER COLUMN absolute_expires_at SET NOT NULL,
  ADD CONSTRAINT admin_sessions_expiry_order CHECK (expires_at <= absolute_expires_at);

CREATE INDEX admin_users_locked_until ON admin_users (locked_until) WHERE locked_until IS NOT NULL;
CREATE INDEX admin_sessions_token_family ON admin_sessions (token_family_id) WHERE revoked_at IS NULL;
