const Patient = require('../models/patientModel');
const Task = require('../models/taskModel');
const User = require('../models/userModel');
const WoundCase = require('../models/woundCaseModel');
const { hashPassword, verifyPassword } = require('../utils/security');
const sequelize = require('../config/db');

const DEFAULT_NOTIFICATION_PREFERENCES = {
  task_alerts: true,
  task_reassigned: true,
  task_cancelled: true,
  task_completed: false,
  wound_updates_added: true,
  doctor_added_instructions: true,
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
  if (value === undefined || value === null) {
    return undefined;
  }

  const trimmed = String(value).trim();
  return trimmed || undefined;
};

const parseId = (value) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : NaN;
};

const asArray = (value) => {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value;
  }

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
  if (!value) {
    return { ...defaults };
  }

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

const getBodyValue = (body, field) => {
  const camelField = field.replace(/_([a-z])/g, (_, letter) =>
    letter.toUpperCase()
  );

  return body[field] !== undefined ? body[field] : body[camelField];
};

const userName = (user) =>
  user.name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || null;

const publicProfile = (user) => ({
  id: user.id,
  name: userName(user),
  first_name: user.first_name,
  last_name: user.last_name,
  email: user.email,
  phone_number: user.phone_number,
  profile_photo_url: user.profile_photo_url,
  role: user.role,
  professional_title: user.professional_title,
  organization_hospital: user.organization_hospital,
  organization_code: user.organization_code,
  shift: user.shift,
  account_status: user.account_status,
  last_login_at: user.last_login_at,
  created_at: user.createdAt,
  updated_at: user.updatedAt,
});

const findUser = async (id) => {
  const userId = parseId(id);

  if (!userId || Number.isNaN(userId)) {
    return null;
  }

  return User.findByPk(userId);
};

const profileCounts = async (user) => {
  const patientWhere = user.role === 'nurse' ? { nurse_id: user.id } : {};
  const patients = await Patient.findAll({ where: patientWhere, attributes: ['id'] });
  const patientIds = patients.map((patient) => patient.id);
  const woundWhere = patientIds.length ? { patient_id: patientIds } : {};
  const [wounds, tasks, woundCases] = await Promise.all([
    WoundCase.count({ where: woundWhere }),
    Task.count({ where: { assigned_to: user.id, status: 'pending' } }),
    WoundCase.findAll({ where: woundWhere, attributes: ['reports'] }),
  ]);
  const reports = woundCases.reduce(
    (total, woundCase) => total + asArray(woundCase.reports).length,
    0
  );

  return {
    patients: patients.length,
    wounds,
    reports,
    tasks,
  };
};

const getProfile = async (req, res) => {
  try {
    const user = await findUser(req.params.id || req.query.user_id || req.query.userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.status(200).json({
      profile: publicProfile(user),
      counts: await profileCounts(user),
      notification_preferences: asObject(
        user.notification_preferences,
        DEFAULT_NOTIFICATION_PREFERENCES
      ),
      app_settings: asObject(user.app_settings, DEFAULT_APP_SETTINGS),
      security_settings: asObject(user.security_settings, DEFAULT_SECURITY_SETTINGS),
      active_sessions: asArray(user.active_sessions),
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Profile fetch failed',
      error: error.message,
    });
  }
};

const updateProfile = async (req, res) => {
  try {
    const user = await findUser(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const payload = {};
    [
      'first_name',
      'last_name',
      'phone_number',
      'profile_photo_url',
      'organization_hospital',
      'organization_code',
      'shift',
      'professional_title',
    ].forEach((field) => {
      const value = cleanString(getBodyValue(req.body, field));

      if (value !== undefined) {
        payload[field] = value || null;
      }
    });

    if (payload.first_name !== undefined || payload.last_name !== undefined) {
      const firstName = payload.first_name !== undefined ? payload.first_name : user.first_name;
      const lastName = payload.last_name !== undefined ? payload.last_name : user.last_name;
      payload.name = `${firstName || ''} ${lastName || ''}`.trim();
    }

    await user.update(payload);

    return res.status(200).json({
      message: 'Profile updated successfully',
      profile: publicProfile(user),
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Profile update failed',
      error: error.message,
    });
  }
};

const changePassword = async (req, res) => {
  try {
    const user = await findUser(req.params.id);
    const currentPassword = req.body.current_password || req.body.currentPassword;
    const newPassword = req.body.new_password || req.body.newPassword;
    const confirmPassword = req.body.confirm_password || req.body.confirmPassword;

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        message: 'current_password, new_password and confirm_password are required',
      });
    }

    if (!verifyPassword(currentPassword, user.password_hash)) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    if (String(newPassword).length < 8) {
      return res.status(400).json({ message: 'New password must be at least 8 characters' });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: 'New password and confirm password do not match' });
    }

    await user.update({
      password_hash: hashPassword(newPassword),
      security_settings: {
        ...asObject(user.security_settings, DEFAULT_SECURITY_SETTINGS),
        password_last_changed_at: new Date().toISOString(),
      },
    });

    return res.status(200).json({ message: 'Password changed successfully' });
  } catch (error) {
    return res.status(500).json({
      message: 'Password change failed',
      error: error.message,
    });
  }
};

