const User = require('../models/userModel');
const Organization = require('../models/organizationModel');
const { Op } = require('sequelize');
const { signToken, verifyPassword } = require('../utils/security');

const ADMIN_ROLES = ['admin', 'super_admin'];

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

const adminUserResponse = (user) => ({
  id: user.id,
  name: user.name,
  first_name: user.first_name,
  last_name: user.last_name,
  email: user.email,
  role: user.role,
  account_status: user.account_status,
  last_login_at: user.last_login_at,
});

const adminLogin = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const { password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: 'Email and password are required',
      });
    }

    const user = await User.findOne({ where: { email } });

    if (
      !user ||
      !ADMIN_ROLES.includes(user.role) ||
      !verifyPassword(password, user.password_hash)
    ) {
      return res.status(401).json({
        message: 'Invalid admin email or password',
      });
    }

    if (user.account_status !== 'active') {
      return res.status(403).json({
        message: 'Admin account is not active',
      });
    }

    const token = signToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    await user.update({
      auth_token: token,
      last_login_at: new Date(),
    });

    return res.status(200).json({
      message: 'Admin login successful',
      token,
      admin: adminUserResponse(user),
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Admin login failed',
      error: error.message,
    });
  }
};

const getOrganizations = async (req, res) => {
  try {
    const organizations = await Organization.findAll({
      order: [['created_at', 'DESC']],
    });

    return res.status(200).json({
      message: 'Organizations retrieved successfully',
      total: organizations.length,
      organizations,
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to retrieve organizations',
      error: error.message,
    });
  }
};

const getOrganizationClinicalUsers = async (req, res) => {
  try {
    const organizationCode = String(req.params.organizationCode || '').trim();

    if (!organizationCode) {
      return res.status(400).json({ message: 'Organization code is required' });
    }

    const [organization, users] = await Promise.all([
      Organization.findOne({ where: { code: organizationCode } }),
      User.findAll({
        where: {
          organization_code: organizationCode,
          role: { [Op.in]: ['doctor', 'nurse'] },
        },
        attributes: [
          'id',
          'name',
          'first_name',
          'last_name',
          'email',
          'phone_number',
          'profile_photo_url',
          'organization_hospital',
          'organization_code',
          'role',
          'shift',
          'professional_title',
          'request_accepted',
          'request_status',
          'is_email_verified',
          'account_status',
          'created_at',
        ],
        order: [
          ['role', 'ASC'],
          ['name', 'ASC'],
        ],
      }),
    ]);

    return res.status(200).json({
      message: 'Organization doctors and nurses retrieved successfully',
      organization: organization
        ? {
            id: organization.id,
            name: organization.name,
            code: organization.code,
            status: organization.status,
          }
        : { code: organizationCode },
      total: users.length,
      users,
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to retrieve organization doctors and nurses',
      error: error.message,
    });
  }
};

module.exports = {
  adminLogin,
  getOrganizations,
  getOrganizationClinicalUsers,
};
