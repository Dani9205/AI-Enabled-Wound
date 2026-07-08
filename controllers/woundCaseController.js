const { Op } = require('sequelize');
const Patient = require('../models/patientModel');
const WoundCase = require('../models/woundCaseModel');

const VALID_STATUSES = ['active', 'monitoring', 'healing', 'healed', 'closed'];

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

const parseNumber = (value) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
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

const isNurse = (req) => req.user?.role === 'nurse';

const getNursePatientIds = async (nurseId) => {
  const patients = await Patient.findAll({
    where: { nurse_id: nurseId },
    attributes: ['id'],
  });

  return patients.map((patient) => patient.id);
};

const getScopedWoundCase = async (req, id) => {
  const woundCase = await WoundCase.findByPk(id);

  if (!woundCase) {
    return null;
  }

  if (!isNurse(req)) {
    return woundCase;
  }

  const patient = await Patient.findOne({
    where: { id: woundCase.patient_id, nurse_id: req.user.id },
  });

  return patient ? woundCase : null;
};

const currentTimestamp = () => new Date().toISOString();

const makeId = (prefix) =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const formatImage = (image) => ({
  id: image.id || makeId('img'),
  url: cleanString(image.url || image.image_url || image.imageUrl),
  caption: cleanString(image.caption) || null,
  uploaded_at: image.uploaded_at || image.uploadedAt || currentTimestamp(),
});

const formatMeasurement = (measurement) => ({
  id: measurement.id || makeId('measurement'),
  length_cm: parseNumber(
    measurement.length_cm !== undefined ? measurement.length_cm : measurement.lengthCm
  ),
  width_cm: parseNumber(
    measurement.width_cm !== undefined ? measurement.width_cm : measurement.widthCm
  ),
  depth_cm: parseNumber(
    measurement.depth_cm !== undefined ? measurement.depth_cm : measurement.depthCm
  ),
  pain_score: parseNumber(
    measurement.pain_score !== undefined ? measurement.pain_score : measurement.painScore
  ),
  notes: cleanString(measurement.notes) || null,
  measured_at: measurement.measured_at || measurement.measuredAt || currentTimestamp(),
});

const formatClinicalNote = (note) => ({
  id: note.id || makeId('note'),
  note_type: cleanString(note.note_type || note.noteType) || 'manual',
  title: cleanString(note.title) || null,
  text: cleanString(note.text || note.note || note.clinical_note || note.clinicalNote),
  soap: note.soap || note.soap_note || note.soapNote || null,
  audio_url: cleanString(note.audio_url || note.audioUrl) || null,
  duration_seconds: parseNumber(
    note.duration_seconds !== undefined ? note.duration_seconds : note.durationSeconds
  ),
  is_ai_generated: Boolean(note.is_ai_generated || note.isAiGenerated),
  created_by: cleanString(note.created_by || note.createdBy) || null,
  created_at: note.created_at || note.createdAt || currentTimestamp(),
});

const formatReport = (report) => ({
  id: report.id || makeId('report'),
  title: cleanString(report.title) || 'Wound report',
  report_type: cleanString(report.report_type || report.reportType) || 'wound',
  url: cleanString(report.url || report.file_url || report.fileUrl) || null,
  summary: cleanString(report.summary) || null,
  pages: parseNumber(report.pages),
  file_size: cleanString(report.file_size || report.fileSize) || null,
  status: cleanString(report.status) || 'new',
  shared_with: asArray(report.shared_with || report.sharedWith),
  report_data: report.report_data || report.reportData || null,
  generated_by: cleanString(report.generated_by || report.generatedBy) || null,
  generated_at: report.generated_at || report.generatedAt || currentTimestamp(),
});

