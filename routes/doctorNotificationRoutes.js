const express = require('express');
const {
  clearAllNotifications,
  clearNotification,
  createNotification,
  getNotifications,
  markAllRead,
  markNotificationRead,
} = require('../controllers/doctorNotificationController');

const router = express.Router();

router.get('/:doctorId', getNotifications);
router.post('/:doctorId', createNotification);
router.patch('/:doctorId/mark-all-read', markAllRead);
router.delete('/:doctorId/clear-all', clearAllNotifications);
router.patch('/:doctorId/:notificationId/read', markNotificationRead);
router.delete('/:doctorId/:notificationId', clearNotification);

module.exports = router;
