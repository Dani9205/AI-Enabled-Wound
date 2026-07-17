-- Sync runtime Sequelize models with the MySQL schema.
-- Non-destructive: creates missing tables and adds missing columns only.
-- Run this against the same database configured in .env.

USE ai_enabled_wound_db;

DELIMITER $$

DROP PROCEDURE IF EXISTS add_column_if_missing $$
CREATE PROCEDURE add_column_if_missing(
  IN table_name_param VARCHAR(64),
  IN column_name_param VARCHAR(64),
  IN column_definition_param TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = table_name_param
      AND COLUMN_NAME = column_name_param
  ) THEN
    SET @ddl = CONCAT(
      'ALTER TABLE `',
      table_name_param,
      '` ADD COLUMN `',
      column_name_param,
      '` ',
      column_definition_param
    );
    PREPARE stmt FROM @ddl;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END $$

DELIMITER ;

-- users columns used by auth/profile/admin flows.
CALL add_column_if_missing('users', 'role', 'ENUM(''doctor'',''nurse'',''patient'',''user'',''admin'',''super_admin'') NOT NULL DEFAULT ''user''');

ALTER TABLE users
  MODIFY COLUMN role ENUM('doctor','nurse','patient','user','admin','super_admin') NOT NULL DEFAULT 'user';

CALL add_column_if_missing('users', 'name', 'VARCHAR(100) NULL');
CALL add_column_if_missing('users', 'first_name', 'VARCHAR(100) NULL');
CALL add_column_if_missing('users', 'last_name', 'VARCHAR(100) NULL');
CALL add_column_if_missing('users', 'phone_number', 'VARCHAR(30) NULL');
CALL add_column_if_missing('users', 'profile_photo_url', 'VARCHAR(255) NULL');
CALL add_column_if_missing('users', 'organization_hospital', 'VARCHAR(150) NULL');
CALL add_column_if_missing('users', 'organization_code', 'VARCHAR(100) NULL');
CALL add_column_if_missing('users', 'request_accepted', 'TINYINT(1) NOT NULL DEFAULT 0');
CALL add_column_if_missing('users', 'request_status', 'ENUM(''none'',''pending'',''accepted'',''rejected'') NOT NULL DEFAULT ''none''');
CALL add_column_if_missing('users', 'reviewed_by', 'INT UNSIGNED NULL');
CALL add_column_if_missing('users', 'reviewed_at', 'DATETIME NULL');
CALL add_column_if_missing('users', 'rejection_reason', 'TEXT NULL');
CALL add_column_if_missing('users', 'shift', 'VARCHAR(100) NULL');
CALL add_column_if_missing('users', 'professional_title', 'VARCHAR(100) NULL');
CALL add_column_if_missing('users', 'verification_code', 'VARCHAR(6) NULL');
CALL add_column_if_missing('users', 'verification_code_expires_at', 'DATETIME NULL');
CALL add_column_if_missing('users', 'verification_purpose', 'ENUM(''signup'',''signin'',''reset_password'') NULL');
CALL add_column_if_missing('users', 'is_email_verified', 'TINYINT(1) NOT NULL DEFAULT 0');
CALL add_column_if_missing('users', 'last_login_at', 'DATETIME NULL');
CALL add_column_if_missing('users', 'auth_token', 'TEXT NULL');
CALL add_column_if_missing('users', 'fcm_token', 'TEXT NULL');
CALL add_column_if_missing('users', 'fcm_platform', 'ENUM(''android'',''ios'',''web'') NULL');
CALL add_column_if_missing('users', 'fcm_token_updated_at', 'DATETIME NULL');
CALL add_column_if_missing('users', 'notification_preferences', 'JSON NULL');
CALL add_column_if_missing('users', 'app_settings', 'JSON NULL');
CALL add_column_if_missing('users', 'security_settings', 'JSON NULL');
CALL add_column_if_missing('users', 'active_sessions', 'JSON NULL');
CALL add_column_if_missing('users', 'account_status', 'ENUM(''active'',''signed_out'',''deactivated'',''deleted'') NOT NULL DEFAULT ''active''');
CALL add_column_if_missing('users', 'deleted_at', 'DATETIME NULL');
CALL add_column_if_missing('users', 'terms_accepted', 'TINYINT(1) NOT NULL DEFAULT 0');
CALL add_column_if_missing('users', 'terms_accepted_at', 'DATETIME NULL');
CALL add_column_if_missing('users', 'created_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP');
CALL add_column_if_missing('users', 'updated_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP');

