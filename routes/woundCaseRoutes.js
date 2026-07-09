const express = require('express');
const {
  addClinicalNote,
  addMeasurement,
  addReport,
  addWoundUpdate,
  addWoundImage,
  createWoundCase,
  deleteWoundCase,
  deleteWoundImage,
  downloadReport,
  generateReport,
  generateSoapNote,
  getClinicalNotes,
  getImages,
  getMeasurements,
  getReportPreview,
  getReports,
  getWoundCases,
  getTimeline,
  saveVoiceDictation,
  shareReport,
  updateWoundCase,
} = require('../controllers/woundCaseController');
const { authenticateToken, requireRoles } = require('../middleware/authMiddleware');
const uploadWoundImages = require('../middleware/woundImageUpload');

const router = express.Router();

router.use(authenticateToken, requireRoles('nurse'));

router.post('/create-wound-case', createWoundCase);
router.get('/get-wound-case', getWoundCases);
router.get('/get-wound-case/:id', getWoundCases);
router.get('/get-timeline/:id', getTimeline);
router.get('/get-images/:id', getImages);
router.get('/get-measurements/:id', getMeasurements);
router.get('/get-notes/:id', getClinicalNotes);
router.get('/get-reports/:id', getReports);
router.get('/preview-report/:id/:reportId', getReportPreview);
router.get('/download-report/:id/:reportId', downloadReport);
router.put('/update-wound-case/:id', updateWoundCase);
router.patch('/add-wound-update/:id', addWoundUpdate);
router.patch('/add-wound-image/:id', uploadWoundImages, addWoundImage);
router.delete('/delete-wound-image/:id/:imageId', deleteWoundImage);
router.patch('/add-measurement/:id', addMeasurement);
router.patch('/add-note/:id', addClinicalNote);
router.post('/save-voice-dictation/:id', saveVoiceDictation);
router.post('/generate-soap-note/:id', generateSoapNote);
router.post('/generate-report/:id', generateReport);
router.patch('/add-report/:id', addReport);
router.patch('/share-report/:id/:reportId', shareReport);
router.delete('/delete-wound-case/:id', deleteWoundCase);

module.exports = router;
