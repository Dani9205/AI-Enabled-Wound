const Patient = require('../models/patientModel');
const WoundCase = require('../models/woundCaseModel');
const { hashPassword, verifyPassword } = require('../utils/security');

const DEFAULT_NOTIFICATION_PREFERENCES = {
  patient_wound_alerts: true,
  wound_update_added: true,
  doctor_instructions: true,
  report_generated: true,
  security_alerts: true,
};

const DEFAULT_APP_SETTINGS = {
  auto_sync_when_online: true,
  save_images_offline: true,
  text_size: 'medium',
  language: 'english',
};

const DEFAULT_SECURITY_SETTINGS = {
  password_last_changed_at: null,
  sign_out_all_devices_at: null,
};

const cleanString = (value) => {
  if (value === undefined || value === null) return undefined;

  const trimmed = String(value).trim();
  return trimmed || undefined;
};

const getBodyValue = (body, field) => {
  const camelField = field.replace(/_([a-z])/g, (_, letter) =>
    letter.toUpperCase()
  );

  return body[field] !== undefined ? body[field] : body[camelField];
};

const asArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  return [];
};

const asObject = (value, defaults = {}) => {
  if (!value) return { ...defaults };

  if (typeof value === 'object' && !Array.isArray(value)) {
    return { ...defaults, ...value };
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return typeof parsed === 'object' && !Array.isArray(parsed)
        ? { ...defaults, ...parsed }
        : { ...defaults };
    } catch (error) {
      return { ...defaults };
    }
  }

  return { ...defaults };
};

const isTruthy = (value) =>
  value === true ||
  value === 1 ||
  ['true', '1'].includes(String(value).trim().toLowerCase());

const fullName = (user) =>
  user.name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || null;

const initials = (name) =>
  String(name || '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

const getPatientProfile = (user) =>
  asObject(asObject(user.app_settings).patient_profile);

const getPatientMrn = (user) =>
  getPatientProfile(user).patient_id_mrn || getPatientProfile(user).mrn || null;

const findLinkedPatient = async (user) => {
  const mrn = getPatientMrn(user);

  if (!mrn) return null;

  return Patient.findOne({ where: { mrn } });
};

const publicPatientProfile = async (user) => {
  const patient = await findLinkedPatient(user);
  const patientProfile = getPatientProfile(user);
  const woundCases = patient
    ? await WoundCase.findAll({ where: { patient_id: patient.id } })
    : [];

  return {
    id: user.id,
    initials: initials(fullName(user)),
    name: fullName(user),
    first_name: user.first_name,
    last_name: user.last_name,
    email: user.email,
    phone_number: user.phone_number,
    profile_photo_url: user.profile_photo_url,
    role: user.role,
    account_status: user.account_status,
    hospital_institution: user.organization_hospital,
    patient_id_mrn: patientProfile.patient_id_mrn || patient?.mrn || null,
    date_of_birth: patientProfile.date_of_birth || patient?.date_of_birth || null,
    gender: patientProfile.gender || patient?.gender || null,
    primary_diagnosis: patient?.primary_diagnosis || null,
    allergies_notes: patient?.allergies_notes || null,
    room: patient?.room || null,
    assigned_staff: {
      primary_staff: patient?.primary_staff || null,
      backup_staff: patient?.backup_staff || null,
    },
    counts: {
      wound_cases: woundCases.length,
      reports: woundCases.reduce(
        (total, woundCase) => total + asArray(woundCase.reports).length,
        0
      ),
    },
    created_at: user.createdAt,
    updated_at: user.updatedAt,
  };
};

const getProfile = async (req, res) => {
  try {
    return res.status(200).json({
      message: 'Patient profile fetched successfully',
      profile: await publicPatientProfile(req.user),
      menu: [
        'edit_profile',
        'security_settings',
        'notification_preferences',
        'app_settings',
        'sign_out',
        'delete_account',
      ],
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Patient profile fetch failed',
      error: error.message,
    });
  }
};

const getEditProfile = async (req, res) => {
  try {
    return res.status(200).json({
      message: 'Patient edit profile fetched successfully',
      profile: await publicPatientProfile(req.user),
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Patient edit profile fetch failed',
      error: error.message,
    });
  }
};

const updateProfile = async (req, res) => {
  try {
    const user = req.user;
    const patient = await findLinkedPatient(user);
    const payload = {};

    [
      'first_name',
      'last_name',
      'phone_number',
      'profile_photo_url',
      'organization_hospital',
    ].forEach((field) => {
      const value = cleanString(getBodyValue(req.body, field));

      if (value !== undefined) {
        payload[field] = value || null;
      }
    });

    if (payload.first_name !== undefined || payload.last_name !== undefined) {
      const firstName =
        payload.first_name !== undefined ? payload.first_name : user.first_name;
      const lastName =
        payload.last_name !== undefined ? payload.last_name : user.last_name;
      payload.name = `${firstName || ''} ${lastName || ''}`.trim();
    }

    const appSettings = asObject(user.app_settings);
    const patientProfile = getPatientProfile(user);
    const nextPatientProfile = { ...patientProfile };
    const patientProfileFields = ['gender', 'date_of_birth', 'patient_id_mrn'];

    patientProfileFields.forEach((field) => {
      const value = cleanString(getBodyValue(req.body, field));

      if (value !== undefined) {
        nextPatientProfile[field] = value || null;
      }
    });

    payload.app_settings = {
      ...appSettings,
      patient_profile: nextPatientProfile,
    };

    await user.update(payload);

    if (patient) {
      const patientPayload = {};

      if (payload.first_name !== undefined) patientPayload.first_name = payload.first_name;
      if (payload.last_name !== undefined) patientPayload.last_name = payload.last_name;
      if (nextPatientProfile.gender !== patientProfile.gender) {
        patientPayload.gender = nextPatientProfile.gender;
      }
      if (nextPatientProfile.date_of_birth !== patientProfile.date_of_birth) {
        patientPayload.date_of_birth = nextPatientProfile.date_of_birth;
      }
      if (
        nextPatientProfile.patient_id_mrn &&
        nextPatientProfile.patient_id_mrn !== patient.mrn
      ) {
        patientPayload.mrn = nextPatientProfile.patient_id_mrn;
      }

      if (Object.keys(patientPayload).length) {
        await patient.update(patientPayload);
      }
    }

    return res.status(200).json({
      message: 'Patient profile updated successfully',
      profile: await publicPatientProfile(user),
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Patient profile update failed',
      error: error.message,
    });
  }
};

const getSecuritySettings = async (req, res) => {
  try {
    return res.status(200).json({
      message: 'Patient security settings fetched successfully',
      security_settings: asObject(
        req.user.security_settings,
        DEFAULT_SECURITY_SETTINGS
      ),
      active_sessions: asArray(req.user.active_sessions),
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Patient security settings fetch failed',
      error: error.message,
    });
  }
};

const changePassword = async (req, res) => {
  try {
    const currentPassword = req.body.current_password || req.body.currentPassword;
    const newPassword = req.body.new_password || req.body.newPassword;
    const confirmPassword = req.body.confirm_password || req.body.confirmPassword;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        message: 'current_password, new_password and confirm_password are required',
      });
    }

    if (!verifyPassword(currentPassword, req.user.password_hash)) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    if (String(newPassword).length < 8) {
      return res.status(400).json({
        message: 'New password must be at least 8 characters',
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        message: 'New password and confirm password do not match',
      });
    }

    await req.user.update({
      password_hash: hashPassword(newPassword),
      security_settings: {
        ...asObject(req.user.security_settings, DEFAULT_SECURITY_SETTINGS),
        password_last_changed_at: new Date().toISOString(),
      },
    });

    return res.status(200).json({
      message: 'Patient password changed successfully',
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Patient password change failed',
      error: error.message,
    });
  }
};

