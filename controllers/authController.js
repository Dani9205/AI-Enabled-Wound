const User = require('../models/userModel');
const { sendEmailCode } = require('../utils/mailer');
const {
  generateSixDigitCode,
  hashPassword,
  signToken,
  verifyPassword,
} = require('../utils/security');

const ALLOWED_ROLES = ['doctor', 'nurse', 'patient'];
const CODE_EXPIRY_MINUTES = 10;

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();
const isTruthy = (value) =>
  value === true ||
  value === 1 ||
  ['true', '1'].includes(String(value).trim().toLowerCase());
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const publicUser = (user) => ({
  id: user.id,
  name: user.name,
  first_name: user.first_name,
  last_name: user.last_name,
  email: user.email,
  phone_number: user.phone_number,
  role: user.role,
  is_email_verified: user.is_email_verified,
});

const setVerificationCode = async (user, purpose) => {
  const code = generateSixDigitCode();

  // Plain code save hoga database me
  user.verification_code = code;
  user.verification_code_expires_at = new Date(
    Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000
  );
  user.verification_purpose = purpose;

  await user.save();
  await sendEmailCode({ to: user.email, code, purpose });
};

const clearVerificationCode = (user) => {
  user.verification_code = null;
  user.verification_code_expires_at = null;
  user.verification_purpose = null;
};

const ensureValidCode = (user, code, purpose) => {
  if (
    !user.verification_code ||
    !user.verification_code_expires_at ||
    user.verification_purpose !== purpose
  ) {
    return 'Verification code not requested';
  }

  if (new Date(user.verification_code_expires_at).getTime() < Date.now()) {
    return 'Verification code expired';
  }

  // Plain code compare hoga
  if (String(code || '') !== String(user.verification_code)) {
    return 'Invalid verification code';
  }

  return null;
};







const createAccount = async (req, res) => {
  try {
    const first_name = String(
      req.body.first_name || req.body.firstName || ''
    ).trim();
    const last_name = String(
      req.body.last_name || req.body.lastName || ''
    ).trim();
    const email = normalizeEmail(req.body.email);
    const phone_number = String(
      req.body.phone_number || req.body.phoneNumber || ''
    ).trim();
    const role = String(req.body.role || '').trim().toLowerCase();
    const password = req.body.password;
    const confirm_password = req.body.confirm_password || req.body.confirmPassword;
    const terms_accepted = req.body.terms_accepted || req.body.termsAccepted;

    if (
      !first_name ||
      !last_name ||
      !email ||
      !phone_number ||
      !password ||
      !confirm_password ||
      !role
    ) {
      return res.status(400).json({
        message:
          'First name, last name, email, phone number, password, confirm password and role are required',
      });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({
        message: 'Valid email is required',
      });
    }

    if (!ALLOWED_ROLES.includes(role)) {
      return res.status(400).json({
        message: `Role must be one of: ${ALLOWED_ROLES.join(', ')}`,
      });
    }

    if (String(password).length < 8) {
      return res.status(400).json({
        message: 'Password must be at least 8 characters',
      });
    }

    if (password !== confirm_password) {
      return res.status(400).json({
        message: 'Password and confirm password do not match',
      });
    }

    if (!isTruthy(terms_accepted)) {
      return res.status(400).json({
        message: 'Terms of Service and Privacy Policy must be accepted',
      });
    }

    const existingUser = await User.findOne({ where: { email } });

    if (existingUser) {
      return res.status(409).json({
        message: 'Email already exists',
      });
    }

    const user = await User.create({
      name: `${first_name} ${last_name}`.trim(),
      first_name,
      last_name,
      email,
      phone_number,
      role,
      password_hash: hashPassword(password),
      terms_accepted: true,
      terms_accepted_at: new Date(),
    });

    await setVerificationCode(user, 'signup');

    return res.status(201).json({
      message: 'Account created successfully. Verification code sent to email',
      email: user.email,
      next_step: 'verify-code',
      user: publicUser(user),
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Account creation failed',
      error: error.message,
    });
  }
};











