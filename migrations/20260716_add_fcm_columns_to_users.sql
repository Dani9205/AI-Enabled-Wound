-- Single-device Firebase Cloud Messaging registration fields.
-- Run against the database configured in .env.

ALTER TABLE users
  ADD COLUMN fcm_token TEXT NULL,
  ADD COLUMN fcm_platform ENUM('android', 'ios', 'web') NULL,
  ADD COLUMN fcm_token_updated_at DATETIME NULL;
