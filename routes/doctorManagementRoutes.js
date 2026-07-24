const express = require('express');
const {
  addInstructions,
  deleteInstructions,
  getHome,
  getPatientDetails,
  getPatients,
  getWoundCaseDetails,
  markTaskComplete,
  updateInstructions,
} = require('../controllers/doctorManagementController');
const { authenticateToken, requireRoles } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/home', getHome);
router.get('/patients', authenticateToken, requireRoles('doctor'), getPatients);
router.get('/patients/:patientId', getPatientDetails);
router.get('/wound-cases/:woundCaseId', getWoundCaseDetails);
router.post('/wound-cases/:woundCaseId/instructions', addInstructions);
router.put(
  '/wound-cases/:woundCaseId/instructions/:instructionId',
  updateInstructions
);
router.delete(
  '/wound-cases/:woundCaseId/instructions/:instructionId',
  deleteInstructions
);
router.patch('/tasks/:taskId/complete', markTaskComplete);

module.exports = router;
