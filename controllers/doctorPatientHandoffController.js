const { Op } = require('sequelize');
const Patient = require('../models/patientModel');
const PatientHandoff = require('../models/patientHandoffModel');
const Task = require('../models/taskModel');
const User = require('../models/userModel');
const WoundCase = require('../models/woundCaseModel');
const sequelize = require('../config/db');

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

const asObject = (value) => {
  if (!value) return {};

  if (typeof value === 'object' && !Array.isArray(value)) return value;

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch (error) {
      return {};
    }
  }

  return {};
};

const fullName = (user) =>
  user ? user.name || `${user.first_name || ''} ${user.last_name || ''}`.trim() : null;

const initials = (firstName, lastName, fallback = '') => {
  const value = `${String(firstName || '').charAt(0)}${String(lastName || '').charAt(0)}`;
  return (value.trim() || String(fallback).slice(0, 2) || 'NA').toUpperCase();
};

const patientName = (patient) =>
  `${patient.first_name || ''} ${patient.last_name || ''}`.trim();

const userResponse = (user) => ({
  id: user.id,
  initials: initials(user.first_name, user.last_name, user.name),
  name: fullName(user),
  first_name: user.first_name,
  last_name: user.last_name,
  email: user.email,
  role: user.role,
  shift: user.shift,
  professional_title: user.professional_title,
  organization_hospital: user.organization_hospital,
  available: user.account_status === 'active',
});

const getPendingTasks = (patientIds) =>
  Task.findAll({
    where: {
      patient_id: patientIds,
      status: 'pending',
    },
    order: [['due_date', 'ASC']],
  });

const patientCard = async (patient, selectedIds = []) => {
  const [tasks, woundCase] = await Promise.all([
    getPendingTasks([patient.id]),
    WoundCase.findOne({
      where: { patient_id: patient.id },
      order: [['last_updated_at', 'DESC']],
    }),
  ]);

  return {
    id: patient.id,
    initials: initials(patient.first_name, patient.last_name, patient.mrn),
    name: patientName(patient),
    first_name: patient.first_name,
    last_name: patient.last_name,
    room: patient.room,
    diagnosis: patient.primary_diagnosis,
    wound_type: woundCase ? woundCase.wound_type : patient.wound_type,
    severity_stage: woundCase ? woundCase.severity_stage : null,
    pending_task_count: tasks.length,
    selected: selectedIds.includes(patient.id),
  };
};

const handoffResponse = async (handoff) => {
  const patientIds = asArray(handoff.patient_ids).map(parseId).filter(Boolean);
  const pendingTaskIds = asArray(handoff.pending_task_ids).map(parseId).filter(Boolean);
  const [fromUser, toUser, patients, pendingTasks] = await Promise.all([
    User.findByPk(handoff.from_nurse_id),
    handoff.to_nurse_id ? User.findByPk(handoff.to_nurse_id) : null,
    patientIds.length ? Patient.findAll({ where: { id: patientIds } }) : [],
    pendingTaskIds.length ? Task.findAll({ where: { id: pendingTaskIds } }) : [],
  ]);

  return {
    id: handoff.id,
    from_staff: fromUser ? userResponse(fromUser) : null,
    to_staff: toUser ? userResponse(toUser) : null,
    patient_ids: patientIds,
    pending_task_ids: pendingTaskIds,
    patient_count: patientIds.length,
    pending_task_count: pendingTaskIds.length,
    patients: await Promise.all(patients.map((patient) => patientCard(patient, patientIds))),
    pending_tasks: pendingTasks.map((task) => ({
      id: task.id,
      title: task.title,
      priority: task.priority,
      patient_id: task.patient_id,
      due_date: task.due_date,
      due_time: task.due_time,
    })),
    general_notes: handoff.general_notes,
    per_patient_notes: asObject(handoff.per_patient_notes),
    shift_label: handoff.shift_label,
    shift_ends_at: handoff.shift_ends_at,
    status: handoff.status,
    completed_at: handoff.completed_at,
    summary: asObject(handoff.summary),
    created_at: handoff.createdAt,
    updated_at: handoff.updatedAt,
  };
};

