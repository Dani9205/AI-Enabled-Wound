const express = require('express');
const {
  adminLogin,
  getOrganizations,
  getOrganizationClinicalUsers,
} = require('../controllers/adminController');
const { adminAuthMiddleware } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/login', adminLogin);
router.get('/organizations', adminAuthMiddleware, getOrganizations);
router.get(
  '/organizations/:organizationCode/users',
  adminAuthMiddleware,
  getOrganizationClinicalUsers
);

module.exports = router;
