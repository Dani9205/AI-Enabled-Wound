const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');
const OpenAI = require('openai');
const PDFDocument = require('pdfkit');
const { Op } = require('sequelize');
const Patient = require('../models/patientModel');
const WoundCase = require('../models/woundCaseModel');

const VALID_STATUSES = ['active', 'monitoring', 'healing', 'healed', 'closed'];
const reportUploadDir = path.join(__dirname, '..', 'uploads', 'reports');
const uploadsRoot = path.join(__dirname, '..', 'uploads');

fs.mkdirSync(reportUploadDir, { recursive: true });

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

const getRequestBaseUrl = (req) => `${req.protocol}://${req.get('host')}`;

const getUploadedWoundImageFiles = (req) => {
  if (req.file) {
    return [req.file];
  }

  if (!req.files) {
    return [];
  }

  if (Array.isArray(req.files)) {
    return req.files;
  }

  return Object.values(req.files).flat();
};

const getIndexedBodyValue = (value, index) => {
  if (Array.isArray(value)) {
    return value[index] !== undefined ? value[index] : value[0];
  }

  return value;
};

const uploadedFileToImage = (req, file, index) => ({
  url: `${getRequestBaseUrl(req)}/uploads/wound-images/${file.filename}`,
  caption: getIndexedBodyValue(req.body.caption || req.body.captions, index),
  original_name: file.originalname,
  mime_type: file.mimetype,
  size: file.size,
});

