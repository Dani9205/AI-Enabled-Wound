const Patient = require('../models/patientModel');
const User = require('../models/userModel');
const { permanentlyDeletePatientRecord } = require('../utils/permanentDelete');

const VALID_GENDERS = ['male', 'female', 'other'];

const cleanString = (value) => {
  if (value === undefined || value === null) {
    return undefined;
  }

  const trimmed = String(value).trim();
  return trimmed || undefined;
};

const normalizeGender = (gender) => {
  const value = cleanString(gender);
  return value ? value.toLowerCase() : undefined;
};

const patientResponse = (patient) => ({
  id: patient.id,
  nurse_id: patient.nurse_id,
  first_name: patient.first_name,
  last_name: patient.last_name,
  date_of_birth: patient.date_of_birth,
  gender: patient.gender,
  mrn: patient.mrn,
  address: patient.address,
  room: patient.room,
  wound_type: patient.wound_type,
  primary_staff: patient.primary_staff,
  backup_staff: patient.backup_staff,
  primary_diagnosis: patient.primary_diagnosis,
  allergies_notes: patient.allergies_notes,
  created_at: patient.createdAt,
  updated_at: patient.updatedAt,
});

const buildPatientPayload = (body, { partial = false } = {}) => {
  const payload = {};
  const fields = [
    'first_name',
    'last_name',
    'date_of_birth',
    'mrn',
    'address',
    'room',
    'wound_type',
    'primary_staff',
    'backup_staff',
    'primary_diagnosis',
    'allergies_notes',
  ];

  fields.forEach((field) => {
    const camelField = field.replace(/_([a-z])/g, (_, letter) =>
      letter.toUpperCase()
    );
    const value = cleanString(body[field] || body[camelField]);

    if (value !== undefined || !partial) {
      payload[field] = value || null;
    }
  });

  const gender = normalizeGender(body.gender);
  if (gender !== undefined || !partial) {
    payload.gender = gender || null;
  }

  const nurseId = body.nurse_id !== undefined ? body.nurse_id : body.nurseId;
  if (nurseId !== undefined || !partial) {
    const parsed = Number(nurseId);
    payload.nurse_id =
      nurseId === undefined || nurseId === null || nurseId === ''
        ? null
        : Number.isInteger(parsed) && parsed > 0
          ? parsed
          : NaN;
  }

  return payload;
};

const validatePatientPayload = (payload, { partial = false } = {}) => {
  const requiredFields = ['first_name', 'last_name', 'mrn'];

  if (!partial) {
    const missingFields = requiredFields.filter((field) => !payload[field]);

    if (missingFields.length) {
      return `${missingFields.join(', ')} are required`;
    }
  }

  if (payload.gender && !VALID_GENDERS.includes(payload.gender)) {
    return `Gender must be one of: ${VALID_GENDERS.join(', ')}`;
  }

  if (Number.isNaN(payload.nurse_id)) {
    return 'nurse_id must be a valid positive id';
  }

  return null;
};

const ensureNurseExists = async (nurseId) => {
  if (!nurseId) {
    return null;
  }

  const nurse = await User.findByPk(nurseId);

  if (!nurse) {
    return 'Nurse not found';
  }

  if (nurse.role !== 'nurse') {
    return 'nurse_id must belong to a nurse user';
  }

  return null;
};

const isNurse = (req) => req.user?.role === 'nurse';

const getNurseScopedPatient = async (req, id) => {
  const where = { id };

  if (isNurse(req)) {
    where.nurse_id = req.user.id;
  }

  return Patient.findOne({ where });
};




const createPatient = async (req, res) => {
  try {
    const payload = buildPatientPayload(req.body);
    if (isNurse(req)) {
      payload.nurse_id = req.user.id;
    }

    const validationError = validatePatientPayload(payload);

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const nurseError = await ensureNurseExists(payload.nurse_id);
    if (nurseError) {
      return res.status(404).json({ message: nurseError });
    }

    const existingPatient = await Patient.findOne({
      where: { mrn: payload.mrn },
    });

    if (existingPatient) {
      return res.status(409).json({ message: 'Patient MRN already exists' });
    }

    const patient = await Patient.create(payload);

    return res.status(201).json({
      message: 'Patient created successfully',
      patient: patientResponse(patient),
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Patient creation failed',
      error: error.message,
    });
  }
};










const getPatients = async (req, res) => {
  try {
    const { id } = req.params;

    if (id) {
      const patient = await getNurseScopedPatient(req, id);

      if (!patient) {
        return res.status(404).json({ message: 'Patient not found' });
      }

      return res.status(200).json({ patient: patientResponse(patient) });
    }

    const where = {};

    if (isNurse(req)) {
      where.nurse_id = req.user.id;
    }

    const patients = await Patient.findAll({
      where,
      order: [['createdAt', 'DESC']],
    });

    return res.status(200).json({
      patients: patients.map(patientResponse),
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Patients fetch failed',
      error: error.message,
    });
  }
};










const updatePatient = async (req, res) => {
  try {
    const { id } = req.params;
    const patient = await getNurseScopedPatient(req, id);

    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    const payload = buildPatientPayload(req.body, { partial: true });
    if (isNurse(req)) {
      delete payload.nurse_id;
    }

    const validationError = validatePatientPayload(payload, { partial: true });

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const nurseError = await ensureNurseExists(payload.nurse_id);
    if (nurseError) {
      return res.status(404).json({ message: nurseError });
    }

    if (payload.mrn && payload.mrn !== patient.mrn) {
      const existingPatient = await Patient.findOne({
        where: { mrn: payload.mrn },
      });

      if (existingPatient) {
        return res.status(409).json({ message: 'Patient MRN already exists' });
      }
    }

    await patient.update(payload);

    return res.status(200).json({
      message: 'Patient updated successfully',
      patient: patientResponse(patient),
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Patient update failed',
      error: error.message,
    });
  }
};











const deletePatient = async (req, res) => {
  try {
    const { id } = req.params;
    const patient = await getNurseScopedPatient(req, id);

    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    const result = await permanentlyDeletePatientRecord(patient);

    return res.status(200).json({
      message: 'Patient permanently deleted successfully',
      deletion: result,
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Patient deletion failed',
      error: error.message,
    });
  }
};

module.exports = {
  createPatient,
  getPatients,
  updatePatient,
  deletePatient,
};
