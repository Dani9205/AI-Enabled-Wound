const Patient = require('../models/patientModel');
const WoundCase = require('../models/woundCaseModel');

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

const patientName = (patient) =>
  `${patient.first_name || ''} ${patient.last_name || ''}`.trim();

const getDurationDays = (date) => {
  if (!date) return 0;

  const startedAt = new Date(date);
  if (Number.isNaN(startedAt.getTime())) return 0;

  return Math.max(0, Math.ceil((Date.now() - startedAt.getTime()) / 86400000));
};

const getLatest = (items, dateFields) =>
  [...items].sort((a, b) => {
    const aDate = dateFields.map((field) => a[field]).find(Boolean);
    const bDate = dateFields.map((field) => b[field]).find(Boolean);

    return new Date(bDate || 0).getTime() - new Date(aDate || 0).getTime();
  })[0] || null;

const getPatientMrn = (user) =>
  user?.app_settings?.patient_profile?.patient_id_mrn ||
  user?.app_settings?.patient_profile?.mrn ||
  null;

const resolvePatientContext = async (req) => {
  const patientId = req.query.patient_id || req.query.patientId;
  const mrn = req.query.mrn || getPatientMrn(req.user);

  const patient = patientId
    ? await Patient.findByPk(patientId)
    : mrn
      ? await Patient.findOne({ where: { mrn } })
      : null;

  if (!patient) {
    return {
      error:
        'Patient profile not found. Make sure patient_id_mrn in users.app_settings matches patients.mrn',
    };
  }

  const woundCases = await WoundCase.findAll({
    where: { patient_id: patient.id },
    order: [['last_updated_at', 'DESC']],
  });

  return { patient, woundCases };
};

const formatReport = (report, woundCase, index) => ({
  id: report.id || `report_${woundCase.id}_${index + 1}`,
  wound_case_id: woundCase.id,
  title: report.title || 'Wound Report',
  report_type: report.report_type || report.reportType || 'wound',
  wound_type: woundCase.wound_type,
  body_location: woundCase.body_location,
  url: report.url || report.file_url || report.fileUrl || null,
  summary: report.summary || null,
  pages: report.pages || null,
  file_size: report.file_size || report.fileSize || null,
  status: report.status || 'new',
  shared_with: asArray(report.shared_with || report.sharedWith),
  generated_at: report.generated_at || report.generatedAt || null,
  report_data: report.report_data || report.reportData || null,
});

const formatWoundCaseCard = (woundCase) => {
  const reports = asArray(woundCase.reports);

  return {
    id: woundCase.id,
    wound_type: woundCase.wound_type,
    severity_stage: woundCase.severity_stage,
    body_location: woundCase.body_location,
    status: woundCase.status,
    healing_progress: Number(woundCase.healing_progress || 0),
    active_since_days: getDurationDays(woundCase.createdAt),
    healed_label: `${Number(woundCase.healing_progress || 0)}%`,
    measurements: {
      length_cm: woundCase.length_cm,
      width_cm: woundCase.width_cm,
      depth_cm: woundCase.depth_cm,
      size_now:
        woundCase.length_cm && woundCase.width_cm
          ? `${woundCase.length_cm}cm x ${woundCase.width_cm}cm`
          : null,
    },
    reports_count: reports.length,
    last_updated_at: woundCase.last_updated_at || woundCase.updatedAt,
  };
};

const buildTrend = (woundCase) => {
  const measurements = asArray(woundCase.measurements);
  const updates = asArray(woundCase.updates);
  const points = [...measurements, ...updates]
    .map((item, index) => ({
      id: item.id || `trend_${index + 1}`,
      label:
        item.label ||
        item.measured_at ||
        item.measuredAt ||
        item.created_at ||
        item.createdAt ||
        `Update ${index + 1}`,
      healing_progress:
        item.healing_progress ?? item.healingProgress ?? woundCase.healing_progress,
      length_cm: item.length_cm ?? item.lengthCm ?? null,
      width_cm: item.width_cm ?? item.widthCm ?? null,
      depth_cm: item.depth_cm ?? item.depthCm ?? null,
    }))
    .filter((item) => item.healing_progress !== null && item.healing_progress !== undefined);

  if (!points.length) {
    points.push({
      id: 'current',
      label: 'Today',
      healing_progress: Number(woundCase.healing_progress || 0),
      length_cm: woundCase.length_cm,
      width_cm: woundCase.width_cm,
      depth_cm: woundCase.depth_cm,
    });
  }

  return points;
};