const formatWoundUpdate = (update) => ({
  id: update.id || makeId('update'),
  title: cleanString(update.title) || 'Wound update',
  summary: cleanString(update.summary || update.description) || null,
  severity_stage: cleanString(update.severity_stage || update.severityStage) || null,
  pain_score: parseNumber(
    update.pain_score !== undefined ? update.pain_score : update.painScore
  ),
  healing_progress: parseNumber(
    update.healing_progress !== undefined
      ? update.healing_progress
      : update.healingProgress
  ),
  priority: cleanString(update.priority) || null,
  dressing_type: cleanString(update.dressing_type || update.dressingType) || null,
  instructions: cleanString(update.instructions || update.doctor_instructions || update.doctorInstructions) || null,
  frequency: cleanString(update.frequency) || null,
  next_review_at: update.next_review_at || update.nextReviewAt || null,
  images_count: asArray(update.images).length,
  created_by: cleanString(update.created_by || update.createdBy) || null,
  created_at: update.created_at || update.createdAt || currentTimestamp(),
});

const buildInitialMeasurement = (payload) => {
  if (
    payload.length_cm === null &&
    payload.width_cm === null &&
    payload.depth_cm === null &&
    payload.pain_score === null
  ) {
    return null;
  }

  return formatMeasurement({
    length_cm: payload.length_cm,
    width_cm: payload.width_cm,
    depth_cm: payload.depth_cm,
    pain_score: payload.pain_score,
    notes: 'Initial measurements',
  });
};

const woundCaseResponse = (woundCase) => {
  const createdAt = woundCase.createdAt ? new Date(woundCase.createdAt) : null;
  const durationDays = createdAt
    ? Math.max(0, Math.ceil((Date.now() - createdAt.getTime()) / 86400000))
    : 0;
  const measurements = asArray(woundCase.measurements);
  const updates = asArray(woundCase.updates);
  const clinicalNotes = asArray(woundCase.clinical_notes);
  const images = asArray(woundCase.images);

  return {
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
    images,
    measurements,
    updates,
    clinical_notes: clinicalNotes,
    reports: asArray(woundCase.reports),
    updates_count: updates.length || measurements.length,
    images_count: images.length,
    notes_count: clinicalNotes.length,
    duration_days: durationDays,
    notes: woundCase.notes,
    last_updated_at: woundCase.last_updated_at,
    created_at: woundCase.createdAt,
    updated_at: woundCase.updatedAt,
  };
};

const buildWoundCasePayload = (body, { partial = false } = {}) => {
  const payload = {};
  const stringFields = [
    'wound_type',
    'severity_stage',
    'body_location',
    'wound_etiology',
    'status',
    'notes',
  ];
  const numberFields = [
    'pain_score',
    'healing_progress',
    'length_cm',
    'width_cm',
    'depth_cm',
  ];

  const patientId = getBodyValue(body, 'patient_id');
  if (patientId !== undefined || !partial) {
    payload.patient_id = parseId(patientId);
  }

  stringFields.forEach((field) => {
    const value = cleanString(getBodyValue(body, field));

    if (value !== undefined || !partial) {
      payload[field] = value || null;
    }
  });

  numberFields.forEach((field) => {
    const value = getBodyValue(body, field);

    if (value !== undefined || !partial) {
      payload[field] = parseNumber(value);
    }
  });

  if (!partial) {
    payload.status = payload.status || 'active';
    payload.images = asArray(body.images).map(formatImage).filter((image) => image.url);
    payload.measurements = asArray(body.measurements).map(formatMeasurement);
    payload.updates = asArray(body.updates).map(formatWoundUpdate);
    payload.clinical_notes = asArray(body.clinical_notes || body.clinicalNotes)
      .map(formatClinicalNote)
      .filter((note) => note.text || note.soap || note.audio_url);
    payload.reports = asArray(body.reports).map(formatReport);
  }

  if (payload.status) {
    payload.status = payload.status.toLowerCase();
  }

  payload.last_updated_at = new Date();

  return payload;
};

const validateWoundCasePayload = (payload, { partial = false } = {}) => {
  if (!partial && !payload.patient_id) {
    return 'patient_id is required';
  }

  if (!partial && !payload.wound_type) {
    return 'wound_type is required';
  }

  if (Number.isNaN(payload.patient_id)) {
    return 'patient_id must be a valid positive id';
  }

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

  const invalidMeasurementField = ['length_cm', 'width_cm', 'depth_cm'].find(
    (field) =>
      payload[field] !== undefined &&
      payload[field] !== null &&
      (Number.isNaN(payload[field]) || payload[field] < 0)
  );

  if (invalidMeasurementField) {
    return `${invalidMeasurementField} must be 0 or greater`;
  }

  return null;
};