const getSelectablePatients = async (req, res) => {
  try {
    const doctorId = parseId(req.params.doctorId || req.query.doctor_id);
    const selectedIds = asArray(req.query.selected_ids || req.query.selectedIds)
      .map(parseId)
      .filter(Boolean);

    if (!doctorId || Number.isNaN(doctorId)) {
      return res.status(400).json({ message: 'doctor_id is required' });
    }

    const doctor = await User.findByPk(doctorId);

    if (!doctor || doctor.role !== 'doctor') {
      return res.status(404).json({ message: 'Doctor not found' });
    }

    const doctorTasks = await Task.findAll({
      where: {
        [Op.or]: [{ assigned_by: doctorId }, { assigned_to: doctorId }],
      },
      attributes: ['patient_id'],
    });
    const patientIds = [...new Set(doctorTasks.map((task) => task.patient_id).filter(Boolean))];
    const patients = patientIds.length
      ? await Patient.findAll({
          where: { id: patientIds },
          order: [['updatedAt', 'DESC']],
        })
      : await Patient.findAll({ order: [['updatedAt', 'DESC']] });

    return res.status(200).json({
      message: 'Doctor handoff patients fetched successfully',
      selected_count: selectedIds.length,
      total_count: patients.length,
      patients: await Promise.all(
        patients.map((patient) => patientCard(patient, selectedIds))
      ),
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Doctor handoff patients fetch failed',
      error: error.message,
    });
  }
};

const getAvailableStaff = async (req, res) => {
  try {
    const doctorId = parseId(req.params.doctorId || req.query.doctor_id);
    const role = cleanString(req.query.role || 'nurse');
    const validRoles = role === 'all' ? ['nurse', 'doctor'] : [role];

    if (!doctorId || Number.isNaN(doctorId)) {
      return res.status(400).json({ message: 'doctor_id is required' });
    }

    if (!validRoles.every((item) => ['nurse', 'doctor'].includes(item))) {
      return res.status(400).json({ message: 'role must be nurse, doctor, or all' });
    }

    const users = await User.findAll({
      where: {
        role: { [Op.in]: validRoles },
        account_status: { [Op.ne]: 'deleted' },
      },
      order: [['first_name', 'ASC']],
    });

    return res.status(200).json({
      message: 'Doctor handoff available staff fetched successfully',
      staff: users
        .filter((user) => Number(user.id) !== Number(doctorId))
        .map(userResponse),
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Doctor handoff available staff fetch failed',
      error: error.message,
    });
  }
};

const createHandoffDraft = async (req, res) => {
  try {
    const doctorId = parseId(req.body.doctor_id || req.body.doctorId);
    const patientIds = asArray(req.body.patient_ids || req.body.patientIds)
      .map(parseId)
      .filter(Boolean);

    if (!doctorId || Number.isNaN(doctorId)) {
      return res.status(400).json({ message: 'doctor_id is required' });
    }

    if (!patientIds.length) {
      return res.status(400).json({ message: 'patient_ids are required' });
    }

    const doctor = await User.findByPk(doctorId);

    if (!doctor || doctor.role !== 'doctor') {
      return res.status(404).json({ message: 'Doctor not found' });
    }

    const patients = await Patient.findAll({ where: { id: patientIds } });

    if (patients.length !== patientIds.length) {
      return res.status(404).json({ message: 'One or more patients not found' });
    }

    const pendingTasks = await getPendingTasks(patientIds);
    const handoff = await PatientHandoff.create({
      from_nurse_id: doctorId,
      patient_ids: patientIds,
      pending_task_ids: pendingTasks.map((task) => task.id),
      shift_label: cleanString(req.body.shift_label || req.body.shiftLabel) || null,
      shift_ends_at: req.body.shift_ends_at || req.body.shiftEndsAt || null,
      status: 'draft',
    });

    return res.status(201).json({
      message: 'Doctor handoff draft created successfully',
      handoff: await handoffResponse(handoff),
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Doctor handoff draft creation failed',
      error: error.message,
    });
  }
};

const selectReceivingStaff = async (req, res) => {
  try {
    const handoff = await PatientHandoff.findByPk(req.params.handoffId);
    const toStaffId = parseId(req.body.to_staff_id || req.body.toStaffId || req.body.to_nurse_id);

    if (!handoff) {
      return res.status(404).json({ message: 'Handoff not found' });
    }

    if (!toStaffId || Number.isNaN(toStaffId)) {
      return res.status(400).json({ message: 'to_staff_id is required' });
    }

    if (Number(toStaffId) === Number(handoff.from_nurse_id)) {
      return res.status(400).json({ message: 'Receiving staff must be different' });
    }

    const toStaff = await User.findByPk(toStaffId);

    if (!toStaff || !['nurse', 'doctor'].includes(toStaff.role)) {
      return res.status(404).json({ message: 'Receiving staff not found' });
    }

    await handoff.update({
      to_nurse_id: toStaffId,
      status: 'ready',
    });

    return res.status(200).json({
      message: 'Doctor handoff receiving staff selected successfully',
      handoff: await handoffResponse(handoff),
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Doctor handoff receiving staff selection failed',
      error: error.message,
    });
  }
};

