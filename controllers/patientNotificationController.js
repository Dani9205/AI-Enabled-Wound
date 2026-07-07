const { Op } = require('sequelize');
const Notification = require('../models/notificationModel');

const VALID_TABS = ['all', 'unread', 'read'];
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
  if (value === undefined || value === null) return undefined;

  const trimmed = String(value).trim();
  return trimmed || undefined;
};

const asObject = (value) => {
  if (!value) return {};

  if (typeof value === 'object' && !Array.isArray(value)) return value;

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

const timeAgo = (dateValue) => {
  if (!dateValue) return null;

  const diff = Date.now() - new Date(dateValue).getTime();
  if (Number.isNaN(diff) || diff < 0) return null;

  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';

  return `${days}d ago`;
};

const sectionLabel = (dateValue) => {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return 'Earlier';

  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const dateStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((todayStart - dateStart) / 86400000);

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';

  return date.toISOString().slice(0, 10);
};

const actionForType = (notification) => {
  const metadata = asObject(notification.metadata);

  if (notification.action_label || notification.action_url) {
    return {
      label: notification.action_label,
      url: notification.action_url,
    };
  }

  if (notification.type === 'wound_update') {
    return {
      label: 'View Update',
      url: metadata.wound_case_id
        ? `/patient/wound-profile/${metadata.wound_case_id}/timeline`
        : null,
    };
  }

  if (notification.type === 'doctor_instruction') {
    return {
      label: 'View Instructions',
      url: metadata.wound_case_id
        ? `/patient/wound-profile/${metadata.wound_case_id}/notes`
        : null,
    };
  }

  if (notification.type === 'new_task' || notification.type === 'task_reassigned') {
    return {
      label: 'View Task',
      url: metadata.task_id ? `/patient/tasks/${metadata.task_id}` : null,
    };
  }

  if (notification.type === 'report_generated') {
    return {
      label: 'View Report',
      url: metadata.report_id
        ? `/patient/reports/${metadata.report_id}`
        : metadata.wound_case_id
          ? `/patient/wound-profile/${metadata.wound_case_id}/reports`
          : null,
    };
  }

  return null;
};

const notificationResponse = (notification) => ({
  id: notification.id,
  user_id: notification.user_id,
  type: notification.type,
  title: notification.title,
  message: notification.message,
  metadata: asObject(notification.metadata),
  is_read: Boolean(notification.read_at),
  read_at: notification.read_at,
  cleared_at: notification.cleared_at,
  time_ago: timeAgo(notification.createdAt),
  section: sectionLabel(notification.createdAt),
  action: actionForType(notification),
  created_at: notification.createdAt,
  updated_at: notification.updatedAt,
});

const groupBySection = (notifications) => {
  const sections = [];
  const sectionMap = new Map();

  notifications.forEach((notification) => {
    const item = notificationResponse(notification);

    if (!sectionMap.has(item.section)) {
      const section = {
        title: item.section,
        notifications: [],
      };
      sectionMap.set(item.section, section);
      sections.push(section);
    }

    sectionMap.get(item.section).notifications.push(item);
  });

  return sections;
};

const getCounts = async (patientUserId) => {
  const baseWhere = {
    user_id: patientUserId,
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
    const patientUserId = req.user.id;
    const tab = cleanString(req.query.tab || 'all').toLowerCase();
    const limit = Number(req.query.limit) || 30;

    if (!VALID_TABS.includes(tab)) {
      return res.status(400).json({
        message: `tab must be one of: ${VALID_TABS.join(', ')}`,
      });
    }

    const where = {
      user_id: patientUserId,
      cleared_at: null,
    };

    if (tab === 'unread') {
      where.read_at = null;
    }

    if (tab === 'read') {
      where.read_at = { [Op.ne]: null };
    }

    if (req.query.type) {
      where.type = String(req.query.type).toLowerCase();
    }

    const notifications = await Notification.findAll({
      where,
      order: [['createdAt', 'DESC']],
      limit,
    });

    return res.status(200).json({
      message: 'Patient notifications fetched successfully',
      tab,
      tabs: VALID_TABS,
      counts: await getCounts(patientUserId),
      sections: groupBySection(notifications),
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Patient notifications fetch failed',
      error: error.message,
    });
  }
};

const markNotificationRead = async (req, res) => {
  try {
    const patientUserId = req.user.id;
    const notification = await Notification.findByPk(req.params.notificationId);

    if (
      !notification ||
      notification.cleared_at ||
      Number(notification.user_id) !== Number(patientUserId)
    ) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    await notification.update({
      read_at: notification.read_at || new Date(),
    });

    return res.status(200).json({
      message: 'Patient notification marked as read',
      notification: notificationResponse(notification),
      counts: await getCounts(patientUserId),
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Patient notification read update failed',
      error: error.message,
    });
  }
};

const markAllRead = async (req, res) => {
  try {
    const patientUserId = req.user.id;
    const [updatedCount] = await Notification.update(
      { read_at: new Date() },
      {
        where: {
          user_id: patientUserId,
          read_at: null,
          cleared_at: null,
        },
      }
    );

    return res.status(200).json({
      message: 'All patient notifications marked as read',
      updated_count: updatedCount,
      counts: await getCounts(patientUserId),
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Patient mark all notifications read failed',
      error: error.message,
    });
  }
};

const clearNotification = async (req, res) => {
  try {
    const patientUserId = req.user.id;
    const notification = await Notification.findByPk(req.params.notificationId);

    if (
      !notification ||
      notification.cleared_at ||
      Number(notification.user_id) !== Number(patientUserId)
    ) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    await notification.update({
      cleared_at: new Date(),
    });

    return res.status(200).json({
      message: 'Patient notification cleared successfully',
      counts: await getCounts(patientUserId),
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Patient notification clear failed',
      error: error.message,
    });
  }
};

const clearAllNotifications = async (req, res) => {
  try {
    const patientUserId = req.user.id;
    const [updatedCount] = await Notification.update(
      { cleared_at: new Date() },
      {
        where: {
          user_id: patientUserId,
          cleared_at: null,
        },
      }
    );

    return res.status(200).json({
      message: 'All patient notifications cleared successfully',
      updated_count: updatedCount,
      counts: await getCounts(patientUserId),
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Patient clear all notifications failed',
      error: error.message,
    });
  }
};

const createNotification = async (req, res) => {
  try {
    const patientUserId = req.user.id;
    const type = cleanString(req.body.type || 'system').toLowerCase();

    if (!VALID_TYPES.includes(type)) {
      return res.status(400).json({
        message: `type must be one of: ${VALID_TYPES.join(', ')}`,
      });
    }

    const title = cleanString(req.body.title);

    if (!title) {
      return res.status(400).json({ message: 'title is required' });
    }

    const notification = await Notification.create({
      user_id: patientUserId,
      type,
      title,
      message: cleanString(req.body.message) || null,
      action_label: cleanString(req.body.action_label || req.body.actionLabel) || null,
      action_url: cleanString(req.body.action_url || req.body.actionUrl) || null,
      metadata: asObject(req.body.metadata),
    });

    return res.status(201).json({
      message: 'Patient notification created successfully',
      notification: notificationResponse(notification),
      counts: await getCounts(patientUserId),
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Patient notification creation failed',
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
