const express = require('express');
const {
  createWoundCase,
  getWoundCases,
  getWoundCase,
  updateWoundCase,
  deleteWoundCase,
} = require('../controllers/doctorWoundCaseController');
const { authenticateToken, requireRoles } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(authenticateToken, requireRoles('doctor'));
router.post('/', createWoundCase);
router.get('/', getWoundCases);
router.get('/:woundCaseId', getWoundCase);
router.put('/:woundCaseId', updateWoundCase);
router.patch('/:woundCaseId', updateWoundCase);
router.delete('/:woundCaseId', deleteWoundCase);

module.exports = router;
