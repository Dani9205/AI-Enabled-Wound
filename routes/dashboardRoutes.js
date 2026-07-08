const express = require('express');
const {
  getAssignedPatients,
  getDashboardStats,
  getHomeDashboard,
  getRecentUpdates,
  getTodayTasks,
} = require('../controllers/dashboardController');
const { authenticateToken, requireRoles } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(authenticateToken, requireRoles('nurse'));

router.get('/home', getHomeDashboard);
router.get('/stats', getDashboardStats);
router.get('/today-tasks', getTodayTasks);
router.get('/assigned-patients', getAssignedPatients);
router.get('/recent-updates', getRecentUpdates);

module.exports = router;
