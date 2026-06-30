const express = require('express');
const {
  acceptOrganizationRequest,
  createAccount,
  createOrganizationAccount,
  forgotPassword,
  resetPassword,
  signin,
  verifySigninCode,
  changeRole,
} = require('../controllers/authController');

const router = express.Router();

router.post('/create-account', createAccount);
router.post('/create-organization-account', createOrganizationAccount);
router.put('/accept-organization-request', acceptOrganizationRequest);
router.post('/signin', signin);
router.post('/verify-code', verifySigninCode);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.put('/change-role', changeRole);

module.exports = router;
