const express = require('express');
const {
  forgotPassword,
  resetPassword,
  setAccountPassword,
  signin,
  submitPersonalInformation,
  submitProfessionalCredentials,
} = require('../controllers/patientAuthController');

const router = express.Router();

router.post('/signup/personal-information', submitPersonalInformation);
router.post('/signup/professional-credentials', submitProfessionalCredentials);
router.post('/signup/professional-information', submitProfessionalCredentials);
router.post('/signup/set-password', setAccountPassword);
router.post('/signin', signin);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

module.exports = router;
