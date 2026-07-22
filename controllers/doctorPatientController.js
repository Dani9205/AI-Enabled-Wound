const { Op } = require('sequelize');
const Patient = require('../models/patientModel');
const User = require('../models/userModel');
const VALID_GENDERS = ['male', 'female', 'other'];
const VALID_STATUSES = ['active', 'archived'];

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

const patientResponse = (patient) => ({
  id: patient.id,
  nurse_id: patient.nurse_id,
  doctor_id: patient.doctor_id,
  first_name: patient.first_name,
  last_name: patient.last_name,
  date_of_birth: patient.date_of_birth,
  gender: patient.gender,
  mrn: patient.mrn,
  address: patient.address,
  phone_number: patient.phone_number,
  room: patient.room,
  wound_type: patient.wound_type,
  primary_staff: patient.primary_staff,
  backup_staff: patient.backup_staff,
  primary_diagnosis: patient.primary_diagnosis,
  allergies_notes: patient.allergies_notes,
  status: patient.status,
  archived_at: patient.archived_at,
  archived_by: patient.archived_by,
  created_at: patient.createdAt,
  updated_at: patient.updatedAt,
});

const buildPayload = (body, partial = false) => {
  const payload = {};
  const fields = [
    'first_name',
    'last_name',
    'date_of_birth',
    'mrn',
    'address',
    'phone_number',
    'room',
    'wound_type',
    'primary_staff',
    'backup_staff',
    'primary_diagnosis',
    'allergies_notes',
  ];

  fields.forEach((field) => {
    const value = bodyValue(body, field);
    if (value !== undefined || !partial) payload[field] = cleanString(value) || null;
  });

  const genderValue = bodyValue(body, 'gender');
  if (genderValue !== undefined || !partial) {
    payload.gender = cleanString(genderValue)?.toLowerCase() || null;
  }

  const statusValue = bodyValue(body, 'status');
  if (statusValue !== undefined) {
    payload.status = cleanString(statusValue)?.toLowerCase();
  }

  const nurseValue = bodyValue(body, 'nurse_id');
  if (nurseValue !== undefined || !partial) payload.nurse_id = parsePositiveId(nurseValue);

  return payload;
};

const validatePayload = (payload, partial = false) => {
  if (!partial) {
    const missing = ['first_name', 'last_name', 'mrn'].filter((field) => !payload[field]);
    if (missing.length) return `${missing.join(', ')} are required`;
  }
  if (payload.gender && !VALID_GENDERS.includes(payload.gender)) {
    return `Gender must be one of: ${VALID_GENDERS.join(', ')}`;
  }
  if (payload.status && !VALID_STATUSES.includes(payload.status)) {
    return `Status must be one of: ${VALID_STATUSES.join(', ')}`;
  }
  if (Number.isNaN(payload.nurse_id)) return 'nurse_id must be a valid positive id';
  return null;
};

const validateNurse = async (nurseId, doctor) => {
  if (!nurseId) return null;
  const nurse = await User.findByPk(nurseId);
  if (!nurse || nurse.role !== 'nurse') return 'nurse_id must belong to a nurse user';
  if (
    doctor.organization_id &&
    Number(nurse.organization_id) !== Number(doctor.organization_id)
  ) {
    return 'Nurse must belong to the doctor organization';
  }
  return null;
};

const createPatient = async (req, res) => {
  try {
    const payload = buildPayload(req.body);
    payload.doctor_id = req.user.id;
    payload.status = 'active';
    payload.archived_at = null;
    payload.archived_by = null;
    const validationError = validatePayload(payload);
    if (validationError) return res.status(400).json({ message: validationError });

    const nurseError = await validateNurse(payload.nurse_id, req.user);
    if (nurseError) return res.status(400).json({ message: nurseError });

    const duplicate = await Patient.findOne({ where: { mrn: payload.mrn } });
    if (duplicate) return res.status(409).json({ message: 'Patient MRN already exists' });

    if (!payload.primary_staff) payload.primary_staff = req.user.name;
    const patient = await Patient.create(payload);
    return res.status(201).json({
      message: 'Patient created successfully',
      patient: patientResponse(patient),
    });
  } catch (error) {
    return res.status(500).json({ message: 'Patient creation failed', error: error.message });
  }
};

