const Patient = require('../models/patientModel');
const Task = require('../models/taskModel');
const User = require('../models/userModel');
const WoundCase = require('../models/woundCaseModel');
const { hashPassword, verifyPassword } = require('../utils/security');
const { permanentlyDeleteUserAccount } = require('../utils/permanentDelete');

const DEFAULT_NOTIFICATION_PREFERENCES = {
  new_task_assigned: true,
  task_reassigned: true,
  task_cancelled: true,
  task_completed: false,
  wound_update_added: true,
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

const parseId = (value) => {
  if (value === undefined || value === null || value === '') return null;

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : NaN;
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

const getBodyValue = (body, field) => {
  const camelField = field.replace(/_([a-z])/g, (_, letter) =>
    letter.toUpperCase()
  );

  return body[field] !== undefined ? body[field] : body[camelField];
};

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

const findDoctor = async (id) => {
  const doctorId = parseId(id);

  if (!doctorId || Number.isNaN(doctorId)) return null;

  const user = await User.findByPk(doctorId);

  return user && user.role === 'doctor' ? user : null;
};

const publicDoctorProfile = (doctor) => {
  const appSettings = asObject(doctor.app_settings);
  const doctorProfile = asObject(appSettings.doctor_profile);

  return {
    id: doctor.id,
    initials: initials(fullName(doctor)),
    name: fullName(doctor),
    first_name: doctor.first_name,
    last_name: doctor.last_name,
    email: doctor.email,
    phone_number: doctor.phone_number,
    profile_photo_url: doctor.profile_photo_url,
    role: doctor.role,
    professional_title: doctor.professional_title,
    organization_hospital: doctor.organization_hospital,
    organization_code: doctor.organization_code,
    doctor_license_number: doctorProfile.doctor_license_number || null,
    specializations: asArray(doctorProfile.specializations),
    title_designation: doctorProfile.title_designation || doctor.professional_title,
    account_status: doctor.account_status,
    last_login_at: doctor.last_login_at,
    created_at: doctor.createdAt,
    updated_at: doctor.updatedAt,
  };
};

const doctorCounts = async (doctor) => {
  const [tasks, pendingTasks, completedTasks, woundCases] = await Promise.all([
    Task.count({
      where: {
        assigned_to: doctor.id,
      },
    }),
    Task.count({
      where: {
        assigned_to: doctor.id,
        status: 'pending',
      },
    }),
    Task.count({
      where: {
        assigned_to: doctor.id,
        status: 'completed',
      },
    }),
    WoundCase.findAll({
      attributes: ['reports'],
    }),
  ]);

  return {
    patients: await Patient.count(),
    tasks,
    pending_tasks: pendingTasks,
    completed_tasks: completedTasks,
    reports: woundCases.reduce(
      (total, woundCase) => total + asArray(woundCase.reports).length,
      0
    ),
  };
};

const getProfile = async (req, res) => {
  try {
    const doctor = await findDoctor(req.params.doctorId);

    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }

    return res.status(200).json({
      message: 'Doctor profile fetched successfully',
      profile: publicDoctorProfile(doctor),
      counts: await doctorCounts(doctor),
      menu: [
        'patient_handoff',
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
      message: 'Doctor profile fetch failed',
      error: error.message,
    });
  }
};

const updateProfile = async (req, res) => {
  try {
    const doctor = await findDoctor(req.params.doctorId);

    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }

    const payload = {};
    [
      'first_name',
      'last_name',
      'phone_number',
      'profile_photo_url',
      'organization_hospital',
      'organization_code',
      'professional_title',
    ].forEach((field) => {
      const value = cleanString(getBodyValue(req.body, field));

      if (value !== undefined) {
        payload[field] = value || null;
      }
    });

    if (payload.first_name !== undefined || payload.last_name !== undefined) {
      const firstName =
        payload.first_name !== undefined ? payload.first_name : doctor.first_name;
      const lastName =
        payload.last_name !== undefined ? payload.last_name : doctor.last_name;
      payload.name = `${firstName || ''} ${lastName || ''}`.trim();
    }

    const appSettings = asObject(doctor.app_settings);
    const doctorProfile = asObject(appSettings.doctor_profile);
    const nextDoctorProfile = {
      ...doctorProfile,
    };

    const doctorProfileFields = [
      'doctor_license_number',
      'title_designation',
      'gender',
      'date_of_birth',
    ];

    doctorProfileFields.forEach((field) => {
      const value = cleanString(getBodyValue(req.body, field));

      if (value !== undefined) {
        nextDoctorProfile[field] = value || null;
      }
    });

    if (req.body.specializations !== undefined || req.body.specialization !== undefined) {
      nextDoctorProfile.specializations = asArray(
        req.body.specializations || req.body.specialization
      );
    }

    payload.app_settings = {
      ...appSettings,
      doctor_profile: nextDoctorProfile,
    };

    await doctor.update(payload);

    return res.status(200).json({
      message: 'Doctor profile updated successfully',
      profile: publicDoctorProfile(doctor),
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Doctor profile update failed',
      error: error.message,
    });
  }
};

const getSecuritySettings = async (req, res) => {
  try {
    const doctor = await findDoctor(req.params.doctorId);

    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }

    return res.status(200).json({
      message: 'Doctor security settings fetched successfully',
      security_settings: asObject(
        doctor.security_settings,
        DEFAULT_SECURITY_SETTINGS
      ),
      active_sessions: asArray(doctor.active_sessions),
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Doctor security settings fetch failed',
      error: error.message,
    });
  }
};