const getSecuritySettings = async (req, res) => {
  try {
    const user = await findUser(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.status(200).json({
      security_settings: asObject(user.security_settings, DEFAULT_SECURITY_SETTINGS),
      active_sessions: asArray(user.active_sessions),
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Security settings fetch failed',
      error: error.message,
    });
  }
};

const signOutAllDevices = async (req, res) => {
  try {
    const user = await findUser(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    await user.update({
      auth_token: null,
      active_sessions: [],
      security_settings: {
        ...asObject(user.security_settings, DEFAULT_SECURITY_SETTINGS),
        sign_out_all_devices_at: new Date().toISOString(),
      },
    });

    return res.status(200).json({ message: 'Signed out from all devices successfully' });
  } catch (error) {
    return res.status(500).json({
      message: 'Sign out all devices failed',
      error: error.message,
    });
  }
};

const getNotificationPreferences = async (req, res) => {
  try {
    const user = await findUser(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.status(200).json({
      notification_preferences: asObject(
        user.notification_preferences,
        DEFAULT_NOTIFICATION_PREFERENCES
      ),
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Notification preferences fetch failed',
      error: error.message,
    });
  }
};

const updateNotificationPreferences = async (req, res) => {
  try {
    const user = await findUser(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const current = asObject(user.notification_preferences, DEFAULT_NOTIFICATION_PREFERENCES);
    const next = { ...current, ...req.body };

    await user.update({ notification_preferences: next });

    return res.status(200).json({
      message: 'Notification preferences updated successfully',
      notification_preferences: next,
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Notification preferences update failed',
      error: error.message,
    });
  }
};

const getAppSettings = async (req, res) => {
  try {
    const user = await findUser(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.status(200).json({
      app_settings: asObject(user.app_settings, DEFAULT_APP_SETTINGS),
      app_version: 'v1.0.0',
    });
  } catch (error) {
    return res.status(500).json({
      message: 'App settings fetch failed',
      error: error.message,
    });
  }
};

const updateAppSettings = async (req, res) => {
  try {
    const user = await findUser(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const next = { ...asObject(user.app_settings, DEFAULT_APP_SETTINGS), ...req.body };

    await user.update({ app_settings: next });

    return res.status(200).json({
      message: 'App settings updated successfully',
      app_settings: next,
    });
  } catch (error) {
    return res.status(500).json({
      message: 'App settings update failed',
      error: error.message,
    });
  }
};

const initiatePatientHandoff = async (req, res) => {
  try {
    const fromNurse = await findUser(req.params.id);
    const toNurseId = parseId(req.body.to_nurse_id || req.body.toNurseId);
    const patientIds = asArray(req.body.patient_ids || req.body.patientIds).map(parseId);

    if (!fromNurse) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!toNurseId || Number.isNaN(toNurseId)) {
      return res.status(400).json({ message: 'to_nurse_id is required' });
    }

    if (!patientIds.length || patientIds.some((id) => !id || Number.isNaN(id))) {
      return res.status(400).json({ message: 'patient_ids are required' });
    }

    const toNurse = await User.findByPk(toNurseId);

    if (!toNurse) {
      return res.status(404).json({ message: 'Target nurse not found' });
    }

    let updatedCount = 0;
    let reassignedTaskCount = 0;
    await sequelize.transaction(async (transaction) => {
      const [patientUpdateCount] = await Patient.update(
        { nurse_id: toNurseId },
        { where: { id: patientIds, nurse_id: fromNurse.id }, transaction }
      );
      const [taskUpdateCount] = await Task.update(
        { assigned_to: toNurseId },
        { where: { patient_id: patientIds, status: 'pending' }, transaction }
      );

      updatedCount = patientUpdateCount;
      reassignedTaskCount = taskUpdateCount;
    });

    return res.status(200).json({
      message: 'Patient handoff initiated successfully',
      from_nurse_id: fromNurse.id,
      to_nurse_id: toNurseId,
      patient_ids: patientIds,
      updated_count: updatedCount,
      reassigned_task_count: reassignedTaskCount,
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Patient handoff failed',
      error: error.message,
    });
  }
};

const signOut = async (req, res) => {
  try {
    const user = await findUser(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    await user.update({
      auth_token: null,
      account_status: 'signed_out',
    });

    return res.status(200).json({ message: 'Signed out successfully' });
  } catch (error) {
    return res.status(500).json({
      message: 'Sign out failed',
      error: error.message,
    });
  }
};

const deleteAccount = async (req, res) => {
  try {
    const user = await findUser(req.params.id);
    const password = req.body.password;
    const confirmDelete = req.body.confirm_delete || req.body.confirmDelete;
    const reason = cleanString(req.body.reason);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!password) {
      return res.status(400).json({ message: 'password is required' });
    }

    if (!verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ message: 'Password is incorrect' });
    }

    if (![true, 'true', 1, '1'].includes(confirmDelete)) {
      return res.status(400).json({ message: 'confirm_delete must be true' });
    }

    await user.update({
      auth_token: null,
      account_status: 'deleted',
      deleted_at: new Date(),
      security_settings: {
        ...asObject(user.security_settings, DEFAULT_SECURITY_SETTINGS),
        deletion_reason: reason || null,
      },
    });

    return res.status(200).json({ message: 'Account deleted successfully' });
  } catch (error) {
    return res.status(500).json({
      message: 'Account deletion failed',
      error: error.message,
    });
  }
};

module.exports = {
  changePassword,
  deleteAccount,
  getAppSettings,
  getNotificationPreferences,
  getProfile,
  getSecuritySettings,
  initiatePatientHandoff,
  signOut,
  signOutAllDevices,
  updateAppSettings,
  updateNotificationPreferences,
  updateProfile,
};
