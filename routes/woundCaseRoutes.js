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
  transcribeVoiceDictation,
  updateWoundCase,
} = require('../controllers/woundCaseController');
const { authenticateToken, requireRoles } = require('../middleware/authMiddleware');
const uploadVoiceDictation = require('../middleware/voiceDictationUpload');
const uploadWoundImages = require('../middleware/woundImageUpload');

const router = express.Router();

router.use(authenticateToken);

router.post('/create-wound-case', requireRoles('nurse'), createWoundCase);
router.get('/get-wound-case', requireRoles('nurse'), getWoundCases);
router.get('/get-wound-case/:id', requireRoles('nurse'), getWoundCases);
router.get('/get-timeline/:id', requireRoles('nurse'), getTimeline);
router.get('/get-images/:id', requireRoles('nurse'), getImages);
router.get('/get-measurements/:id', requireRoles('nurse'), getMeasurements);
router.get('/get-notes/:id', requireRoles('nurse'), getClinicalNotes);
router.get('/get-reports/:id', requireRoles('nurse'), getReports);
router.get('/preview-report/:id/:reportId', requireRoles('nurse'), getReportPreview);
router.get('/download-report/:id/:reportId', requireRoles('nurse'), downloadReport);
router.put('/update-wound-case/:id', requireRoles('nurse'), updateWoundCase);
router.patch('/add-wound-update/:id', requireRoles('nurse'), addWoundUpdate);
router.patch('/add-wound-image/:id', requireRoles('nurse', 'doctor'), uploadWoundImages, addWoundImage);
router.delete('/delete-wound-image/:id/:imageId', requireRoles('nurse'), deleteWoundImage);
router.patch('/add-measurement/:id', requireRoles('nurse'), addMeasurement);
router.patch('/add-note/:id', requireRoles('nurse'), addClinicalNote);
router.post('/save-voice-dictation/:id', requireRoles('nurse', 'doctor'), uploadVoiceDictation, saveVoiceDictation);
router.post('/transcribe-voice-dictation/:id/:noteId?', requireRoles('nurse'), uploadVoiceDictation, transcribeVoiceDictation);
router.post('/generate-soap-note/:id', requireRoles('nurse', 'doctor'), generateSoapNote);
router.post('/generate-report/:id', requireRoles('nurse'), generateReport);
router.post('/generate-ai-report/:id', requireRoles('nurse'), generateReport);
router.patch('/add-report/:id', requireRoles('nurse'), addReport);
router.patch('/share-report/:id/:reportId', requireRoles('nurse'), shareReport);
router.delete('/delete-wound-case/:id', requireRoles('nurse'), deleteWoundCase);

module.exports = router;
