# AI Wound Measurement APIs

These APIs support the AI-assisted "Measure Wound" screen. The flow has two steps:

1. Detect measurement from one or more wound images.
2. Save the final user-reviewed or manually adjusted measurement.

Base URL:

```http
/api/ai-wound-measurements
```

Auth:

- Bearer token is required.
- Allowed roles: `nurse`, `doctor`.
- Nurse access is scoped by `patients.nurse_id`.
- Doctor access is scoped by `patients.doctor_id`.
- The frontend sends `woundCaseId` in the URL. The backend finds the patient through `wound_cases.patient_id`, so `patient_id` is not required in these API requests.

Runtime requirement:

```env
OPENAI_API_KEY=your_openai_api_key
OPENAI_WOUND_MEASUREMENT_MODEL=gpt-4.1-mini
```

`OPENAI_WOUND_MEASUREMENT_MODEL` is optional. Default model is `gpt-4.1-mini`.

## 1. Detect AI Wound Measurement

```http
POST /api/ai-wound-measurements/:woundCaseId/detect
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

Purpose:

- Takes 1 or multiple wound images from frontend.
- Sends images to AI for measurement estimation.
- Returns length, width, depth, area, ruler status, confidence, and editable points.
- Does not save measurement in database.
- Uploaded image files are stored in `uploads/wound-images`.
- Wound case `images` and `measurements` are not updated by this API.

Accepted image field names:

```text
image
images
file
files
wound_image
wound_images
woundImage
woundImages
```

Optional form fields:

| Field | Type | Description |
|---|---|---|
| `caption` / `captions` | string or array | Caption metadata for uploaded images. |
| `ruler_present` / `rulerPresent` | boolean/string | Optional hint from frontend if ruler is visible. |
| `notes` | string | Optional notes/context for AI. |

Single image behavior:

- AI estimates measurement from that one image.
- If ruler is visible, AI uses ruler as scale.
- If ruler is not visible, AI returns estimated measurement.

Multiple image behavior:

- AI reviews all images together.
- AI returns one final/best measurement for the wound.
- API does not calculate average across images.
- If one image has a clear ruler, AI should prefer it for scale.
- Other images are used as supporting context.

No-ruler behavior:

- `ruler_detected` should be `false`.
- `scale_source` should be `estimated`.
- `confidence` may be lower.
- Depth from normal 2D images should be considered low-confidence unless explicit depth context is visible.

Example form-data:

```text
images = wound-front.jpg
images = wound-side.jpg
images = wound-with-ruler.jpg
ruler_present = true
notes = Wound photo taken after dressing removal.
```

Example success response:

```json
{
  "message": "AI wound measurement generated successfully",
  "measurement": {
    "id": "ai_measurement_1723371234567_ab12cd",
    "source": "ai_detected",
    "length_cm": 3.5,
    "width_cm": 2.2,
    "depth_cm": 0.5,
    "area_cm2": 7.7,
    "confidence": 0.82,
    "scale_source": "ruler",
    "ruler_detected": true,
    "points": {
      "length": {
        "start": { "x": 0.32, "y": 0.55 },
        "end": { "x": 0.71, "y": 0.42 }
      },
      "width": {
        "start": { "x": 0.51, "y": 0.39 },
        "end": { "x": 0.56, "y": 0.68 }
      }
    },
    "images": [
      {
        "id": "img_1723371234567_cd34ef",
        "url": "http://localhost:3000/uploads/wound-images/1723371234567-123456789-wound.jpg",
        "caption": null,
        "original_name": "wound.jpg",
        "mime_type": "image/jpeg",
        "size": 245991,
        "uploaded_at": "2026-08-12T10:30:00.000Z"
      }
    ],
    "notes": "AI-generated estimate. Review and adjust points before saving clinical measurements.",
    "measured_at": "2026-08-12T10:30:00.000Z"
  },
  "ai": {
    "model": "gpt-4.1-mini",
    "requires_review": true
  }
}
```

Common errors:

```json
{
  "message": "At least one wound image is required"
}
```

```json
{
  "message": "Wound case not found"
}
```

```json
{
  "message": "AI wound measurement failed",
  "error": "OPENAI_API_KEY is required for AI wound measurement"
}
```

## 2. Save AI Wound Measurement

```http
PATCH /api/ai-wound-measurements/:woundCaseId/save
Authorization: Bearer <token>
Content-Type: application/json
```

Purpose:

- Saves final measurement after user accepts or adjusts AI result.
- Appends record to `wound_cases.measurements`.
- Updates current wound dimensions:
  - `wound_cases.length_cm`
  - `wound_cases.width_cm`
  - `wound_cases.depth_cm`
- Appends image metadata to `wound_cases.images`.

Frontend flow:

1. Call detect API with images.
2. Show AI result on measurement screen.
3. User adjusts draggable points or values if needed.
4. Call save API with final values.

Example request:

```json
{
  "length_cm": 3.6,
  "width_cm": 2.1,
  "depth_cm": 0.5,
  "area_cm2": 7.56,
  "source": "ai_adjusted",
  "ai_confidence": 0.82,
  "ruler_detected": true,
  "scale_source": "ruler",
  "points": {
    "length": {
      "start": { "x": 0.30, "y": 0.56 },
      "end": { "x": 0.73, "y": 0.43 }
    },
    "width": {
      "start": { "x": 0.51, "y": 0.39 },
      "end": { "x": 0.56, "y": 0.68 }
    }
  },
  "images": [
    {
      "id": "img_1723371234567_cd34ef",
      "url": "http://localhost:3000/uploads/wound-images/1723371234567-123456789-wound.jpg",
      "caption": null,
      "original_name": "wound.jpg",
      "mime_type": "image/jpeg",
      "size": 245991,
      "uploaded_at": "2026-08-12T10:30:00.000Z"
    }
  ],
  "notes": "Adjusted after AI detection."
}
```

The request can also be wrapped inside `measurement`:

```json
{
  "measurement": {
    "length_cm": 3.6,
    "width_cm": 2.1,
    "depth_cm": 0.5,
    "area_cm2": 7.56,
    "source": "ai_adjusted"
  }
}
```

Example success response:

```json
{
  "message": "AI wound measurement saved successfully",
  "measurement": {
    "id": "measurement_1723371234567_ef56gh",
    "source": "ai_adjusted",
    "length_cm": 3.6,
    "width_cm": 2.1,
    "depth_cm": 0.5,
    "area_cm2": 7.56,
    "points": {
      "length": {
        "start": { "x": 0.30, "y": 0.56 },
        "end": { "x": 0.73, "y": 0.43 }
      },
      "width": {
        "start": { "x": 0.51, "y": 0.39 },
        "end": { "x": 0.56, "y": 0.68 }
      }
    },
    "images": [
      {
        "id": "img_1723371234567_cd34ef",
        "url": "http://localhost:3000/uploads/wound-images/1723371234567-123456789-wound.jpg",
        "caption": null,
        "original_name": "wound.jpg",
        "mime_type": "image/jpeg",
        "size": 245991,
        "uploaded_at": "2026-08-12T10:30:00.000Z"
      }
    ],
    "ai_confidence": 0.82,
    "ruler_detected": true,
    "scale_source": "ruler",
    "notes": "Adjusted after AI detection.",
    "measured_at": "2026-08-12T10:32:00.000Z"
  },
  "wound_case": {
    "id": 21,
    "patient_id": 5,
    "length_cm": 3.6,
    "width_cm": 2.1,
    "depth_cm": 0.5
  }
}
```

Common errors:

```json
{
  "message": "At least one measurement value is required"
}
```

```json
{
  "message": "Measurement values must be valid numbers"
}
```

```json
{
  "message": "Wound case not found"
}
```

## Where Data Is Stored

Detect API:

- Stores uploaded files physically in `uploads/wound-images`.
- Returns image URLs like:

```http
http://localhost:3000/uploads/wound-images/1723371234567-123456789-wound.jpg
```

- Does not save measurement in database.
- Does not update `wound_cases.images`.

Save API:

- Saves final measurement in:

```text
wound_cases.measurements
```

- Updates latest dimensions in:

```text
wound_cases.length_cm
wound_cases.width_cm
wound_cases.depth_cm
```

- Saves image metadata in:

```text
wound_cases.images
```

## Complete Frontend Flow

```text
User opens Measure Wound screen
        ↓
Frontend uploads one or more images
        ↓
POST /api/ai-wound-measurements/:woundCaseId/detect
        ↓
AI returns measurement estimate and points
        ↓
Frontend draws length/width handles on image
        ↓
User adjusts points or values if needed
        ↓
PATCH /api/ai-wound-measurements/:woundCaseId/save
        ↓
Backend saves final measurement to wound case
```