const ensurePatientExists = async (patientId, req) => {
  if (!patientId) {
    return null;
  }

  const patient = await Patient.findByPk(patientId);
  if (!patient) {
    return 'Patient not found';
  }

  if (isNurse(req) && Number(patient.nurse_id) !== Number(req.user.id)) {
    return 'Patient not found';
  }

  return null;
};

const createWoundCase = async (req, res) => {
  try {
    const payload = buildWoundCasePayload(req.body);
    const validationError = validateWoundCasePayload(payload);

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const patientError = await ensurePatientExists(payload.patient_id, req);
    if (patientError) {
      return res.status(404).json({ message: patientError });
    }

    const initialMeasurement = buildInitialMeasurement(payload);
    if (initialMeasurement) {
      payload.measurements = [initialMeasurement, ...payload.measurements];
    }

    const woundCase = await WoundCase.create(payload);

    return res.status(201).json({
      message: 'Wound case created successfully',
      wound_case: woundCaseResponse(woundCase),
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Wound case creation failed',
      error: error.message,
    });
  }
};

const getWoundCases = async (req, res) => {
  try {
    const { id } = req.params;

    if (id) {
      const woundCase = await getScopedWoundCase(req, id);

      if (!woundCase) {
        return res.status(404).json({ message: 'Wound case not found' });
      }

      return res.status(200).json({ wound_case: woundCaseResponse(woundCase) });
    }

    const where = {};
    let nursePatientIds = null;

    if (isNurse(req)) {
      nursePatientIds = await getNursePatientIds(req.user.id);

      if (!nursePatientIds.length) {
        return res.status(200).json({ wound_cases: [] });
      }
    }

    if (req.query.patient_id) {
      if (
        isNurse(req) &&
        !nursePatientIds.map(String).includes(String(req.query.patient_id))
      ) {
        return res.status(200).json({ wound_cases: [] });
      }

      where.patient_id = req.query.patient_id;
    } else if (isNurse(req)) {
      where.patient_id = nursePatientIds;
    }

    if (req.query.status) {
      where.status = String(req.query.status).toLowerCase();
    }

    if (req.query.wound_type) {
      where.wound_type = { [Op.like]: `%${req.query.wound_type}%` };
    }

    if (req.query.search) {
      where[Op.or] = [
        { wound_type: { [Op.like]: `%${req.query.search}%` } },
        { body_location: { [Op.like]: `%${req.query.search}%` } },
        { wound_etiology: { [Op.like]: `%${req.query.search}%` } },
      ];
    }

    const woundCases = await WoundCase.findAll({
      where,
      order: [['createdAt', 'DESC']],
    });

    return res.status(200).json({
      wound_cases: woundCases.map(woundCaseResponse),
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Wound cases fetch failed',
      error: error.message,
    });
  }
};

const updateWoundCase = async (req, res) => {
  try {
    const { id } = req.params;
    const woundCase = await getScopedWoundCase(req, id);

    if (!woundCase) {
      return res.status(404).json({ message: 'Wound case not found' });
    }

    const payload = buildWoundCasePayload(req.body, { partial: true });
    const validationError = validateWoundCasePayload(payload, { partial: true });

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const patientError = await ensurePatientExists(payload.patient_id, req);
    if (patientError) {
      return res.status(404).json({ message: patientError });
    }

    await woundCase.update(payload);

    return res.status(200).json({
      message: 'Wound case updated successfully',
      wound_case: woundCaseResponse(woundCase),
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Wound case update failed',
      error: error.message,
    });
  }
};

const addWoundImage = async (req, res) => {
  try {
    const { id } = req.params;
    const woundCase = await getScopedWoundCase(req, id);

    if (!woundCase) {
      return res.status(404).json({ message: 'Wound case not found' });
    }

    const images = asArray(req.body.images);
    const singleImage = {
      url: req.body.url || req.body.image_url || req.body.imageUrl,
      caption: req.body.caption,
    };
    const newImages = (images.length ? images : [singleImage])
      .map(formatImage)
      .filter((image) => image.url);

    if (!newImages.length) {
      return res.status(400).json({ message: 'image url is required' });
    }

    await woundCase.update({
      images: [...asArray(woundCase.images), ...newImages],
      last_updated_at: new Date(),
    });

    return res.status(200).json({
      message: 'Wound image added successfully',
      wound_case: woundCaseResponse(woundCase),
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Wound image add failed',
      error: error.message,
    });
  }
};

