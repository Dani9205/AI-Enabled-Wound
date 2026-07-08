const express = require('express');
const {
  createPatient,
  deletePatient,
  getPatients,
  updatePatient,
} = require('../controllers/patientController');
const { authenticateToken, requireRoles } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(authenticateToken, requireRoles('nurse'));

router.post('/create-patient', createPatient);
router.get('/get-patient', getPatients);
router.get('/get-patient/:id', getPatients);
router.put('/update-patient/:id', updatePatient);
router.delete('/delete-patient/:id', deletePatient);

module.exports = router;
