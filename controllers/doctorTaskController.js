const { Op } = require('sequelize');
const Patient = require('../models/patientModel');
const Task = require('../models/taskModel');
const User = require('../models/userModel');
const WoundCase = require('../models/woundCaseModel');

const VALID_TASK_TYPES = ['all', 'wound', 'documentation', 'follow_up', 'other'];
const VALID_PRIORITIES = ['low', 'medium', 'high'];
const VALID_STATUSES = ['pending', 'completed', 'cancelled'];

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

const fullName = (user) =>
  user ? user.name || `${user.first_name || ''} ${user.last_name || ''}`.trim() : null;

const patientName = (patient) =>
  patient ? `${patient.first_name || ''} ${patient.last_name || ''}`.trim() : null;

const initials = (name) =>
  String(name || '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

const getDoctorId = (req) =>
  parseId(req.query.doctor_id || req.body.doctor_id || req.params.doctorId);

const getUsersById = async (ids) => {
  const uniqueIds = [...new Set(ids.filter(Boolean).map(Number))];

  if (!uniqueIds.length) return new Map();

  const users = await User.findAll({
    where: {
      id: uniqueIds,
    },
  });

  return new Map(users.map((user) => [Number(user.id), user]));
};

const getPatientsById = async (ids) => {
  const uniqueIds = [...new Set(ids.filter(Boolean).map(Number))];

  if (!uniqueIds.length) return new Map();

  const patients = await Patient.findAll({
    where: {
      id: uniqueIds,
    },
  });

  return new Map(patients.map((patient) => [Number(patient.id), patient]));
};

const getWoundCaseMap = async (tasks) => {
  const patientIds = [...new Set(tasks.map((task) => task.patient_id).filter(Boolean))];

  if (!patientIds.length) return new Map();

  const woundCases = await WoundCase.findAll({
    where: {
      patient_id: patientIds,
    },
    order: [['last_updated_at', 'DESC']],
  });
  const map = new Map();

  woundCases.forEach((woundCase) => {
    const key = Number(woundCase.patient_id);

    if (!map.has(key)) {
      map.set(key, []);
    }

    map.get(key).push(woundCase);
  });

  return map;
};

const woundCaseLabel = (woundCase) =>
  woundCase
    ? `${woundCase.wound_type}${woundCase.body_location ? ` - ${woundCase.body_location}` : ''}`
    : null;

const formatUserOption = (user) => ({
  id: user.id,
  name: fullName(user),
  initials: initials(fullName(user)),
  role: user.role,
  professional_title: user.professional_title,
  shift: user.shift,
});

const formatTask = (task, context = {}) => {
  const patient = context.patientsById?.get(Number(task.patient_id));
  const assignedBy = context.usersById?.get(Number(task.assigned_by));
  const assignedTo = context.usersById?.get(Number(task.assigned_to));
  const patientWoundCases = context.woundCasesByPatientId?.get(Number(task.patient_id)) || [];
  const woundCase =
    patientWoundCases.find((item) => woundCaseLabel(item) === task.wound_case) ||
    patientWoundCases[0] ||
    null;

  return {
    id: task.id,
    title: task.title,
    description: task.description,
    task_type: task.task_type,
    priority: task.priority,
    status: task.status,
    patient_id: task.patient_id,
    patient: patient
      ? {
          id: patient.id,
          name: patientName(patient),
          room: patient.room,
          diagnosis: patient.primary_diagnosis,
        }
      : null,
    wound_case: task.wound_case,
    wound_case_detail: woundCase
      ? {
          id: woundCase.id,
          wound_type: woundCase.wound_type,
          severity_stage: woundCase.severity_stage,
          body_location: woundCase.body_location,
        }
      : null,
    assigned_by: assignedBy ? formatUserOption(assignedBy) : null,
    assigned_to: assignedTo ? formatUserOption(assignedTo) : null,
    due_date: task.due_date,
    due_time: task.due_time,
    task_notes: task.task_notes,
    work_notes: task.work_notes,
    completed_at: task.completed_at,
    created_at: task.createdAt,
    updated_at: task.updatedAt,
  };
};

const buildTaskPayload = (body, { partial = false } = {}) => {
  const payload = {};
  const title = cleanString(body.title || body.task_title || body.taskTitle);
  const patientId = parseId(body.patient_id || body.patientId);
  const assignedBy = parseId(body.assigned_by || body.assignedBy || body.doctor_id);
  const assignedTo = parseId(body.assigned_to || body.assignedTo);
  const taskType = cleanString(body.task_type || body.taskType);
  const priority = cleanString(body.priority);
  const status = cleanString(body.status);

  if (title !== undefined || !partial) payload.title = title || null;
  if (body.description !== undefined || !partial) {
    payload.description = cleanString(body.description) || null;
  }
  if (taskType !== undefined || !partial) {
    payload.task_type = taskType ? taskType.toLowerCase() : 'wound';
  }
  if (priority !== undefined || !partial) {
    payload.priority = priority ? priority.toLowerCase() : 'medium';
  }
  if (status !== undefined || !partial) {
    payload.status = status ? status.toLowerCase() : 'pending';
  }
  if (patientId !== null || !partial) payload.patient_id = patientId;
  if (body.wound_case !== undefined || body.woundCase !== undefined || !partial) {
    payload.wound_case = cleanString(body.wound_case || body.woundCase) || null;
  }
  if (assignedBy !== null || !partial) payload.assigned_by = assignedBy;
  if (assignedTo !== null || !partial) payload.assigned_to = assignedTo;
  if (body.due_date !== undefined || body.dueDate !== undefined || !partial) {
    payload.due_date = cleanString(body.due_date || body.dueDate) || null;
  }
  if (body.due_time !== undefined || body.dueTime !== undefined || !partial) {
    payload.due_time = cleanString(body.due_time || body.dueTime) || null;
  }
  if (body.task_notes !== undefined || body.taskNotes !== undefined || !partial) {
    payload.task_notes = cleanString(body.task_notes || body.taskNotes) || null;
  }
  if (body.work_notes !== undefined || body.workNotes !== undefined) {
    payload.work_notes = cleanString(body.work_notes || body.workNotes) || null;
  }

  if (payload.status === 'completed') {
    payload.completed_at = new Date();
  }

  if (payload.status && payload.status !== 'completed') {
    payload.completed_at = null;
  }

  return payload;
};

const validateTaskPayload = (payload, { partial = false } = {}) => {
  if (!partial && !payload.title) return 'Task title is required';
  if (!partial && !payload.patient_id) return 'patient_id is required';
  if (!partial && !payload.assigned_by) return 'doctor_id or assigned_by is required';
  if (!partial && !payload.assigned_to) return 'assigned_to is required';

  const invalidIdField = ['patient_id', 'assigned_by', 'assigned_to'].find((field) =>
    Number.isNaN(payload[field])
  );

  if (invalidIdField) return `${invalidIdField} must be a valid positive id`;

  if (payload.task_type && !VALID_TASK_TYPES.includes(payload.task_type)) {
    return `task_type must be one of: ${VALID_TASK_TYPES.join(', ')}`;
  }

  if (payload.priority && !VALID_PRIORITIES.includes(payload.priority)) {
    return `priority must be one of: ${VALID_PRIORITIES.join(', ')}`;
  }

  if (payload.status && !VALID_STATUSES.includes(payload.status)) {
    return `status must be one of: ${VALID_STATUSES.join(', ')}`;
  }

  return null;
};

const ensureReferences = async (payload) => {
  if (payload.patient_id) {
    const patient = await Patient.findByPk(payload.patient_id);
    if (!patient) return 'Patient not found';
  }

  if (payload.assigned_by) {
    const assignedBy = await User.findByPk(payload.assigned_by);
    if (!assignedBy) return 'Assigned by user not found';
    if (assignedBy.role !== 'doctor') return 'assigned_by must belong to a doctor';
  }

  if (payload.assigned_to) {
    const assignedTo = await User.findByPk(payload.assigned_to);
    if (!assignedTo) return 'Assigned to user not found';
    if (!['nurse', 'doctor'].includes(assignedTo.role)) {
      return 'assigned_to must belong to a nurse or doctor';
    }
  }

  return null;
};

const buildTaskContext = async (tasks) => {
  const patientsById = await getPatientsById(tasks.map((task) => task.patient_id));
  const usersById = await getUsersById([
    ...tasks.map((task) => task.assigned_by),
    ...tasks.map((task) => task.assigned_to),
  ]);
  const woundCasesByPatientId = await getWoundCaseMap(tasks);

  return {
    patientsById,
    usersById,
    woundCasesByPatientId,
  };
};

const getDashboard = async (req, res) => {
  try {
    const doctorId = getDoctorId(req);
    const where = doctorId
      ? {
          [Op.or]: [{ assigned_by: doctorId }, { assigned_to: doctorId }],
        }
      : {};
    const tasks = await Task.findAll({
      where,
      order: [['createdAt', 'DESC']],
    });
    const context = await buildTaskContext(tasks);
    const pendingTasks = tasks.filter((task) => task.status === 'pending');
    const completedTasks = tasks.filter((task) => task.status === 'completed');

    return res.status(200).json({
      message: 'Doctor task dashboard fetched successfully',
      stats: {
        total: tasks.length,
        pending: pendingTasks.length,
        completed: completedTasks.length,
      },
      tabs: ['all_tasks', 'assigned_to_me', 'created_by_me'],
      pending_tasks: pendingTasks.map((task) => formatTask(task, context)),
      completed_tasks: completedTasks.map((task) => formatTask(task, context)),
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Doctor task dashboard fetch failed',
      error: error.message,
    });
  }
};

const getTasks = async (req, res) => {
  try {
    const doctorId = getDoctorId(req);
    const tab = cleanString(req.query.tab || 'all_tasks');
    const where = {};

    if (doctorId && tab === 'assigned_to_me') {
      where.assigned_to = doctorId;
    } else if (doctorId && tab === 'created_by_me') {
      where.assigned_by = doctorId;
    } else if (doctorId) {
      where[Op.or] = [{ assigned_by: doctorId }, { assigned_to: doctorId }];
    }

    if (req.query.status) where.status = String(req.query.status).toLowerCase();
    if (req.query.priority) where.priority = String(req.query.priority).toLowerCase();

    if (req.query.search) {
      where.title = { [Op.like]: `%${req.query.search}%` };
    }

    const tasks = await Task.findAll({
      where,
      order: [['createdAt', 'DESC']],
    });
    const context = await buildTaskContext(tasks);

    return res.status(200).json({
      message: 'Doctor tasks fetched successfully',
      tasks: tasks.map((task) => formatTask(task, context)),
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Doctor tasks fetch failed',
      error: error.message,
    });
  }
};

const getCreateTaskOptions = async (req, res) => {
  try {
    const [patients, users, woundCases] = await Promise.all([
      Patient.findAll({ order: [['first_name', 'ASC']] }),
      User.findAll({
        where: {
          role: { [Op.in]: ['nurse', 'doctor'] },
        },
        order: [['name', 'ASC']],
      }),
      WoundCase.findAll({ order: [['last_updated_at', 'DESC']] }),
    ]);

    return res.status(200).json({
      message: 'Doctor create task options fetched successfully',
      task_types: VALID_TASK_TYPES,
      priorities: VALID_PRIORITIES,
      patients: patients.map((patient) => ({
        id: patient.id,
        name: patientName(patient),
        room: patient.room,
        diagnosis: patient.primary_diagnosis,
      })),
      wound_cases: woundCases.map((woundCase) => ({
        id: woundCase.id,
        patient_id: woundCase.patient_id,
        label: woundCaseLabel(woundCase),
        wound_type: woundCase.wound_type,
        body_location: woundCase.body_location,
        severity_stage: woundCase.severity_stage,
      })),
      assignees: users.map(formatUserOption),
      nurses: users.filter((user) => user.role === 'nurse').map(formatUserOption),
      doctors: users.filter((user) => user.role === 'doctor').map(formatUserOption),
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Doctor create task options fetch failed',
      error: error.message,
    });
  }
};

const createTask = async (req, res) => {
  try {
    const payload = buildTaskPayload(req.body);
    const validationError = validateTaskPayload(payload);

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const referenceError = await ensureReferences(payload);
    if (referenceError) {
      return res.status(404).json({ message: referenceError });
    }

    const task = await Task.create(payload);
    const context = await buildTaskContext([task]);

    return res.status(201).json({
      message: 'Doctor task created successfully',
      task: formatTask(task, context),
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Doctor task creation failed',
      error: error.message,
    });
  }
};

const getTaskDetails = async (req, res) => {
  try {
    const task = await Task.findByPk(req.params.taskId);

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const context = await buildTaskContext([task]);

    return res.status(200).json({
      message: 'Doctor task details fetched successfully',
      task: formatTask(task, context),
      actions: {
        can_mark_complete: task.status === 'pending',
        can_reassign: task.status === 'pending',
        can_edit: task.status === 'pending',
        can_delete: task.status === 'pending',
      },
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Doctor task details fetch failed',
      error: error.message,
    });
  }
};

const updateTask = async (req, res) => {
  try {
    const task = await Task.findByPk(req.params.taskId);

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const payload = buildTaskPayload(req.body, { partial: true });
    const validationError = validateTaskPayload(payload, { partial: true });

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const referenceError = await ensureReferences(payload);
    if (referenceError) {
      return res.status(404).json({ message: referenceError });
    }

    await task.update(payload);

    const context = await buildTaskContext([task]);

    return res.status(200).json({
      message: 'Doctor task updated successfully',
      task: formatTask(task, context),
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Doctor task update failed',
      error: error.message,
    });
  }
};

const completeTask = async (req, res) => {
  try {
    const task = await Task.findByPk(req.params.taskId);

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    await task.update({
      status: 'completed',
      work_notes: cleanString(req.body.work_notes || req.body.workNotes) || task.work_notes,
      completed_at: new Date(),
    });

    const context = await buildTaskContext([task]);

    return res.status(200).json({
      message: 'Task completed successfully',
      task: formatTask(task, context),
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Task completion failed',
      error: error.message,
    });
  }
};

const getReassignOptions = async (req, res) => {
  try {
    const task = await Task.findByPk(req.params.taskId);

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const users = await User.findAll({
      where: {
        role: { [Op.in]: ['nurse', 'doctor'] },
      },
      order: [['name', 'ASC']],
    });

    return res.status(200).json({
      message: 'Task reassignment options fetched successfully',
      task_id: task.id,
      current_assignee_id: task.assigned_to,
      assignees: users.map((user) => ({
        ...formatUserOption(user),
        selected: Number(user.id) === Number(task.assigned_to),
      })),
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Task reassignment options fetch failed',
      error: error.message,
    });
  }
};

const reassignTask = async (req, res) => {
  try {
    const task = await Task.findByPk(req.params.taskId);
    const assignedTo = parseId(req.body.assigned_to || req.body.assignedTo);

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    if (!assignedTo || Number.isNaN(assignedTo)) {
      return res.status(400).json({ message: 'assigned_to is required' });
    }

    const assignee = await User.findByPk(assignedTo);

    if (!assignee || !['nurse', 'doctor'].includes(assignee.role)) {
      return res.status(404).json({
        message: 'Assigned user must be a nurse or doctor',
      });
    }

    await task.update({
      assigned_to: assignedTo,
      status: 'pending',
      completed_at: null,
    });

    const context = await buildTaskContext([task]);

    return res.status(200).json({
      message: 'Task reassigned successfully',
      task: formatTask(task, context),
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Task reassignment failed',
      error: error.message,
    });
  }
};

const deleteTask = async (req, res) => {
  try {
    const task = await Task.findByPk(req.params.taskId);

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    await task.destroy();

    return res.status(200).json({
      message: 'Task deleted successfully',
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Task deletion failed',
      error: error.message,
    });
  }
};

module.exports = {
  completeTask,
  createTask,
  deleteTask,
  getCreateTaskOptions,
  getDashboard,
  getReassignOptions,
  getTaskDetails,
  getTasks,
  reassignTask,
  updateTask,
};
