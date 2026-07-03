const express = require('express');
const {
  forgotPassword,
  resetPassword,
  setAccountPassword,
  signin,
  submitPersonalInformation,
  submitProfessionalCredentials,
  verifyOtp,
} = require('../controllers/doctorAuthController');

const router = express.Router();

router.post('/signup/personal-information', submitPersonalInformation);
router.post('/signup/professional-credentials', submitProfessionalCredentials);
router.post('/signup/set-password', setAccountPassword);
router.post('/signin', signin);
router.post('/forgot-password', forgotPassword);
router.post('/verify-otp', verifyOtp);
router.post('/reset-password', resetPassword);

module.exports = router;