const deleteWoundImage = async (req, res) => {
  try {
    const { id, imageId } = req.params;
    const woundCase = await getScopedWoundCase(req, id);

    if (!woundCase) {
      return res.status(404).json({ message: 'Wound case not found' });
    }

    const images = asArray(woundCase.images);
    const nextImages = images.filter((image) => String(image.id) !== String(imageId));

    if (nextImages.length === images.length) {
      return res.status(404).json({ message: 'Wound image not found' });
    }

    await woundCase.update({
      images: nextImages,
      last_updated_at: new Date(),
    });

    return res.status(200).json({
      message: 'Wound image deleted successfully',
      wound_case: woundCaseResponse(woundCase),
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Wound image delete failed',
      error: error.message,
    });
  }
};

const addMeasurement = async (req, res) => {
  try {
    const { id } = req.params;
    const woundCase = await getScopedWoundCase(req, id);

    if (!woundCase) {
      return res.status(404).json({ message: 'Wound case not found' });
    }

    const measurement = formatMeasurement(req.body);
    const hasMeasurement =
      measurement.length_cm !== null ||
      measurement.width_cm !== null ||
      measurement.depth_cm !== null ||
      measurement.pain_score !== null;

    if (!hasMeasurement) {
      return res.status(400).json({
        message: 'At least one measurement value is required',
      });
    }

    const validationError = validateWoundCasePayload(
      {
        pain_score: measurement.pain_score,
        length_cm: measurement.length_cm,
        width_cm: measurement.width_cm,
        depth_cm: measurement.depth_cm,
      },
      { partial: true }
    );

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    await woundCase.update({
      length_cm:
        measurement.length_cm !== null ? measurement.length_cm : woundCase.length_cm,
      width_cm: measurement.width_cm !== null ? measurement.width_cm : woundCase.width_cm,
      depth_cm: measurement.depth_cm !== null ? measurement.depth_cm : woundCase.depth_cm,
      pain_score:
        measurement.pain_score !== null ? measurement.pain_score : woundCase.pain_score,
      measurements: [...asArray(woundCase.measurements), measurement],
      last_updated_at: new Date(),
    });

    return res.status(200).json({
      message: 'Measurement added successfully',
      wound_case: woundCaseResponse(woundCase),
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Measurement add failed',
      error: error.message,
    });
  }
};

const getTimeline = async (req, res) => {
  try {
    const woundCase = await getScopedWoundCase(req, req.params.id);

    if (!woundCase) {
      return res.status(404).json({ message: 'Wound case not found' });
    }

    return res.status(200).json({
      timeline: asArray(woundCase.updates),
      measurements: asArray(woundCase.measurements),
      images: asArray(woundCase.images),
      clinical_notes: asArray(woundCase.clinical_notes),
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Timeline fetch failed',
      error: error.message,
    });
  }
};

const getImages = async (req, res) => {
  try {
    const woundCase = await getScopedWoundCase(req, req.params.id);

    if (!woundCase) {
      return res.status(404).json({ message: 'Wound case not found' });
    }

    return res.status(200).json({ images: asArray(woundCase.images) });
  } catch (error) {
    return res.status(500).json({
      message: 'Wound images fetch failed',
      error: error.message,
    });
  }
};

const getMeasurements = async (req, res) => {
  try {
    const woundCase = await getScopedWoundCase(req, req.params.id);

    if (!woundCase) {
      return res.status(404).json({ message: 'Wound case not found' });
    }

    return res.status(200).json({
      current: {
        length_cm: woundCase.length_cm,
        width_cm: woundCase.width_cm,
        depth_cm: woundCase.depth_cm,
        pain_score: woundCase.pain_score,
      },
      measurements: asArray(woundCase.measurements),
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Measurements fetch failed',
      error: error.message,
    });
  }
};

