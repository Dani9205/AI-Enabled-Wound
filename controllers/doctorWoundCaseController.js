const { Op } = require('sequelize');
const Patient = require('../models/patientModel');
const WoundCase = require('../models/woundCaseModel');

const VALID_STATUSES = ['active', 'monitoring', 'healing', 'healed', 'closed'];

const cleanString = (value) => {
  if (value === undefined || value === null) return undefined;
  const trimmed = String(value).trim();
  return trimmed || undefined;
};

const bodyValue = (body, field) => {
  const camelField = field.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
  return body[field] !== undefined ? body[field] : body[camelField];
};

const parsePositiveId = (value) => {
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
  if (Array.isArray(value)) return value;
  if (!value) return [];
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

const response = (woundCase) => ({
  id: woundCase.id,
  patient_id: woundCase.patient_id,
  wound_type: woundCase.wound_type,
  severity_stage: woundCase.severity_stage,
  pain_score: woundCase.pain_score,
  body_location: woundCase.body_location,
  wound_etiology: woundCase.wound_etiology,
  status: woundCase.status,
  healing_progress: woundCase.healing_progress,
  length_cm: woundCase.length_cm,
  width_cm: woundCase.width_cm,
  depth_cm: woundCase.depth_cm,
  images: asArray(woundCase.images),
  measurements: asArray(woundCase.measurements),
  updates: asArray(woundCase.updates),
  clinical_notes: asArray(woundCase.clinical_notes),
  reports: asArray(woundCase.reports),
  notes: woundCase.notes,
  last_updated_at: woundCase.last_updated_at,
  created_at: woundCase.createdAt,
  updated_at: woundCase.updatedAt,
});

const buildPayload = (body, partial = false) => {
  const payload = {};
  const patientValue = bodyValue(body, 'patient_id');
  if (patientValue !== undefined || !partial) {
    payload.patient_id = parsePositiveId(patientValue);
  }

  ['wound_type', 'severity_stage', 'body_location', 'wound_etiology', 'notes'].forEach(
    (field) => {
      const value = bodyValue(body, field);
      if (value !== undefined || !partial) payload[field] = cleanString(value) || null;
    }
  );

  const statusValue = bodyValue(body, 'status');
  if (statusValue !== undefined || !partial) {
    payload.status = cleanString(statusValue)?.toLowerCase() || 'active';
  }

  ['pain_score', 'healing_progress', 'length_cm', 'width_cm', 'depth_cm'].forEach(
    (field) => {
      const value = bodyValue(body, field);
      if (value !== undefined || !partial) payload[field] = parseNumber(value);
    }
  );

  ['images', 'measurements', 'updates', 'clinical_notes', 'reports'].forEach((field) => {
    const value = bodyValue(body, field);
    if (value !== undefined || !partial) payload[field] = asArray(value);
  });

  payload.last_updated_at = new Date();
  return payload;
};

const validatePayload = (payload, partial = false) => {
  if (!partial && !payload.patient_id) return 'patient_id is required';
  if (!partial && !payload.wound_type) return 'wound_type is required';
  if (Number.isNaN(payload.patient_id)) return 'patient_id must be a valid positive id';
  if (payload.status && !VALID_STATUSES.includes(payload.status)) {
    return `status must be one of: ${VALID_STATUSES.join(', ')}`;
  }
  if (
    payload.pain_score !== undefined &&
    payload.pain_score !== null &&
    (Number.isNaN(payload.pain_score) || payload.pain_score < 0 || payload.pain_score > 10)
  ) {
    return 'pain_score must be between 0 and 10';
  }
  if (
    payload.healing_progress !== undefined &&
    payload.healing_progress !== null &&
    (Number.isNaN(payload.healing_progress) ||
      payload.healing_progress < 0 ||
      payload.healing_progress > 100)
  ) {
    return 'healing_progress must be between 0 and 100';
  }
  const invalidSize = ['length_cm', 'width_cm', 'depth_cm'].find(
    (field) =>
      payload[field] !== undefined &&
      payload[field] !== null &&
      (Number.isNaN(payload[field]) || payload[field] < 0)
  );
  return invalidSize ? `${invalidSize} must be 0 or greater` : null;
};

const getDoctorId = (req) => {
  const id = Number(req.user?.id);
  return Number.isInteger(id) && id > 0 ? id : null;
};

const findOwnedPatient = (patientId, doctorId) => {
  if (!doctorId) return null;
  return Patient.findOne({ where: { id: patientId, doctor_id: doctorId } });
};

const getOwnedPatientIds = async (doctorId) => {
  if (!doctorId) return [];
  const patients = await Patient.findAll({
    where: { doctor_id: doctorId },
    attributes: ['id'],
  });
  return patients.map((patient) => patient.id);
};

const findOwnedWoundCase = async (woundCaseId, doctorId) => {
  const ownedPatientIds = await getOwnedPatientIds(doctorId);
  if (!ownedPatientIds.length) return null;
  return WoundCase.findOne({
    where: { id: woundCaseId, patient_id: { [Op.in]: ownedPatientIds } },
  });
};

const createWoundCase = async (req, res) => {
  try {
    const doctorId = getDoctorId(req);
    const payload = buildPayload(req.body);
    const validationError = validatePayload(payload);
    if (validationError) return res.status(400).json({ message: validationError });

    const patient = await findOwnedPatient(payload.patient_id, doctorId);
    if (!patient) return res.status(404).json({ message: 'Patient not found' });

    const woundCase = await WoundCase.create(payload);
    return res.status(201).json({
      message: 'Wound case created successfully',
      wound_case: response(woundCase),
    });
  } catch (error) {
    return res.status(500).json({ message: 'Wound case creation failed', error: error.message });
  }
};

const getWoundCases = async (req, res) => {
  try {
    const doctorId = getDoctorId(req);
    const patientIds = await getOwnedPatientIds(doctorId);
    if (!patientIds.length) return res.status(200).json({ total_count: 0, wound_cases: [] });

    const where = { patient_id: { [Op.in]: patientIds } };
    const requestedPatientId = parsePositiveId(req.query.patient_id || req.query.patientId);
    if (Number.isNaN(requestedPatientId)) {
      return res.status(400).json({ message: 'patient_id must be a valid positive id' });
    }
    if (requestedPatientId) {
      if (!patientIds.map(Number).includes(requestedPatientId)) {
        return res.status(200).json({ total_count: 0, wound_cases: [] });
      }
      where.patient_id = requestedPatientId;
    }
    if (req.query.status) {
      const status = cleanString(req.query.status)?.toLowerCase();
      if (!VALID_STATUSES.includes(status)) {
        return res.status(400).json({
          message: `status must be one of: ${VALID_STATUSES.join(', ')}`,
        });
      }
      where.status = status;
    }
    const search = cleanString(req.query.search);
    if (search) {
      where[Op.or] = [
        { wound_type: { [Op.like]: `%${search}%` } },
        { body_location: { [Op.like]: `%${search}%` } },
        { wound_etiology: { [Op.like]: `%${search}%` } },
      ];
    }

    const woundCases = await WoundCase.findAll({ where, order: [['createdAt', 'DESC']] });
    return res.status(200).json({
      total_count: woundCases.length,
      wound_cases: woundCases.map(response),
    });
  } catch (error) {
    return res.status(500).json({ message: 'Wound cases fetch failed', error: error.message });
  }
};

const getWoundCase = async (req, res) => {
  try {
    const woundCase = await findOwnedWoundCase(req.params.woundCaseId, getDoctorId(req));
    if (!woundCase) return res.status(404).json({ message: 'Wound case not found' });
    return res.status(200).json({ wound_case: response(woundCase) });
  } catch (error) {
    return res.status(500).json({ message: 'Wound case fetch failed', error: error.message });
  }
};

const updateWoundCase = async (req, res) => {
  try {
    const doctorId = getDoctorId(req);
    const woundCase = await findOwnedWoundCase(req.params.woundCaseId, doctorId);
    if (!woundCase) return res.status(404).json({ message: 'Wound case not found' });

    const payload = buildPayload(req.body, true);
    const validationError = validatePayload(payload, true);
    if (validationError) return res.status(400).json({ message: validationError });
    if (Object.keys(payload).length === 1 && payload.last_updated_at) {
      return res.status(400).json({ message: 'At least one wound case field is required' });
    }
    if (payload.patient_id) {
      const patient = await findOwnedPatient(payload.patient_id, doctorId);
      if (!patient) return res.status(404).json({ message: 'Patient not found' });
    }

    await woundCase.update(payload);
    return res.status(200).json({
      message: 'Wound case updated successfully',
      wound_case: response(woundCase),
    });
  } catch (error) {
    return res.status(500).json({ message: 'Wound case update failed', error: error.message });
  }
};

const deleteWoundCase = async (req, res) => {
  try {
    const woundCase = await findOwnedWoundCase(req.params.woundCaseId, getDoctorId(req));
    if (!woundCase) return res.status(404).json({ message: 'Wound case not found' });
    await woundCase.destroy();
    return res.status(200).json({ message: 'Wound case permanently deleted successfully' });
  } catch (error) {
    return res.status(500).json({ message: 'Wound case deletion failed', error: error.message });
  }
};

module.exports = {
  createWoundCase,
  getWoundCases,
  getWoundCase,
  updateWoundCase,
  deleteWoundCase,
};
