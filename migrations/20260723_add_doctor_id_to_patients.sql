-- Add the doctor assignment used by the current Patient model.
-- Safe to run repeatedly against the database configured for this project.

SET @doctor_id_exists = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'patients'
    AND COLUMN_NAME = 'doctor_id'
);

SET @add_doctor_id_sql = IF(
  @doctor_id_exists = 0,
  'ALTER TABLE `patients` ADD COLUMN `doctor_id` INT UNSIGNED NULL AFTER `nurse_id`',
  'SELECT 1'
);

PREPARE add_doctor_id_stmt FROM @add_doctor_id_sql;
EXECUTE add_doctor_id_stmt;
DEALLOCATE PREPARE add_doctor_id_stmt;