const addClinicalNote = async (req, res) => {
  try {
    const woundCase = await getScopedWoundCase(req, req.params.id);

    if (!woundCase) {
      return res.status(404).json({ message: 'Wound case not found' });
    }

    const note = formatClinicalNote(req.body);

    if (!note.text && !note.soap && !note.audio_url) {
      return res.status(400).json({ message: 'note text, soap, or audio_url is required' });
    }

    await woundCase.update({
      clinical_notes: [...asArray(woundCase.clinical_notes), note],
      last_updated_at: new Date(),
    });

    return res.status(200).json({
      message: 'Clinical note added successfully',
      clinical_note: note,
      wound_case: woundCaseResponse(woundCase),
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Clinical note add failed',
      error: error.message,
    });
  }
};

const getClinicalNotes = async (req, res) => {
  try {
    const woundCase = await getScopedWoundCase(req, req.params.id);

    if (!woundCase) {
      return res.status(404).json({ message: 'Wound case not found' });
    }

    return res.status(200).json({
      clinical_notes: asArray(woundCase.clinical_notes),
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Clinical notes fetch failed',
      error: error.message,
    });
  }
};

const generateSoapNote = async (req, res) => {
  try {
    const woundCase = await getScopedWoundCase(req, req.params.id);

    if (!woundCase) {
      return res.status(404).json({ message: 'Wound case not found' });
    }

    const text = cleanString(req.body.text || req.body.clinical_note || req.body.clinicalNote) || woundCase.notes || '';
    const soap = {
      subjective: cleanString(req.body.subjective) || `Pain score ${woundCase.pain_score || 0}/10.`,
      objective:
        cleanString(req.body.objective) ||
        `${woundCase.wound_type} at ${woundCase.body_location || 'recorded location'} measuring L ${woundCase.length_cm || 0} x W ${woundCase.width_cm || 0} x D ${woundCase.depth_cm || 0} cm.`,
      assessment:
        cleanString(req.body.assessment) ||
        text ||
        `${woundCase.severity_stage || 'Current stage'} wound with ${woundCase.healing_progress || 0}% healing progress.`,
      plan:
        cleanString(req.body.plan) ||
        'Continue wound care, monitor pain, drainage, and signs of infection.',
    };
    const note = formatClinicalNote({
      note_type: 'soap',
      title: 'AI SOAP Note',
      text,
      soap,
      is_ai_generated: true,
      created_by: req.body.created_by || req.body.createdBy,
    });

    await woundCase.update({
      clinical_notes: [...asArray(woundCase.clinical_notes), note],
      last_updated_at: new Date(),
    });

    return res.status(200).json({
      message: 'SOAP note generated successfully',
      clinical_note: note,
    });
  } catch (error) {
    return res.status(500).json({
      message: 'SOAP note generation failed',
      error: error.message,
    });
  }
};

const addReport = async (req, res) => {
  try {
    const woundCase = await getScopedWoundCase(req, req.params.id);

    if (!woundCase) {
      return res.status(404).json({ message: 'Wound case not found' });
    }

    const report = formatReport(req.body);

    await woundCase.update({
      reports: [...asArray(woundCase.reports), report],
      last_updated_at: new Date(),
    });

    return res.status(200).json({
      message: 'Report added successfully',
      report,
      wound_case: woundCaseResponse(woundCase),
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Report add failed',
      error: error.message,
    });
  }
};

const getReports = async (req, res) => {
  try {
    const woundCase = await getScopedWoundCase(req, req.params.id);

    if (!woundCase) {
      return res.status(404).json({ message: 'Wound case not found' });
    }

    return res.status(200).json({ reports: asArray(woundCase.reports) });
  } catch (error) {
    return res.status(500).json({
      message: 'Reports fetch failed',
      error: error.message,
    });
  }
};