const formatImage = (image) => ({
  id: image.id || makeId('img'),
  url: cleanString(image.url || image.image_url || image.imageUrl),
  caption: cleanString(image.caption) || null,
  original_name: cleanString(image.original_name || image.originalName) || null,
  mime_type: cleanString(image.mime_type || image.mimeType) || null,
  size: parseNumber(image.size),
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
  audio_file_path: cleanString(note.audio_file_path || note.audioFilePath) || null,
  audio_original_name: cleanString(note.audio_original_name || note.audioOriginalName) || null,
  audio_mime_type: cleanString(note.audio_mime_type || note.audioMimeType) || null,
  audio_size: parseNumber(
    note.audio_size !== undefined ? note.audio_size : note.audioSize
  ),
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
  is_ai_generated: Boolean(report.is_ai_generated || report.isAiGenerated),
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

    const uploadedImages = getUploadedWoundImageFiles(req).map((file, index) =>
      uploadedFileToImage(req, file, index)
    );
    const images = asArray(req.body.images);
    const singleImage = {
      url: req.body.url || req.body.image_url || req.body.imageUrl,
      caption: req.body.caption,
    };
    const imageSources = uploadedImages.length
      ? uploadedImages
      : images.length
        ? images
        : [singleImage];
    const newImages = imageSources
      .map(formatImage)
      .filter((image) => image.url);

    if (!newImages.length) {
      return res.status(400).json({ message: 'image file or image url is required' });
    }

    const nextImages = [...asArray(woundCase.images), ...newImages];

    await woundCase.update({
      images: nextImages,
      last_updated_at: new Date(),
    });

    return res.status(200).json({
      message: 'Wound image added successfully',
      images: nextImages,
      added_images: newImages,
      wound_case: woundCaseResponse({
        ...woundCase.get({ plain: true }),
        images: nextImages,
      }),
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

    const images = asArray(woundCase.images);

    return res.status(200).json({
      images,
      images_count: images.length,
    });
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

const parseSoapNoteResponse = (body) => {
  const normalizedBody = cleanString(body)?.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');

  if (!normalizedBody) {
    throw new Error('OpenAI returned an empty SOAP note');
  }

  const parsed = JSON.parse(normalizedBody);
  const soap = parsed.soap || parsed.soap_note || parsed.soapNote || parsed;
  const normalizedSoap = {
    subjective: cleanString(soap.subjective),
    objective: cleanString(soap.objective),
    assessment: cleanString(soap.assessment),
    plan: cleanString(soap.plan),
  };

  if (Object.values(normalizedSoap).some((section) => !section)) {
    throw new Error('OpenAI returned an incomplete SOAP note');
  }

  return normalizedSoap;
};

const callOpenAiSoapService = async ({ woundCase, text, instructions }) => {
  const apiKey = cleanString(process.env.OPENAI_API_KEY);

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is required for SOAP note generation');
  }

  const openai = new OpenAI({ apiKey });
  const modelCandidates = [
    cleanString(process.env.OPENAI_SOAP_MODEL),
    cleanString(process.env.OPENAI_REPORT_MODEL),
    'gpt-4.1-mini',
  ].filter((model, index, models) => model && models.indexOf(model) === index);
  const modelErrors = [];
  const input = [
    {
      role: 'system',
      content:
        'You are a clinical documentation assistant. Convert the supplied wound-care narrative and case facts into a concise professional SOAP note. Synthesize and reorganize the information instead of copying the narrative verbatim. Do not invent facts, diagnoses, examination findings, treatments, or patient statements. Clearly state when clinically relevant information is not documented. Return only JSON containing the string fields subjective, objective, assessment, and plan.',
    },
    {
      role: 'user',
      content: JSON.stringify({
        clinical_narrative: text || null,
        wound_case: {
          wound_type: woundCase.wound_type,
          severity_stage: woundCase.severity_stage,
          body_location: woundCase.body_location,
          wound_etiology: woundCase.wound_etiology,
          status: woundCase.status,
          pain_score: woundCase.pain_score,
          healing_progress: woundCase.healing_progress,
          length_cm: woundCase.length_cm,
          width_cm: woundCase.width_cm,
          depth_cm: woundCase.depth_cm,
          existing_notes: woundCase.notes,
          latest_measurement: asArray(woundCase.measurements).slice(-1)[0] || null,
        },
        additional_instructions: cleanString(instructions) || null,
      }),
    },
  ];

  for (const model of modelCandidates) {
    try {
      const response = await openai.responses.create({
        model,
        input,
        text: {
          format: {
            type: 'json_schema',
            name: 'soap_note',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                subjective: { type: 'string' },
                objective: { type: 'string' },
                assessment: { type: 'string' },
                plan: { type: 'string' },
              },
              required: ['subjective', 'objective', 'assessment', 'plan'],
              additionalProperties: false,
            },
          },
        },
      });

      return {
        soap: parseSoapNoteResponse(response.output_text),
        model,
      };
    } catch (error) {
      const code = error.code || error.error?.code;
      const status = error.status || error.statusCode;
      const message = error.message || 'OpenAI request failed';

      if (status === 401 || status === 403 || status === 429) {
        throw new Error(`OpenAI SOAP note generation failed: ${message}`);
      }

      modelErrors.push(`${model}: ${code || status || 'error'} ${message}`);
    }
  }

  throw new Error(`OpenAI SOAP note generation failed for all models: ${modelErrors.join(' | ')}`);
};

/**
 * Generates and persists an AI-authored SOAP clinical note for a scoped wound case.
 *
 * Uses `text`, `clinical_note`, or `clinicalNote` as the source narrative, falling
 * back to the wound case notes. Optional AI guidance can be supplied through
 * `instructions`, `ai_instructions`, or `aiInstructions`. The generated note is
 * appended to the case's `clinical_notes` JSON collection.
 *
 * @param {import('express').Request} req Nurse-authenticated request with wound case ID.
 * @param {import('express').Response} res Express response containing the saved note.
 * @returns {Promise<import('express').Response>}
 */
const generateSoapNote = async (req, res) => {
  try {
    const woundCase = await getScopedWoundCase(req, req.params.id);

    if (!woundCase) {
      return res.status(404).json({ message: 'Wound case not found' });
    }

    const text =
      cleanString(req.body.text || req.body.clinical_note || req.body.clinicalNote) ||
      cleanString(woundCase.notes) ||
      '';
    const aiResult = await callOpenAiSoapService({
      woundCase,
      text,
      instructions: req.body.instructions || req.body.ai_instructions || req.body.aiInstructions,
    });
    const note = formatClinicalNote({
      note_type: 'soap',
      title: 'AI SOAP Note',
      text,
      soap: aiResult.soap,
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
      ai_model: aiResult.model,
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

const formatPdfValue = (value, fallback = 'N/A') => {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  if (Array.isArray(value)) {
    return value.length ? value.join(', ') : fallback;
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
};

const addPdfSectionTitle = (doc, title) => {
  doc.moveDown(0.8);
  doc.fontSize(14).font('Helvetica-Bold').text(title);
  doc.moveDown(0.3);
  doc.fontSize(10).font('Helvetica');
};

const addPdfKeyValue = (doc, label, value) => {
  doc
    .font('Helvetica-Bold')
    .text(`${label}: `, { continued: true })
    .font('Helvetica')
    .text(formatPdfValue(value));
};

const writeReportPdf = ({ filePath, woundCase, report, reportData }) =>
  new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const stream = fs.createWriteStream(filePath);
    const measurements = asArray(reportData.measurements);
    const images = asArray(reportData.images);
    const latestMeasurement = measurements.slice(-1)[0] || null;
    const latestNote = reportData.latest_note || null;

    stream.on('finish', resolve);
    stream.on('error', reject);
    doc.on('error', reject);
    doc.pipe(stream);

    doc.fontSize(20).font('Helvetica-Bold').text(report.title || 'Wound Report');
    doc.moveDown(0.2);
    doc.fontSize(10).font('Helvetica').text(`Generated at: ${formatPdfValue(report.generated_at || reportData.generated_at)}`);
    doc.text(`Report ID: ${formatPdfValue(report.id)}`);

    if (report.summary) {
      doc.moveDown();
      doc.fontSize(11).text(report.summary, { align: 'left' });
    }

    addPdfSectionTitle(doc, 'Wound Summary');
    addPdfKeyValue(doc, 'Wound Case ID', woundCase.id);
    addPdfKeyValue(doc, 'Patient ID', woundCase.patient_id);
    addPdfKeyValue(doc, 'Wound Type', reportData.wound_type);
    addPdfKeyValue(doc, 'Body Location', reportData.body_location);
    addPdfKeyValue(doc, 'Severity Stage', reportData.severity_stage);
    addPdfKeyValue(doc, 'Status', woundCase.status);
    addPdfKeyValue(doc, 'Duration Days', reportData.duration_days);
    addPdfKeyValue(doc, 'Healing Progress', reportData.healing_progress !== null ? `${reportData.healing_progress}%` : null);
    addPdfKeyValue(doc, 'Pain Score', reportData.pain_score);

    addPdfSectionTitle(doc, 'Current Measurements');
    addPdfKeyValue(doc, 'Length (cm)', reportData.length_cm);
    addPdfKeyValue(doc, 'Width (cm)', reportData.width_cm);
    addPdfKeyValue(doc, 'Depth (cm)', reportData.depth_cm);

    if (latestMeasurement) {
      addPdfSectionTitle(doc, 'Latest Measurement Entry');
      addPdfKeyValue(doc, 'Measured At', latestMeasurement.measured_at);
      addPdfKeyValue(doc, 'Length (cm)', latestMeasurement.length_cm);
      addPdfKeyValue(doc, 'Width (cm)', latestMeasurement.width_cm);
      addPdfKeyValue(doc, 'Depth (cm)', latestMeasurement.depth_cm);
      addPdfKeyValue(doc, 'Pain Score', latestMeasurement.pain_score);
      addPdfKeyValue(doc, 'Notes', latestMeasurement.notes);
    }

    if (latestNote) {
      addPdfSectionTitle(doc, 'Latest Clinical Note');
      addPdfKeyValue(doc, 'Type', latestNote.note_type);
      addPdfKeyValue(doc, 'Title', latestNote.title);
      addPdfKeyValue(doc, 'Created At', latestNote.created_at);
      addPdfKeyValue(doc, 'Text', latestNote.text);

      if (latestNote.soap) {
        addPdfKeyValue(doc, 'SOAP', latestNote.soap);
      }
    }

    addPdfSectionTitle(doc, 'Images');
    if (images.length) {
      images.forEach((image, index) => {
        doc.text(`${index + 1}. ${formatPdfValue(image.caption, 'Wound image')} - ${formatPdfValue(image.url)}`);
      });
    } else {
      doc.text('No wound images recorded.');
    }

    addPdfSectionTitle(doc, 'Report Metadata');
    addPdfKeyValue(doc, 'Report Type', report.report_type);
    addPdfKeyValue(doc, 'Generated By', report.generated_by);
    addPdfKeyValue(doc, 'Updates Count', reportData.updates_count);
    addPdfKeyValue(doc, 'Images Count', images.length);
    addPdfKeyValue(doc, 'Measurements Count', measurements.length);

    doc.end();
  });

const getReportFileName = (woundCase, report) =>
  `wound-report-${woundCase.id}-${String(report.id || makeId('report')).replace(/[^a-z0-9_-]/gi, '-')}.pdf`;

const getReportPublicUrl = (req, fileName) =>
  `${getRequestBaseUrl(req)}/uploads/reports/${fileName}`;

const getUploadedVoiceDictationFile = (req) => {
  if (req.file) {
    return req.file;
  }

  if (!req.files) {
    return null;
  }

  if (Array.isArray(req.files)) {
    return req.files[0] || null;
  }

  return Object.values(req.files).flat()[0] || null;
};

const uploadedVoiceFileToNoteData = (req, file) => ({
  audio_url: `${getRequestBaseUrl(req)}/uploads/voice-dictations/${file.filename}`,
  audio_file_path: `/uploads/voice-dictations/${file.filename}`,
  audio_original_name: file.originalname,
  audio_mime_type: file.mimetype,
  audio_size: file.size,
});

const resolveLocalUploadPath = (filePathOrUrl) => {
  const value = cleanString(filePathOrUrl);

  if (!value) {
    return null;
  }

  let uploadPath = value;

  try {
    uploadPath = new URL(value).pathname;
  } catch (error) {
    uploadPath = value;
  }

  if (!uploadPath.startsWith('/uploads/')) {
    return null;
  }

  const relativePath = uploadPath.replace(/^\/uploads\//, '');
  const resolvedPath = path.resolve(uploadsRoot, relativePath);

  if (!resolvedPath.startsWith(path.resolve(uploadsRoot))) {
    return null;
  }

  return resolvedPath;
};

const parseWhisperResponseText = (body) => {
  try {
    const parsed = JSON.parse(body);
    return cleanString(
      parsed.text ||
        parsed.transcript ||
        parsed.transcription ||
        parsed.data?.text ||
        parsed.result?.text
    );
  } catch (error) {
    return cleanString(body);
  }
};

const transcribeAudioFile = async (filePath) => {
  if (!process.env.WHISPER_SERVICE_URL) {
    throw new Error('WHISPER_SERVICE_URL is required for voice transcription');
  }

  const serviceUrl = new URL(process.env.WHISPER_SERVICE_URL);
  const boundary = `----wound-whisper-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const fileName = path.basename(filePath);
  const fileBuffer = fs.readFileSync(filePath);
  const multipartHeader = Buffer.from(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n` +
      'Content-Type: application/octet-stream\r\n\r\n'
  );
  const multipartFooter = Buffer.from(`\r\n--${boundary}--\r\n`);
  const requestBody = Buffer.concat([multipartHeader, fileBuffer, multipartFooter]);
  const transport = serviceUrl.protocol === 'https:' ? https : http;
  const headers = {
    'Content-Type': `multipart/form-data; boundary=${boundary}`,
    'Content-Length': requestBody.length,
  };

  if (process.env.WHISPER_SERVICE_API_KEY) {
    headers.Authorization = `Bearer ${process.env.WHISPER_SERVICE_API_KEY}`;
  }

  const responseBody = await new Promise((resolve, reject) => {
    const request = transport.request(
      {
        method: 'POST',
        hostname: serviceUrl.hostname,
        port: serviceUrl.port || undefined,
        path: `${serviceUrl.pathname}${serviceUrl.search}`,
        headers,
      },
      (response) => {
        const chunks = [];

        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf8');

          if (response.statusCode < 200 || response.statusCode >= 300) {
            return reject(
              new Error(`Whisper service failed with status ${response.statusCode}: ${body}`)
            );
          }

          return resolve(body);
        });
      }
    );

    request.on('error', reject);
    request.write(requestBody);
    request.end();
  });

  return parseWhisperResponseText(responseBody);
};

const parseAiReportResponse = (body) => {
  try {
    const parsed = JSON.parse(body);
    const report = parsed.report || parsed.data || parsed.result || parsed;

    return {
      title: cleanString(report.title),
      summary: cleanString(report.summary || report.impression || report.assessment),
      report_type: cleanString(report.report_type || report.reportType),
      pages: parseNumber(report.pages),
      report_data:
        report.report_data ||
        report.reportData ||
        report.sections ||
        report.content ||
        report,
    };
  } catch (error) {
    return {
      summary: cleanString(body),
      report_data: { generated_text: cleanString(body) },
    };
  }
};

const callOpenAiReportService = async ({ woundCase, reportData, body }) => {
  const apiKey = cleanString(process.env.OPENAI_API_KEY);

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is required for AI report generation');
  }

  const openai = new OpenAI({ apiKey });
  const reportType = body.report_type || body.reportType || 'full';
  const instructions =
    body.instructions || body.ai_instructions || body.aiInstructions || '';
  const modelCandidates = [
    cleanString(process.env.OPENAI_REPORT_MODEL),
    cleanString(process.env.OPENAI_REPORT_FALLBACK_MODEL),
    'gpt-4.1-mini',
  ].filter((model, index, models) => model && models.indexOf(model) === index);
  const input = [
    {
      role: 'system',
      content:
        'You generate concise clinical wound reports from structured data. Do not invent patient facts. Return only valid JSON with keys: title, summary, report_type, pages, report_data.',
    },
    {
      role: 'user',
      content: JSON.stringify({
        prompt:
          body.prompt ||
          'Generate a concise clinical wound report. Include wound summary, current measurements, healing progress, latest clinical note, image count, risk considerations, and recommended follow-up considerations.',
        report_type: reportType,
        wound_case: woundCaseResponse(woundCase),
        report_data: reportData,
        instructions,
      }),
    },
  ];
  const modelErrors = [];

  for (const model of modelCandidates) {
    try {
      const response = await openai.responses.create({
        model,
        input,
      });
      const aiReport = parseAiReportResponse(response.output_text || '');

      return {
        ...aiReport,
        model,
      };
    } catch (error) {
      const code = error.code || error.error?.code;
      const status = error.status || error.statusCode;
      const message = error.message || 'OpenAI request failed';

      if (status === 401 || status === 403 || status === 429) {
        throw new Error(`OpenAI report generation failed: ${message}`);
      }

      modelErrors.push(`${model}: ${code || status || 'error'} ${message}`);
    }
  }

  throw new Error(`OpenAI report generation failed for all models: ${modelErrors.join(' | ')}`);
};







const generateReport = async (req, res) => {
  try {
    const woundCase = await getScopedWoundCase(req, req.params.id);

    if (!woundCase) {
      return res.status(404).json({ message: 'Wound case not found' });
    }

    const baseReportData = buildReportData(woundCase);
    const aiReport = await callOpenAiReportService({
      woundCase,
      reportData: baseReportData,
      body: req.body,
    });
    const reportData = {
      ...baseReportData,
      ai_report: aiReport?.report_data || null,
      ai_generated_at: currentTimestamp(),
      ai_provider: 'openai',
      ai_model: aiReport?.model || process.env.OPENAI_REPORT_MODEL || 'gpt-4.1-mini',
    };
    const report = formatReport({
      title: req.body.title || aiReport?.title || 'Complete Wound Report',
      report_type:
        req.body.report_type || req.body.reportType || aiReport?.report_type || 'full',
      summary:
        req.body.summary ||
        aiReport?.summary ||
        `${woundCase.wound_type} report for ${woundCase.body_location || 'wound location'}.`,
      pages: req.body.pages || aiReport?.pages || 1,
      file_size: req.body.file_size || req.body.fileSize,
      url: req.body.url || req.body.file_url || req.body.fileUrl,
      generated_by: req.body.generated_by || req.body.generatedBy,
      report_data: reportData,
      is_ai_generated: true,
    });

    await woundCase.update({
      reports: [...asArray(woundCase.reports), report],
      last_updated_at: new Date(),
    });

    return res.status(201).json({
      message: 'AI report generated successfully',
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

    const reports = asArray(woundCase.reports);
    const reportIndex = reports.findIndex(
      (report) => String(report.id) === String(req.params.reportId)
    );

    if (reportIndex === -1) {
      return res.status(404).json({ message: 'Report not found' });
    }

    const report = reports[reportIndex];
    const reportData = report.report_data || buildReportData(woundCase);
    const fileName = getReportFileName(woundCase, report);
    const filePath = path.join(reportUploadDir, fileName);
    const downloadUrl = getReportPublicUrl(req, fileName);

    if (!fs.existsSync(filePath)) {
      await writeReportPdf({ filePath, woundCase, report, reportData });
    }

    const stats = fs.statSync(filePath);
    const updatedReport = {
      ...report,
      url: downloadUrl,
      file_url: downloadUrl,
      file_path: `/uploads/reports/${fileName}`,
      file_size: `${stats.size} bytes`,
      mime_type: 'application/pdf',
      pages: report.pages || 1,
      report_data: reportData,
      generated_at: report.generated_at || currentTimestamp(),
    };

    reports[reportIndex] = updatedReport;

    await woundCase.update({
      reports,
      last_updated_at: new Date(),
    });

    return res.status(200).json({
      message: 'Report PDF ready for download',
      download_url: downloadUrl,
      file_path: updatedReport.file_path,
      report: updatedReport,
      preview: reportData,
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Report download failed',
      error: error.message,
    });
  }
};

/**
 * Saves a transcript and/or uploaded/remote audio as a voice clinical note.
 *
 * Multipart audio is accepted under the configured voice upload aliases and takes
 * precedence over `audio_url`. This function stores existing transcription text;
 * speech-to-text processing is handled by `transcribeVoiceDictation`.
 *
 * @param {import('express').Request} req Nurse-authenticated request with wound case ID.
 * @param {import('express').Response} res Express response containing the saved note.
 * @returns {Promise<import('express').Response>}
 */
const saveVoiceDictation = async (req, res) => {
  try {
    const woundCase = await getScopedWoundCase(req, req.params.id);

    if (!woundCase) {
      return res.status(404).json({ message: 'Wound case not found' });
    }

    const uploadedVoiceFile = getUploadedVoiceDictationFile(req);
    const uploadedVoiceData = uploadedVoiceFile
      ? uploadedVoiceFileToNoteData(req, uploadedVoiceFile)
      : {};
    const transcript = cleanString(req.body.transcript || req.body.text);
    const note = formatClinicalNote({
      note_type: 'voice',
      title: req.body.title || 'Voice Note',
      text: transcript,
      audio_url: uploadedVoiceData.audio_url || req.body.audio_url || req.body.audioUrl,
      audio_file_path: uploadedVoiceData.audio_file_path,
      audio_original_name: uploadedVoiceData.audio_original_name,
      audio_mime_type: uploadedVoiceData.audio_mime_type,
      audio_size: uploadedVoiceData.audio_size,
      duration_seconds: req.body.duration_seconds || req.body.durationSeconds,
      created_by: req.body.created_by || req.body.createdBy,
    });

    if (!note.text && !note.audio_url) {
      return res.status(400).json({ message: 'transcript or audio file is required' });
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





const transcribeVoiceDictation = async (req, res) => {
  try {
    const woundCase = await getScopedWoundCase(req, req.params.id);

    if (!woundCase) {
      return res.status(404).json({ message: 'Wound case not found' });
    }

    const uploadedVoiceFile = getUploadedVoiceDictationFile(req);
    const clinicalNotes = asArray(woundCase.clinical_notes);
    const noteId = req.params.noteId || req.body.note_id || req.body.noteId;
    const noteIndex = noteId
      ? clinicalNotes.findIndex((note) => String(note.id) === String(noteId))
      : -1;

    if (noteId && noteIndex === -1) {
      return res.status(404).json({ message: 'Voice note not found' });
    }

    const existingNote = noteIndex >= 0 ? clinicalNotes[noteIndex] : null;
    const uploadedVoiceData = uploadedVoiceFile
      ? uploadedVoiceFileToNoteData(req, uploadedVoiceFile)
      : {};
    const localAudioPath = uploadedVoiceFile
      ? uploadedVoiceFile.path
      : resolveLocalUploadPath(
          existingNote?.audio_file_path ||
            existingNote?.audioFilePath ||
            existingNote?.audio_url ||
            existingNote?.audioUrl
        );

    if (!localAudioPath || !fs.existsSync(localAudioPath)) {
      return res.status(400).json({
        message: 'A saved local audio file or uploaded audio file is required',
      });
    }

    const transcript = await transcribeAudioFile(localAudioPath);

    if (!transcript) {
      return res.status(422).json({ message: 'Audio transcription returned no text' });
    }

    const note = formatClinicalNote({
      ...(existingNote || {}),
      note_type: 'voice',
      title: req.body.title || existingNote?.title || 'Voice Note',
      text: transcript,
      audio_url:
        uploadedVoiceData.audio_url ||
        existingNote?.audio_url ||
        existingNote?.audioUrl,
      audio_file_path:
        uploadedVoiceData.audio_file_path ||
        existingNote?.audio_file_path ||
        existingNote?.audioFilePath,
      audio_original_name:
        uploadedVoiceData.audio_original_name ||
        existingNote?.audio_original_name ||
        existingNote?.audioOriginalName,
      audio_mime_type:
        uploadedVoiceData.audio_mime_type ||
        existingNote?.audio_mime_type ||
        existingNote?.audioMimeType,
      audio_size:
        uploadedVoiceData.audio_size ||
        existingNote?.audio_size ||
        existingNote?.audioSize,
      duration_seconds:
        req.body.duration_seconds ||
        req.body.durationSeconds ||
        existingNote?.duration_seconds ||
        existingNote?.durationSeconds,
      created_by:
        req.body.created_by ||
        req.body.createdBy ||
        existingNote?.created_by ||
        existingNote?.createdBy,
    });

    const nextClinicalNotes =
      noteIndex >= 0
        ? clinicalNotes.map((item, index) => (index === noteIndex ? note : item))
        : [...clinicalNotes, note];

    await woundCase.update({
      clinical_notes: nextClinicalNotes,
      last_updated_at: new Date(),
    });

    return res.status(noteIndex >= 0 ? 200 : 201).json({
      message: 'Voice transcribed successfully',
      transcript,
      clinical_note: note,
      wound_case: woundCaseResponse(woundCase),
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Voice transcription failed',
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
  transcribeVoiceDictation,
  updateWoundCase,
};
