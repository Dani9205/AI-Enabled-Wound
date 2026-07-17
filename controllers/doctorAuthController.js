const crypto = require('crypto');
const sequelize = require('../config/db');
const User = require('../models/userModel');
const { sendEmailCode } = require('../utils/mailer');
const { resolveOrganization } = require('../utils/organizationResolver');
const {
  generateSixDigitCode,
  hashPassword,
  signToken,
  verifyPassword,
} = require('../utils/security');

const DOCTOR_ROLE = 'doctor';
const CODE_EXPIRY_MINUTES = 10;
const RESET_SESSION_COOKIE = 'doctor_reset_session';
const resetSessions = new Map();

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();
const normalizeText = (value) => String(value || '').trim();
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const isTruthy = (value) =>
  value === true ||
  value === 1 ||
  ['true', '1'].includes(String(value).trim().toLowerCase());
const toArray = (value) => {
  if (Array.isArray(value)) {
    return value.map(normalizeText).filter(Boolean);
  }

  if (!value) return [];

  return String(value)
    .split(',')
    .map(normalizeText)
    .filter(Boolean);
};

const getCookie = (req, name) => {
  const cookies = String(req.headers.cookie || '').split(';');
  const cookie = cookies.find((item) => item.trim().startsWith(`${name}=`));

  if (!cookie) return null;

  return decodeURIComponent(cookie.split('=').slice(1).join('='));
};

const publicDoctor = (user) => ({
  id: user.id,
  organization_id: user.organization_id,
  name: user.name,
  first_name: user.first_name,
  last_name: user.last_name,
  email: user.email,
  phone_number: user.phone_number,
  role: user.role,
  is_email_verified: user.is_email_verified,
  profile_photo_url: user.profile_photo_url,
  professional_title: user.professional_title,
  organization_hospital: user.organization_hospital,
  organization_code: user.organization_code,
  request_accepted: user.request_accepted,
  request_status: user.request_status,
  doctor_profile: user.app_settings?.doctor_profile || null,
  account_status: user.account_status,
});

const findDoctorByEmail = async (email) =>
  User.findOne({
    where: {
      email,
      role: DOCTOR_ROLE,
    },
  });

const findDoctorByIdentifier = async (identifier) => {
  const value = normalizeText(identifier);

  if (!value) return null;

  if (isValidEmail(value)) {
    return findDoctorByEmail(normalizeEmail(value));
  }

  return User.findOne({
    where: {
      phone_number: value,
      role: DOCTOR_ROLE,
    },
  });
};

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

const createResetSession = (res, user) => {
  const sessionId = crypto.randomBytes(32).toString('hex');

  resetSessions.set(sessionId, {
    userId: user.id,
    expiresAt: Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000,
  });

  res.cookie(RESET_SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    maxAge: CODE_EXPIRY_MINUTES * 60 * 1000,
  });
};

const getResetSession = (req) => {
  const sessionId = getCookie(req, RESET_SESSION_COOKIE);

  if (!sessionId) return null;

  const session = resetSessions.get(sessionId);

  if (!session) return null;

  if (session.expiresAt < Date.now()) {
    resetSessions.delete(sessionId);
    return null;
  }

  return {
    id: sessionId,
    ...session,
  };
};

const clearResetSession = (req, res) => {
  const sessionId = getCookie(req, RESET_SESSION_COOKIE);

  if (sessionId) {
    resetSessions.delete(sessionId);
  }

  res.clearCookie(RESET_SESSION_COOKIE, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
  });
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
  email: normalizeEmail(body.email || body.work_email || body.workEmail),
  phoneNumber: normalizeText(body.phone_number || body.phoneNumber),
  gender: normalizeText(body.gender).toLowerCase(),
  dateOfBirth: normalizeText(body.date_of_birth || body.dateOfBirth),
  profilePhotoUrl: normalizeText(
    body.profile_photo_url || body.profilePhotoUrl
  ),
});

