const express = require('express');
const {
  addHandoffNotes,
  confirmHandoff,
  createHandoffDraft,
  getAvailableStaff,
  getHandoffDetails,
  getHandoffSuccess,
  getSelectablePatients,
  selectReceivingStaff,
} = require('../controllers/doctorPatientHandoffController');

const router = express.Router();

router.get('/:doctorId/patients', getSelectablePatients);
router.get('/:doctorId/available-staff', getAvailableStaff);
router.post('/draft', createHandoffDraft);
router.get('/:handoffId', getHandoffDetails);
router.patch('/:handoffId/select-staff', selectReceivingStaff);
router.patch('/:handoffId/notes', addHandoffNotes);
router.patch('/:handoffId/confirm', confirmHandoff);
router.get('/:handoffId/success', getHandoffSuccess);

module.exports = router;
