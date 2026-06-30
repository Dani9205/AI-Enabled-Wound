const express = require('express');
const {
  changePassword,
  deleteAccount,
  getAppSettings,
  getNotificationPreferences,
  getProfile,
  getSecuritySettings,
  initiatePatientHandoff,
  signOut,
  signOutAllDevices,
  updateAppSettings,
  updateNotificationPreferences,
  updateProfile,
} = require('../controllers/profileController');

const router = express.Router();

router.get('/get-profile/:id', getProfile);
router.put('/update-profile/:id', updateProfile);
router.get('/security-settings/:id', getSecuritySettings);
router.patch('/change-password/:id', changePassword);
router.patch('/sign-out-all-devices/:id', signOutAllDevices);
router.get('/notification-preferences/:id', getNotificationPreferences);
router.patch('/notification-preferences/:id', updateNotificationPreferences);
router.get('/app-settings/:id', getAppSettings);
router.patch('/app-settings/:id', updateAppSettings);
router.post('/patient-handoff/:id', initiatePatientHandoff);
router.post('/sign-out/:id', signOut);
router.delete('/delete-account/:id', deleteAccount);

module.exports = router;