const getPatients = async (req, res) => {
  try {
    const doctorId = Number(req.user?.id);

    if (!Number.isInteger(doctorId) || doctorId <= 0) {
      return res.status(401).json({ message: 'Authenticated doctor is required' });
    }

    const where = {
      [Op.and]: [
        { doctor_id: { [Op.eq]: doctorId } },
        { doctor_id: { [Op.not]: null } },
      ],
    };
    const search = cleanString(req.query.search);
    const nurseId = parsePositiveId(req.query.nurse_id || req.query.nurseId);
    if (Number.isNaN(nurseId)) {
      return res.status(400).json({ message: 'nurse_id must be a valid positive id' });
    }
    if (nurseId) where[Op.and].push({ nurse_id: nurseId });
    const status = cleanString(req.query.status)?.toLowerCase() || 'active';
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        message: `Status must be one of: ${VALID_STATUSES.join(', ')}`,
      });
    }
    where[Op.and].push({ status });
    if (search) {
      where[Op.and].push({
        [Op.or]: [
          { first_name: { [Op.like]: `%${search}%` } },
          { last_name: { [Op.like]: `%${search}%` } },
          { mrn: { [Op.like]: `%${search}%` } },
        ],
      });
    }

    const patients = await Patient.findAll({ where, order: [['createdAt', 'DESC']] });
    return res.status(200).json({
      message: 'Patients fetched successfully',
      total_count: patients.length,
      patients: patients.map(patientResponse),
    });
  } catch (error) {
    return res.status(500).json({ message: 'Patients fetch failed', error: error.message });
  }
};

const getPatient = async (req, res) => {
  try {
    const doctorId = Number(req.user?.id);
    const patientId = Number(req.params.patientId);

    if (!Number.isInteger(doctorId) || doctorId <= 0) {
      return res.status(401).json({ message: 'Authenticated doctor is required' });
    }

    if (!Number.isInteger(patientId) || patientId <= 0) {
      return res.status(400).json({ message: 'Valid patient id is required' });
    }

    const patient = await Patient.findOne({
      where: {
        [Op.and]: [
          { id: { [Op.eq]: patientId } },
          { doctor_id: { [Op.eq]: doctorId } },
          { doctor_id: { [Op.not]: null } },
        ],
      },
    });
    if (!patient) return res.status(404).json({ message: 'Patient not found' });
    return res.status(200).json({ patient: patientResponse(patient) });
  } catch (error) {
    return res.status(500).json({ message: 'Patient fetch failed', error: error.message });
  }
};

const updatePatient = async (req, res) => {
  try {
    const patient = await Patient.findOne({
      where: { id: req.params.patientId, doctor_id: req.user.id },
    });
    if (!patient) return res.status(404).json({ message: 'Patient not found' });

    const payload = buildPayload(req.body, true);
    if (payload.status === 'archived') {
      payload.archived_at = new Date();
      payload.archived_by = req.user.id;
    } else if (payload.status === 'active') {
      payload.archived_at = null;
      payload.archived_by = null;
    }
    const validationError = validatePayload(payload, true);
    if (validationError) return res.status(400).json({ message: validationError });
    if (!Object.keys(payload).length) {
      return res.status(400).json({ message: 'At least one patient field is required' });
    }

    const nurseError = await validateNurse(payload.nurse_id, req.user);
    if (nurseError) return res.status(400).json({ message: nurseError });

    if (payload.mrn && payload.mrn !== patient.mrn) {
      const duplicate = await Patient.findOne({ where: { mrn: payload.mrn } });
      if (duplicate) return res.status(409).json({ message: 'Patient MRN already exists' });
    }

    await patient.update(payload);
    return res.status(200).json({
      message: 'Patient updated successfully',
      patient: patientResponse(patient),
    });
  } catch (error) {
    return res.status(500).json({ message: 'Patient update failed', error: error.message });
  }
};

const deletePatient = async (req, res) => {
  try {
    const patient = await Patient.findOne({
      where: { id: req.params.patientId, doctor_id: req.user.id },
    });
    if (!patient) return res.status(404).json({ message: 'Patient not found' });
    const deleteService = require('../utils/permanentDelete');

    if (typeof deleteService.permanentlyDeletePatientRecord !== 'function') {
      throw new Error('Patient permanent deletion service is unavailable');
    }

    const deletion = await deleteService.permanentlyDeletePatientRecord(patient);
    return res.status(200).json({
      message: 'Patient permanently deleted successfully',
      deletion,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Patient deletion failed', error: error.message });
  }
};

module.exports = { createPatient, getPatients, getPatient, updatePatient, deletePatient };