const signOutAllDevices = async (req, res) => {
  try {
    await req.user.update({
      auth_token: null,
      active_sessions: [],
      security_settings: {
        ...asObject(req.user.security_settings, DEFAULT_SECURITY_SETTINGS),
        sign_out_all_devices_at: new Date().toISOString(),
      },
    });

    return res.status(200).json({
      message: 'Patient signed out from all devices successfully',
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Patient sign out all devices failed',
      error: error.message,
    });
  }
};

const getNotificationPreferences = async (req, res) => {
  try {
    return res.status(200).json({
      message: 'Patient notification preferences fetched successfully',
      notification_preferences: asObject(
        req.user.notification_preferences,
        DEFAULT_NOTIFICATION_PREFERENCES
      ),
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Patient notification preferences fetch failed',
      error: error.message,
    });
  }
};

const updateNotificationPreferences = async (req, res) => {
  try {
    const next = {
      ...asObject(req.user.notification_preferences, DEFAULT_NOTIFICATION_PREFERENCES),
      ...req.body,
    };

    await req.user.update({ notification_preferences: next });

    return res.status(200).json({
      message: 'Patient notification preferences updated successfully',
      notification_preferences: next,
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Patient notification preferences update failed',
      error: error.message,
    });
  }
};

const getAppSettings = async (req, res) => {
  try {
    return res.status(200).json({
      message: 'Patient app settings fetched successfully',
      app_settings: asObject(req.user.app_settings, DEFAULT_APP_SETTINGS),
      app_version: 'v1.0.0',
      build: 24,
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Patient app settings fetch failed',
      error: error.message,
    });
  }
};

const updateAppSettings = async (req, res) => {
  try {
    const next = {
      ...asObject(req.user.app_settings, DEFAULT_APP_SETTINGS),
      ...req.body,
    };

    await req.user.update({ app_settings: next });

    return res.status(200).json({
      message: 'Patient app settings updated successfully',
      app_settings: next,
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Patient app settings update failed',
      error: error.message,
    });
  }
};

const signOut = async (req, res) => {
  try {
    await req.user.update({
      auth_token: null,
      account_status: 'signed_out',
    });

    return res.status(200).json({
      message: 'Patient signed out successfully',
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Patient sign out failed',
      error: error.message,
    });
  }
};

const deleteAccount = async (req, res) => {
  try {
    const password = req.body.password;
    const reason = cleanString(req.body.reason);
    const confirmDelete = req.body.confirm_delete || req.body.confirmDelete;

    if (!password) {
      return res.status(400).json({ message: 'password is required' });
    }

    if (!verifyPassword(password, req.user.password_hash)) {
      return res.status(401).json({ message: 'Password is incorrect' });
    }

    if (!isTruthy(confirmDelete)) {
      return res.status(400).json({ message: 'confirm_delete must be true' });
    }

    await req.user.update({
      auth_token: null,
      account_status: 'deleted',
      deleted_at: new Date(),
      security_settings: {
        ...asObject(req.user.security_settings, DEFAULT_SECURITY_SETTINGS),
        deletion_reason: reason || null,
        deleted_at: new Date().toISOString(),
      },
    });

    return res.status(200).json({
      message: 'Patient account deleted successfully',
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Patient account deletion failed',
      error: error.message,
    });
  }
};

module.exports = {
  changePassword,
  deleteAccount,
  getAppSettings,
  getEditProfile,
  getNotificationPreferences,
  getProfile,
  getSecuritySettings,
  signOut,
  signOutAllDevices,
  updateAppSettings,
  updateNotificationPreferences,
  updateProfile,
};