const buildReportData = (woundCase) => {
  const measurements = asArray(woundCase.measurements);
  const latestNote = asArray(woundCase.clinical_notes).slice(-1)[0] || null;

  return {
    patient_id: woundCase.patient_id,
    wound_type: woundCase.wound_type,
    severity_stage: woundCase.severity_stage,
    body_location: woundCase.body_location,
    duration_days: woundCaseResponse(woundCase).duration_days,
    pain_score: woundCase.pain_score,
    healing_progress: woundCase.healing_progress,
    length_cm: woundCase.length_cm,
    width_cm: woundCase.width_cm,
    depth_cm: woundCase.depth_cm,
    updates_count: asArray(woundCase.updates).length || measurements.length,
    images: asArray(woundCase.images),
    measurements,
    latest_note: latestNote,
    generated_at: currentTimestamp(),
  };
};

const generateReport = async (req, res) => {
  try {
    const woundCase = await getScopedWoundCase(req, req.params.id);

    if (!woundCase) {
      return res.status(404).json({ message: 'Wound case not found' });
    }

    const report = formatReport({
      title: req.body.title || 'Complete Wound Report',
      report_type: req.body.report_type || req.body.reportType || 'full',
      summary:
        req.body.summary ||
        `${woundCase.wound_type} report for ${woundCase.body_location || 'wound location'}.`,
      pages: req.body.pages || 1,
      file_size: req.body.file_size || req.body.fileSize,
      url: req.body.url || req.body.file_url || req.body.fileUrl,
      generated_by: req.body.generated_by || req.body.generatedBy,
      report_data: buildReportData(woundCase),
    });

    await woundCase.update({
      reports: [...asArray(woundCase.reports), report],
      last_updated_at: new Date(),
    });

    return res.status(201).json({
      message: 'Report generated successfully',
      report,
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Report generation failed',
      error: error.message,
    });
  }
};

const findReport = (woundCase, reportId) =>
  asArray(woundCase.reports).find((report) => String(report.id) === String(reportId));

const getReportPreview = async (req, res) => {
  try {
    const woundCase = await getScopedWoundCase(req, req.params.id);

    if (!woundCase) {
      return res.status(404).json({ message: 'Wound case not found' });
    }

    const report = findReport(woundCase, req.params.reportId);

    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }

    return res.status(200).json({
      report,
      preview: report.report_data || buildReportData(woundCase),
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Report preview failed',
      error: error.message,
    });
  }
};

const shareReport = async (req, res) => {
  try {
    const woundCase = await getScopedWoundCase(req, req.params.id);

    if (!woundCase) {
      return res.status(404).json({ message: 'Wound case not found' });
    }

    const reports = asArray(woundCase.reports);
    const reportIndex = reports.findIndex(
      (report) => String(report.id) === String(req.params.reportId)
    );

    if (reportIndex === -1) {
      return res.status(404).json({ message: 'Report not found' });
    }

    const share = {
      id: makeId('share'),
      name: cleanString(req.body.name) || null,
      email: cleanString(req.body.email),
      role: cleanString(req.body.role) || null,
      expires_at: req.body.expires_at || req.body.expiresAt || null,
      shared_at: currentTimestamp(),
    };

    if (!share.email) {
      return res.status(400).json({ message: 'email is required' });
    }

    reports[reportIndex] = {
      ...reports[reportIndex],
      shared_with: [...asArray(reports[reportIndex].shared_with), share],
    };

    await woundCase.update({
      reports,
      last_updated_at: new Date(),
    });

    return res.status(200).json({
      message: 'Report shared successfully',
      report: reports[reportIndex],
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Report share failed',
      error: error.message,
    });
  }
};

const downloadReport = async (req, res) => {
  try {
    const woundCase = await getScopedWoundCase(req, req.params.id);

    if (!woundCase) {
      return res.status(404).json({ message: 'Wound case not found' });
    }

    const report = findReport(woundCase, req.params.reportId);

    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }

    return res.status(200).json({
      message: report.url ? 'Report download URL ready' : 'Report data ready for PDF generation',
      download_url: report.url,
      report,
      preview: report.report_data || buildReportData(woundCase),
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Report download failed',
      error: error.message,
    });
  }
};

