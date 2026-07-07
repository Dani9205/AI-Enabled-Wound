const User = require('../models/userModel');
const { sendEmailCode } = require('../utils/mailer');
const {
  generateSixDigitCode,
  hashPassword,
  signToken,
  verifyPassword,
} = require('../utils/security');

const PATIENT_ROLE = 'patient';
const CODE_EXPIRY_MINUTES = 10;

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();
const normalizeText = (value) => String(value || '').trim();
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const isTruthy = (value) =>
  value === true ||
  value === 1 ||
  ['true', '1'].includes(String(value).trim().toLowerCase());

const publicPatient = (user) => ({
  id: user.id,
  name: user.name,
  first_name: user.first_name,
  last_name: user.last_name,
  email: user.email,
  phone_number: user.phone_number,
  role: user.role,
  is_email_verified: user.is_email_verified,
  account_status: user.account_status,
  profile_photo_url: user.profile_photo_url,
  organization_hospital: user.organization_hospital,
  request_accepted: user.request_accepted,
  request_status: user.request_status,
  patient_profile: user.app_settings?.patient_profile || null,
});

const findPatientByEmail = (email) =>
  User.findOne({
    where: {
      email,
      role: PATIENT_ROLE,
    },
  });

const setResetCode = async (user) => {
  const code = generateSixDigitCode();

  user.verification_code = code;
  user.verification_code_expires_at = new Date(
    Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000
  );
  user.verification_purpose = 'reset_password';

  await user.save();
  await sendEmailCode({ to: user.email, code, purpose: 'reset_password' });
};

const clearVerificationCode = (user) => {
  user.verification_code = null;
  user.verification_code_expires_at = null;
  user.verification_purpose = null;
};

const getResetCodeError = (user, code) => {
  if (
    !user.verification_code ||
    !user.verification_code_expires_at ||
    user.verification_purpose !== 'reset_password'
  ) {
    return 'Verification code not requested';
  }

  if (new Date(user.verification_code_expires_at).getTime() < Date.now()) {
    return 'Verification code expired';
  }

  if (String(code || '') !== String(user.verification_code)) {
    return 'Invalid verification code';
  }

  return null;
};

const getPersonalInfo = (body) => ({
  firstName: normalizeText(body.first_name || body.firstName),
  lastName: normalizeText(body.last_name || body.lastName),
  email: normalizeEmail(body.email),
  phoneNumber: normalizeText(body.phone_number || body.phoneNumber),
  gender: normalizeText(body.gender).toLowerCase(),
  dateOfBirth: normalizeText(body.date_of_birth || body.dateOfBirth),
  profilePhotoUrl: normalizeText(
    body.profile_photo_url || body.profilePhotoUrl
  ),
});

const getProfessionalInfo = (body) => ({
  hospitalInstitution: normalizeText(
    body.hospital_institution ||
      body.hospitalInstitution ||
      body.hospital ||
      body.organization_hospital ||
      body.organizationHospital
  ),
  patientIdMrn: normalizeText(
    body.patient_id_mrn ||
      body.patientIdMrn ||
      body.patient_id ||
      body.patientId ||
      body.mrn
  ),
});

const getSignupBody = (req) => ({
  ...req.body,
  ...(req.body.personal_information || req.body.personalInformation || {}),
  ...(req.body.professional_details || req.body.professionalDetails || {}),
  ...(req.body.professional_information || req.body.professionalInformation || {}),
});

const validatePersonalInfo = ({ firstName, lastName, email, phoneNumber, gender }) => {
  if (!firstName || !lastName || !email || !phoneNumber || !gender) {
    return 'First name, last name, email, gender and phone number are required';
  }

  if (!isValidEmail(email)) {
    return 'Valid email is required';
  }

  if (!['male', 'female', 'other'].includes(gender)) {
    return 'Gender must be male, female or other';
  }

  return null;
};

const validateProfessionalInfo = ({ hospitalInstitution, patientIdMrn }) => {
  if (!hospitalInstitution || !patientIdMrn) {
    return 'Hospital/institution and patient ID/MRN are required';
  }

  return null;
};

const submitPersonalInformation = async (req, res) => {
  try {
    const personalInfo = getPersonalInfo(req.body);
    const validationError = validatePersonalInfo(personalInfo);

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const existingUser = await User.findOne({
      where: { email: personalInfo.email },
    });

    if (existingUser) {
      return res.status(409).json({ message: 'Email already exists' });
    }

    return res.status(200).json({
      message: 'Patient personal information accepted',
      next_step: 'professional-credentials',
      personal_information: {
        first_name: personalInfo.firstName,
        last_name: personalInfo.lastName,
        email: personalInfo.email,
        gender: personalInfo.gender,
        phone_number: personalInfo.phoneNumber,
        date_of_birth: personalInfo.dateOfBirth || null,
        profile_photo_url: personalInfo.profilePhotoUrl || null,
      },
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Patient personal information failed',
      error: error.message,
    });
  }
};

const submitProfessionalCredentials = async (req, res) => {
  try {
    const professionalInfo = getProfessionalInfo(req.body);
    const validationError = validateProfessionalInfo(professionalInfo);

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    return res.status(200).json({
      message: 'Patient professional credentials accepted',
      next_step: 'set-password',
      professional_details: {
        hospital_institution: professionalInfo.hospitalInstitution,
        patient_id_mrn: professionalInfo.patientIdMrn,
      },
      note:
        'Credentials will be verified by admin before account activation',
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Patient professional credentials failed',
      error: error.message,
    });
  }
};

