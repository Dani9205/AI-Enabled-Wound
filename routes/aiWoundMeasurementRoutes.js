const express = require('express');
const {
  aiDetectWoundMeasurement,
  saveAiWoundMeasurement,
} = require('../controllers/aiWoundMeasurementController');
const { authenticateToken, requireRoles } = require('../middleware/authMiddleware');
const uploadWoundImages = require('../middleware/woundImageUpload');

const router = express.Router();

router.use(authenticateToken, requireRoles('nurse', 'doctor'));

router.post('/:woundCaseId/detect', uploadWoundImages, aiDetectWoundMeasurement);
router.patch('/:woundCaseId/save', saveAiWoundMeasurement);

module.exports = router;