const saveVoiceDictation = async (req, res) => {
  try {
    const woundCase = await getScopedWoundCase(req, req.params.id);

    if (!woundCase) {
      return res.status(404).json({ message: 'Wound case not found' });
    }

    const transcript = cleanString(req.body.transcript || req.body.text);
    const note = formatClinicalNote({
      note_type: 'voice',
      title: req.body.title || 'Voice Note',
      text: transcript,
      audio_url: req.body.audio_url || req.body.audioUrl,
      duration_seconds: req.body.duration_seconds || req.body.durationSeconds,
      created_by: req.body.created_by || req.body.createdBy,
    });

    if (!note.text && !note.audio_url) {
      return res.status(400).json({ message: 'transcript or audio_url is required' });
    }

    await woundCase.update({
      clinical_notes: [...asArray(woundCase.clinical_notes), note],
      last_updated_at: new Date(),
    });

    return res.status(201).json({
      message: 'Voice dictation saved successfully',
      clinical_note: note,
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Voice dictation save failed',
      error: error.message,
    });
  }
};

const addWoundUpdate = async (req, res) => {
  try {
    const woundCase = await getScopedWoundCase(req, req.params.id);

    if (!woundCase) {
      return res.status(404).json({ message: 'Wound case not found' });
    }

    const update = formatWoundUpdate(req.body);
    const newImages = asArray(req.body.images).map(formatImage).filter((image) => image.url);
    const measurement = formatMeasurement(req.body.measurement || req.body);
    const hasMeasurement =
      measurement.length_cm !== null ||
      measurement.width_cm !== null ||
      measurement.depth_cm !== null ||
      measurement.pain_score !== null;
    const noteText = req.body.clinical_note || req.body.clinicalNote || req.body.note;
    const note = noteText
      ? formatClinicalNote({
          note_type: req.body.note_type || req.body.noteType || 'manual',
          text: noteText,
          created_by: req.body.created_by || req.body.createdBy,
        })
      : null;

    const validationError = validateWoundCasePayload(
      {
        pain_score: measurement.pain_score,
        healing_progress: update.healing_progress,
        length_cm: measurement.length_cm,
        width_cm: measurement.width_cm,
        depth_cm: measurement.depth_cm,
      },
      { partial: true }
    );

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    await woundCase.update({
      severity_stage: update.severity_stage || woundCase.severity_stage,
      pain_score: measurement.pain_score !== null ? measurement.pain_score : woundCase.pain_score,
      healing_progress:
        update.healing_progress !== null ? update.healing_progress : woundCase.healing_progress,
      length_cm: measurement.length_cm !== null ? measurement.length_cm : woundCase.length_cm,
      width_cm: measurement.width_cm !== null ? measurement.width_cm : woundCase.width_cm,
      depth_cm: measurement.depth_cm !== null ? measurement.depth_cm : woundCase.depth_cm,
      images: [...asArray(woundCase.images), ...newImages],
      measurements: hasMeasurement
        ? [...asArray(woundCase.measurements), measurement]
        : asArray(woundCase.measurements),
      updates: [...asArray(woundCase.updates), update],
      clinical_notes: note
        ? [...asArray(woundCase.clinical_notes), note]
        : asArray(woundCase.clinical_notes),
      last_updated_at: new Date(),
    });

    return res.status(200).json({
      message: 'Wound update saved successfully',
      update,
      wound_case: woundCaseResponse(woundCase),
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Wound update save failed',
      error: error.message,
    });
  }
};

const deleteWoundCase = async (req, res) => {
  try {
    const { id } = req.params;
    const woundCase = await getScopedWoundCase(req, id);

    if (!woundCase) {
      return res.status(404).json({ message: 'Wound case not found' });
    }

    await woundCase.destroy();

    return res.status(200).json({
      message: 'Wound case deleted successfully',
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Wound case deletion failed',
      error: error.message,
    });
  }
};

module.exports = {
  addMeasurement,
  addClinicalNote,
  addReport,
  addWoundUpdate,
  addWoundImage,
  createWoundCase,
  deleteWoundCase,
  deleteWoundImage,
  downloadReport,
  generateReport,
  generateSoapNote,
  getClinicalNotes,
  getImages,
  getMeasurements,
  getReportPreview,
  getReports,
  getWoundCases,
  getTimeline,
  saveVoiceDictation,
  shareReport,
  updateWoundCase,
};
