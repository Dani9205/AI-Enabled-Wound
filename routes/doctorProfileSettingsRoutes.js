const express = require('express');
const {
  changePassword,
  deleteAccount,
  getAppSettings,
  getHandoffSummary,
  getNotificationPreferences,
  getProfile,
  getSecuritySettings,
  initiateHandoff,
  signOut,
  signOutAllDevices,
  updateAppSettings,
  updateNotificationPreferences,
  updateProfile,
} = require('../controllers/doctorProfileSettingsController');

const router = express.Router();

router.get('/:doctorId/profile', getProfile);
router.put('/:doctorId/profile', updateProfile);
router.get('/:doctorId/security', getSecuritySettings);
router.patch('/:doctorId/security/change-password', changePassword);
router.patch('/:doctorId/security/sign-out-all-devices', signOutAllDevices);
router.get('/:doctorId/notifications', getNotificationPreferences);
router.patch('/:doctorId/notifications', updateNotificationPreferences);
router.get('/:doctorId/app-settings', getAppSettings);
router.patch('/:doctorId/app-settings', updateAppSettings);
router.get('/:doctorId/handoff', getHandoffSummary);
router.post('/:doctorId/handoff', initiateHandoff);
router.post('/:doctorId/sign-out', signOut);
router.delete('/:doctorId/delete-account', deleteAccount);

module.exports = router;
