const { Op } = require('sequelize');
const Patient = require('../models/patientModel');
const Task = require('../models/taskModel');
const User = require('../models/userModel');
const WoundCase = require('../models/woundCaseModel');

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

const parseNumber = (value) => {
  if (value === undefined || value === null || value === '') return null;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
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

const makeId = (prefix) =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const currentTimestamp = () => new Date().toISOString();

const getDoctorId = (req) =>
  parseId(req.query.doctor_id || req.body.doctor_id || req.params.doctorId);

const fullName = (user) =>
  user ? user.name || `${user.first_name || ''} ${user.last_name || ''}`.trim() : null;

const patientName = (patient) =>
  `${patient.first_name || ''} ${patient.last_name || ''}`.trim();

const patientInitials = (patient) =>
  `${patient.first_name?.[0] || ''}${patient.last_name?.[0] || ''}`.toUpperCase();

const getNursesById = async (ids) => {
  const uniqueIds = [...new Set(ids.filter(Boolean))];

  if (!uniqueIds.length) return new Map();

  const nurses = await User.findAll({
    where: {
      id: uniqueIds,
    },
  });

  return new Map(nurses.map((nurse) => [Number(nurse.id), nurse]));
};

const formatPatientCard = (patient, woundCases = [], nurse = null) => {
  const primaryCase = woundCases[0] || null;

  return {
    id: patient.id,
    initials: patientInitials(patient),
    name: patientName(patient),
    mrn: patient.mrn,
    age: getAge(patient.date_of_birth),
    gender: patient.gender,
    room: patient.room,
    ward: patient.address,
    wound_type: primaryCase?.wound_type || patient.wound_type,
    diagnosis: patient.primary_diagnosis,
    assigned_nurse: nurse ? fullName(nurse) : patient.primary_staff,
    last_activity_at: primaryCase?.last_updated_at || primaryCase?.updatedAt || patient.updatedAt,
    active_wound_cases_count: woundCases.length,
  };
};

const getAge = (dateOfBirth) => {
  if (!dateOfBirth) return null;

  const birthDate = new Date(dateOfBirth);
  if (Number.isNaN(birthDate.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age -= 1;
  }

  return age;
};

const getDurationDays = (date) => {
  if (!date) return 0;

  const startedAt = new Date(date);
  if (Number.isNaN(startedAt.getTime())) return 0;

  return Math.max(0, Math.ceil((Date.now() - startedAt.getTime()) / 86400000));
};

const formatWoundSummary = (woundCase) => ({
  id: woundCase.id,
  patient_id: woundCase.patient_id,
  wound_type: woundCase.wound_type,
  severity_stage: woundCase.severity_stage,
  body_location: woundCase.body_location,
  pain_score: woundCase.pain_score,
  status: woundCase.status,
  healing_progress: woundCase.healing_progress,
  duration_days: getDurationDays(woundCase.createdAt),
  updates_count: asArray(woundCase.updates).length,
  last_updated_at: woundCase.last_updated_at || woundCase.updatedAt,
});

const formatTask = (task, patient = null) => ({
  id: task.id,
  title: task.title,
  description: task.description,
  task_type: task.task_type,
  priority: task.priority,
  status: task.status,
  patient_id: task.patient_id,
  patient_name: patient ? patientName(patient) : null,
  wound_case: task.wound_case,
  due_date: task.due_date,
  due_time: task.due_time,
  created_at: task.createdAt,
});

const getDoctorInstructionNotes = (woundCase) =>
  asArray(woundCase.clinical_notes).filter(
    (note) => note.note_type === 'doctor_instruction'
  );

const formatInstruction = (instruction) => ({
  id: instruction.id,
  text: instruction.text,
  frequency: instruction.frequency,
  priority: instruction.priority,
  dressing_type: instruction.dressing_type,
  next_review_at: instruction.next_review_at,
  tags: instruction.tags || [],
  created_by: instruction.created_by,
  created_at: instruction.created_at,
  updated_at: instruction.updated_at || null,
});

const formatTimelineItem = (item, fallbackType) => ({
  id: item.id || makeId('timeline'),
  type: item.note_type || fallbackType,
  title: item.title || item.note_type || fallbackType,
  summary: item.summary || item.text || item.instructions || null,
  severity_stage: item.severity_stage || null,
  pain_score: item.pain_score ?? null,
  healing_progress: item.healing_progress ?? null,
  images_count: item.images_count ?? asArray(item.images).length,
  measurements: item.measurements || null,
  created_by: item.created_by || null,
  created_at: item.created_at || item.measured_at || currentTimestamp(),
});

const formatWoundDetail = (woundCase, patient, nurse = null, doctor = null) => {
  const updates = asArray(woundCase.updates).map((item) =>
    formatTimelineItem(item, 'wound_update')
  );
  const measurements = asArray(woundCase.measurements).map((item) =>
    formatTimelineItem(item, 'measurement')
  );
  const notes = asArray(woundCase.clinical_notes).map((item) =>
    formatTimelineItem(item, item.note_type || 'clinical_note')
  );
  const instructions = getDoctorInstructionNotes(woundCase).map(formatInstruction);

  const timeline = [...updates, ...measurements, ...notes].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return {
    id: woundCase.id,
    patient: formatPatientCard(patient, [woundCase], nurse),
    assigned_staff: {
      primary_nurse: nurse
        ? {
            id: nurse.id,
            name: fullName(nurse),
            role: nurse.role,
          }
        : null,
      doctor: doctor
        ? {
            id: doctor.id,
            name: fullName(doctor),
            role: doctor.role,
          }
        : null,
    },
    wound_case: {
      ...formatWoundSummary(woundCase),
      wound_etiology: woundCase.wound_etiology,
      length_cm: woundCase.length_cm,
      width_cm: woundCase.width_cm,
      depth_cm: woundCase.depth_cm,
      images: asArray(woundCase.images),
      reports: asArray(woundCase.reports),
      notes: woundCase.notes,
    },
    tabs: {
      timeline,
      images: asArray(woundCase.images),
      measures: asArray(woundCase.measurements),
      notes: asArray(woundCase.clinical_notes),
      reports: asArray(woundCase.reports),
    },
    doctor_instructions: instructions,
  };
};

const buildInstruction = (body, doctor) => {
  const text = cleanString(
    body.instructions || body.text || body.clinical_instructions || body.clinicalInstructions
  );

  return {
    id: makeId('instruction'),
    note_type: 'doctor_instruction',
    title: cleanString(body.title) || 'Doctor Instructions',
    text,
    frequency: cleanString(body.frequency) || null,
    priority: cleanString(body.priority)?.toLowerCase() || 'medium',
    dressing_type: cleanString(body.dressing_type || body.dressingType) || null,
    next_review_at: body.next_review_at || body.nextReviewAt || null,
    tags: asArray(body.tags),
    created_by: doctor ? fullName(doctor) : cleanString(body.created_by || body.createdBy),
    created_by_id: doctor?.id || parseId(body.created_by_id || body.createdById),
    created_at: currentTimestamp(),
  };
};

const validateInstruction = (instruction) => {
  if (!instruction.text) return 'Clinical instructions are required';

  if (
    instruction.priority &&
    !['low', 'medium', 'high'].includes(instruction.priority)
  ) {
    return 'Priority must be low, medium or high';
  }

  return null;
};

const getHome = async (req, res) => {
  try {
    const doctorId = getDoctorId(req);
    const doctor = doctorId ? await User.findByPk(doctorId) : null;
    const [patients, woundCases, tasks] = await Promise.all([
      Patient.findAll({ order: [['createdAt', 'DESC']] }),
      WoundCase.findAll({ order: [['last_updated_at', 'DESC']] }),
      Task.findAll({
        where: doctorId ? { assigned_to: doctorId } : {},
        order: [['createdAt', 'DESC']],
      }),
    ]);
    const patientMap = new Map(patients.map((patient) => [Number(patient.id), patient]));
    const activeTasks = tasks.filter((task) => task.status === 'pending');
    const activeWounds = woundCases.filter((woundCase) =>
      ['active', 'monitoring', 'healing'].includes(woundCase.status)
    );

    return res.status(200).json({
      message: 'Doctor home fetched successfully',
      doctor: doctor
        ? {
            id: doctor.id,
            name: fullName(doctor),
            title: doctor.professional_title,
          }
        : null,
      stats: {
        patients: patients.length,
        wounds: activeWounds.length,
        tasks: activeTasks.length,
        reports: woundCases.reduce(
          (count, woundCase) => count + asArray(woundCase.reports).length,
          0
        ),
      },
      my_tasks: activeTasks.slice(0, 5).map((task) =>
        formatTask(task, patientMap.get(Number(task.patient_id)))
      ),
      assigned_patients: patients.slice(0, 6).map((patient) =>
        formatPatientCard(
          patient,
          woundCases.filter((woundCase) => woundCase.patient_id === patient.id)
        )
      ),
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Doctor home fetch failed',
      error: error.message,
    });
  }
};

const getPatients = async (req, res) => {
  try {
    const search = cleanString(req.query.search);
    const patients = await Patient.findAll({
      where: search
        ? {
            [Op.or]: [
              { first_name: { [Op.like]: `%${search}%` } },
              { last_name: { [Op.like]: `%${search}%` } },
              { room: { [Op.like]: `%${search}%` } },
              { wound_type: { [Op.like]: `%${search}%` } },
              { primary_diagnosis: { [Op.like]: `%${search}%` } },
            ],
          }
        : {},
      order: [['createdAt', 'DESC']],
    });
    const woundCases = await WoundCase.findAll({
      where: {
        patient_id: patients.map((patient) => patient.id),
      },
      order: [['last_updated_at', 'DESC']],
    });
    const nursesById = await getNursesById(patients.map((patient) => patient.nurse_id));

    return res.status(200).json({
      message: 'Doctor patients fetched successfully',
      patients: patients.map((patient) =>
        formatPatientCard(
          patient,
          woundCases.filter((woundCase) => woundCase.patient_id === patient.id),
          nursesById.get(Number(patient.nurse_id))
        )
      ),
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Doctor patients fetch failed',
      error: error.message,
    });
  }
};

const getPatientDetails = async (req, res) => {
  try {
    const patient = await Patient.findByPk(req.params.patientId);

    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    const [woundCases, nurse] = await Promise.all([
      WoundCase.findAll({
        where: { patient_id: patient.id },
        order: [['last_updated_at', 'DESC']],
      }),
      patient.nurse_id ? User.findByPk(patient.nurse_id) : null,
    ]);

    return res.status(200).json({
      message: 'Doctor patient details fetched successfully',
      patient: {
        ...formatPatientCard(patient, woundCases, nurse),
        date_of_birth: patient.date_of_birth,
        allergies_notes: patient.allergies_notes,
        primary_diagnosis: patient.primary_diagnosis,
      },
      assigned_staff: {
        primary_nurse: nurse
          ? {
              id: nurse.id,
              name: fullName(nurse),
              role: nurse.role,
            }
          : null,
      },
      active_wound_cases: woundCases.map(formatWoundSummary),
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Doctor patient details fetch failed',
      error: error.message,
    });
  }
};

const getWoundCaseDetails = async (req, res) => {
  try {
    const doctorId = getDoctorId(req);
    const woundCase = await WoundCase.findByPk(req.params.woundCaseId);

    if (!woundCase) {
      return res.status(404).json({ message: 'Wound case not found' });
    }

    const patient = await Patient.findByPk(woundCase.patient_id);

    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    const [nurse, doctor] = await Promise.all([
      patient.nurse_id ? User.findByPk(patient.nurse_id) : null,
      doctorId ? User.findByPk(doctorId) : null,
    ]);

    return res.status(200).json({
      message: 'Doctor wound case details fetched successfully',
      ...formatWoundDetail(woundCase, patient, nurse, doctor),
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Doctor wound case details fetch failed',
      error: error.message,
    });
  }
};

const addInstructions = async (req, res) => {
  try {
    const doctorId = getDoctorId(req);
    const woundCase = await WoundCase.findByPk(req.params.woundCaseId);

    if (!woundCase) {
      return res.status(404).json({ message: 'Wound case not found' });
    }

    const doctor = doctorId ? await User.findByPk(doctorId) : null;
    const instruction = buildInstruction(req.body, doctor);
    const validationError = validateInstruction(instruction);

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const notes = asArray(woundCase.clinical_notes);

    await woundCase.update({
      clinical_notes: [instruction, ...notes],
      last_updated_at: new Date(),
    });

    return res.status(201).json({
      message: 'Doctor instructions saved successfully',
      instruction: formatInstruction(instruction),
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Doctor instructions save failed',
      error: error.message,
    });
  }
};

const updateInstructions = async (req, res) => {
  try {
    const woundCase = await WoundCase.findByPk(req.params.woundCaseId);

    if (!woundCase) {
      return res.status(404).json({ message: 'Wound case not found' });
    }

    const notes = asArray(woundCase.clinical_notes);
    const index = notes.findIndex(
      (note) =>
        note.note_type === 'doctor_instruction' &&
        String(note.id) === String(req.params.instructionId)
    );

    if (index === -1) {
      return res.status(404).json({ message: 'Doctor instruction not found' });
    }

    const updatedInstruction = {
      ...notes[index],
      text: cleanString(req.body.instructions || req.body.text) || notes[index].text,
      frequency: cleanString(req.body.frequency) || notes[index].frequency,
      priority:
        cleanString(req.body.priority)?.toLowerCase() || notes[index].priority,
      dressing_type:
        cleanString(req.body.dressing_type || req.body.dressingType) ||
        notes[index].dressing_type,
      next_review_at:
        req.body.next_review_at ||
        req.body.nextReviewAt ||
        notes[index].next_review_at,
      tags: req.body.tags !== undefined ? asArray(req.body.tags) : notes[index].tags,
      updated_at: currentTimestamp(),
    };
    const validationError = validateInstruction(updatedInstruction);

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const nextNotes = notes.map((note, noteIndex) =>
      noteIndex === index ? updatedInstruction : note
    );

    woundCase.setDataValue('clinical_notes', nextNotes);
    woundCase.changed('clinical_notes', true);
    woundCase.last_updated_at = new Date();
    await woundCase.save({ fields: ['clinical_notes', 'last_updated_at'] });

    await woundCase.reload({ attributes: ['clinical_notes'] });
    const persistedInstruction = asArray(woundCase.clinical_notes).find(
      (note) =>
        note.note_type === 'doctor_instruction' &&
        String(note.id) === String(req.params.instructionId)
    );

    return res.status(200).json({
      message: 'Doctor instructions updated successfully',
      instruction: formatInstruction(persistedInstruction || updatedInstruction),
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Doctor instructions update failed',
      error: error.message,
    });
  }
};

const deleteInstructions = async (req, res) => {
  try {
    const woundCase = await WoundCase.findByPk(req.params.woundCaseId);

    if (!woundCase) {
      return res.status(404).json({ message: 'Wound case not found' });
    }

    const notes = asArray(woundCase.clinical_notes);
    const nextNotes = notes.filter(
      (note) =>
        !(
          note.note_type === 'doctor_instruction' &&
          String(note.id) === String(req.params.instructionId)
        )
    );

    if (nextNotes.length === notes.length) {
      return res.status(404).json({ message: 'Doctor instruction not found' });
    }

    await woundCase.update({
      clinical_notes: nextNotes,
      last_updated_at: new Date(),
    });

    return res.status(200).json({
      message: 'Doctor instructions deleted successfully',
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Doctor instructions delete failed',
      error: error.message,
    });
  }
};

const markTaskComplete = async (req, res) => {
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

    return res.status(200).json({
      message: 'Task marked as complete',
      task: formatTask(task),
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Task completion failed',
      error: error.message,
    });
  }
};

module.exports = {
  addInstructions,
  deleteInstructions,
  getHome,
  getPatientDetails,
  getPatients,
  getWoundCaseDetails,
  markTaskComplete,
  updateInstructions,
};