const changePassword = async (req, res) => {
  try {
    const doctor = await findDoctor(req.params.doctorId);
    const currentPassword = req.body.current_password || req.body.currentPassword;
    const newPassword = req.body.new_password || req.body.newPassword;
    const confirmPassword = req.body.confirm_password || req.body.confirmPassword;

    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        message: 'current_password, new_password and confirm_password are required',
      });
    }

    if (!verifyPassword(currentPassword, doctor.password_hash)) {
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

    await doctor.update({
      password_hash: hashPassword(newPassword),
      security_settings: {
        ...asObject(doctor.security_settings, DEFAULT_SECURITY_SETTINGS),
        password_last_changed_at: new Date().toISOString(),
      },
    });

    return res.status(200).json({
      message: 'Doctor password changed successfully',
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Doctor password change failed',
      error: error.message,
    });
  }
};

const signOutAllDevices = async (req, res) => {
  try {
    const doctor = await findDoctor(req.params.doctorId);

    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }

    await doctor.update({
      auth_token: null,
      active_sessions: [],
      security_settings: {
        ...asObject(doctor.security_settings, DEFAULT_SECURITY_SETTINGS),
        sign_out_all_devices_at: new Date().toISOString(),
      },
    });

    return res.status(200).json({
      message: 'Doctor signed out from all devices successfully',
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Doctor sign out all devices failed',
      error: error.message,
    });
  }
};

const getNotificationPreferences = async (req, res) => {
  try {
    const doctor = await findDoctor(req.params.doctorId);

    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }

    return res.status(200).json({
      message: 'Doctor notification preferences fetched successfully',
      notification_preferences: asObject(
        doctor.notification_preferences,
        DEFAULT_NOTIFICATION_PREFERENCES
      ),
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Doctor notification preferences fetch failed',
      error: error.message,
    });
  }
};

const updateNotificationPreferences = async (req, res) => {
  try {
    const doctor = await findDoctor(req.params.doctorId);

    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }

    const next = {
      ...asObject(doctor.notification_preferences, DEFAULT_NOTIFICATION_PREFERENCES),
      ...req.body,
    };

    await doctor.update({ notification_preferences: next });

    return res.status(200).json({
      message: 'Doctor notification preferences updated successfully',
      notification_preferences: next,
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Doctor notification preferences update failed',
      error: error.message,
    });
  }
};

const getAppSettings = async (req, res) => {
  try {
    const doctor = await findDoctor(req.params.doctorId);

    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }

    return res.status(200).json({
      message: 'Doctor app settings fetched successfully',
      app_settings: asObject(doctor.app_settings, DEFAULT_APP_SETTINGS),
      app_version: 'v1.0.0',
      build: 24,
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Doctor app settings fetch failed',
      error: error.message,
    });
  }
};

const updateAppSettings = async (req, res) => {
  try {
    const doctor = await findDoctor(req.params.doctorId);

    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }

    const next = {
      ...asObject(doctor.app_settings, DEFAULT_APP_SETTINGS),
      ...req.body,
    };

    await doctor.update({ app_settings: next });

    return res.status(200).json({
      message: 'Doctor app settings updated successfully',
      app_settings: next,
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Doctor app settings update failed',
      error: error.message,
    });
  }
};

