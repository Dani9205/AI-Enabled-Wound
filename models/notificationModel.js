const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const { sendNotificationPush } = require('../services/pushNotificationService');

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

const pushCreatedNotification = async (notification) => {
  try {
    await sendNotificationPush(notification);
  } catch (error) {
    console.error(
      `Push notification failed for notification ${notification.id}:`,
      error.message
    );
  }
};

Notification.addHook(
  'afterCreate',
  'sendPushForCreatedNotification',
  async (notification, options) => {
    if (options.transaction) {
      options.transaction.afterCommit(() => pushCreatedNotification(notification));
      return;
    }

    await pushCreatedNotification(notification);
  }
);

module.exports = Notification;