UPDATE users
SET request_status = CASE
  WHEN request_accepted = 1 THEN 'accepted'
  WHEN organization_hospital IS NOT NULL AND organization_hospital <> '' THEN 'pending'
  ELSE 'none'
END
WHERE request_status = 'none';

CREATE TABLE IF NOT EXISTS patients (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nurse_id INT UNSIGNED NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  date_of_birth DATE NULL,
  gender ENUM('male','female','other') NULL,
  mrn VARCHAR(100) NOT NULL,
  address VARCHAR(255) NULL,
  room VARCHAR(100) NULL,
  wound_type VARCHAR(150) NULL,
  primary_staff VARCHAR(150) NULL,
  backup_staff VARCHAR(150) NULL,
  primary_diagnosis VARCHAR(255) NULL,
  allergies_notes TEXT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY patients_mrn_unique (mrn),
  KEY idx_patients_nurse_id (nurse_id),
  CONSTRAINT fk_patients_nurse_id FOREIGN KEY (nurse_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tasks (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  title VARCHAR(150) NOT NULL,
  description TEXT NULL,
  task_type ENUM('all','wound','documentation','follow_up','other') NOT NULL DEFAULT 'other',
  priority ENUM('low','medium','high') NOT NULL DEFAULT 'medium',
  status ENUM('pending','completed','cancelled') NOT NULL DEFAULT 'pending',
  patient_id INT UNSIGNED NULL,
  wound_case VARCHAR(255) NULL,
  assigned_by INT UNSIGNED NULL,
  assigned_to INT UNSIGNED NULL,
  due_date DATE NULL,
  due_time TIME NULL,
  task_notes TEXT NULL,
  work_notes TEXT NULL,
  completed_at DATETIME NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY idx_tasks_patient_id (patient_id),
  KEY idx_tasks_assigned_by (assigned_by),
  KEY idx_tasks_assigned_to (assigned_to),
  KEY idx_tasks_status (status),
  CONSTRAINT fk_tasks_patient_id FOREIGN KEY (patient_id) REFERENCES patients(id),
  CONSTRAINT fk_tasks_assigned_by FOREIGN KEY (assigned_by) REFERENCES users(id),
  CONSTRAINT fk_tasks_assigned_to FOREIGN KEY (assigned_to) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS wound_cases (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  patient_id INT UNSIGNED NOT NULL,
  wound_type VARCHAR(150) NOT NULL,
  severity_stage VARCHAR(50) NULL,
  pain_score INT UNSIGNED NULL,
  body_location VARCHAR(150) NULL,
  wound_etiology VARCHAR(150) NULL,
  status ENUM('active','monitoring','healing','healed','closed') NOT NULL DEFAULT 'active',
  healing_progress DECIMAL(5,2) NULL,
  length_cm DECIMAL(8,2) NULL,
  width_cm DECIMAL(8,2) NULL,
  depth_cm DECIMAL(8,2) NULL,
  images JSON NULL,
  measurements JSON NULL,
  updates JSON NULL,
  clinical_notes JSON NULL,
  reports JSON NULL,
  notes TEXT NULL,
  last_updated_at DATETIME NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY idx_wound_cases_patient_id (patient_id),
  KEY idx_wound_cases_status (status),
  CONSTRAINT fk_wound_cases_patient_id FOREIGN KEY (patient_id) REFERENCES patients(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS patient_handoffs (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  from_nurse_id INT UNSIGNED NOT NULL,
  to_nurse_id INT UNSIGNED NULL,
  patient_ids JSON NULL,
  pending_task_ids JSON NULL,
  general_notes TEXT NULL,
  per_patient_notes JSON NULL,
  shift_label VARCHAR(100) NULL,
  shift_ends_at DATETIME NULL,
  status ENUM('draft','ready','completed','cancelled') NOT NULL DEFAULT 'draft',
  completed_at DATETIME NULL,
  summary JSON NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY idx_patient_handoffs_from_nurse_id (from_nurse_id),
  KEY idx_patient_handoffs_to_nurse_id (to_nurse_id),
  KEY idx_patient_handoffs_status (status),
  CONSTRAINT fk_patient_handoffs_from_nurse_id FOREIGN KEY (from_nurse_id) REFERENCES users(id),
  CONSTRAINT fk_patient_handoffs_to_nurse_id FOREIGN KEY (to_nurse_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notifications (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  type ENUM('wound_update','doctor_instruction','new_task','patient_assigned','task_completed','task_reassigned','login_alert','report_generated','system') NOT NULL DEFAULT 'system',
  title VARCHAR(150) NOT NULL,
  message TEXT NULL,
  action_label VARCHAR(80) NULL,
  action_url VARCHAR(255) NULL,
  metadata JSON NULL,
  read_at DATETIME NULL,
  cleared_at DATETIME NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY idx_notifications_user_id (user_id),
  KEY idx_notifications_type (type),
  KEY idx_notifications_read_at (read_at),
  CONSTRAINT fk_notifications_user_id FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS subscriptions (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  plan_code ENUM('free','basic','professional','organization') NOT NULL DEFAULT 'free',
  plan_name VARCHAR(120) NOT NULL DEFAULT 'Free',
  billing_provider ENUM('manual','apple_pay','google_pay','app_store') NOT NULL DEFAULT 'manual',
  provider_subscription_id VARCHAR(180) NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'CHF',
  amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  `interval` ENUM('forever','month') NOT NULL DEFAULT 'forever',
  status ENUM('active','trialing','cancelled','expired') NOT NULL DEFAULT 'active',
  `usage` JSON NULL,
  features JSON NULL,
  trial_ends_at DATETIME NULL,
  current_period_start DATETIME NULL,
  current_period_end DATETIME NULL,
  cancelled_at DATETIME NULL,
  metadata JSON NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY idx_subscriptions_user_id (user_id),
  KEY idx_subscriptions_plan_code (plan_code),
  KEY idx_subscriptions_status (status),
  CONSTRAINT fk_subscriptions_user_id FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add any columns missing from existing tables without changing data.
CALL add_column_if_missing('patients', 'nurse_id', 'INT UNSIGNED NULL');
CALL add_column_if_missing('patients', 'first_name', 'VARCHAR(100) NULL');
CALL add_column_if_missing('patients', 'last_name', 'VARCHAR(100) NULL');
CALL add_column_if_missing('patients', 'date_of_birth', 'DATE NULL');
CALL add_column_if_missing('patients', 'gender', 'ENUM(''male'',''female'',''other'') NULL');
CALL add_column_if_missing('patients', 'mrn', 'VARCHAR(100) NULL');
CALL add_column_if_missing('patients', 'address', 'VARCHAR(255) NULL');
CALL add_column_if_missing('patients', 'room', 'VARCHAR(100) NULL');
CALL add_column_if_missing('patients', 'wound_type', 'VARCHAR(150) NULL');
CALL add_column_if_missing('patients', 'primary_staff', 'VARCHAR(150) NULL');
CALL add_column_if_missing('patients', 'backup_staff', 'VARCHAR(150) NULL');
CALL add_column_if_missing('patients', 'primary_diagnosis', 'VARCHAR(255) NULL');
CALL add_column_if_missing('patients', 'allergies_notes', 'TEXT NULL');
CALL add_column_if_missing('patients', 'created_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP');
CALL add_column_if_missing('patients', 'updated_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP');

CALL add_column_if_missing('tasks', 'title', 'VARCHAR(150) NULL');
CALL add_column_if_missing('tasks', 'description', 'TEXT NULL');
CALL add_column_if_missing('tasks', 'task_type', 'ENUM(''all'',''wound'',''documentation'',''follow_up'',''other'') NOT NULL DEFAULT ''other''');
CALL add_column_if_missing('tasks', 'priority', 'ENUM(''low'',''medium'',''high'') NOT NULL DEFAULT ''medium''');
CALL add_column_if_missing('tasks', 'status', 'ENUM(''pending'',''completed'',''cancelled'') NOT NULL DEFAULT ''pending''');
CALL add_column_if_missing('tasks', 'patient_id', 'INT UNSIGNED NULL');
CALL add_column_if_missing('tasks', 'wound_case', 'VARCHAR(255) NULL');
CALL add_column_if_missing('tasks', 'assigned_by', 'INT UNSIGNED NULL');
CALL add_column_if_missing('tasks', 'assigned_to', 'INT UNSIGNED NULL');
CALL add_column_if_missing('tasks', 'due_date', 'DATE NULL');
CALL add_column_if_missing('tasks', 'due_time', 'TIME NULL');
CALL add_column_if_missing('tasks', 'task_notes', 'TEXT NULL');
CALL add_column_if_missing('tasks', 'work_notes', 'TEXT NULL');
CALL add_column_if_missing('tasks', 'completed_at', 'DATETIME NULL');
CALL add_column_if_missing('tasks', 'created_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP');
CALL add_column_if_missing('tasks', 'updated_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP');

CALL add_column_if_missing('wound_cases', 'patient_id', 'INT UNSIGNED NULL');
CALL add_column_if_missing('wound_cases', 'wound_type', 'VARCHAR(150) NULL');
CALL add_column_if_missing('wound_cases', 'severity_stage', 'VARCHAR(50) NULL');
CALL add_column_if_missing('wound_cases', 'pain_score', 'INT UNSIGNED NULL');
CALL add_column_if_missing('wound_cases', 'body_location', 'VARCHAR(150) NULL');
CALL add_column_if_missing('wound_cases', 'wound_etiology', 'VARCHAR(150) NULL');
CALL add_column_if_missing('wound_cases', 'status', 'ENUM(''active'',''monitoring'',''healing'',''healed'',''closed'') NOT NULL DEFAULT ''active''');
CALL add_column_if_missing('wound_cases', 'healing_progress', 'DECIMAL(5,2) NULL');
CALL add_column_if_missing('wound_cases', 'length_cm', 'DECIMAL(8,2) NULL');
CALL add_column_if_missing('wound_cases', 'width_cm', 'DECIMAL(8,2) NULL');
CALL add_column_if_missing('wound_cases', 'depth_cm', 'DECIMAL(8,2) NULL');
CALL add_column_if_missing('wound_cases', 'images', 'JSON NULL');
CALL add_column_if_missing('wound_cases', 'measurements', 'JSON NULL');
CALL add_column_if_missing('wound_cases', 'updates', 'JSON NULL');
CALL add_column_if_missing('wound_cases', 'clinical_notes', 'JSON NULL');
CALL add_column_if_missing('wound_cases', 'reports', 'JSON NULL');
CALL add_column_if_missing('wound_cases', 'notes', 'TEXT NULL');
CALL add_column_if_missing('wound_cases', 'last_updated_at', 'DATETIME NULL');
CALL add_column_if_missing('wound_cases', 'created_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP');
CALL add_column_if_missing('wound_cases', 'updated_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP');

CALL add_column_if_missing('patient_handoffs', 'from_nurse_id', 'INT UNSIGNED NULL');
CALL add_column_if_missing('patient_handoffs', 'to_nurse_id', 'INT UNSIGNED NULL');
CALL add_column_if_missing('patient_handoffs', 'patient_ids', 'JSON NULL');
CALL add_column_if_missing('patient_handoffs', 'pending_task_ids', 'JSON NULL');
CALL add_column_if_missing('patient_handoffs', 'general_notes', 'TEXT NULL');
CALL add_column_if_missing('patient_handoffs', 'per_patient_notes', 'JSON NULL');
CALL add_column_if_missing('patient_handoffs', 'shift_label', 'VARCHAR(100) NULL');
CALL add_column_if_missing('patient_handoffs', 'shift_ends_at', 'DATETIME NULL');
CALL add_column_if_missing('patient_handoffs', 'status', 'ENUM(''draft'',''ready'',''completed'',''cancelled'') NOT NULL DEFAULT ''draft''');
CALL add_column_if_missing('patient_handoffs', 'completed_at', 'DATETIME NULL');
CALL add_column_if_missing('patient_handoffs', 'summary', 'JSON NULL');
CALL add_column_if_missing('patient_handoffs', 'created_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP');
CALL add_column_if_missing('patient_handoffs', 'updated_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP');

CALL add_column_if_missing('notifications', 'user_id', 'INT UNSIGNED NULL');
CALL add_column_if_missing('notifications', 'type', 'ENUM(''wound_update'',''doctor_instruction'',''new_task'',''patient_assigned'',''task_completed'',''task_reassigned'',''login_alert'',''report_generated'',''system'') NOT NULL DEFAULT ''system''');
CALL add_column_if_missing('notifications', 'title', 'VARCHAR(150) NULL');
CALL add_column_if_missing('notifications', 'message', 'TEXT NULL');
CALL add_column_if_missing('notifications', 'action_label', 'VARCHAR(80) NULL');
CALL add_column_if_missing('notifications', 'action_url', 'VARCHAR(255) NULL');
CALL add_column_if_missing('notifications', 'metadata', 'JSON NULL');
CALL add_column_if_missing('notifications', 'read_at', 'DATETIME NULL');
CALL add_column_if_missing('notifications', 'cleared_at', 'DATETIME NULL');
CALL add_column_if_missing('notifications', 'created_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP');
CALL add_column_if_missing('notifications', 'updated_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP');

CALL add_column_if_missing('subscriptions', 'user_id', 'INT UNSIGNED NULL');
CALL add_column_if_missing('subscriptions', 'plan_code', 'ENUM(''free'',''basic'',''professional'',''organization'') NOT NULL DEFAULT ''free''');
CALL add_column_if_missing('subscriptions', 'plan_name', 'VARCHAR(120) NOT NULL DEFAULT ''Free''');
CALL add_column_if_missing('subscriptions', 'billing_provider', 'ENUM(''manual'',''apple_pay'',''google_pay'',''app_store'') NOT NULL DEFAULT ''manual''');
CALL add_column_if_missing('subscriptions', 'provider_subscription_id', 'VARCHAR(180) NULL');
CALL add_column_if_missing('subscriptions', 'currency', 'VARCHAR(10) NOT NULL DEFAULT ''CHF''');
CALL add_column_if_missing('subscriptions', 'amount', 'DECIMAL(10,2) NOT NULL DEFAULT 0');
CALL add_column_if_missing('subscriptions', 'interval', 'ENUM(''forever'',''month'') NOT NULL DEFAULT ''forever''');
CALL add_column_if_missing('subscriptions', 'status', 'ENUM(''active'',''trialing'',''cancelled'',''expired'') NOT NULL DEFAULT ''active''');
CALL add_column_if_missing('subscriptions', 'usage', 'JSON NULL');
CALL add_column_if_missing('subscriptions', 'features', 'JSON NULL');
CALL add_column_if_missing('subscriptions', 'trial_ends_at', 'DATETIME NULL');
CALL add_column_if_missing('subscriptions', 'current_period_start', 'DATETIME NULL');
CALL add_column_if_missing('subscriptions', 'current_period_end', 'DATETIME NULL');
CALL add_column_if_missing('subscriptions', 'cancelled_at', 'DATETIME NULL');
CALL add_column_if_missing('subscriptions', 'metadata', 'JSON NULL');
CALL add_column_if_missing('subscriptions', 'created_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP');
CALL add_column_if_missing('subscriptions', 'updated_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP');

DROP PROCEDURE IF EXISTS add_column_if_missing;
