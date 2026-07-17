const { Op } = require('sequelize');
const Notification = require('../models/notificationModel');
const User = require('../models/userModel');
const { sendNotificationPush } = require('../services/pushNotificationService');

const VALID_TYPES = [
  'wound_update',
  'doctor_instruction',
  'new_task',
  'patient_assigned',
  'task_completed',
  'task_reassigned',
  'login_alert',
  'report_generated',
  'system',
];

const cleanString = (value) => {
  if (value === undefined || value === null) {
    return undefined;
  }

  const trimmed = String(value).trim();
  return trimmed || undefined;
};

const parseId = (value) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : NaN;
};

const asObject = (value) => {
  if (!value) {
    return {};
  }

  if (typeof value === 'object' && !Array.isArray(value)) {
    return value;
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch (error) {
      return {};
    }
  }

  return {};
};

const getBodyValue = (body, field) => {
  const camelField = field.replace(/_([a-z])/g, (_, letter) =>
    letter.toUpperCase()
  );

  return body[field] !== undefined ? body[field] : body[camelField];
};

const timeAgo = (dateValue) => {
  if (!dateValue) {
    return null;
  }

  const diff = Date.now() - new Date(dateValue).getTime();
  if (Number.isNaN(diff) || diff < 0) {
    return null;
  }

  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';

  return `${days}d ago`;
};

const notificationResponse = (notification) => ({
  id: notification.id,
  user_id: notification.user_id,
  type: notification.type,
  title: notification.title,
  message: notification.message,
  action_label: notification.action_label,
  action_url: notification.action_url,
  metadata: asObject(notification.metadata),
  is_read: Boolean(notification.read_at),
  read_at: notification.read_at,
  cleared_at: notification.cleared_at,
  time_ago: timeAgo(notification.createdAt),
  created_at: notification.createdAt,
  updated_at: notification.updatedAt,
});

const buildNotificationPayload = (body) => {
  const userId = parseId(getBodyValue(body, 'user_id'));
  const type = cleanString(body.type) || 'system';

  return {
    user_id: userId,
    type: type.toLowerCase(),
    title: cleanString(body.title),
    message: cleanString(body.message),
    action_label: cleanString(getBodyValue(body, 'action_label')) || null,
    action_url: cleanString(getBodyValue(body, 'action_url')) || null,
    metadata: asObject(body.metadata),
  };
};

const validateNotificationPayload = (payload) => {
  if (!payload.user_id || Number.isNaN(payload.user_id)) {
    return 'user_id is required';
  }

  if (!payload.title) {
    return 'title is required';
  }

  if (!VALID_TYPES.includes(payload.type)) {
    return `type must be one of: ${VALID_TYPES.join(', ')}`;
  }

  return null;
};

const buildWhere = (req) => {
  const userId = parseId(req.params.userId || req.query.user_id || req.query.userId);
  const tab = cleanString(req.query.tab || req.query.status || 'all').toLowerCase();
  const where = { cleared_at: null };

  if (userId && !Number.isNaN(userId)) {
    where.user_id = userId;
  }

  if (tab === 'unread') {
    where.read_at = null;
  }

  if (tab === 'read') {
    where.read_at = { [Op.ne]: null };
  }

  if (req.query.type) {
    where.type = String(req.query.type).toLowerCase();
  }

  return { where, userId, tab };
};

const getNotificationCounts = async (userId) => {
  const baseWhere = {
    ...(userId ? { user_id: userId } : {}),
    cleared_at: null,
  };
  const [all, unread, read] = await Promise.all([
    Notification.count({ where: baseWhere }),
    Notification.count({ where: { ...baseWhere, read_at: null } }),
    Notification.count({ where: { ...baseWhere, read_at: { [Op.ne]: null } } }),
  ]);

  return { all, unread, read };
};

const getNotifications = async (req, res) => {
  try {
    const { where, userId, tab } = buildWhere(req);
    const limit = Number(req.query.limit) || 30;
    const notifications = await Notification.findAll({
      where,
      order: [['createdAt', 'DESC']],
      limit,
    });

    return res.status(200).json({
      tab,
      counts: await getNotificationCounts(userId),
      notifications: notifications.map(notificationResponse),
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Notifications fetch failed',
      error: error.message,
    });
  }
};

const createNotification = async (req, res) => {
  try {
    const payload = buildNotificationPayload(req.body);
    const validationError = validateNotificationPayload(payload);

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const user = await User.findByPk(payload.user_id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const notification = await Notification.create(payload);
    const push = await sendNotificationPush(notification);

    return res.status(201).json({
      message: 'Notification created successfully',
      notification: notificationResponse(notification),
      push,
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Notification creation failed',
      error: error.message,
    });
  }
};

const markNotificationRead = async (req, res) => {
  try {
    const notification = await Notification.findByPk(req.params.id);

    if (!notification || notification.cleared_at) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    await notification.update({ read_at: notification.read_at || new Date() });

    return res.status(200).json({
      message: 'Notification marked as read',
      notification: notificationResponse(notification),
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Notification read update failed',
      error: error.message,
    });
  }
};

const markAllRead = async (req, res) => {
  try {
    const userId = parseId(req.params.userId || req.body.user_id || req.body.userId);

    if (!userId || Number.isNaN(userId)) {
      return res.status(400).json({ message: 'user_id is required' });
    }

    const [updated_count] = await Notification.update(
      { read_at: new Date() },
      {
        where: {
          user_id: userId,
          read_at: null,
          cleared_at: null,
        },
      }
    );

    return res.status(200).json({
      message: 'All notifications marked as read',
      updated_count,
      counts: await getNotificationCounts(userId),
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Mark all read failed',
      error: error.message,
    });
  }
};

const clearNotification = async (req, res) => {
  try {
    const notification = await Notification.findByPk(req.params.id);

    if (!notification || notification.cleared_at) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    await notification.update({ cleared_at: new Date() });

    return res.status(200).json({ message: 'Notification cleared successfully' });
  } catch (error) {
    return res.status(500).json({
      message: 'Notification clear failed',
      error: error.message,
    });
  }
};

const clearAllNotifications = async (req, res) => {
  try {
    const userId = parseId(req.params.userId || req.body.user_id || req.body.userId);

    if (!userId || Number.isNaN(userId)) {
      return res.status(400).json({ message: 'user_id is required' });
    }

    const [updated_count] = await Notification.update(
      { cleared_at: new Date() },
      {
        where: {
          user_id: userId,
          cleared_at: null,
        },
      }
    );

    return res.status(200).json({
      message: 'All notifications cleared successfully',
      updated_count,
      counts: await getNotificationCounts(userId),
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Clear all notifications failed',
      error: error.message,
    });
  }
};

module.exports = {
  clearAllNotifications,
  clearNotification,
  createNotification,
  getNotifications,
  markAllRead,
  markNotificationRead,
};
