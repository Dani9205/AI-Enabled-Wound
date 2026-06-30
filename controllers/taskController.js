const { Op } = require('sequelize');
const Task = require('../models/taskModel');
const Patient = require('../models/patientModel');
const User = require('../models/userModel');

const VALID_TASK_TYPES = ['all', 'wound', 'documentation', 'follow_up', 'other'];
const VALID_PRIORITIES = ['low', 'medium', 'high'];
const VALID_STATUSES = ['pending', 'completed', 'cancelled'];

const cleanString = (value) => {
  if (value === undefined || value === null) {
    return undefined;
  }

  const trimmed = String(value).trim();
  return trimmed || undefined;
};

const getBodyValue = (body, field) => {
  const camelField = field.replace(/_([a-z])/g, (_, letter) =>
    letter.toUpperCase()
  );

  return body[field] !== undefined ? body[field] : body[camelField];
};

const parseId = (value) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : NaN;
};

const taskResponse = (task) => ({
  id: task.id,
  title: task.title,
  description: task.description,
  task_type: task.task_type,
  priority: task.priority,
  status: task.status,
  patient_id: task.patient_id,
  wound_case: task.wound_case,
  assigned_by: task.assigned_by,
  assigned_to: task.assigned_to,
  due_date: task.due_date,
  due_time: task.due_time,
  task_notes: task.task_notes,
  work_notes: task.work_notes,
  completed_at: task.completed_at,
  created_at: task.createdAt,
  updated_at: task.updatedAt,
});

const buildTaskPayload = (body, { partial = false } = {}) => {
  const payload = {};
  const stringFields = [
    'title',
    'description',
    'task_type',
    'priority',
    'status',
    'wound_case',
    'due_date',
    'due_time',
    'task_notes',
    'work_notes',
  ];
  const idFields = ['patient_id', 'assigned_by', 'assigned_to'];

  stringFields.forEach((field) => {
    const value = cleanString(getBodyValue(body, field));

    if (value !== undefined || !partial) {
      payload[field] = value || null;
    }
  });

  idFields.forEach((field) => {
    const rawValue = getBodyValue(body, field);

    if (rawValue !== undefined || !partial) {
      payload[field] = parseId(rawValue);
    }
  });

  if (!partial) {
    payload.task_type = payload.task_type || 'other';
    payload.priority = payload.priority || 'medium';
    payload.status = payload.status || 'pending';
  }

  if (payload.task_type) {
    payload.task_type = payload.task_type.toLowerCase();
  }

  if (payload.priority) {
    payload.priority = payload.priority.toLowerCase();
  }

  if (payload.status) {
    payload.status = payload.status.toLowerCase();
  }

  if (payload.status === 'completed' && !payload.completed_at) {
    payload.completed_at = new Date();
  }

  if (payload.status && payload.status !== 'completed') {
    payload.completed_at = null;
  }

  return payload;
};

const validateTaskPayload = (payload, { partial = false } = {}) => {
  if (!partial && !payload.title) {
    return 'title is required';
  }

  if (payload.task_type && !VALID_TASK_TYPES.includes(payload.task_type)) {
    return `task_type must be one of: ${VALID_TASK_TYPES.join(', ')}`;
  }

  if (payload.priority && !VALID_PRIORITIES.includes(payload.priority)) {
    return `priority must be one of: ${VALID_PRIORITIES.join(', ')}`;
  }

  if (payload.status && !VALID_STATUSES.includes(payload.status)) {
    return `status must be one of: ${VALID_STATUSES.join(', ')}`;
  }

  const invalidIdField = ['patient_id', 'assigned_by', 'assigned_to'].find(
    (field) => Number.isNaN(payload[field])
  );

  if (invalidIdField) {
    return `${invalidIdField} must be a valid positive id`;
  }

  return null;
};