const createOrganizationAccount = async (req, res) => {
  try {
    const first_name = String(
      req.body.first_name || req.body.firstName || ''
    ).trim();
    const last_name = String(
      req.body.last_name || req.body.lastName || ''
    ).trim();
    const email = normalizeEmail(req.body.email);
    const phone_number = String(
      req.body.phone_number || req.body.phoneNumber || ''
    ).trim();
    const organization_hospital = String(
      req.body.organization_hospital ||
        req.body.organizationHospital ||
        req.body.organization ||
        req.body.hospital ||
        ''
    ).trim();
    const organization_code = String(
      req.body.organization_code || req.body.organizationCode || ''
    ).trim();
    const role = String(req.body.role || '').trim().toLowerCase();
    const password = req.body.password;
    const confirm_password = req.body.confirm_password || req.body.confirmPassword;
    const terms_accepted = req.body.terms_accepted || req.body.termsAccepted;

    if (
      !first_name ||
      !last_name ||
      !email ||
      !phone_number ||
      !organization_hospital ||
      !organization_code ||
      !password ||
      !confirm_password ||
      !role
    ) {
      return res.status(400).json({
        message:
          'First name, last name, email, phone number, organization/hospital, organization code, password, confirm password and role are required',
      });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({
        message: 'Valid email is required',
      });
    }

    if (!ALLOWED_ROLES.includes(role)) {
      return res.status(400).json({
        message: `Role must be one of: ${ALLOWED_ROLES.join(', ')}`,
      });
    }

    if (String(password).length < 8) {
      return res.status(400).json({
        message: 'Password must be at least 8 characters',
      });
    }

    if (password !== confirm_password) {
      return res.status(400).json({
        message: 'Password and confirm password do not match',
      });
    }

    if (!isTruthy(terms_accepted)) {
      return res.status(400).json({
        message: 'Terms of Service and Privacy Policy must be accepted',
      });
    }

    const existingUser = await User.findOne({ where: { email } });

    if (existingUser) {
      return res.status(409).json({
        message: 'Email already exists',
      });
    }

    const user = await User.create({
      name: `${first_name} ${last_name}`.trim(),
      first_name,
      last_name,
      email,
      phone_number,
      organization_hospital,
      organization_code,
      role,
      password_hash: hashPassword(password),
      request_accepted: false,
      request_status: 'pending',
      terms_accepted: true,
      terms_accepted_at: new Date(),
    });

    await setVerificationCode(user, 'signup');

    return res.status(201).json({
      message:
        'Account request submitted successfully. Verification code sent to email',
      email: user.email,
      next_step: 'verify-code',
      user: {
        ...publicUser(user),
        organization_hospital: user.organization_hospital,
        organization_code: user.organization_code,
        request_accepted: user.request_accepted,
        request_status: user.request_status,
      },
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Account request failed',
      error: error.message,
    });
  }
};

const acceptOrganizationRequest = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);

    if (!email) {
      return res.status(400).json({
        message: 'Email is required',
      });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({
        message: 'Valid email is required',
      });
    }

    const user = await User.findOne({ where: { email } });

    if (!user) {
      return res.status(404).json({
        message: 'User not found',
      });
    }

    await user.update({
      request_accepted: true,
      request_status: 'accepted',
      reviewed_at: new Date(),
      rejection_reason: null,
    });

    return res.status(200).json({
      message: 'Organization request accepted successfully',
      user: {
        ...publicUser(user),
        organization_hospital: user.organization_hospital,
        organization_code: user.organization_code,
        request_accepted: user.request_accepted,
        request_status: user.request_status,
        reviewed_at: user.reviewed_at,
      },
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Request approval failed',
      error: error.message,
    });
  }
};






// signin user >>> doctor, nurse, patient
const signin = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const { password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: 'Email and password are required',
      });
    }

    const user = await User.findOne({ where: { email } });

    if (!user) {
      return res.status(404).json({
        message: 'User not found',
      });
    }

    if (!verifyPassword(password, user.password_hash)) {
      return res.status(401).json({
        message: 'Invalid email or password',
      });
    }

    if (['deactivated', 'deleted'].includes(user.account_status)) {
      return res.status(403).json({
        message: 'User account is not active',
      });
    }

    user.last_login_at = new Date();
    user.account_status = 'active';
    await user.save();

    const token = signToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    user.auth_token = token;
    await user.save();

    return res.status(200).json({
      message: 'Login successful',
      token,
      user: publicUser(user),
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Signin failed',
      error: error.message,
    });
  }
};