const setAccountPassword = async (req, res) => {
  try {
    const body = getSignupBody(req);
    const personalInfo = getPersonalInfo(body);
    const professionalInfo = getProfessionalInfo(body);
    const password = req.body.password;
    const confirmPassword = req.body.confirm_password || req.body.confirmPassword;
    const termsAccepted = req.body.terms_accepted || req.body.termsAccepted;
    const personalValidationError = validatePersonalInfo(personalInfo);
    const professionalValidationError = validateProfessionalInfo(professionalInfo);

    if (personalValidationError) {
      return res.status(400).json({ message: personalValidationError });
    }

    if (professionalValidationError) {
      return res.status(400).json({ message: professionalValidationError });
    }

    if (!password || !confirmPassword) {
      return res.status(400).json({
        message: 'Password and confirm password are required',
      });
    }

    if (String(password).length < 8) {
      return res.status(400).json({
        message: 'Password must be at least 8 characters',
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        message: 'Password and confirm password do not match',
      });
    }

    if (!isTruthy(termsAccepted)) {
      return res.status(400).json({
        message: 'Terms of Service and Privacy Policy must be accepted',
      });
    }

    const existingUser = await User.findOne({
      where: { email: personalInfo.email },
    });

    if (existingUser) {
      return res.status(409).json({ message: 'Email already exists' });
    }

    const patientProfile = {
      gender: personalInfo.gender,
      date_of_birth: personalInfo.dateOfBirth || null,
      patient_id_mrn: professionalInfo.patientIdMrn,
      request_submitted_at: new Date().toISOString(),
      request_timeline: [
        {
          label: 'Request Submitted',
          status: 'completed',
        },
        {
          label: 'Admin Review',
          status: 'pending',
        },
        {
          label: 'Email Notification',
          status: 'pending',
        },
      ],
    };

    const user = await User.create({
      name: `${personalInfo.firstName} ${personalInfo.lastName}`.trim(),
      first_name: personalInfo.firstName,
      last_name: personalInfo.lastName,
      email: personalInfo.email,
      phone_number: personalInfo.phoneNumber,
      profile_photo_url: personalInfo.profilePhotoUrl || null,
      organization_hospital: professionalInfo.hospitalInstitution,
      role: PATIENT_ROLE,
      password_hash: hashPassword(password),
      request_accepted: false,
      request_status: 'pending',
      terms_accepted: true,
      terms_accepted_at: new Date(),
      app_settings: {
        patient_profile: patientProfile,
      },
    });

    return res.status(201).json({
      message: 'Patient account request submitted successfully',
      next_step: 'pending-approval',
      patient: publicPatient(user),
      request_summary: {
        name: user.name,
        email: user.email,
        role_requested: user.role,
        hospital_institution: user.organization_hospital,
        patient_id_mrn: patientProfile.patient_id_mrn,
        status: user.request_status,
      },
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Patient account password setup failed',
      error: error.message,
    });
  }
};

const signin = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const { password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: 'Email and password are required',
      });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({
        message: 'Valid email is required',
      });
    }

    const user = await findPatientByEmail(email);

    if (!user || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({
        message: 'Invalid patient email or password',
      });
    }

    if (['deactivated', 'deleted'].includes(user.account_status)) {
      return res.status(403).json({
        message: 'Patient account is not active',
      });
    }

    if (user.request_status === 'pending') {
      return res.status(403).json({
        message: 'Patient account request is pending approval',
      });
    }

    if (user.request_status === 'rejected') {
      return res.status(403).json({
        message: 'Patient account request was rejected',
        rejection_reason: user.rejection_reason,
      });
    }

    const token = signToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    await user.update({
      auth_token: token,
      last_login_at: new Date(),
      account_status: 'active',
    });

    return res.status(200).json({
      message: 'Patient login successful',
      token,
      patient: publicPatient(user),
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Patient signin failed',
      error: error.message,
    });
  }
};

const forgotPassword = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({
        message: 'Valid email is required',
      });
    }

    const user = await findPatientByEmail(email);

    if (!user) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    await setResetCode(user);

    return res.status(200).json({
      message: 'Password reset OTP sent to email',
      email: user.email,
      next_step: 'reset-password',
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Patient forgot password failed',
      error: error.message,
    });
  }
};

const resetPassword = async (req, res) => {
  try {
    const code = req.body.otp || req.body.code;
    const newPassword = req.body.new_password || req.body.newPassword;
    const confirmNewPassword =
      req.body.confirm_new_password || req.body.confirmNewPassword;

    if (!code || !newPassword) {
      return res.status(400).json({
        message: 'OTP and new_password are required',
      });
    }

    if (!/^\d{6}$/.test(String(code))) {
      return res.status(400).json({
        message: 'OTP must be 6 digits',
      });
    }

    if (String(newPassword).length < 8) {
      return res.status(400).json({
        message: 'New password must be at least 8 characters',
      });
    }

    if (confirmNewPassword && newPassword !== confirmNewPassword) {
      return res.status(400).json({
        message: 'New password and confirm password do not match',
      });
    }

    const user = await User.findOne({
      where: {
        verification_code: String(code),
        verification_purpose: 'reset_password',
        role: PATIENT_ROLE,
      },
    });

    if (!user) {
      return res.status(400).json({
        message: 'Invalid OTP',
      });
    }

    const codeError = getResetCodeError(user, code);

    if (codeError) {
      return res.status(400).json({ message: codeError });
    }

    clearVerificationCode(user);
    user.password_hash = hashPassword(newPassword);
    await user.save();

    return res.status(200).json({
      message: 'Patient password updated successfully',
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Patient password reset failed',
      error: error.message,
    });
  }
};

module.exports = {
  forgotPassword,
  resetPassword,
  signin,
  setAccountPassword,
  submitPersonalInformation,
  submitProfessionalCredentials,
};
