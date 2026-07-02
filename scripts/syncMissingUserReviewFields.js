const sequelize = require('../config/db');

const addColumnIfMissing = async (columns, name, definition) => {
  if (columns[name]) {
    console.log(`exists ${name}`);
    return;
  }

  await sequelize.query(`ALTER TABLE users ADD COLUMN ${definition}`);
  console.log(`added ${name}`);
};

const syncMissingUserReviewFields = async () => {
  const queryInterface = sequelize.getQueryInterface();
  const columns = await queryInterface.describeTable('users');

  await addColumnIfMissing(
    columns,
    'request_status',
    "request_status ENUM('none','pending','accepted','rejected') NOT NULL DEFAULT 'none'"
  );
  await addColumnIfMissing(columns, 'reviewed_by', 'reviewed_by INT UNSIGNED NULL');
  await addColumnIfMissing(columns, 'reviewed_at', 'reviewed_at DATETIME NULL');
  await addColumnIfMissing(columns, 'rejection_reason', 'rejection_reason TEXT NULL');

  await sequelize.query(`
    UPDATE users
    SET request_status = CASE
      WHEN request_accepted = 1 THEN 'accepted'
      WHEN organization_hospital IS NOT NULL AND organization_hospital <> '' THEN 'pending'
      ELSE 'none'
    END
    WHERE request_status = 'none'
  `);
};

syncMissingUserReviewFields()
  .then(async () => {
    await sequelize.close();
  })
  .catch(async (error) => {
    console.error(error.message);
    await sequelize.close();
    process.exit(1);
  });
