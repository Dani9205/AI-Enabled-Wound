# Wound Case APIs - Frontend Guide

This document covers the nurse wound case APIs for creating and fetching wound cases.

Base URL:

```txt
https://aiwond.appistansoft.com
```

All APIs require a nurse bearer token:

```http
Authorization: Bearer <nurse_token>
Content-Type: application/json
```

## Wound Date Behavior

The frontend can send the manually selected wound date when creating a wound case.

Accepted request fields:

```txt
wound_date
woundDate
date
```

Recommended field:

```txt
wound_date
```

The wound date is not stored in the database `created_at` column. The `created_at` column remains the record creation timestamp.

The wound date is stored inside the existing `updates` JSON field as the first wound timeline entry:

```json
{
  "title": "Wound occurred",
  "summary": "Wound date recorded",
  "wound_date": "2026-09-01T00:00:00.000Z",
  "created_at": "2026-09-01T00:00:00.000Z"
}
```

Frontend should read wound date from:

```txt
wound_case.updates[0].wound_date
```

or, for list API:

```txt
wound_cases[index].updates[0].wound_date
```

## 1. Create Wound Case

```http
POST /api/wound-cases/create-wound-case
Authorization: Bearer <nurse_token>
Content-Type: application/json
```

Full URL:

```http
POST https://aiwond.appistansoft.com/api/wound-cases/create-wound-case
```

### Purpose

Creates a new wound case for a patient. The frontend can send the date when the wound occurred using `wound_date`.

### Request Body

```json
{
  "patient_id": 2,
  "wound_type": "Diabetic Foot Ulcer",
  "wound_date": "2026-09-01",
  "severity_stage": "Stage III",
  "pain_score": 5,
  "body_location": "Left heel",
  "wound_etiology": "Diabetes",
  "healing_progress": 0,
  "length_cm": 5,
  "width_cm": 4,
  "depth_cm": 2,
  "notes": "Initial wound case created from nurse assessment."
}
```

### Required Fields

| Field | Required | Notes |
|---|---:|---|
| `patient_id` | Yes | Patient ID. |
| `wound_type` | Yes | Wound type/name. |
| `wound_date` | No | Date when wound occurred. Recommended format: `YYYY-MM-DD`. |

### Optional Fields

| Field | Notes |
|---|---|
| `severity_stage` | Wound severity or stage. |
| `pain_score` | Number from `0` to `10`. |
| `body_location` | Body location of wound. |
| `wound_etiology` | Cause or etiology. |
| `healing_progress` | Number from `0` to `100`. |
| `length_cm` | Wound length in cm. |
| `width_cm` | Wound width in cm. |
| `depth_cm` | Wound depth in cm. |
| `notes` | Free text notes. |
| `images` | Optional image JSON array. |
| `measurements` | Optional measurement JSON array. |
| `updates` | Optional wound update JSON array. |
| `clinical_notes` | Optional clinical note JSON array. |
| `reports` | Optional report JSON array. |

### Success Response

```json
{
  "message": "Wound case created successfully",
  "wound_case": {
    "id": 2,
    "patient_id": 2,
    "wound_type": "Diabetic Foot Ulcer",
    "severity_stage": "Stage III",
    "pain_score": 5,
    "body_location": "Left heel",
    "wound_etiology": "Diabetes",
    "status": "active",
    "healing_progress": 0,
    "length_cm": 5,
    "width_cm": 4,
    "depth_cm": 2,
    "images": [],
    "measurements": [
      {
        "id": "measurement_...",
        "length_cm": 5,
        "width_cm": 4,
        "depth_cm": 2,
        "pain_score": 5,
        "notes": "Initial measurements",
        "measured_at": "2026-09-15T00:00:00.000Z"
      }
    ],
    "updates": [
      {
        "id": "update_...",
        "title": "Wound occurred",
        "summary": "Wound date recorded",
        "wound_date": "2026-09-01T00:00:00.000Z",
        "created_at": "2026-09-01T00:00:00.000Z"
      }
    ],
    "clinical_notes": [],
    "reports": [],
    "duration_days": 0,
    "notes": "Initial wound case created from nurse assessment.",
    "last_updated_at": "2026-09-15T00:00:00.000Z",
    "created_at": "2026-09-15T00:00:00.000Z",
    "updated_at": "2026-09-15T00:00:00.000Z"
  }
}
```

### Error Responses

Missing patient ID:

```json
{
  "message": "patient_id is required"
}
```

Missing wound type:

```json
{
  "message": "wound_type is required"
}
```

Invalid wound date:

```json
{
  "message": "wound_date must be a valid date"
}
```

Patient not found:

