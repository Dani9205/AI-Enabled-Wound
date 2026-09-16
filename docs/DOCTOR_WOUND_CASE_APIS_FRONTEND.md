# Doctor Wound Case APIs - Frontend Guide

This document covers the doctor wound case APIs for creating and fetching wound cases.

Base URL:

```txt
https://aiwond.appistansoft.com
```

All APIs require a doctor bearer token:

```http
Authorization: Bearer <doctor_token>
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

The wound date is not stored in the database `created_at` column. The top-level `created_at` remains the record creation timestamp.

The wound date is stored inside the existing `updates` JSON field:

```json
{
  "title": "Wound occurred",
  "summary": "Wound date recorded",
  "wound_date": "2026-09-02T00:00:00.000Z",
  "created_at": "2026-09-02T00:00:00.000Z"
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

## 1. Create Doctor Wound Case

```http
POST /api/doctor/wound-cases
Authorization: Bearer <doctor_token>
Content-Type: application/json
```

Full URL:

```http
POST https://aiwond.appistansoft.com/api/doctor/wound-cases
```

### Purpose

Creates a wound case for a patient owned by the authenticated doctor. The frontend can send the wound occurred date using `wound_date`.

### Request Body

```json
{
  "patient_id": 2,
  "wound_type": "Pressure Injury",
  "wound_date": "2026-09-02",
  "severity_stage": "Stage II",
  "pain_score": 3,
  "body_location": "Sacrum",
  "wound_etiology": "Pressure",
  "healing_progress": 0,
  "length_cm": 4,
  "width_cm": 3,
  "depth_cm": 1,
  "notes": "Doctor created initial wound case."
}
```

### Required Fields

| Field | Required | Notes |
|---|---:|---|
| `patient_id` | Yes | Patient must belong to the authenticated doctor. |
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
    "id": 77,
    "patient_id": 2,
    "wound_type": "Pressure Injury",
    "severity_stage": "Stage II",
    "pain_score": 3,
    "body_location": "Sacrum",
    "wound_etiology": "Pressure",
    "status": "active",
    "healing_progress": 0,
    "length_cm": 4,
    "width_cm": 3,
    "depth_cm": 1,
    "images": [],
    "measurements": [],
    "updates": [
      {
        "id": "update_...",
        "title": "Wound occurred",
        "summary": "Wound date recorded",
        "wound_date": "2026-09-02T00:00:00.000Z",
        "created_at": "2026-09-02T00:00:00.000Z"
      }
    ],
    "clinical_notes": [],
    "reports": [],
    "notes": "Doctor created initial wound case.",
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

Patient not found or not owned by doctor:

```json
{
  "message": "Patient not found"
}
```

## 2. Get Doctor Wound Cases

```http
GET /api/doctor/wound-cases
Authorization: Bearer <doctor_token>
```

Full URL:

```http
GET https://aiwond.appistansoft.com/api/doctor/wound-cases
```

### Purpose

Fetches all wound cases for patients owned by the authenticated doctor. Each wound case includes the `updates` array where `wound_date` is stored.

### Optional Query Params

| Query | Notes |
|---|---|
| `patient_id` | Filter by patient ID. |
| `patientId` | Alternative for `patient_id`. |
| `status` | Filter by status: `active`, `monitoring`, `healing`, `healed`, `closed`. |
| `search` | Search by wound type, body location, or wound etiology. |

Examples:

```http
GET /api/doctor/wound-cases?patient_id=2
GET /api/doctor/wound-cases?status=active
GET /api/doctor/wound-cases?search=sacrum
```

### Success Response

```json
{
  "total_count": 1,
  "wound_cases": [
    {
      "id": 77,
      "patient_id": 2,
      "wound_type": "Pressure Injury",
      "severity_stage": "Stage II",
      "pain_score": 3,
      "body_location": "Sacrum",
      "wound_etiology": "Pressure",
      "status": "active",
      "healing_progress": 0,
      "length_cm": 4,
      "width_cm": 3,
      "depth_cm": 1,
      "images": [],
      "measurements": [],
      "updates": [
        {
          "id": "update_...",
          "title": "Wound occurred",
          "summary": "Wound date recorded",
          "wound_date": "2026-09-02T00:00:00.000Z",
          "created_at": "2026-09-02T00:00:00.000Z"
        }
      ],
      "clinical_notes": [],
      "reports": [],
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

## 3. Get Single Doctor Wound Case

```http
GET /api/doctor/wound-cases/:woundCaseId
Authorization: Bearer <doctor_token>
```

Full URL example:

```http
GET https://aiwond.appistansoft.com/api/doctor/wound-cases/77
```

### Purpose

Fetches one wound case by ID for a patient owned by the authenticated doctor. The response includes the `updates` array where `wound_date` is stored.

### Path Params

| Param | Required | Notes |
|---|---:|---|
| `woundCaseId` | Yes | Wound case ID. |

### Success Response

```json
{
  "wound_case": {
    "id": 77,
    "patient_id": 2,
    "wound_type": "Pressure Injury",
    "severity_stage": "Stage II",
    "pain_score": 3,
    "body_location": "Sacrum",
    "wound_etiology": "Pressure",
    "status": "active",
    "healing_progress": 0,
    "length_cm": 4,
    "width_cm": 3,
    "depth_cm": 1,
    "images": [],
    "measurements": [],
    "updates": [
      {
        "id": "update_...",
        "title": "Wound occurred",
        "summary": "Wound date recorded",
        "wound_date": "2026-09-02T00:00:00.000Z",
        "created_at": "2026-09-02T00:00:00.000Z"
      }
    ],
    "clinical_notes": [],
    "reports": [],
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

## Important Frontend Notes

- Use `wound_date` for the manually selected wound occurred date.
- Do not use top-level `created_at` as wound date. It is the record creation timestamp.
- Read wound date from `updates[0].wound_date`.
- Older wound cases created before this change may not have `updates[0].wound_date`.
- Doctor APIs only return wound cases for patients owned by the authenticated doctor.
