const express = require('express');
const {
  clearAllNotifications,
  clearNotification,
  createNotification,
  getNotifications,
  markAllRead,
  markNotificationRead,
} = require('../controllers/patientNotificationController');
const { authenticateToken, requireRoles } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(authenticateToken, requireRoles('patient'));

router.get('/', getNotifications);
router.post('/', createNotification);
router.patch('/mark-all-read', markAllRead);
router.delete('/clear-all', clearAllNotifications);
router.patch('/:notificationId/read', markNotificationRead);
router.delete('/:notificationId', clearNotification);

module.exports = router;