// const signin = async (req, res) => {
//   try {
//     const email = normalizeEmail(req.body.email);
//     const { password } = req.body;

//     if (!email || !password) {
//       return res.status(400).json({
//         message: 'Email and password are required',
//       });
//     }

//     // Password validation
//     if (String(password).length < 8) {
//       return res.status(400).json({
//         message: 'Password must be at least 8 characters long',
//       });
//     }

//     let user = await User.findOne({ where: { email } });

//     if (user) {
//       if (!verifyPassword(password, user.password_hash)) {
//         return res.status(401).json({
//           message: 'Invalid email or password',
//         });
//       }
//     } else {
//       user = await User.create({
//         email,
//         password_hash: hashPassword(password),
//       });
//     }

//     await setVerificationCode(user, 'signin');

//     return res.status(200).json({
//       message: 'Verification code sent to email',
//       email: user.email,
//       next_step: 'verify-code',
//     });
//   } catch (error) {
//     return res.status(500).json({
//       message: 'Signin failed',
//       error: error.message,
//     });
//   }
// };














const verifySigninCode = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const { code } = req.body;

    if (!email || !code) {
      return res.status(400).json({ message: 'Email and code are required' });
    }

    const user = await User.findOne({ where: { email } });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const purpose = user.verification_purpose || 'signup';
    const codeError = ensureValidCode(user, code, purpose);

    if (codeError) {
      return res.status(400).json({ message: codeError });
    }

    clearVerificationCode(user);
    user.is_email_verified = true;
    user.last_login_at = new Date();
    await user.save();

    const token = signToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    user.auth_token = token;
    await user.save();

    return res.status(200).json({
      message:
        purpose === 'signup'
          ? 'Account verified successfully'
          : 'Login successful',
      token,
      user: publicUser(user),
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: 'Code verification failed', error: error.message });
  }
};














const forgotPassword = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const user = await User.findOne({ where: { email } });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    await setVerificationCode(user, 'reset_password');

    return res.status(200).json({
      message: 'Password reset code sent to email',
      email: user.email,
      next_step: 'reset-password',
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: 'Forgot password failed', error: error.message });
  }
};

















const resetPassword = async (req, res) => {
  try {
    const { code, new_password, confirm_new_password } = req.body;

    if (!code || !new_password || !confirm_new_password) {
      return res.status(400).json({
        message: 'Code, new_password and confirm_new_password are required',
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

    const user = await User.findOne({
      where: {
        verification_code: String(code),
        verification_purpose: 'reset_password',
      },
    });

    if (!user) {
      return res.status(400).json({
        message: 'Invalid code',
      });
    }

    const codeError = ensureValidCode(user, code, 'reset_password');

    if (codeError) {
      return res.status(400).json({ message: codeError });
    }

    clearVerificationCode(user);
    user.password_hash = hashPassword(new_password);

    await user.save();

    return res.status(200).json({
      message: 'Password updated successfully',
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Password reset failed',
      error: error.message,
    });
  }
};










const changeRole = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const { role } = req.body;

    if (!email || !role) {
      return res.status(400).json({
        message: 'Email and role are required',
      });
    }

    if (!ALLOWED_ROLES.includes(role)) {
      return res.status(400).json({
        message: `Role must be one of: ${ALLOWED_ROLES.join(', ')}`,
      });
    }

    const user = await User.findOne({ where: { email } });

    if (!user) {
      return res.status(404).json({
        message: 'User not found',
      });
    }

    user.role = role;
    await user.save();

    return res.status(200).json({
      message: 'Role updated successfully',
      user: publicUser(user),
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Something went wrong',
      error: error.message,
    });
  }
};
module.exports = {
  acceptOrganizationRequest,
  createAccount,
  createOrganizationAccount,
  forgotPassword,
  resetPassword,
  signin,
  verifySigninCode,
  changeRole,
};
