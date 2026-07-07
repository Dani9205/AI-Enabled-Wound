const express = require('express');
const {
  downloadReport,
  downloadWoundReport,
  getDashboard,
  getHealingProgress,
  getReportDetails,
  getReports,
  getWoundImages,
  getWoundMeasurements,
  getWoundNotes,
  getWoundProfile,
  getWoundReportDetails,
  getWoundReports,
  getWoundTimeline,
  previewWoundReport,
  shareWoundReport,
} = require('../controllers/patientAppController');
const { authenticateToken, requireRoles } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(authenticateToken, requireRoles('patient'));

router.get('/dashboard', getDashboard);
router.get('/healing-progress', getHealingProgress);
router.get('/healing-progress/:woundCaseId', getHealingProgress);
router.get('/reports', getReports);
router.get('/reports/:reportId/download', downloadReport);
router.get('/reports/:reportId', getReportDetails);

router.get('/wound-profile/:woundCaseId', getWoundProfile);
router.get('/wound-profile/:woundCaseId/timeline', getWoundTimeline);
router.get('/wound-profile/:woundCaseId/images', getWoundImages);
router.get('/wound-profile/:woundCaseId/measurements', getWoundMeasurements);
router.get('/wound-profile/:woundCaseId/measures', getWoundMeasurements);
router.get('/wound-profile/:woundCaseId/notes', getWoundNotes);
router.get('/wound-profile/:woundCaseId/reports', getWoundReports);
router.get(
  '/wound-profile/:woundCaseId/reports/:reportId/preview',
  previewWoundReport
);
router.get(
  '/wound-profile/:woundCaseId/reports/:reportId/download',
  downloadWoundReport
);
router.post(
  '/wound-profile/:woundCaseId/reports/:reportId/share',
  shareWoundReport
);
router.get('/wound-profile/:woundCaseId/reports/:reportId', getWoundReportDetails);

module.exports = router;
