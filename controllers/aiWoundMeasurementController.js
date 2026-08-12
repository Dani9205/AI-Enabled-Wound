const fs = require('fs');
const OpenAI = require('openai');
const Patient = require('../models/patientModel');
const WoundCase = require('../models/woundCaseModel');

const cleanString = (value) => {
  if (value === undefined || value === null) return undefined;
  const trimmed = String(value).trim();
  return trimmed || undefined;
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

const currentTimestamp = () => new Date().toISOString();

const makeId = (prefix) =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const isNurse = (req) => req.user?.role === 'nurse';
const isDoctor = (req) => req.user?.role === 'doctor';

const getScopedWoundCase = async (req, id) => {
  const woundCase = await WoundCase.findByPk(id);

  if (!woundCase) return null;

  if (!isNurse(req) && !isDoctor(req)) return woundCase;

  const patientWhere = { id: woundCase.patient_id };

  if (isNurse(req)) {
    patientWhere.nurse_id = req.user.id;
  }

  if (isDoctor(req)) {
    patientWhere.doctor_id = req.user.id;
  }

  const patient = await Patient.findOne({
    where: patientWhere,
  });

  return patient ? woundCase : null;
};

const getRequestBaseUrl = (req) => `${req.protocol}://${req.get('host')}`;

const getUploadedWoundImageFiles = (req) => {
  if (req.file) return [req.file];
  if (!req.files) return [];
  if (Array.isArray(req.files)) return req.files;
  return Object.values(req.files).flat();
};

const getIndexedBodyValue = (value, index) => {
  if (Array.isArray(value)) return value[index] !== undefined ? value[index] : value[0];
  return value;
};

const uploadedFileToImage = (req, file, index) => ({
  id: makeId('img'),
  url: `${getRequestBaseUrl(req)}/uploads/wound-images/${file.filename}`,
  caption: cleanString(getIndexedBodyValue(req.body.caption || req.body.captions, index)) || null,
  original_name: file.originalname,
  mime_type: file.mimetype,
  size: file.size,
  uploaded_at: currentTimestamp(),
});

const fileToDataUrl = (file) => {
  const buffer = fs.readFileSync(file.path);
  return `data:${file.mimetype || 'image/jpeg'};base64,${buffer.toString('base64')}`;
};

const safeJsonParse = (value) => {
  if (!value || typeof value !== 'string') return null;

  const trimmed = value.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);

  try {
    return JSON.parse(jsonMatch ? jsonMatch[0] : trimmed);
  } catch (error) {
    return null;
  }
};

const normalizeAiMeasurement = (payload, images) => {
  const measurement = payload?.measurement || payload || {};
  const lengthCm = parseNumber(measurement.length_cm ?? measurement.lengthCm);
  const widthCm = parseNumber(measurement.width_cm ?? measurement.widthCm);
  const depthCm = parseNumber(measurement.depth_cm ?? measurement.depthCm);
  const areaCm2 = parseNumber(measurement.area_cm2 ?? measurement.areaCm2);

  return {
    id: makeId('ai_measurement'),
    source: 'ai_detected',
    length_cm: Number.isFinite(lengthCm) ? lengthCm : null,
    width_cm: Number.isFinite(widthCm) ? widthCm : null,
    depth_cm: Number.isFinite(depthCm) ? depthCm : null,
    area_cm2:
      Number.isFinite(areaCm2)
        ? areaCm2
        : Number.isFinite(lengthCm) && Number.isFinite(widthCm)
          ? Number((lengthCm * widthCm).toFixed(2))
          : null,
    confidence: parseNumber(payload?.confidence ?? measurement.confidence),
    scale_source: cleanString(payload?.scale_source || payload?.scaleSource) || 'estimated',
    ruler_detected: Boolean(payload?.ruler_detected || payload?.rulerDetected),
    points: payload?.points || measurement.points || null,
    images,
    notes:
      cleanString(payload?.notes || measurement.notes) ||
      'AI-generated estimate. Review and adjust points before saving clinical measurements.',
    measured_at: currentTimestamp(),
  };
};

