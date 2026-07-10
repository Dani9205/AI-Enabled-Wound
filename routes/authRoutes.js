const express = require('express');
const {
  acceptOrganizationRequest,
  createAccount,
  createOrganizationAccount,
  forgotPassword,
  getAuthenticatedUser,
  resetPassword,
  signin,
  uploadAuthImage,
  verifySigninCode,
  changeRole,
} = require('../controllers/authController');
const { authenticateToken } = require('../middleware/authMiddleware');
const uploadProfilePhoto = require('../middleware/profilePhotoUpload');

const router = express.Router();

router.get('/me', authenticateToken, getAuthenticatedUser);
router.post('/create-account', uploadProfilePhoto, createAccount);
router.post('/create-organization-account', uploadProfilePhoto, createOrganizationAccount);
router.post('/upload-image', authenticateToken, uploadProfilePhoto, uploadAuthImage);
router.put('/accept-organization-request', acceptOrganizationRequest);
router.post('/signin', signin);
router.post('/verify-code', verifySigninCode);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.put('/change-role', changeRole);

module.exports = router;
