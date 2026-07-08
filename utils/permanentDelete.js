const { Op } = require('sequelize');
const sequelize = require('../config/db');
const Notification = require('../models/notificationModel');
const Patient = require('../models/patientModel');
const PatientHandoff = require('../models/patientHandoffModel');
const Subscription = require('../models/subscriptionModel');
const Task = require('../models/taskModel');
const User = require('../models/userModel');
const WoundCase = require('../models/woundCaseModel');

const asObject = (value) => {
  if (!value) return {};

  if (typeof value === 'object' && !Array.isArray(value)) {
    return value;
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch (error) {
      return {};
    }
  }

  return {};
};

const getPatientMrnFromUser = (user) => {
  const appSettings = asObject(user.app_settings);
  const patientProfile = asObject(appSettings.patient_profile);

  return patientProfile.patient_id_mrn || patientProfile.mrn || null;
};

const permanentlyDeletePatientRecord = async (patient, options = {}) => {
  if (!patient) {
    return { deleted_patient: false, deleted_wound_cases: 0, deleted_tasks: 0 };
  }

  const run = async (transaction) => {
    const deletedTasks = await Task.destroy({
      where: { patient_id: patient.id },
      transaction,
    });
    const deletedWoundCases = await WoundCase.destroy({
      where: { patient_id: patient.id },
      transaction,
    });

    await patient.destroy({ transaction });

    return {
      deleted_patient: true,
      deleted_wound_cases: deletedWoundCases,
      deleted_tasks: deletedTasks,
    };
  };

  return options.transaction ? run(options.transaction) : sequelize.transaction(run);
};

const permanentlyDeleteLinkedPatientRecord = async (user, transaction) => {
  if (user.role !== 'patient') {
    return { deleted_patient: false, deleted_wound_cases: 0, deleted_tasks: 0 };
  }

  const mrn = getPatientMrnFromUser(user);

  if (!mrn) {
    return { deleted_patient: false, deleted_wound_cases: 0, deleted_tasks: 0 };
  }

  const patient = await Patient.findOne({ where: { mrn }, transaction });
  return permanentlyDeletePatientRecord(patient, { transaction });
};

const permanentlyDeleteUserAccount = async (user) => {
  return sequelize.transaction(async (transaction) => {
    const linkedPatientResult = await permanentlyDeleteLinkedPatientRecord(user, transaction);

    await Promise.all([
      Notification.destroy({ where: { user_id: user.id }, transaction }),
      Subscription.destroy({ where: { user_id: user.id }, transaction }),
      PatientHandoff.destroy({
        where: {
          [Op.or]: [{ from_nurse_id: user.id }, { to_nurse_id: user.id }],
        },
        transaction,
      }),
      Patient.update({ nurse_id: null }, { where: { nurse_id: user.id }, transaction }),
      Task.update({ assigned_by: null }, { where: { assigned_by: user.id }, transaction }),
      Task.update({ assigned_to: null }, { where: { assigned_to: user.id }, transaction }),
      User.update({ reviewed_by: null }, { where: { reviewed_by: user.id }, transaction }),
    ]);

    await user.destroy({ transaction });

    return {
      deleted_user: true,
      ...linkedPatientResult,
    };
  });
};

module.exports = {
  permanentlyDeletePatientRecord,
  permanentlyDeleteUserAccount,
};
