const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Subscription = sequelize.define(
  'Subscription',
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    plan_code: {
      type: DataTypes.ENUM('free', 'basic', 'professional', 'organization'),
      allowNull: false,
      defaultValue: 'free',
    },
    plan_name: {
      type: DataTypes.STRING(120),
      allowNull: false,
      defaultValue: 'Free',
    },
    billing_provider: {
      type: DataTypes.ENUM('manual', 'apple_pay', 'google_pay', 'app_store'),
      allowNull: false,
      defaultValue: 'manual',
    },
    provider_subscription_id: {
      type: DataTypes.STRING(180),
      allowNull: true,
    },
    currency: {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: 'CHF',
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },
    interval: {
      type: DataTypes.ENUM('forever', 'month'),
      allowNull: false,
      defaultValue: 'forever',
    },
    status: {
      type: DataTypes.ENUM('active', 'trialing', 'cancelled', 'expired'),
      allowNull: false,
      defaultValue: 'active',
    },
    usage: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    features: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    trial_ends_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    current_period_start: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    current_period_end: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    cancelled_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
    },
  },
  {
    tableName: 'subscriptions',
    underscored: true,
  }
);

module.exports = Subscription;
