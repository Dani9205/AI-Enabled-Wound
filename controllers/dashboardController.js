const { Op } = require('sequelize');
const Patient = require('../models/patientModel');
const Task = require('../models/taskModel');
const User = require('../models/userModel');
const WoundCase = require('../models/woundCaseModel');
const Notification = require('../models/notificationModel');

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

const todayDate = () =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });

const priorityRank = (priority) => {
  if (priority === 'high') return 0;
  if (priority === 'medium') return 1;
  if (priority === 'low') return 2;
  return 3;
};

const minutesAgo = (dateValue) => {
  if (!dateValue) {
    return null;
  }

  const diff = Date.now() - new Date(dateValue).getTime();
  if (Number.isNaN(diff) || diff < 0) {
    return null;
  }

  return Math.floor(diff / 60000);
};

const userName = (user) => {
  if (!user) {
    return null;
  }

  return user.name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || null;
};

const initials = (firstName, lastName, fallback = '') => {
  const first = String(firstName || '').trim().charAt(0);
  const last = String(lastName || '').trim().charAt(0);
  const built = `${first}${last}`.trim();

  return (built || String(fallback).slice(0, 2) || 'NA').toUpperCase();
};

const patientResponse = (patient) => ({
  id: patient.id,
  initials: initials(patient.first_name, patient.last_name, patient.mrn),
  first_name: patient.first_name,
  last_name: patient.last_name,
  display_name: `${patient.first_name} ${patient.last_name}`.trim(),
  mrn: patient.mrn,
  room: patient.room,
  wound_type: patient.wound_type,
  primary_diagnosis: patient.primary_diagnosis,
  updated_minutes_ago: minutesAgo(patient.updatedAt),
  created_at: patient.createdAt,
  updated_at: patient.updatedAt,
});

const taskResponse = async (task, patientMap, assigneeMap) => {
  const patient = patientMap.get(task.patient_id);
  const assignee = assigneeMap.get(task.assigned_to);

  return {
    id: task.id,
    title: task.title,
    description: task.description,
    task_type: task.task_type,
    priority: task.priority,
    status: task.status,
    patient_id: task.patient_id,
    patient_name: patient ? `${patient.first_name} ${patient.last_name}`.trim() : null,
    wound_case: task.wound_case || (patient ? patient.wound_type : null),
    assigned_to: task.assigned_to,
    assigned_to_name: userName(assignee),
    due_date: task.due_date,
    due_time: task.due_time,
    task_notes: task.task_notes,
    created_at: task.createdAt,
    updated_at: task.updatedAt,
  };
};

const buildScope = (req) => {
  if (req.user?.role === 'nurse') {
    return { nurseId: req.user.id };
  }

  const nurseId = parseId(req.query.nurse_id || req.query.nurseId || req.query.user_id || req.query.userId);

  return {
    nurseId: Number.isNaN(nurseId) ? null : nurseId,
  };
};

const getScopedPatientIds = async (nurseId) => {
  if (!nurseId) {
    return null;
  }

  const patients = await Patient.findAll({
    where: { nurse_id: nurseId },
    attributes: ['id'],
  });

  return patients.map((patient) => patient.id);
};

const getDashboardStats = async (req, res) => {
  try {
    const { nurseId } = buildScope(req);
    const scopedPatientIds = await getScopedPatientIds(nurseId);
    const patientWhere = nurseId ? { nurse_id: nurseId } : {};
    const woundWhere = scopedPatientIds ? { patient_id: scopedPatientIds } : {};
    const taskWhere = nurseId ? { assigned_by: nurseId } : {};

    const [patients, wounds, high, tasks, notifications] = await Promise.all([
      Patient.count({ where: patientWhere }),
      WoundCase.count({ where: woundWhere }),
      Task.count({ where: { ...taskWhere, priority: 'high', status: 'pending' } }),
      Task.count({ where: { ...taskWhere, status: 'pending' } }),
      Notification.count({
        where: {
          ...(nurseId ? { user_id: nurseId } : {}),
          read_at: null,
          cleared_at: null,
        },
      }),
    ]);

    return res.status(200).json({
      stats: {
        patients,
        wounds,
        high,
        tasks,
        notifications,
      },
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Dashboard stats fetch failed',
      error: error.message,
    });
  }
};

