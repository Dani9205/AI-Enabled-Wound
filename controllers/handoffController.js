const Patient = require('../models/patientModel');
const PatientHandoff = require('../models/patientHandoffModel');
const Task = require('../models/taskModel');
const User = require('../models/userModel');
const WoundCase = require('../models/woundCaseModel');
const sequelize = require('../config/db');

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

const asObject = (value) => {
  if (!value) {
    return {};
  }

  if (typeof value === 'object' && !Array.isArray(value)) {
    return value;
  }

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

const displayName = (user) =>
  user
    ? user.name || `${user.first_name || ''} ${user.last_name || ''}`.trim()
    : null;

const initials = (firstName, lastName, fallback = '') => {
  const value = `${String(firstName || '').charAt(0)}${String(lastName || '').charAt(0)}`;
  return (value.trim() || String(fallback).slice(0, 2) || 'NA').toUpperCase();
};

const userResponse = (user) => ({
  id: user.id,
  initials: initials(user.first_name, user.last_name, user.name),
  name: displayName(user),
  first_name: user.first_name,
  last_name: user.last_name,
  email: user.email,
  role: user.role,
  shift: user.shift,
  professional_title: user.professional_title,
  organization_hospital: user.organization_hospital,
});

const patientCard = async (patient, selectedIds = []) => {
  const [taskCount, woundCase] = await Promise.all([
    Task.count({
      where: {
        patient_id: patient.id,
        status: 'pending',
      },
    }),
    WoundCase.findOne({
      where: { patient_id: patient.id },
      order: [['updatedAt', 'DESC']],
    }),
  ]);

  return {
    id: patient.id,
    initials: initials(patient.first_name, patient.last_name, patient.mrn),
    first_name: patient.first_name,
    last_name: patient.last_name,
    display_name: `${patient.first_name} ${patient.last_name}`.trim(),
    room: patient.room,
    wound_type: woundCase ? woundCase.wound_type : patient.wound_type,
    severity_stage: woundCase ? woundCase.severity_stage : null,
    task_count: taskCount,
    selected: selectedIds.includes(patient.id),
  };
};

const handoffResponse = async (handoff) => {
  const [fromNurse, toNurse, patients, pendingTasks] = await Promise.all([
    User.findByPk(handoff.from_nurse_id),
    handoff.to_nurse_id ? User.findByPk(handoff.to_nurse_id) : null,
    Patient.findAll({ where: { id: asArray(handoff.patient_ids) } }),
    Task.findAll({ where: { id: asArray(handoff.pending_task_ids) } }),
  ]);

  return {
    id: handoff.id,
    from_nurse: fromNurse ? userResponse(fromNurse) : null,
    to_nurse: toNurse ? userResponse(toNurse) : null,
    patient_ids: asArray(handoff.patient_ids),
    pending_task_ids: asArray(handoff.pending_task_ids),
    patient_count: asArray(handoff.patient_ids).length,
    pending_task_count: asArray(handoff.pending_task_ids).length,
    patients: await Promise.all(patients.map((patient) => patientCard(patient))),
    pending_tasks: pendingTasks.map((task) => ({
      id: task.id,
      title: task.title,
      priority: task.priority,
      status: task.status,
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

const getHandoffPatients = async (req, res) => {
  try {
    const nurseId = parseId(req.params.nurseId || req.query.nurse_id || req.query.nurseId);

    if (!nurseId || Number.isNaN(nurseId)) {
      return res.status(400).json({ message: 'nurse_id is required' });
    }

    const selectedIds = asArray(req.query.selected_ids || req.query.selectedIds).map(parseId);
    const patients = await Patient.findAll({
      where: { nurse_id: nurseId },
      order: [['updatedAt', 'DESC']],
    });

    return res.status(200).json({
      patients: await Promise.all(patients.map((patient) => patientCard(patient, selectedIds))),
      selected_count: selectedIds.filter(Boolean).length,
      total_count: patients.length,
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Handoff patients fetch failed',
      error: error.message,
    });
  }
};

const getAvailableNurses = async (req, res) => {
  try {
    const currentNurseId = parseId(
      req.params.nurseId || req.query.current_nurse_id || req.query.currentNurseId
    );
    const nurses = await User.findAll({
      where: { role: 'nurse' },
      order: [['first_name', 'ASC']],
    });

    return res.status(200).json({
      nurses: nurses
        .filter((nurse) => nurse.id !== currentNurseId)
        .map((nurse) => ({
          ...userResponse(nurse),
          available: nurse.account_status !== 'deleted',
        })),
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Available nurses fetch failed',
      error: error.message,
    });
  }
};

const createHandoff = async (req, res) => {
  try {
    const fromNurseId = parseId(req.body.from_nurse_id || req.body.fromNurseId);
    const patientIds = asArray(req.body.patient_ids || req.body.patientIds).map(parseId);

    if (!fromNurseId || Number.isNaN(fromNurseId)) {
      return res.status(400).json({ message: 'from_nurse_id is required' });
    }

    if (!patientIds.length || patientIds.some((id) => !id || Number.isNaN(id))) {
      return res.status(400).json({ message: 'patient_ids are required' });
    }

    const fromNurse = await User.findByPk(fromNurseId);

    if (!fromNurse) {
      return res.status(404).json({ message: 'From nurse not found' });
    }

    const patients = await Patient.findAll({
      where: {
        id: patientIds,
        nurse_id: fromNurseId,
      },
    });

    if (patients.length !== patientIds.length) {
      return res.status(400).json({
        message: 'All selected patients must belong to the from nurse',
      });
    }

    const pendingTasks = await Task.findAll({
      where: {
        patient_id: patientIds,
        status: 'pending',
      },
    });

    const handoff = await PatientHandoff.create({
      from_nurse_id: fromNurseId,
      patient_ids: patientIds,
      pending_task_ids: pendingTasks.map((task) => task.id),
      shift_label: cleanString(req.body.shift_label || req.body.shiftLabel) || null,
      shift_ends_at: req.body.shift_ends_at || req.body.shiftEndsAt || null,
      status: 'draft',
    });

    return res.status(201).json({
      message: 'Handoff draft created successfully',
      handoff: await handoffResponse(handoff),
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Handoff draft creation failed',
      error: error.message,
    });
  }
};

const selectHandoffNurse = async (req, res) => {
  try {
    const handoff = await PatientHandoff.findByPk(req.params.id);
    const toNurseId = parseId(req.body.to_nurse_id || req.body.toNurseId);

    if (!handoff) {
      return res.status(404).json({ message: 'Handoff not found' });
    }

    if (!toNurseId || Number.isNaN(toNurseId)) {
      return res.status(400).json({ message: 'to_nurse_id is required' });
    }

    if (toNurseId === handoff.from_nurse_id) {
      return res.status(400).json({ message: 'to_nurse_id must be different' });
    }

    const toNurse = await User.findByPk(toNurseId);

    if (!toNurse || toNurse.role !== 'nurse') {
      return res.status(404).json({ message: 'Target nurse not found' });
    }

    await handoff.update({
      to_nurse_id: toNurseId,
      status: 'ready',
    });

    return res.status(200).json({
      message: 'Handoff nurse selected successfully',
      handoff: await handoffResponse(handoff),
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Handoff nurse selection failed',
      error: error.message,
    });
  }
};

const addHandoffNotes = async (req, res) => {
  try {
    const handoff = await PatientHandoff.findByPk(req.params.id);

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
      message: 'Handoff notes saved successfully',
      handoff: await handoffResponse(handoff),
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Handoff notes save failed',
      error: error.message,
    });
  }
};

const confirmHandoff = async (req, res) => {
  try {
    const handoff = await PatientHandoff.findByPk(req.params.id);

    if (!handoff) {
      return res.status(404).json({ message: 'Handoff not found' });
    }

    if (!handoff.to_nurse_id) {
      return res.status(400).json({ message: 'Select a receiving nurse first' });
    }

    if (handoff.status === 'completed') {
      return res.status(200).json({
        message: 'Handoff already completed',
        handoff: await handoffResponse(handoff),
      });
    }

    let completedHandoff = handoff;
    await sequelize.transaction(async (transaction) => {
      const patientIds = asArray(handoff.patient_ids);
      const taskIds = asArray(handoff.pending_task_ids);
      const [patientUpdateCount] = await Patient.update(
        { nurse_id: handoff.to_nurse_id },
        {
          where: {
            id: patientIds,
            nurse_id: handoff.from_nurse_id,
          },
          transaction,
        }
      );
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
            patients_transferred: patientUpdateCount,
            tasks_transferred: taskUpdateCount,
            completed_at: new Date().toISOString(),
          },
        },
        { transaction }
      );
    });

    return res.status(200).json({
      message: 'Handoff completed successfully',
      handoff: await handoffResponse(completedHandoff),
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Handoff confirmation failed',
      error: error.message,
    });
  }
};

const getHandoff = async (req, res) => {
  try {
    const handoff = await PatientHandoff.findByPk(req.params.id);

    if (!handoff) {
      return res.status(404).json({ message: 'Handoff not found' });
    }

    return res.status(200).json({ handoff: await handoffResponse(handoff) });
  } catch (error) {
    return res.status(500).json({
      message: 'Handoff fetch failed',
      error: error.message,
    });
  }
};

const getHandoffSuccess = async (req, res) => {
  try {
    const handoff = await PatientHandoff.findByPk(req.params.id);

    if (!handoff) {
      return res.status(404).json({ message: 'Handoff not found' });
    }

    const response = await handoffResponse(handoff);

    return res.status(200).json({
      success: handoff.status === 'completed',
      message:
        handoff.status === 'completed'
          ? 'Handoff successful'
          : 'Handoff has not been completed yet',
      summary: {
        from_nurse: response.from_nurse,
        to_nurse: response.to_nurse,
        patients: response.patient_count,
        tasks: response.pending_task_count,
        shift_label: response.shift_label,
        completed_at: response.completed_at,
      },
      handoff: response,
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Handoff success fetch failed',
      error: error.message,
    });
  }
};

module.exports = {
  addHandoffNotes,
  confirmHandoff,
  createHandoff,
  getAvailableNurses,
  getHandoff,
  getHandoffPatients,
  getHandoffSuccess,
  selectHandoffNurse,
};
