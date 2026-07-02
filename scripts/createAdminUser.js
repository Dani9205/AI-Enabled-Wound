require('dotenv').config();

const sequelize = require('../config/db');
const User = require('../models/userModel');
const { hashPassword } = require('../utils/security');

const isValidRole = (role) => ['admin', 'super_admin'].includes(role);

const main = async () => {
  const email = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const role = String(process.env.ADMIN_ROLE || 'super_admin').trim().toLowerCase();
  const firstName = String(process.env.ADMIN_FIRST_NAME || 'Admin').trim();
  const lastName = String(process.env.ADMIN_LAST_NAME || 'User').trim();

  if (!email || !password) {
    throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD are required');
  }

  if (!isValidRole(role)) {
    throw new Error('ADMIN_ROLE must be admin or super_admin');
  }

  if (String(password).length < 8) {
    throw new Error('ADMIN_PASSWORD must be at least 8 characters');
  }

  const [user, created] = await User.findOrCreate({
    where: { email },
    defaults: {
      name: `${firstName} ${lastName}`.trim(),
      first_name: firstName,
      last_name: lastName,
      email,
      role,
      password_hash: hashPassword(password),
      is_email_verified: true,
      account_status: 'active',
      request_status: 'accepted',
      request_accepted: true,
      reviewed_at: new Date(),
      terms_accepted: true,
      terms_accepted_at: new Date(),
    },
  });

  if (!created) {
    await user.update({
      role,
      password_hash: hashPassword(password),
      is_email_verified: true,
      account_status: 'active',
      request_status: 'accepted',
      request_accepted: true,
      reviewed_at: user.reviewed_at || new Date(),
    });
  }

  console.log(`${created ? 'Created' : 'Updated'} ${role}: ${email}`);
};

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