```json
{
  "message": "Patient not found"
}
```

## 2. Get Single Wound Case

```http
GET /api/wound-cases/get-wound-case/:id
Authorization: Bearer <nurse_token>
```

Full URL example:

```http
GET https://aiwond.appistansoft.com/api/wound-cases/get-wound-case/2
```

### Purpose

Fetches one wound case by ID. This response includes full wound case data, including the `updates` array where `wound_date` is stored.

### Path Params

| Param | Required | Notes |
|---|---:|---|
| `id` | Yes | Wound case ID. |

### Success Response

```json
{
  "wound_case": {
    "id": 2,
    "patient_id": 2,
    "wound_type": "Diabetic Foot Ulcer",
    "severity_stage": "Stage III",
    "pain_score": 5,
    "body_location": "Left heel",
    "wound_etiology": "Diabetes",
    "status": "active",
    "healing_progress": 0,
    "length_cm": 5,
    "width_cm": 4,
    "depth_cm": 2,
    "images": [],
    "measurements": [],
    "updates": [
      {
        "id": "update_...",
        "title": "Wound occurred",
        "summary": "Wound date recorded",
        "wound_date": "2026-09-01T00:00:00.000Z",
        "created_at": "2026-09-01T00:00:00.000Z"
      }
    ],
    "clinical_notes": [],
    "reports": [],
    "updates_count": 1,
    "images_count": 0,
    "notes_count": 0,
    "duration_days": 1,
    "notes": null,
    "last_updated_at": "2026-09-15T00:00:00.000Z",
    "created_at": "2026-09-15T00:00:00.000Z",
    "updated_at": "2026-09-15T00:00:00.000Z"
  }
}
```

### Frontend Wound Date Path

```js
const woundDate = response.wound_case.updates?.[0]?.wound_date;
```

### Error Response

```json
{
  "message": "Wound case not found"
}
```

## 3. Get All Wound Cases

```http
GET /api/wound-cases/get-wound-case
Authorization: Bearer <nurse_token>
```

Full URL:

```http
GET https://aiwond.appistansoft.com/api/wound-cases/get-wound-case
```

### Purpose

Fetches all wound cases available to the authenticated nurse. Each wound case includes full wound data, including the `updates` array where `wound_date` is stored.

### Optional Query Params

| Query | Notes |
|---|---|
| `patient_id` | Filter wound cases by patient ID. |
| `status` | Filter by status: `active`, `monitoring`, `healing`, `healed`, `closed`. |
| `wound_type` | Search by wound type. |
| `search` | Search by wound type, body location, or wound etiology. |

Examples:

```http
GET /api/wound-cases/get-wound-case?patient_id=2
GET /api/wound-cases/get-wound-case?status=active
GET /api/wound-cases/get-wound-case?search=heel
```

### Success Response

```json
{
  "wound_cases": [
    {
      "id": 2,
      "patient_id": 2,
      "wound_type": "Diabetic Foot Ulcer",
      "severity_stage": "Stage III",
      "pain_score": 5,
      "body_location": "Left heel",
      "wound_etiology": "Diabetes",
      "status": "active",
      "healing_progress": 0,
      "length_cm": 5,
      "width_cm": 4,
      "depth_cm": 2,
      "images": [],
      "measurements": [],
      "updates": [
        {
          "id": "update_...",
          "title": "Wound occurred",
          "summary": "Wound date recorded",
          "wound_date": "2026-09-01T00:00:00.000Z",
          "created_at": "2026-09-01T00:00:00.000Z"
        }
      ],
      "clinical_notes": [],
      "reports": [],
      "updates_count": 1,
      "images_count": 0,
      "notes_count": 0,
      "duration_days": 1,
      "notes": null,
      "last_updated_at": "2026-09-15T00:00:00.000Z",
      "created_at": "2026-09-15T00:00:00.000Z",
      "updated_at": "2026-09-15T00:00:00.000Z"
    }
  ]
}
```

### Frontend Wound Date Path

```js
const woundDate = response.wound_cases[index].updates?.[0]?.wound_date;
```

If showing a list:

```js
const rows = response.wound_cases.map((woundCase) => ({
  id: woundCase.id,
  woundType: woundCase.wound_type,
  woundDate: woundCase.updates?.[0]?.wound_date || null,
  createdAt: woundCase.created_at
}));
```

## Important Frontend Notes

- Use `wound_date` for the manually selected wound occurred date.
- Do not use top-level `created_at` as wound date. It is the database record creation date.
- Read wound date from `updates[0].wound_date`.
- If an older wound case was created before this change, `updates[0].wound_date` may be missing.
- Recommended display format can be handled on frontend from the ISO date string.
