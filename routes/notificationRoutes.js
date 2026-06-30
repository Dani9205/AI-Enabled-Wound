const express = require('express');
const {
  clearAllNotifications,
  clearNotification,
  createNotification,
  getNotifications,
  markAllRead,
  markNotificationRead,
} = require('../controllers/notificationController');

const router = express.Router();

router.get('/get-notifications/:userId', getNotifications);
router.get('/get-notifications', getNotifications);
router.post('/create-notification', createNotification);
router.patch('/mark-read/:id', markNotificationRead);
router.patch('/mark-all-read/:userId', markAllRead);
router.delete('/clear/:id', clearNotification);
router.delete('/clear-all/:userId', clearAllNotifications);

module.exports = router;