const getProfessionalInfo = (body) => ({
  organizationId: body.organization_id || body.organizationId || null,
  organizationHospital: normalizeText(
    body.organization_hospital ||
      body.organizationHospital ||
      body.hospital_organization ||
      body.hospital ||
      body.hospital_institution ||
      body.hospitalInstitution
  ),
  organizationCode: normalizeText(
    body.organization_code || body.organizationCode
  ),
  doctorLicenseNumber: normalizeText(
    body.doctor_license_number ||
      body.doctorLicenseNumber ||
      body.medical_license_number ||
      body.medicalLicenseNumber ||
      body.doctor_id ||
      body.doctorId
  ),
  titleDesignation: normalizeText(
    body.title_designation ||
      body.titleDesignation ||
      body.professional_title ||
      body.professionalTitle
  ).toLowerCase(),
  specializations: toArray(body.specializations || body.specialization),
});

const getSignupBody = (req) => ({
  ...req.body,
  ...(req.body.personal_information || req.body.personalInformation || {}),
  ...(req.body.professional_details || req.body.professionalDetails || {}),
  ...(req.body.professional_information || req.body.professionalInformation || {}),
});

const validatePersonalInfo = ({ firstName, lastName, email, phoneNumber, gender }) => {
  if (!firstName || !lastName || !email || !phoneNumber || !gender) {
    return 'First name, last name, work email, gender and phone number are required';
  }

  if (!isValidEmail(email)) {
    return 'Valid work email is required';
  }

  if (!['male', 'female', 'other'].includes(gender)) {
    return 'Gender must be male, female or other';
  }

  return null;
};