const callAiMeasurementService = async ({ woundCase, files, body }) => {
  const apiKey = cleanString(process.env.OPENAI_API_KEY);

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is required for AI wound measurement');
  }

  const openai = new OpenAI({ apiKey });
  const model = cleanString(process.env.OPENAI_WOUND_MEASUREMENT_MODEL) || 'gpt-4.1-mini';
  const imageContent = files.map((file) => ({
    type: 'input_image',
    image_url: fileToDataUrl(file),
  }));

  const response = await openai.responses.create({
    model,
    input: [
      {
        role: 'system',
        content:
          'You estimate wound measurements from clinical photos. Use a visible ruler/scale when present. If no ruler is visible, estimate conservatively and mark scale_source as estimated. Depth from a 2D image must be low-confidence unless explicit depth context is visible. Return only valid JSON.',
      },
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: JSON.stringify({
              task:
                'Detect wound length, width, estimated depth, area, ruler availability, confidence, and editable measurement points for app overlay.',
              expected_json: {
                measurement: {
                  length_cm: 'number or null',
                  width_cm: 'number or null',
                  depth_cm: 'number or null',
                  area_cm2: 'number or null',
                },
                confidence: '0 to 1 number',
                ruler_detected: 'boolean',
                scale_source: 'ruler | estimated',
                points:
                  'object containing length and width start/end points as normalized x/y values from 0 to 1 when possible',
                notes: 'short clinical measurement caveat',
              },
              wound_case: {
                id: woundCase.id,
                wound_type: woundCase.wound_type,
                body_location: woundCase.body_location,
                previous_length_cm: woundCase.length_cm,
                previous_width_cm: woundCase.width_cm,
                previous_depth_cm: woundCase.depth_cm,
              },
              frontend_context: {
                ruler_present: body.ruler_present ?? body.rulerPresent,
                notes: body.notes,
              },
            }),
          },
          ...imageContent,
        ],
      },
    ],
  });

  const parsed = safeJsonParse(response.output_text);

  if (!parsed) {
    throw new Error('AI measurement response was not valid JSON');
  }

  return {
    model,
    raw: parsed,
  };
};











const aiDetectWoundMeasurement = async (req, res) => {
  try {
    const woundCase = await getScopedWoundCase(req, req.params.woundCaseId);

    if (!woundCase) {
      return res.status(404).json({ message: 'Wound case not found' });
    }

    const files = getUploadedWoundImageFiles(req);

    if (!files.length) {
      return res.status(400).json({
        message: 'At least one wound image is required',
      });
    }

    const images = files.map((file, index) => uploadedFileToImage(req, file, index));
    const aiResult = await callAiMeasurementService({ woundCase, files, body: req.body });
    const measurement = normalizeAiMeasurement(aiResult.raw, images);

    return res.status(200).json({
      message: 'AI wound measurement generated successfully',
      measurement,
      ai: {
        model: aiResult.model,
        requires_review: true,
      },
    });
  } catch (error) {
    return res.status(500).json({
      message: 'AI wound measurement failed',
      error: error.message,
    });
  }
};









const saveAiWoundMeasurement = async (req, res) => {
  try {
    const woundCase = await getScopedWoundCase(req, req.params.woundCaseId);

    if (!woundCase) {
      return res.status(404).json({ message: 'Wound case not found' });
    }

    const measurementBody = req.body.measurement || req.body;
    const lengthCm = parseNumber(measurementBody.length_cm ?? measurementBody.lengthCm);
    const widthCm = parseNumber(measurementBody.width_cm ?? measurementBody.widthCm);
    const depthCm = parseNumber(measurementBody.depth_cm ?? measurementBody.depthCm);
    const areaCm2 = parseNumber(measurementBody.area_cm2 ?? measurementBody.areaCm2);

    if (![lengthCm, widthCm, depthCm].some((value) => value !== null)) {
      return res.status(400).json({
        message: 'At least one measurement value is required',
      });
    }

    if ([lengthCm, widthCm, depthCm, areaCm2].some((value) => Number.isNaN(value))) {
      return res.status(400).json({
        message: 'Measurement values must be valid numbers',
      });
    }

    const finalMeasurement = {
      id: measurementBody.id || makeId('measurement'),
      source: cleanString(measurementBody.source) || 'ai_adjusted',
      length_cm: lengthCm,
      width_cm: widthCm,
      depth_cm: depthCm,
      area_cm2:
        areaCm2 !== null
          ? areaCm2
          : lengthCm !== null && widthCm !== null
            ? Number((lengthCm * widthCm).toFixed(2))
            : null,
      points: measurementBody.points || null,
      images: asArray(measurementBody.images || req.body.images),
      ai_confidence: parseNumber(measurementBody.ai_confidence ?? measurementBody.aiConfidence),
      ruler_detected: Boolean(measurementBody.ruler_detected || measurementBody.rulerDetected),
      scale_source: cleanString(measurementBody.scale_source || measurementBody.scaleSource) || null,
      notes: cleanString(measurementBody.notes) || null,
      measured_at: measurementBody.measured_at || measurementBody.measuredAt || currentTimestamp(),
    };

    await woundCase.update({
      length_cm: lengthCm !== null ? lengthCm : woundCase.length_cm,
      width_cm: widthCm !== null ? widthCm : woundCase.width_cm,
      depth_cm: depthCm !== null ? depthCm : woundCase.depth_cm,
      measurements: [...asArray(woundCase.measurements), finalMeasurement],
      images: [...asArray(woundCase.images), ...finalMeasurement.images],
      last_updated_at: new Date(),
    });

    return res.status(200).json({
      message: 'AI wound measurement saved successfully',
      measurement: finalMeasurement,
      wound_case: woundCase.get({ plain: true }),
    });
  } catch (error) {
    return res.status(500).json({
      message: 'AI wound measurement save failed',
      error: error.message,
    });
  }
};

module.exports = {
  aiDetectWoundMeasurement,
  saveAiWoundMeasurement,
};