const getDoctorNote = (woundCase) =>
  asArray(woundCase.clinical_notes).find(
    (note) => note.note_type === 'doctor_instruction'
  ) || getLatest(asArray(woundCase.clinical_notes), ['created_at', 'createdAt']);

const getAllReports = (woundCases) =>
  woundCases
    .flatMap((woundCase) =>
      asArray(woundCase.reports).map((report, index) =>
        formatReport(report, woundCase, index)
      )
    )
    .sort(
      (a, b) =>
        new Date(b.generated_at || 0).getTime() -
        new Date(a.generated_at || 0).getTime()
    );

const getScopedWoundCase = async (req) => {
  const { patient, woundCases, error } = await resolvePatientContext(req);

  if (error) return { error };

  const woundCase = woundCases.find(
    (item) => String(item.id) === String(req.params.woundCaseId)
  );

  if (!woundCase) {
    return { error: 'Wound case not found' };
  }

  return { patient, woundCase };
};

const formatWoundProfileHeader = (woundCase) => ({
  ...formatWoundCaseCard(woundCase),
  wound_etiology: woundCase.wound_etiology,
  pain_score: woundCase.pain_score,
  tabs: ['timeline', 'images', 'measures', 'notes', 'reports'],
});

const formatImage = (image, index) => ({
  id: image.id || `image_${index + 1}`,
  url: image.url || image.image_url || image.imageUrl || null,
  caption: image.caption || null,
  label: image.label || null,
  uploaded_at: image.uploaded_at || image.uploadedAt || image.created_at || null,
});

const formatMeasurement = (measurement, index) => ({
  id: measurement.id || `measurement_${index + 1}`,
  date:
    measurement.measured_at ||
    measurement.measuredAt ||
    measurement.created_at ||
    measurement.createdAt ||
    null,
  length_cm: measurement.length_cm ?? measurement.lengthCm ?? null,
  width_cm: measurement.width_cm ?? measurement.widthCm ?? null,
  depth_cm: measurement.depth_cm ?? measurement.depthCm ?? null,
  pain_score: measurement.pain_score ?? measurement.painScore ?? null,
  healing_progress: measurement.healing_progress ?? measurement.healingProgress ?? null,
  notes: measurement.notes || null,
});

const formatNote = (note, index) => ({
  id: note.id || `note_${index + 1}`,
  note_type: note.note_type || note.noteType || 'manual',
  title: note.title || null,
  text: note.text || note.note || note.instructions || null,
  soap: note.soap || note.soap_note || note.soapNote || null,
  audio_url: note.audio_url || note.audioUrl || null,
  duration_seconds: note.duration_seconds ?? note.durationSeconds ?? null,
  is_ai_generated: Boolean(note.is_ai_generated || note.isAiGenerated),
  created_by: note.created_by || note.createdBy || null,
  created_at: note.created_at || note.createdAt || null,
  frequency: note.frequency || null,
  priority: note.priority || null,
  next_review_at: note.next_review_at || note.nextReviewAt || null,
});

const formatTimelineItem = (item, type, index) => ({
  id: item.id || `${type}_${index + 1}`,
  type,
  title: item.title || item.note_type || item.noteType || type,
  summary: item.summary || item.text || item.note || item.instructions || null,
  severity_stage: item.severity_stage || item.severityStage || null,
  pain_score: item.pain_score ?? item.painScore ?? null,
  healing_progress: item.healing_progress ?? item.healingProgress ?? null,
  measurements: item.measurements || null,
  images_count: asArray(item.images).length || item.images_count || item.imagesCount || 0,
  created_by: item.created_by || item.createdBy || null,
  created_at:
    item.created_at ||
    item.createdAt ||
    item.measured_at ||
    item.measuredAt ||
    item.uploaded_at ||
    item.uploadedAt ||
    null,
});

const buildTimeline = (woundCase) => {
  const updates = asArray(woundCase.updates).map((item, index) =>
    formatTimelineItem(item, 'wound_update', index)
  );
  const measurements = asArray(woundCase.measurements).map((item, index) =>
    formatTimelineItem(item, 'measurement', index)
  );
  const notes = asArray(woundCase.clinical_notes).map((item, index) =>
    formatTimelineItem(item, item.note_type || item.noteType || 'note', index)
  );
  const images = asArray(woundCase.images).map((item, index) =>
    formatTimelineItem(item, 'image', index)
  );

  return [...updates, ...measurements, ...notes, ...images].sort(
    (a, b) =>
      new Date(b.created_at || 0).getTime() -
      new Date(a.created_at || 0).getTime()
  );
};