const addHandoffNotes = async (req, res) => {
  try {
    const handoff = await PatientHandoff.findByPk(req.params.handoffId);

    if (!handoff) {
      return res.status(404).json({ message: 'Handoff not found' });
    }

    await handoff.update({
      general_notes: cleanString(req.body.general_notes || req.body.generalNotes) || null,
      per_patient_notes: asObject(req.body.per_patient_notes || req.body.perPatientNotes),
      shift_label: cleanString(req.body.shift_label || req.body.shiftLabel) || handoff.shift_label,
      shift_ends_at: req.body.shift_ends_at || req.body.shiftEndsAt || handoff.shift_ends_at,
    });

    return res.status(200).json({
      message: 'Doctor handoff notes saved successfully',
      handoff: await handoffResponse(handoff),
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Doctor handoff notes save failed',
      error: error.message,
    });
  }
};

const getHandoffDetails = async (req, res) => {
  try {
    const handoff = await PatientHandoff.findByPk(req.params.handoffId);

    if (!handoff) {
      return res.status(404).json({ message: 'Handoff not found' });
    }

    return res.status(200).json({
      message: 'Doctor handoff details fetched successfully',
      handoff: await handoffResponse(handoff),
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Doctor handoff details fetch failed',
      error: error.message,
    });
  }
};

const confirmHandoff = async (req, res) => {
  try {
    const handoff = await PatientHandoff.findByPk(req.params.handoffId);

    if (!handoff) {
      return res.status(404).json({ message: 'Handoff not found' });
    }

    if (!handoff.to_nurse_id) {
      return res.status(400).json({ message: 'Select receiving staff first' });
    }

    if (handoff.status === 'completed') {
      return res.status(200).json({
        message: 'Doctor handoff already completed',
        handoff: await handoffResponse(handoff),
      });
    }

    let completedHandoff = handoff;
    await sequelize.transaction(async (transaction) => {
      const patientIds = asArray(handoff.patient_ids).map(parseId).filter(Boolean);
      const taskIds = asArray(handoff.pending_task_ids).map(parseId).filter(Boolean);
      const [taskUpdateCount] = await Task.update(
        { assigned_to: handoff.to_nurse_id },
        {
          where: {
            id: taskIds,
            status: 'pending',
          },
          transaction,
        }
      );

      completedHandoff = await handoff.update(
        {
          status: 'completed',
          completed_at: new Date(),
          summary: {
            patients_transferred: patientIds.length,
            tasks_transferred: taskUpdateCount,
            shift_start: cleanString(req.body.shift_start || req.body.shiftStart) || null,
            completed_at: new Date().toISOString(),
          },
        },
        { transaction }
      );
    });

    return res.status(200).json({
      message: 'Doctor handoff completed successfully',
      handoff: await handoffResponse(completedHandoff),
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Doctor handoff confirmation failed',
      error: error.message,
    });
  }
};

const getHandoffSuccess = async (req, res) => {
  try {
    const handoff = await PatientHandoff.findByPk(req.params.handoffId);

    if (!handoff) {
      return res.status(404).json({ message: 'Handoff not found' });
    }

    const response = await handoffResponse(handoff);

    return res.status(200).json({
      message:
        handoff.status === 'completed'
          ? 'Handoff successful'
          : 'Handoff has not been completed yet',
      success: handoff.status === 'completed',
      summary: {
        from_staff: response.from_staff,
        to_staff: response.to_staff,
        patients: response.patient_count,
        tasks: response.pending_task_count,
        shift_label: response.shift_label,
        completed_at: response.completed_at,
      },
      handoff: response,
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Doctor handoff success fetch failed',
      error: error.message,
    });
  }
};

module.exports = {
  addHandoffNotes,
  confirmHandoff,
  createHandoffDraft,
  getAvailableStaff,
  getHandoffDetails,
  getHandoffSuccess,
  getSelectablePatients,
  selectReceivingStaff,
};
