const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Notification = sequelize.define(
  'Notification',
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
    type: {
      type: DataTypes.ENUM(
        'wound_update',
        'doctor_instruction',
        'new_task',
        'patient_assigned',
        'task_completed',
        'task_reassigned',
        'login_alert',
        'report_generated',
        'system'
      ),
      allowNull: false,
      defaultValue: 'system',
    },
    title: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    action_label: {
      type: DataTypes.STRING(80),
      allowNull: true,
    },
    action_url: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    read_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    cleared_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: 'notifications',
    underscored: true,
  }
);

module.exports = Notification;