const buildBeforeAfterPairs = (images) => {
  const beforeImages = images.filter((image) =>
    ['before', 'initial', 'day 1'].includes(String(image.label || '').toLowerCase())
  );
  const afterImages = images.filter((image) =>
    ['after', 'latest', 'today'].includes(String(image.label || '').toLowerCase())
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

const getDifference = (current, previous) => {
  const currentNumber = Number(current);
  const previousNumber = Number(previous);

  if (!Number.isFinite(currentNumber) || !Number.isFinite(previousNumber)) {
    return null;
  }

  return Number((currentNumber - previousNumber).toFixed(2));
};

const buildReportPreview = (report, woundCase, patient) => ({
  patient: {
    id: patient.id,
    name: patientName(patient),
    mrn: patient.mrn,
    diagnosis: patient.primary_diagnosis,
  },
  wound_case: formatWoundProfileHeader(woundCase),
  report,
  images: asArray(woundCase.images).map(formatImage).slice(0, 4),
  measurements: {
    length_cm: woundCase.length_cm,
    width_cm: woundCase.width_cm,
    depth_cm: woundCase.depth_cm,
    healing_progress: woundCase.healing_progress,
    updates_count: asArray(woundCase.updates).length,
  },
  notes: asArray(woundCase.clinical_notes).map(formatNote).slice(0, 5),
});

const findWoundReport = (woundCase, reportId) =>
  asArray(woundCase.reports)
    .map((report, index) => formatReport(report, woundCase, index))
    .find((report) => String(report.id) === String(reportId));

const getDashboard = async (req, res) => {
  try {
    const { patient, woundCases, error } = await resolvePatientContext(req);

    if (error) return res.status(404).json({ message: error });

    const woundCards = woundCases.map(formatWoundCaseCard);
    const averageHealing = woundCards.length
      ? Math.round(
          woundCards.reduce((sum, item) => sum + item.healing_progress, 0) /
            woundCards.length
        )
      : 0;

    return res.status(200).json({
      message: 'Patient app dashboard fetched successfully',
      patient: {
        id: patient.id,
        name: patientName(patient),
        mrn: patient.mrn,
        diagnosis: patient.primary_diagnosis,
      },
      overall_healing_progress: averageHealing,
      wound_cases: woundCards,
      recent_reports: getAllReports(woundCases).slice(0, 3),
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Patient app dashboard fetch failed',
      error: error.message,
    });
  }
};

const getHealingProgress = async (req, res) => {
  try {
    const { patient, woundCases, error } = await resolvePatientContext(req);

    if (error) return res.status(404).json({ message: error });

    const woundCase = req.params.woundCaseId
      ? woundCases.find((item) => String(item.id) === String(req.params.woundCaseId))
      : woundCases[0];

    if (!woundCase) {
      return res.status(404).json({ message: 'Wound case not found' });
    }

    const doctorNote = getDoctorNote(woundCase);

    return res.status(200).json({
      message: 'Patient healing progress fetched successfully',
      patient: {
        id: patient.id,
        name: patientName(patient),
        mrn: patient.mrn,
      },
      wound_case: {
        ...formatWoundCaseCard(woundCase),
        wound_etiology: woundCase.wound_etiology,
        pain_score: woundCase.pain_score,
      },
      progress_summary: {
        overall_healing: Number(woundCase.healing_progress || 0),
        check_ups: asArray(woundCase.updates).length,
        days_active: getDurationDays(woundCase.createdAt),
        size_now:
          woundCase.length_cm && woundCase.width_cm
            ? `${woundCase.length_cm}cm`
            : null,
      },
      wound_size_over_time: buildTrend(woundCase),
      doctor_note: doctorNote
        ? {
            id: doctorNote.id || null,
            text: doctorNote.text || doctorNote.instructions || doctorNote.summary || null,
            created_by: doctorNote.created_by || doctorNote.createdBy || null,
            created_at: doctorNote.created_at || doctorNote.createdAt || null,
            next_review_at: doctorNote.next_review_at || doctorNote.nextReviewAt || null,
          }
        : null,
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Patient healing progress fetch failed',
      error: error.message,
    });
  }
};

const getReports = async (req, res) => {
  try {
    const { woundCases, error } = await resolvePatientContext(req);

    if (error) return res.status(404).json({ message: error });

    const filter = String(req.query.filter || 'all').toLowerCase();
    const reports = getAllReports(woundCases).filter((report) => {
      const reportType = String(report.report_type || '').toLowerCase();

      if (filter === 'all') return true;
      if (filter === 'progress') return reportType.includes('progress');
      if (filter === 'visit-notes' || filter === 'visit_notes') {
        return reportType.includes('visit') || reportType.includes('note');
      }

      return reportType === filter;
    });

    return res.status(200).json({
      message: 'Patient reports fetched successfully',
      filters: ['all', 'progress', 'visit-notes'],
      reports,
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Patient reports fetch failed',
      error: error.message,
    });
  }
};

const getReportDetails = async (req, res) => {
  try {
    const { woundCases, error } = await resolvePatientContext(req);

    if (error) return res.status(404).json({ message: error });

    const report = getAllReports(woundCases).find(
      (item) => String(item.id) === String(req.params.reportId)
    );

    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }

    return res.status(200).json({
      message: 'Patient report details fetched successfully',
      report,
      preview: report.report_data,
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Patient report details fetch failed',
      error: error.message,
    });
  }
};

const downloadReport = async (req, res) => {
  try {
    const { woundCases, error } = await resolvePatientContext(req);

    if (error) return res.status(404).json({ message: error });

    const report = getAllReports(woundCases).find(
      (item) => String(item.id) === String(req.params.reportId)
    );

    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }

    return res.status(200).json({
      message: report.url
        ? 'Patient report download URL ready'
        : 'Patient report data ready for PDF generation',
      download_url: report.url,
      report,
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Patient report download failed',
      error: error.message,
    });
  }
};

