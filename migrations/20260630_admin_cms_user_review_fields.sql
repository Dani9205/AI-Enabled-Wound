-- Admin CMS minimum user-review migration.
-- Target database: ai_enabled_wound_db
-- Non-destructive: does not drop, truncate, or reset data.
-- Run this against the same MySQL database used by the mobile/main backend.

USE ai_enabled_wound_db;

ALTER TABLE users
  MODIFY role ENUM(
    'doctor',
    'nurse',
    'patient',
    'user',
    'admin',
    'super_admin'
  ) NOT NULL DEFAULT 'user';

ALTER TABLE users
  ADD COLUMN request_status ENUM('none', 'pending', 'accepted', 'rejected') NOT NULL DEFAULT 'none',
  ADD COLUMN reviewed_by INT UNSIGNED NULL,
  ADD COLUMN reviewed_at DATETIME NULL,
  ADD COLUMN rejection_reason TEXT NULL;

UPDATE users
SET request_status = CASE
  WHEN request_accepted = 1 THEN 'accepted'
  WHEN organization_hospital IS NOT NULL AND organization_hospital <> '' THEN 'pending'
  ELSE 'none'
END
WHERE request_status = 'none';

CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_request_status ON users(request_status);
CREATE INDEX idx_users_account_status ON users(account_status);
