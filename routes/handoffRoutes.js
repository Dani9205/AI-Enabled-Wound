const express = require('express');
const {
  addHandoffNotes,
  confirmHandoff,
  createHandoff,
  getAvailableNurses,
  getHandoff,
  getHandoffPatients,
  getHandoffSuccess,
  selectHandoffNurse,
} = require('../controllers/handoffController');

const router = express.Router();

router.get('/patients/:nurseId', getHandoffPatients);
router.get('/available-nurses/:nurseId', getAvailableNurses);
router.post('/create', createHandoff);
router.get('/get/:id', getHandoff);
router.patch('/select-nurse/:id', selectHandoffNurse);
router.patch('/notes/:id', addHandoffNotes);
router.patch('/confirm/:id', confirmHandoff);
router.get('/success/:id', getHandoffSuccess);

module.exports = router;
