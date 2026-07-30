const express = require('express');
const {
  createPatient,
  getPatients,
  getPatient,
  reassignPatient,
  updatePatient,
  deletePatient,
} = require('../controllers/doctorPatientController');
const { authenticateToken, requireRoles } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(authenticateToken, requireRoles('doctor'));
router.post('/', createPatient);
router.get('/ss', getPatients);
router.get('/:patientId', getPatient);
router.put('/:patientId', updatePatient);
router.patch('/:patientId', updatePatient);
router.patch('/:patientId/reassign', reassignPatient);
router.delete('/:patientId', deletePatient);

module.exports = router;