const getWoundProfile = async (req, res) => {
  try {
    const { patient, woundCase, error } = await getScopedWoundCase(req);

    if (error) return res.status(404).json({ message: error });

    return res.status(200).json({
      message: 'Patient wound profile fetched successfully',
      patient: {
        id: patient.id,
        name: patientName(patient),
        mrn: patient.mrn,
      },
      wound_case: formatWoundProfileHeader(woundCase),
      timeline_count: buildTimeline(woundCase).length,
      images_count: asArray(woundCase.images).length,
      measurements_count: asArray(woundCase.measurements).length,
      notes_count: asArray(woundCase.clinical_notes).length,
      reports_count: asArray(woundCase.reports).length,
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Patient wound profile fetch failed',
      error: error.message,
    });
  }
};

const getWoundTimeline = async (req, res) => {
  try {
    const { woundCase, error } = await getScopedWoundCase(req);

    if (error) return res.status(404).json({ message: error });

    return res.status(200).json({
      message: 'Patient wound timeline fetched successfully',
      wound_case: formatWoundProfileHeader(woundCase),
      update_history: buildTimeline(woundCase),
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Patient wound timeline fetch failed',
      error: error.message,
    });
  }
};

const getWoundImages = async (req, res) => {
  try {
    const { woundCase, error } = await getScopedWoundCase(req);

    if (error) return res.status(404).json({ message: error });

    const images = asArray(woundCase.images).map(formatImage);

    return res.status(200).json({
      message: 'Patient wound images fetched successfully',
      wound_case: formatWoundProfileHeader(woundCase),
      view_modes: ['grid', 'date', 'before_after'],
      images,
      before_after: buildBeforeAfterPairs(images),
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Patient wound images fetch failed',
      error: error.message,
    });
  }
};

const getWoundMeasurements = async (req, res) => {
  try {
    const { woundCase, error } = await getScopedWoundCase(req);

    if (error) return res.status(404).json({ message: error });

    const history = asArray(woundCase.measurements).map(formatMeasurement);
    const latest = history[history.length - 1] || {
      length_cm: woundCase.length_cm,
      width_cm: woundCase.width_cm,
      depth_cm: woundCase.depth_cm,
      pain_score: woundCase.pain_score,
      healing_progress: woundCase.healing_progress,
    };
    const previous = history.length > 1 ? history[history.length - 2] : null;

    return res.status(200).json({
      message: 'Patient wound measurements fetched successfully',
      wound_case: formatWoundProfileHeader(woundCase),
      current: {
        length_cm: latest.length_cm,
        width_cm: latest.width_cm,
        depth_cm: latest.depth_cm,
        pain_score: latest.pain_score,
        changes: {
          length_cm: previous ? getDifference(latest.length_cm, previous.length_cm) : null,
          width_cm: previous ? getDifference(latest.width_cm, previous.width_cm) : null,
          depth_cm: previous ? getDifference(latest.depth_cm, previous.depth_cm) : null,
        },
      },
      healing_trend: buildTrend(woundCase),
      measurement_history: history,
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Patient wound measurements fetch failed',
      error: error.message,
    });
  }
};

