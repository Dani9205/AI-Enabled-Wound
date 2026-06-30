const express = require('express');
const {
  createPatient,
  deletePatient,
  getPatients,
  updatePatient,
} = require('../controllers/patientController');

const router = express.Router();

router.post('/create-patient', createPatient);
router.get('/get-patient', getPatients);
router.get('/get-patient/:id', getPatients);
router.put('/update-patient/:id', updatePatient);
router.delete('/delete-patient/:id', deletePatient);

module.exports = router;
