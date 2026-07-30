-- Add task-style assignment tracking to patients.
-- Safe to run repeatedly against the configured MySQL database.

SET @assigned_by_exists = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'patients'
    AND COLUMN_NAME = 'assigned_by'
);

SET @add_assigned_by_sql = IF(
  @assigned_by_exists = 0,
  'ALTER TABLE `patients` ADD COLUMN `assigned_by` INT UNSIGNED NULL AFTER `doctor_id`',
  'SELECT 1'
);

PREPARE add_assigned_by_stmt FROM @add_assigned_by_sql;
EXECUTE add_assigned_by_stmt;
DEALLOCATE PREPARE add_assigned_by_stmt;

SET @assigned_to_exists = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'patients'
    AND COLUMN_NAME = 'assigned_to'
);

SET @add_assigned_to_sql = IF(
  @assigned_to_exists = 0,
  'ALTER TABLE `patients` ADD COLUMN `assigned_to` INT UNSIGNED NULL AFTER `assigned_by`',
  'SELECT 1'
);

PREPARE add_assigned_to_stmt FROM @add_assigned_to_sql;
EXECUTE add_assigned_to_stmt;
DEALLOCATE PREPARE add_assigned_to_stmt;

UPDATE `patients`
SET
  `assigned_by` = COALESCE(`assigned_by`, `doctor_id`, `nurse_id`),
  `assigned_to` = COALESCE(`assigned_to`, `nurse_id`, `doctor_id`)
WHERE `assigned_by` IS NULL OR `assigned_to` IS NULL;