const getWoundNotes = async (req, res) => {
  try {
    const { woundCase, error } = await getScopedWoundCase(req);

    if (error) return res.status(404).json({ message: error });

    const filter = String(req.query.type || 'all').toLowerCase();
    const notes = asArray(woundCase.clinical_notes)
      .map(formatNote)
      .filter((note) => {
        if (filter === 'all') return true;
        if (filter === 'voice') return note.note_type === 'voice';
        if (filter === 'manual') return note.note_type === 'manual';
        if (filter === 'ai') return note.is_ai_generated;

        return note.note_type === filter;
      });

    return res.status(200).json({
      message: 'Patient wound notes fetched successfully',
      wound_case: formatWoundProfileHeader(woundCase),
      filters: ['all', 'voice', 'manual', 'ai', 'doctor_instruction', 'soap'],
      notes,
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Patient wound notes fetch failed',
      error: error.message,
    });
  }
};

const getWoundReports = async (req, res) => {
  try {
    const { woundCase, error } = await getScopedWoundCase(req);

    if (error) return res.status(404).json({ message: error });

    const reports = asArray(woundCase.reports).map((report, index) =>
      formatReport(report, woundCase, index)
    );

    return res.status(200).json({
      message: 'Patient wound reports fetched successfully',
      wound_case: formatWoundProfileHeader(woundCase),
      reports,
      shared_with: reports.flatMap((report) => asArray(report.shared_with)),
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Patient wound reports fetch failed',
      error: error.message,
    });
  }
};

const getWoundReportDetails = async (req, res) => {
  try {
    const { patient, woundCase, error } = await getScopedWoundCase(req);

    if (error) return res.status(404).json({ message: error });

    const report = findWoundReport(woundCase, req.params.reportId);

    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }

    return res.status(200).json({
      message: 'Patient wound report details fetched successfully',
      report,
      preview: report.report_data || buildReportPreview(report, woundCase, patient),
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Patient wound report details fetch failed',
      error: error.message,
    });
  }
};

const previewWoundReport = async (req, res) => {
  try {
    const { patient, woundCase, error } = await getScopedWoundCase(req);

    if (error) return res.status(404).json({ message: error });

    const report = findWoundReport(woundCase, req.params.reportId);

    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }

    return res.status(200).json({
      message: 'Patient wound report PDF preview fetched successfully',
      report,
      pdf_preview: report.report_data || buildReportPreview(report, woundCase, patient),
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Patient wound report PDF preview failed',
      error: error.message,
    });
  }
};

const downloadWoundReport = async (req, res) => {
  try {
    const { patient, woundCase, error } = await getScopedWoundCase(req);

    if (error) return res.status(404).json({ message: error });

    const report = findWoundReport(woundCase, req.params.reportId);

    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }

    return res.status(200).json({
      message: report.url
        ? 'Patient wound report download URL ready'
        : 'Patient wound report data ready for PDF generation',
      download_url: report.url,
      report,
      pdf_preview: report.report_data || buildReportPreview(report, woundCase, patient),
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Patient wound report download failed',
      error: error.message,
    });
  }
};

const shareWoundReport = async (req, res) => {
  try {
    const { woundCase, error } = await getScopedWoundCase(req);

    if (error) return res.status(404).json({ message: error });

    const reports = asArray(woundCase.reports);
    const reportIndex = reports.findIndex((report, index) => {
      const reportId = report.id || `report_${woundCase.id}_${index + 1}`;
      return String(reportId) === String(req.params.reportId);
    });

    if (reportIndex === -1) {
      return res.status(404).json({ message: 'Report not found' });
    }

    const share = {
      id: `share_${Date.now()}`,
      name: req.body.name || null,
      email: req.body.email || null,
      role: req.body.role || null,
      permission: req.body.permission || 'can_view',
      shared_at: new Date().toISOString(),
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
      message: 'Patient wound report shared successfully',
      report: formatReport(reports[reportIndex], woundCase, reportIndex),
      share,
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Patient wound report share failed',
      error: error.message,
    });
  }
};

module.exports = {
  downloadReport,
  downloadWoundReport,
  getDashboard,
  getHealingProgress,
  getReportDetails,
  getReports,
  getWoundImages,
  getWoundMeasurements,
  getWoundNotes,
  getWoundProfile,
  getWoundReportDetails,
  getWoundReports,
  getWoundTimeline,
  previewWoundReport,
  shareWoundReport,
};
