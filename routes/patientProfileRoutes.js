const express = require('express');
const {
  changePassword,
  deleteAccount,
  getAppSettings,
  getEditProfile,
  getNotificationPreferences,
  getProfile,
  getSecuritySettings,
  signOut,
  signOutAllDevices,
  updateAppSettings,
  updateNotificationPreferences,
  updateProfile,
} = require('../controllers/patientProfileController');
const { authenticateToken, requireRoles } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(authenticateToken, requireRoles('patient'));

router.get('/', getProfile);
router.get('/edit-profile', getEditProfile);
router.patch('/edit-profile', updateProfile);
router.get('/security-settings', getSecuritySettings);
router.patch('/change-password', changePassword);
router.patch('/sign-out-all-devices', signOutAllDevices);
router.get('/notifications', getNotificationPreferences);
router.patch('/notifications', updateNotificationPreferences);
router.get('/app-settings', getAppSettings);
router.patch('/app-settings', updateAppSettings);
router.post('/sign-out', signOut);
router.delete('/delete-account', deleteAccount);

module.exports = router;
