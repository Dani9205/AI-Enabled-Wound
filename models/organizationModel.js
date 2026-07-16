const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Organization = sequelize.define(
  'Organization',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    domain: DataTypes.STRING,
    code: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    admin_user_id: DataTypes.INTEGER,
    status: {
      type: DataTypes.ENUM('active', 'pending', 'suspended', 'declined'),
      allowNull: false,
      defaultValue: 'pending',
    },
    suspension_reason: DataTypes.STRING,
    suspension_note: DataTypes.TEXT,
    suspended_by: DataTypes.INTEGER,
    suspended_at: DataTypes.DATE,
    decline_reason: DataTypes.TEXT,
    declined_by: DataTypes.INTEGER,
    declined_at: DataTypes.DATE,
    subscription_plan: DataTypes.STRING,
    subscription_status: {
      type: DataTypes.ENUM('active', 'trialing', 'expired', 'cancelled'),
      allowNull: false,
      defaultValue: 'trialing',
    },
    metadata: DataTypes.TEXT('long'),
  },
  {
    tableName: 'organizations',
    underscored: true,
  }
);

module.exports = Organization;
