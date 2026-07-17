const express = require('express');
const {
  adminLogin,
  getOrganizations,
  getOrganizationClinicalUsers,
} = require('../controllers/adminController');
const { adminAuthMiddleware } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/login', adminLogin);
router.get('/organizations', getOrganizations);
router.get('/organizations/:organizationCode/users', getOrganizationClinicalUsers);

module.exports = router;
