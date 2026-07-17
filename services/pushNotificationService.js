const User = require('../models/userModel');
const { getFirebaseMessaging } = require('../config/firebase');

const INVALID_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
]);

const stringifyData = (data = {}) =>
  Object.fromEntries(
    Object.entries(data)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) => [
        key,
        typeof value === 'string' ? value : JSON.stringify(value),
      ])
  );

const clearInvalidToken = async (user, error) => {
  if (!INVALID_TOKEN_CODES.has(error?.code)) return;

  await user.update({
    fcm_token: null,
    fcm_platform: null,
    fcm_token_updated_at: null,
  });
};

const sendPushToUser = async ({ userId, title, body, data = {} }) => {
  const user = await User.findByPk(userId);

  if (!user?.fcm_token) {
    return { status: 'skipped', reason: 'fcm_token_not_registered' };
  }

  const messaging = getFirebaseMessaging();
  if (!messaging) {
    return { status: 'skipped', reason: 'firebase_not_configured' };
  }

  try {
    const messageId = await messaging.send({
      token: user.fcm_token,
      notification: { title, body: body || '' },
      data: stringifyData(data),
      android: {
        priority: 'high',
        notification: { channelId: 'wound_updates', sound: 'default' },
      },
      apns: {
        payload: { aps: { sound: 'default', badge: 1 } },
      },
    });

    return { status: 'sent', message_id: messageId };
  } catch (error) {
    await clearInvalidToken(user, error);
    return { status: 'failed', code: error.code, error: error.message };
  }
};

const sendNotificationPush = async (notification) =>
  sendPushToUser({
    userId: notification.user_id,
    title: notification.title,
    body: notification.message,
    data: {
      notification_id: String(notification.id),
      type: notification.type,
      action_url: notification.action_url || '',
      ...(notification.metadata || {}),
    },
  });

module.exports = { sendNotificationPush, sendPushToUser };
