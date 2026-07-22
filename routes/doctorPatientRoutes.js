const express = require('express');
const {
  createPatient,
  getPatients,
  getPatient,
  updatePatient,
  deletePatient,
} = require('../controllers/doctorPatientController');
const { authenticateToken, requireRoles } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(authenticateToken, requireRoles('doctor'));
router.post('/', createPatient);
router.get('/', getPatients);
router.get('/:patientId', getPatient);
router.put('/:patientId', updatePatient);
router.patch('/:patientId', updatePatient);
router.delete('/:patientId', deletePatient);

module.exports = router;
