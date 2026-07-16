const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const User = sequelize.define(
  'User',
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    first_name: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    last_name: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    email: {
      type: DataTypes.STRING(150),
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    phone_number: {
      type: DataTypes.STRING(30),
      allowNull: true,
    },
    profile_photo_url: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    organization_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: {
        model: 'organizations',
        key: 'id',
      },
    },
    organization_hospital: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    organization_code: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    request_accepted: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    request_status: {
      type: DataTypes.ENUM('none', 'pending', 'accepted', 'rejected'),
      allowNull: false,
      defaultValue: 'none',
    },
    reviewed_by: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    reviewed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    rejection_reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    role: {
      type: DataTypes.ENUM(
        'doctor',
        'nurse',
        'patient',
        'user',
        'admin',
        'super_admin'
      ),
      allowNull: false,
      defaultValue: 'nurse',
    },
    shift: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    professional_title: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    password_hash: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    verification_code: {
      type: DataTypes.STRING(6),
      allowNull: true,
    },
    verification_code_expires_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    verification_purpose: {
      type: DataTypes.ENUM('signup', 'signin', 'reset_password'),
      allowNull: true,
    },
    is_email_verified: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    last_login_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    auth_token: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    notification_preferences: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    app_settings: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    security_settings: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    active_sessions: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    account_status: {
      type: DataTypes.ENUM('active', 'signed_out', 'deactivated', 'deleted'),
      allowNull: false,
      defaultValue: 'active',
    },
    deleted_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    terms_accepted: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    terms_accepted_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: 'users',
    underscored: true,
    indexes: [
      { fields: ['role'] },
      { fields: ['organization_id'] },
      { fields: ['request_status'] },
      { fields: ['account_status'] },
    ],
  }
);

module.exports = User;
