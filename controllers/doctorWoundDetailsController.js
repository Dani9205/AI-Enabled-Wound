const Patient = require('../models/patientModel');
const User = require('../models/userModel');
const WoundCase = require('../models/woundCaseModel');

const cleanString = (value) => {
  if (value === undefined || value === null) return undefined;

  const trimmed = String(value).trim();
  return trimmed || undefined;
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

const parseNumber = (value) => {
  if (value === undefined || value === null || value === '') return null;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
};

const makeId = (prefix) =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const currentTimestamp = () => new Date().toISOString();

const fullName = (user) =>
  user ? user.name || `${user.first_name || ''} ${user.last_name || ''}`.trim() : null;

const patientName = (patient) =>
  patient ? `${patient.first_name || ''} ${patient.last_name || ''}`.trim() : null;

const getDurationDays = (date) => {
  if (!date) return 0;

  const startedAt = new Date(date);
  if (Number.isNaN(startedAt.getTime())) return 0;

  return Math.max(0, Math.ceil((Date.now() - startedAt.getTime()) / 86400000));
};

const formatWoundHeader = (woundCase, patient) => ({
  id: woundCase.id,
  patient_id: woundCase.patient_id,
  patient_name: patientName(patient),
  wound_type: woundCase.wound_type,
  severity_stage: woundCase.severity_stage,
  body_location: woundCase.body_location,
  duration_days: getDurationDays(woundCase.createdAt),
  pain_score: woundCase.pain_score,
  healing_progress: woundCase.healing_progress,
  last_updated_at: woundCase.last_updated_at || woundCase.updatedAt,
});

const getWoundCaseWithPatient = async (woundCaseId) => {
  const woundCase = await WoundCase.findByPk(woundCaseId);

  if (!woundCase) {
    return { error: 'Wound case not found' };
  }

  const patient = await Patient.findByPk(woundCase.patient_id);

  if (!patient) {
    return { error: 'Patient not found' };
  }

  return { woundCase, patient };
};

const formatImage = (image, index) => ({
  id: image.id || `image_${index + 1}`,
  url: image.url || image.image_url || image.imageUrl || null,
  caption: image.caption || null,
  uploaded_at: image.uploaded_at || image.uploadedAt || null,
  label: image.label || null,
});

const buildBeforeAfterPairs = (images) => {
  const beforeImages = images.filter((image) =>
    ['before', 'day 1', 'initial'].includes(String(image.label || '').toLowerCase())
  );
  const afterImages = images.filter((image) =>
    ['after', 'today', 'latest'].includes(String(image.label || '').toLowerCase())
  );
  const pairs = [];
  const max = Math.max(beforeImages.length, afterImages.length);

  for (let index = 0; index < max; index += 1) {
    pairs.push({
      id: `before_after_${index + 1}`,
      before: beforeImages[index] || null,
      after: afterImages[index] || null,
    });
  }

  if (!pairs.length && images.length >= 2) {
    pairs.push({
      id: 'before_after_1',
      before: images[images.length - 1],
      after: images[0],
    });
  }

  return pairs;
};

const formatMeasurement = (measurement, index) => ({
  id: measurement.id || `measurement_${index + 1}`,
  date: measurement.measured_at || measurement.measuredAt || measurement.created_at || null,
  length_cm: measurement.length_cm ?? measurement.lengthCm ?? null,
  width_cm: measurement.width_cm ?? measurement.widthCm ?? null,
  depth_cm: measurement.depth_cm ?? measurement.depthCm ?? null,
  pain_score: measurement.pain_score ?? measurement.painScore ?? null,
  notes: measurement.notes || null,
});

const diff = (current, previous) => {
  const currentNumber = parseNumber(current);
  const previousNumber = parseNumber(previous);

  if (currentNumber === null || previousNumber === null) return null;
  if (Number.isNaN(currentNumber) || Number.isNaN(previousNumber)) return null;

  return Number((currentNumber - previousNumber).toFixed(2));
};

const formatNote = (note, index) => ({
  id: note.id || `note_${index + 1}`,
  note_type: note.note_type || note.noteType || 'manual',
  title: note.title || null,
  text: note.text || note.note || null,
  soap: note.soap || note.soap_note || note.soapNote || null,
  audio_url: note.audio_url || note.audioUrl || null,
  duration_seconds: note.duration_seconds ?? note.durationSeconds ?? null,
  is_ai_generated: Boolean(note.is_ai_generated || note.isAiGenerated),
  created_by: note.created_by || note.createdBy || null,
  created_at: note.created_at || note.createdAt || null,
});

const formatReport = (report, index) => ({
  id: report.id || `report_${index + 1}`,
  title: report.title || 'Wound Report',
  report_type: report.report_type || report.reportType || 'wound',
  url: report.url || report.file_url || report.fileUrl || null,
  summary: report.summary || null,
  pages: report.pages || null,
  file_size: report.file_size || report.fileSize || null,
  status: report.status || 'new',
  shared_with: asArray(report.shared_with || report.sharedWith),
  report_data: report.report_data || report.reportData || null,
  generated_by: report.generated_by || report.generatedBy || null,
  generated_at: report.generated_at || report.generatedAt || null,
});

const buildReportData = (woundCase, patient) => ({
  patient: {
    id: patient.id,
    name: patientName(patient),
    mrn: patient.mrn,
    diagnosis: patient.primary_diagnosis,
  },
  wound_case: formatWoundHeader(woundCase, patient),
  measurements: asArray(woundCase.measurements).map(formatMeasurement),
  images: asArray(woundCase.images).map(formatImage),
  notes: asArray(woundCase.clinical_notes).map(formatNote),
  generated_at: currentTimestamp(),
});

const getImages = async (req, res) => {
  try {
    const { woundCase, patient, error } = await getWoundCaseWithPatient(
      req.params.woundCaseId
    );

    if (error) return res.status(error.includes('Patient') ? 404 : 404).json({ message: error });

    const images = asArray(woundCase.images).map(formatImage);

    return res.status(200).json({
      message: 'Wound images fetched successfully',
      wound_case: formatWoundHeader(woundCase, patient),
      view_modes: ['grid', 'date', 'before_after'],
      images,
      before_after: buildBeforeAfterPairs(images),
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
    const { woundCase, patient, error } = await getWoundCaseWithPatient(
      req.params.woundCaseId
    );

    if (error) return res.status(404).json({ message: error });

    const history = asArray(woundCase.measurements).map(formatMeasurement);
    const latest = history[history.length - 1] || {
      length_cm: woundCase.length_cm,
      width_cm: woundCase.width_cm,
      depth_cm: woundCase.depth_cm,
      pain_score: woundCase.pain_score,
      date: woundCase.last_updated_at,
    };
    const previous = history.length > 1 ? history[history.length - 2] : null;

    return res.status(200).json({
      message: 'Wound measurements fetched successfully',
      wound_case: formatWoundHeader(woundCase, patient),
      current: {
        length_cm: latest.length_cm,
        width_cm: latest.width_cm,
        depth_cm: latest.depth_cm,
        pain_score: latest.pain_score,
        changes: {
          length_cm: previous ? diff(latest.length_cm, previous.length_cm) : null,
          width_cm: previous ? diff(latest.width_cm, previous.width_cm) : null,
          depth_cm: previous ? diff(latest.depth_cm, previous.depth_cm) : null,
        },
      },
      healing_trend: history.map((measurement, index) => ({
        label: measurement.date || `Update ${index + 1}`,
        healing_progress: measurement.healing_progress || null,
        length_cm: measurement.length_cm,
        width_cm: measurement.width_cm,
        depth_cm: measurement.depth_cm,
      })),
      measurement_history: history,
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Wound measurements fetch failed',
      error: error.message,
    });
  }
};

const getNotes = async (req, res) => {
  try {
    const { woundCase, patient, error } = await getWoundCaseWithPatient(
      req.params.woundCaseId
    );

    if (error) return res.status(404).json({ message: error });

    const filter = cleanString(req.query.type);
    const notes = asArray(woundCase.clinical_notes)
      .map(formatNote)
      .filter((note) => !filter || note.note_type === filter);

    return res.status(200).json({
      message: 'Wound notes fetched successfully',
      wound_case: formatWoundHeader(woundCase, patient),
      filters: ['all', 'voice', 'manual', 'soap', 'ai'],
      notes,
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Wound notes fetch failed',
      error: error.message,
    });
  }
};

const getReports = async (req, res) => {
  try {
    const { woundCase, patient, error } = await getWoundCaseWithPatient(
      req.params.woundCaseId
    );

    if (error) return res.status(404).json({ message: error });

    const reports = asArray(woundCase.reports).map(formatReport);

    return res.status(200).json({
      message: 'Wound reports fetched successfully',
      wound_case: formatWoundHeader(woundCase, patient),
      reports,
      shared_with: reports.flatMap((report) => report.shared_with),
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Wound reports fetch failed',
      error: error.message,
    });
  }
};

const generateReport = async (req, res) => {
  try {
    const { woundCase, patient, error } = await getWoundCaseWithPatient(
      req.params.woundCaseId
    );

    if (error) return res.status(404).json({ message: error });

    const report = formatReport(
      {
        id: makeId('report'),
        title: cleanString(req.body.title) || 'Complete Wound Report',
        report_type: cleanString(req.body.report_type || req.body.reportType) || 'full',
        summary:
          cleanString(req.body.summary) ||
          `${woundCase.wound_type} report for ${patientName(patient)}.`,
        pages: req.body.pages || 1,
        file_size: req.body.file_size || req.body.fileSize || null,
        url: req.body.url || req.body.file_url || req.body.fileUrl || null,
        status: 'new',
        generated_by: req.body.generated_by || req.body.generatedBy || null,
        generated_at: currentTimestamp(),
        report_data: buildReportData(woundCase, patient),
      },
      0
    );

    await woundCase.update({
      reports: [report, ...asArray(woundCase.reports)],
      last_updated_at: new Date(),
    });

    return res.status(201).json({
      message: 'Wound report generated successfully',
      report,
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Wound report generation failed',
      error: error.message,
    });
  }
};

const getReportDetails = async (req, res) => {
  try {
    const { woundCase, patient, error } = await getWoundCaseWithPatient(
      req.params.woundCaseId
    );

    if (error) return res.status(404).json({ message: error });

    const report = asArray(woundCase.reports)
      .map(formatReport)
      .find((item) => String(item.id) === String(req.params.reportId));

    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }

    return res.status(200).json({
      message: 'Wound report details fetched successfully',
      report,
      preview: report.report_data || buildReportData(woundCase, patient),
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Wound report details fetch failed',
      error: error.message,
    });
  }
};

const shareReport = async (req, res) => {
  try {
    const { woundCase, error } = await getWoundCaseWithPatient(req.params.woundCaseId);

    if (error) return res.status(404).json({ message: error });

    const reports = asArray(woundCase.reports);
    const index = reports.findIndex(
      (report) => String(report.id) === String(req.params.reportId)
    );

    if (index === -1) {
      return res.status(404).json({ message: 'Report not found' });
    }

    const userId = req.body.user_id || req.body.userId;
    const user = userId ? await User.findByPk(userId) : null;
    const share = {
      id: makeId('share'),
      user_id: user?.id || null,
      name: cleanString(req.body.name) || fullName(user),
      email: cleanString(req.body.email) || user?.email,
      role: cleanString(req.body.role) || user?.role || null,
      permission: cleanString(req.body.permission) || 'can_view',
      shared_at: currentTimestamp(),
    };

    if (!share.email && !share.user_id) {
      return res.status(400).json({
        message: 'user_id or email is required',
      });
    }

    reports[index] = {
      ...reports[index],
      shared_with: [...asArray(reports[index].shared_with), share],
    };

    await woundCase.update({
      reports,
      last_updated_at: new Date(),
    });

    return res.status(200).json({
      message: 'Wound report shared successfully',
      report: formatReport(reports[index], index),
      share,
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Wound report share failed',
      error: error.message,
    });
  }
};

module.exports = {
  generateReport,
  getImages,
  getMeasurements,
  getNotes,
  getReportDetails,
  getReports,
  shareReport,
};
