DROP INDEX IF EXISTS admin_sessions_token_family;
DROP INDEX IF EXISTS admin_users_locked_until;

ALTER TABLE admin_sessions
  DROP CONSTRAINT IF EXISTS admin_sessions_expiry_order,
  DROP COLUMN IF EXISTS absolute_expires_at,
  DROP COLUMN IF EXISTS last_rotated_at,
  DROP COLUMN IF EXISTS previous_refresh_token_hash;

ALTER TABLE admin_users
  DROP COLUMN IF EXISTS login_disabled_reason,
  DROP COLUMN IF EXISTS locked_until,
  DROP COLUMN IF EXISTS failed_login_attempts;