const getTodayTasks = async (req, res) => {
  try {
    const { nurseId } = buildScope(req);
    const limit = Number(req.query.limit) || 10;
    const where = {
      status: 'pending',
      ...(nurseId ? { assigned_by: nurseId } : {}),
    };

    if (req.query.today !== 'false') {
      where[Op.or] = [{ due_date: todayDate() }, { due_date: null }];
    }

    const tasks = await Task.findAll({
      where,
      order: [
        ['due_date', 'ASC'],
        ['due_time', 'ASC'],
        ['createdAt', 'DESC'],
      ],
      limit,
    });
    tasks.sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority));
    const patientIds = [...new Set(tasks.map((task) => task.patient_id).filter(Boolean))];
    const assigneeIds = [...new Set(tasks.map((task) => task.assigned_to).filter(Boolean))];
    const [patients, assignees] = await Promise.all([
      Patient.findAll({ where: { id: patientIds } }),
      User.findAll({ where: { id: assigneeIds } }),
    ]);
    const patientMap = new Map(patients.map((patient) => [patient.id, patient]));
    const assigneeMap = new Map(assignees.map((assignee) => [assignee.id, assignee]));
    const response = await Promise.all(
      tasks.map((task) => taskResponse(task, patientMap, assigneeMap))
    );

    return res.status(200).json({ tasks: response });
  } catch (error) {
    return res.status(500).json({
      message: "Today's tasks fetch failed",
      error: error.message,
    });
  }
};

const getAssignedPatients = async (req, res) => {
  try {
    const { nurseId } = buildScope(req);
    const limit = Number(req.query.limit) || 10;
    const patients = await Patient.findAll({
      where: nurseId ? { nurse_id: nurseId } : {},
      order: [['updatedAt', 'DESC']],
      limit,
    });

    return res.status(200).json({
      patients: patients.map(patientResponse),
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Assigned patients fetch failed',
      error: error.message,
    });
  }
};

const updateResponse = (woundCase, update) => ({
  id: update.id || `${woundCase.id}-${update.created_at || woundCase.updatedAt}`,
  wound_case_id: woundCase.id,
  patient_id: woundCase.patient_id,
  title: update.title || `${woundCase.wound_type} updated`,
  summary: update.summary || update.instructions || update.text || null,
  wound_type: woundCase.wound_type,
  severity_stage: update.severity_stage || woundCase.severity_stage,
  created_by: update.created_by || null,
  created_at: update.created_at || woundCase.updatedAt,
  minutes_ago: minutesAgo(update.created_at || woundCase.updatedAt),
});

const getRecentUpdates = async (req, res) => {
  try {
    const { nurseId } = buildScope(req);
    const scopedPatientIds = await getScopedPatientIds(nurseId);
    const limit = Number(req.query.limit) || 10;
    const woundCases = await WoundCase.findAll({
      where: scopedPatientIds ? { patient_id: scopedPatientIds } : {},
      order: [['updatedAt', 'DESC']],
      limit: Math.max(limit, 20),
    });
    const updates = woundCases
      .flatMap((woundCase) => {
        const caseUpdates = asArray(woundCase.updates);

        if (!caseUpdates.length) {
          return [
            updateResponse(woundCase, {
              title: `${woundCase.wound_type} updated`,
              summary: woundCase.notes,
              created_at: woundCase.last_updated_at || woundCase.updatedAt,
            }),
          ];
        }

        return caseUpdates.map((update) => updateResponse(woundCase, update));
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, limit);

    return res.status(200).json({ updates });
  } catch (error) {
    return res.status(500).json({
      message: 'Recent updates fetch failed',
      error: error.message,
    });
  }
};

const getHomeDashboard = async (req, res) => {
  try {
    const userId = parseId(req.query.user_id || req.query.userId || req.query.nurse_id || req.query.nurseId);
    const user = req.user || (userId && !Number.isNaN(userId) ? await User.findByPk(userId) : null);

    const statsResult = await new Promise((resolve, reject) => {
      const mockRes = {
        status: () => ({
          json: (payload) => resolve(payload),
        }),
      };
      getDashboardStats(req, mockRes).catch(reject);
    });
    const tasksResult = await new Promise((resolve, reject) => {
      const mockRes = {
        status: () => ({
          json: (payload) => resolve(payload),
        }),
      };
      getTodayTasks(req, mockRes).catch(reject);
    });
    const patientsResult = await new Promise((resolve, reject) => {
      const mockRes = {
        status: () => ({
          json: (payload) => resolve(payload),
        }),
      };
      getAssignedPatients(req, mockRes).catch(reject);
    });
    const updatesResult = await new Promise((resolve, reject) => {
      const mockRes = {
        status: () => ({
          json: (payload) => resolve(payload),
        }),
      };
      getRecentUpdates(req, mockRes).catch(reject);
    });

    return res.status(200).json({
      greeting: {
        message: 'Good Morning',
        user_name: userName(user),
        role: user ? user.role : null,
      },
      stats: statsResult.stats,
      todays_tasks: tasksResult.tasks,
      assigned_patients: patientsResult.patients,
      recent_updates: updatesResult.updates,
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Home dashboard fetch failed',
      error: error.message,
    });
  }
};

module.exports = {
  getAssignedPatients,
  getDashboardStats,
  getHomeDashboard,
  getRecentUpdates,
  getTodayTasks,
};