const getHandoffSummary = async (req, res) => {
  try {
    const doctor = await findDoctor(req.params.doctorId);

    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }

    const [patients, doctors] = await Promise.all([
      Patient.findAll({ order: [['updatedAt', 'DESC']] }),
      User.findAll({
        where: { role: 'doctor', account_status: 'active' },
        order: [['name', 'ASC']],
      }),
    ]);

    return res.status(200).json({
      message: 'Doctor patient handoff summary fetched successfully',
      patient_count: patients.length,
      patients: patients.map((patient) => ({
        id: patient.id,
        name: `${patient.first_name} ${patient.last_name}`.trim(),
        room: patient.room,
        diagnosis: patient.primary_diagnosis,
      })),
      available_doctors: doctors
        .filter((item) => item.id !== doctor.id)
        .map((item) => ({
          id: item.id,
          name: fullName(item),
          email: item.email,
          professional_title: item.professional_title,
        })),
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Doctor handoff summary fetch failed',
      error: error.message,
    });
  }
};

const initiateHandoff = async (req, res) => {
  try {
    const doctor = await findDoctor(req.params.doctorId);
    const toDoctorId = parseId(req.body.to_doctor_id || req.body.toDoctorId);
    const patientIds = asArray(req.body.patient_ids || req.body.patientIds).map(parseId);

    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }

    if (!toDoctorId || Number.isNaN(toDoctorId)) {
      return res.status(400).json({ message: 'to_doctor_id is required' });
    }

    if (!patientIds.length || patientIds.some((id) => !id || Number.isNaN(id))) {
      return res.status(400).json({ message: 'patient_ids are required' });
    }

    const toDoctor = await findDoctor(toDoctorId);

    if (!toDoctor) {
      return res.status(404).json({ message: 'Target doctor not found' });
    }

    const appSettings = asObject(doctor.app_settings);
    const handoff = {
      id: `doctor_handoff_${Date.now()}`,
      from_doctor_id: doctor.id,
      to_doctor_id: toDoctor.id,
      patient_ids: patientIds,
      notes: cleanString(req.body.notes) || null,
      status: 'initiated',
      created_at: new Date().toISOString(),
    };

    await doctor.update({
      app_settings: {
        ...appSettings,
        doctor_handoffs: [handoff, ...asArray(appSettings.doctor_handoffs)],
      },
    });

    return res.status(201).json({
      message: 'Doctor patient handoff initiated successfully',
      handoff,
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Doctor patient handoff failed',
      error: error.message,
    });
  }
};

const signOut = async (req, res) => {
  try {
    const doctor = await findDoctor(req.params.doctorId);

    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }

    await doctor.update({
      auth_token: null,
      account_status: 'signed_out',
    });

    return res.status(200).json({
      message: 'Doctor signed out successfully',
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Doctor sign out failed',
      error: error.message,
    });
  }
};

const deleteAccount = async (req, res) => {
  try {
    const doctor = await findDoctor(req.params.doctorId);
    const password = req.body.password;
    const reason = cleanString(req.body.reason);
    const confirmDelete = req.body.confirm_delete || req.body.confirmDelete;

    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }

    if (!password) {
      return res.status(400).json({ message: 'password is required' });
    }

    if (!verifyPassword(password, doctor.password_hash)) {
      return res.status(401).json({ message: 'Password is incorrect' });
    }

    if (![true, 'true', 1, '1'].includes(confirmDelete)) {
      return res.status(400).json({ message: 'confirm_delete must be true' });
    }

    const result = await permanentlyDeleteUserAccount(doctor);

    return res.status(200).json({
      message: 'Doctor account permanently deleted successfully',
      deletion: {
        ...result,
        reason: reason || null,
      },
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Doctor account deletion failed',
      error: error.message,
    });
  }
};

module.exports = {
  changePassword,
  deleteAccount,
  getAppSettings,
  getHandoffSummary,
  getNotificationPreferences,
  getProfile,
  getSecuritySettings,
  initiateHandoff,
  signOut,
  signOutAllDevices,
  updateAppSettings,
  updateNotificationPreferences,
  updateProfile,
};