const validateProfessionalInfo = ({
  organizationHospital,
  doctorLicenseNumber,
  titleDesignation,
  specializations,
}) => {
  if (!organizationHospital || !doctorLicenseNumber || !titleDesignation) {
    return 'Hospital/organization, doctor ID/medical license number and title/designation are required';
  }

  if (!specializations.length) {
    return 'At least one specialization is required';
  }

  if (!['md', 'mbbs', 'resident'].includes(titleDesignation)) {
    return 'Title/designation must be md, mbbs or resident';
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
      message: 'Doctor personal information accepted',
      next_step: 'professional-credentials',
      personal_information: {
        first_name: personalInfo.firstName,
        last_name: personalInfo.lastName,
        work_email: personalInfo.email,
        gender: personalInfo.gender,
        phone_number: personalInfo.phoneNumber,
        date_of_birth: personalInfo.dateOfBirth || null,
        profile_photo_url: personalInfo.profilePhotoUrl || null,
      },
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Doctor personal information failed',
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

    const organization = await resolveOrganization({
      organizationId: professionalInfo.organizationId,
      organizationCode: professionalInfo.organizationCode,
      organizationHospital: professionalInfo.organizationHospital,
    });

    if (!organization) {
      return res.status(404).json({
        message:
          'Selected hospital/organization could not be found. Please check the organization code or hospital name and try again.',
      });
    }

    return res.status(200).json({
      message: 'Doctor professional credentials accepted',
      next_step: 'set-password',
      professional_details: {
        organization_id: organization.id,
        hospital_organization: organization.name,
        organization_hospital: organization.name,
        organization_code: organization.code,
        doctor_license_number: professionalInfo.doctorLicenseNumber,
        specializations: professionalInfo.specializations,
        title_designation: professionalInfo.titleDesignation,
      },
      note:
        'Credentials will be verified by admin before account activation',
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Doctor professional credentials failed',
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

    const organization = await resolveOrganization({
      organizationId: professionalInfo.organizationId,
      organizationCode: professionalInfo.organizationCode,
      organizationHospital: professionalInfo.organizationHospital,
    });

    if (!organization) {
      return res.status(404).json({
        message:
          'Selected hospital/organization could not be found. Please check the organization code or hospital name and try again.',
      });
    }

    const doctorProfile = {
      gender: personalInfo.gender,
      date_of_birth: personalInfo.dateOfBirth || null,
      doctor_license_number: professionalInfo.doctorLicenseNumber,
      title_designation: professionalInfo.titleDesignation,
      specializations: professionalInfo.specializations,
      request_submitted_at: new Date().toISOString(),
      request_timeline: [
        {
          label: 'Request Submitted',
          status: 'completed',
        },
        {
          label: 'Organization Admin Review',
          status: 'pending',
        },
        {
          label: 'Email Notification',
          status: 'pending',
        },
      ],
    };

    const user = await sequelize.transaction(async (transaction) => {
      const createdUser = await User.create(
        {
          name: `${personalInfo.firstName} ${personalInfo.lastName}`.trim(),
          first_name: personalInfo.firstName,
          last_name: personalInfo.lastName,
          email: personalInfo.email,
          phone_number: personalInfo.phoneNumber,
          profile_photo_url: personalInfo.profilePhotoUrl || null,
          organization_id: organization.id,
          organization_hospital: organization.name,
          organization_code: organization.code,
          professional_title: professionalInfo.titleDesignation,
          role: DOCTOR_ROLE,
          password_hash: hashPassword(password),
          request_accepted: false,
          request_status: 'pending',
          terms_accepted: true,
          terms_accepted_at: new Date(),
          app_settings: {
            doctor_profile: doctorProfile,
          },
        },
        { transaction }
      );

      // Read the persisted value back from MySQL so a doctor can never be
      // created successfully with a silently missing organization link.
      await createdUser.reload({ transaction });

      if (Number(createdUser.organization_id) !== Number(organization.id)) {
        throw new Error('Doctor organization ID was not persisted');
      }

      return createdUser;
    });

    return res.status(201).json({
      message: 'Doctor account request submitted successfully',
      next_step: 'pending-approval',
      doctor: publicDoctor(user),
      request_summary: {
        name: user.name,
        email: user.email,
        role_requested: user.role,
        hospital_institution: user.organization_hospital,
        status: user.request_status,
      },
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Doctor account password setup failed',
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

    const user = await findDoctorByEmail(email);

    if (!user || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({
        message: 'Invalid doctor email or password',
      });
    }

    if (['deactivated', 'deleted'].includes(user.account_status)) {
      return res.status(403).json({
        message: 'Doctor account is not active',
      });
    }

    if (user.request_status === 'pending') {
      return res.status(403).json({
        message: 'Doctor organization request is pending approval',
      });
    }

    if (user.request_status === 'rejected') {
      return res.status(403).json({
        message: 'Doctor organization request was rejected',
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
      message: 'Doctor login successful',
      token,
      doctor: publicDoctor(user),
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Doctor signin failed',
      error: error.message,
    });
  }
};

const forgotPassword = async (req, res) => {
  try {
    const identifier =
      req.body.email ||
      req.body.phone_number ||
      req.body.phoneNumber ||
      req.body.identifier;

    if (!identifier) {
      return res.status(400).json({
        message: 'Email or phone number is required',
      });
    }

    const user = await findDoctorByIdentifier(identifier);

    if (!user) {
      return res.status(404).json({ message: 'Doctor not found' });
    }

    await setResetCode(user);

    return res.status(200).json({
      message: 'Password reset code sent to email',
      email: user.email,
      next_step: 'verify-otp',
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Doctor forgot password failed',
      error: error.message,
    });
  }
};

const verifyOtp = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const { code } = req.body;

    if (!email || !code) {
      return res.status(400).json({
        message: 'Email and code are required',
      });
    }

    const user = await findDoctorByEmail(email);

    if (!user) {
      return res.status(404).json({ message: 'Doctor not found' });
    }

    const codeError = getResetCodeError(user, code);

    if (codeError) {
      return res.status(400).json({ message: codeError });
    }

    createResetSession(res, user);
    clearVerificationCode(user);
    await user.save();

    return res.status(200).json({
      message: 'OTP verified successfully',
      next_step: 'reset-password',
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Doctor OTP verification failed',
      error: error.message,
    });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { new_password, confirm_new_password } = req.body;

    if (!new_password || !confirm_new_password) {
      return res.status(400).json({
        message: 'new_password and confirm_new_password are required',
      });
    }

    if (String(new_password).length < 8) {
      return res.status(400).json({
        message: 'New password must be at least 8 characters',
      });
    }

    if (new_password !== confirm_new_password) {
      return res.status(400).json({
        message: 'New password and confirm password do not match',
      });
    }

    const resetSession = getResetSession(req);

    if (!resetSession) {
      return res.status(401).json({
        message: 'OTP verification is required before resetting password',
      });
    }

    const user = await User.findOne({
      where: {
        id: resetSession.userId,
        role: DOCTOR_ROLE,
      },
    });

    if (!user) {
      return res.status(404).json({ message: 'Doctor not found' });
    }

    clearVerificationCode(user);
    user.password_hash = hashPassword(new_password);
    await user.save();
    clearResetSession(req, res);

    return res.status(200).json({
      message: 'Doctor password updated successfully',
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Doctor password reset failed',
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
  verifyOtp,
};
