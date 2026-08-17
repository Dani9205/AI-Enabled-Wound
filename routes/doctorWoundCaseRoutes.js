const express = require('express');
const {
  createWoundCase,
  getWoundCases,
  getWoundCase,
  updateWoundCase,
  deleteWoundCase,
} = require('../controllers/doctorWoundCaseController');
const {
  generateSoapNote,
  saveVoiceDictation,
  transcribeVoiceDictation,
} = require('../controllers/woundCaseController');
const { authenticateToken, requireRoles } = require('../middleware/authMiddleware');
const uploadVoiceDictation = require('../middleware/voiceDictationUpload');

const router = express.Router();

const useWoundCaseIdParam = (handler) => (req, res, next) => {
  req.params.id = req.params.woundCaseId;
  return handler(req, res, next);
};

router.use(authenticateToken, requireRoles('doctor'));
router.post('/', createWoundCase);
router.get('/', getWoundCases);
router.post(
  '/:woundCaseId/save-voice-dictation',
  uploadVoiceDictation,
  useWoundCaseIdParam(saveVoiceDictation)
);
router.post(
  '/:woundCaseId/transcribe-voice-dictation/:noteId?',
  uploadVoiceDictation,
  useWoundCaseIdParam(transcribeVoiceDictation)
);
router.post(
  '/:woundCaseId/generate-soap-note',
  useWoundCaseIdParam(generateSoapNote)
);
router.get('/:woundCaseId', getWoundCase);
router.put('/:woundCaseId', updateWoundCase);
router.patch('/:woundCaseId', updateWoundCase);
router.delete('/:woundCaseId', deleteWoundCase);

module.exports = router;
