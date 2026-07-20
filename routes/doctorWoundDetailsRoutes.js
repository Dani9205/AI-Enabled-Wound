const express = require('express');
const {
  generateReport,
  getHealingProgress,
  getImages,
  getMeasurements,
  getNotes,
  getReportDetails,
  getReports,
  shareReport,
} = require('../controllers/doctorWoundDetailsController');

const router = express.Router();

router.get('/:woundCaseId/images', getImages);
router.get('/:woundCaseId/measurements', getMeasurements);
router.post('/:woundCaseId/healing-progress', getHealingProgress);
router.get('/:woundCaseId/notes', getNotes);
router.get('/:woundCaseId/reports', getReports);
router.post('/:woundCaseId/reports/generate', generateReport);
router.get('/:woundCaseId/reports/:reportId', getReportDetails);
router.post('/:woundCaseId/reports/:reportId/share', shareReport);

module.exports = router;