const ensureReferencesExist = async (payload) => {
  if (payload.patient_id) {
    const patient = await Patient.findByPk(payload.patient_id);

    if (!patient) {
      return 'Patient not found';
    }
  }

  if (payload.assigned_by) {
    const creator = await User.findByPk(payload.assigned_by);

    if (!creator) {
      return 'Assigned by user not found';
    }
  }

  if (payload.assigned_to) {
    const assignee = await User.findByPk(payload.assigned_to);

    if (!assignee) {
      return 'Assigned to user not found';
    }
  }

  return null;
};












const createTask = async (req, res) => {
  try {
    const payload = buildTaskPayload(req.body);
    const validationError = validateTaskPayload(payload);

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const referenceError = await ensureReferencesExist(payload);

    if (referenceError) {
      return res.status(404).json({ message: referenceError });
    }

    const task = await Task.create(payload);

    return res.status(201).json({
      message: 'Task created successfully',
      task: taskResponse(task),
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Task creation failed',
      error: error.message,
    });
  }
};












const getTasks = async (req, res) => {
  try {
    const { id } = req.params;

    if (id) {
      const task = await Task.findByPk(id);

      if (!task) {
        return res.status(404).json({ message: 'Task not found' });
      }

      return res.status(200).json({ task: taskResponse(task) });
    }

    const where = {};
    const { status, priority, task_type, assigned_to, assigned_by, patient_id } =
      req.query;

    if (status) {
      where.status = String(status).toLowerCase();
    }

    if (priority) {
      where.priority = String(priority).toLowerCase();
    }

    if (task_type) {
      where.task_type = String(task_type).toLowerCase();
    }

    if (assigned_to) {
      where.assigned_to = assigned_to;
    }

    if (assigned_by) {
      where.assigned_by = assigned_by;
    }

    if (patient_id) {
      where.patient_id = patient_id;
    }

    if (req.query.search) {
      where.title = { [Op.like]: `%${req.query.search}%` };
    }

    const tasks = await Task.findAll({
      where,
      order: [['createdAt', 'DESC']],
    });

    return res.status(200).json({
      tasks: tasks.map(taskResponse),
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Tasks fetch failed',
      error: error.message,
    });
  }
};











const updateTask = async (req, res) => {
  try {
    const { id } = req.params;
    const task = await Task.findByPk(id);

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const payload = buildTaskPayload(req.body, { partial: true });
    const validationError = validateTaskPayload(payload, { partial: true });

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const referenceError = await ensureReferencesExist(payload);

    if (referenceError) {
      return res.status(404).json({ message: referenceError });
    }

    await task.update(payload);

    return res.status(200).json({
      message: 'Task updated successfully',
      task: taskResponse(task),
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Task update failed',
      error: error.message,
    });
  }
};









const completeTask = async (req, res) => {
  try {
    const { id } = req.params;
    const task = await Task.findByPk(id);

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    await task.update({
      status: 'completed',
      work_notes: cleanString(req.body.work_notes || req.body.workNotes) || task.work_notes,
      completed_at: new Date(),
    });

    return res.status(200).json({
      message: 'Task marked as completed',
      task: taskResponse(task),
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Task completion failed',
      error: error.message,
    });
  }
};










const reassignTask = async (req, res) => {
  try {
    const { id } = req.params;
    const assignedTo = parseId(req.body.assigned_to || req.body.assignedTo);

    if (!assignedTo || Number.isNaN(assignedTo)) {
      return res.status(400).json({ message: 'assigned_to is required' });
    }

    const task = await Task.findByPk(id);

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const assignee = await User.findByPk(assignedTo);

    if (!assignee) {
      return res.status(404).json({ message: 'Assigned to user not found' });
    }

    await task.update({
      assigned_to: assignedTo,
      status: 'pending',
      completed_at: null,
    });

    return res.status(200).json({
      message: 'Task reassigned successfully',
      task: taskResponse(task),
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
    const { id } = req.params;
    const task = await Task.findByPk(id);

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
  createTask,
  deleteTask,
  getTasks,
  updateTask,
  completeTask,
  reassignTask,
};
