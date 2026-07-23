# Doctor Patient and Wound Case APIs

## Overview

These APIs allow an authenticated doctor to manage patients and their wound cases.

Base URLs:

- Patients: `/api/doctor/patients`
- Wound cases: `/api/doctor/wound-cases`

All endpoints require a valid doctor access token.

```http
Authorization: Bearer <doctor_access_token>
Content-Type: application/json
```

Requests made without a valid token return `401`. A valid user without the `doctor` role receives `403 Forbidden`.

## Ownership rules

### Patients

- `doctor_id` is taken from the authenticated user (`req.user.id`).
- The client must not send or select `doctor_id`.
- A doctor can only read, update, or delete patients whose `doctor_id` matches the authenticated doctor.
- Patients belonging to another doctor, and patients with a `NULL doctor_id`, are returned as `404 Patient not found` for single-record operations.

### Wound cases

- A doctor can create a wound case only for a patient owned by that doctor.
- Wound-case access is scoped through the related patient's `doctor_id`.
- A wound case belonging to another doctor's patient is returned as `404 Wound case not found`.

---

# Doctor Patient APIs

## Create patient

```http
POST /api/doctor/patients
```

Required fields:

- `first_name`
- `last_name`
- `mrn`

Optional fields:

- `nurse_id`
- `date_of_birth` (`YYYY-MM-DD`)
- `gender`: `male`, `female`, or `other`
- `address`
- `phone_number`
- `room`
- `wound_type`
- `primary_staff`
- `backup_staff`
- `primary_diagnosis`
- `allergies_notes`

Example request:

```json
{
  "first_name": "Ali",
  "last_name": "Ahmed",
  "date_of_birth": "1985-06-15",
  "gender": "male",
  "mrn": "MRN-1001",
  "address": "Layyah",
  "phone_number": "03001234567",
  "room": "A-12",
  "wound_type": "Diabetic foot ulcer",
  "primary_diagnosis": "Type 2 diabetes",
  "allergies_notes": "Penicillin allergy",
  "nurse_id": 12
}
```

The API automatically sets:

```json
{
  "doctor_id": "authenticated doctor id",
  "status": "active",
  "archived_at": null,
  "archived_by": null
}
```

Success: `201 Created`

```json
{
  "message": "Patient created successfully",
  "patient": {
    "id": 25,
    "nurse_id": 12,
    "doctor_id": 7,
    "first_name": "Ali",
    "last_name": "Ahmed",
    "mrn": "MRN-1001",
    "status": "active"
  }
}
```

Possible errors:

- `400`: Required field, gender, nurse ID, or validation error.
- `409`: `Patient MRN already exists`.
- `500`: Patient creation failed.

## Get all patients

```http
GET /api/doctor/patients
```

Only patients created by the authenticated doctor are returned. The default status is `active`.

Optional query parameters:

| Parameter | Description |
|---|---|
| `search` | Searches first name, last name, or MRN. |
| `nurse_id` | Returns patients assigned to a specific nurse. |
| `status` | `active` or `archived`; default is `active`. |

Examples:

```http
GET /api/doctor/patients?search=Ali
GET /api/doctor/patients?nurse_id=12
GET /api/doctor/patients?status=archived
```

Success: `200 OK`

```json
{
  "message": "Patients fetched successfully",
  "total_count": 1,
  "patients": [
    {
      "id": 25,
      "doctor_id": 7,
      "first_name": "Ali",
      "last_name": "Ahmed",
      "mrn": "MRN-1001",
      "status": "active"
    }
  ]
}
```

## Get single patient

```http
GET /api/doctor/patients/:patientId
```

Example:

```http
GET /api/doctor/patients/25
```

The patient ID and authenticated `doctor_id` must both match.

Success: `200 OK`

```json
{
  "patient": {
    "id": 25,
    "doctor_id": 7,
    "first_name": "Ali",
    "last_name": "Ahmed",
    "mrn": "MRN-1001",
    "status": "active"
  }
}
```

Possible errors:

- `400`: Invalid patient ID.
- `404`: Patient does not exist or belongs to another doctor.

## Update patient

```http
PUT /api/doctor/patients/:patientId
PATCH /api/doctor/patients/:patientId
```

Both endpoints perform a partial update; send only the fields that should change.

Example:

```json
{
  "phone_number": "03009876543",
  "room": "B-04",
  "primary_diagnosis": "Updated diagnosis"
}
```

Success: `200 OK`

```json
{
  "message": "Patient updated successfully",
  "patient": {
    "id": 25,
    "doctor_id": 7,
    "room": "B-04"
  }
}
```

Possible errors:

- `400`: No update fields or invalid values.
- `404`: Patient does not exist or belongs to another doctor.
- `409`: Updated MRN already exists.

## Permanently delete patient

```http
DELETE /api/doctor/patients/:patientId
```

This operation permanently deletes the patient and its linked tasks and wound cases. It cannot be undone through the API.

Success: `200 OK`

```json
{
  "message": "Patient permanently deleted successfully",
  "deletion": {
    "deleted_patient": true,
    "deleted_wound_cases": 2,
    "deleted_tasks": 3
  }
}
```

`404 Patient not found` is returned when the patient belongs to another doctor.

---

# Doctor Wound Case APIs

## Create wound case

```http
POST /api/doctor/wound-cases
```

Required fields:

- `patient_id`
- `wound_type`

The patient must be owned by the authenticated doctor.

Optional fields:

- `severity_stage`
- `pain_score`: number from `0` to `10`
- `body_location`
- `wound_etiology`
- `status`: `active`, `monitoring`, `healing`, `healed`, or `closed`
- `healing_progress`: number from `0` to `100`
- `length_cm`, `width_cm`, `depth_cm`: numbers greater than or equal to `0`
- `images`, `measurements`, `updates`, `clinical_notes`, `reports`: JSON arrays
- `notes`

Example request:

```json
{
  "patient_id": 25,
  "wound_type": "Diabetic foot ulcer",
  "severity_stage": "Stage 2",
  "pain_score": 6,
  "body_location": "Left foot",
  "wound_etiology": "Diabetic",
  "status": "active",
  "healing_progress": 25,
  "length_cm": 4.5,
  "width_cm": 3.2,
  "depth_cm": 1.1,
  "notes": "Initial assessment"
}
```

Success: `201 Created`

```json
{
  "message": "Wound case created successfully",
  "wound_case": {
    "id": 41,
    "patient_id": 25,
    "wound_type": "Diabetic foot ulcer",
    "status": "active",
    "pain_score": 6
  }
}
```

Possible errors:

- `400`: Missing/invalid fields or values outside allowed ranges.
- `404`: Patient does not exist or belongs to another doctor.

## Get all wound cases

```http
GET /api/doctor/wound-cases
```

Only wound cases associated with patients owned by the authenticated doctor are returned.

Optional query parameters:

| Parameter | Description |
|---|---|
| `patient_id` | Returns wound cases for one owned patient. |
| `status` | Filters by a valid wound-case status. |
| `search` | Searches wound type, body location, and wound etiology. |

Examples:

```http
GET /api/doctor/wound-cases?patient_id=25
GET /api/doctor/wound-cases?status=healing
GET /api/doctor/wound-cases?search=foot
```

Success: `200 OK`

```json
{
  "total_count": 1,
  "wound_cases": [
    {
      "id": 41,
      "patient_id": 25,
      "wound_type": "Diabetic foot ulcer",
      "status": "active"
    }
  ]
}
```

## Get single wound case

```http
GET /api/doctor/wound-cases/:woundCaseId
```

Example:

```http
GET /api/doctor/wound-cases/41
```

Success: `200 OK`. A missing wound case or a case linked to another doctor's patient returns `404 Wound case not found`.

## Update wound case

```http
PUT /api/doctor/wound-cases/:woundCaseId
PATCH /api/doctor/wound-cases/:woundCaseId
```

Both endpoints support partial updates.

Example:

```json
{
  "status": "healing",
  "pain_score": 3,
  "healing_progress": 60,
  "length_cm": 3.1,
  "width_cm": 2.2,
  "depth_cm": 0.7,
  "notes": "Wound size reduced"
}
```

When changing `patient_id`, the new patient must also belong to the authenticated doctor.

Success: `200 OK`

```json
{
  "message": "Wound case updated successfully",
  "wound_case": {
    "id": 41,
    "patient_id": 25,
    "status": "healing",
    "healing_progress": 60
  }
}
```

Possible errors:

- `400`: No fields supplied or validation failed.
- `404`: Wound case/new patient not found or belongs to another doctor.

## Permanently delete wound case

```http
DELETE /api/doctor/wound-cases/:woundCaseId
```

The wound case must belong to a patient owned by the authenticated doctor.

Success: `200 OK`

```json
{
  "message": "Wound case permanently deleted successfully"
}
```

`404 Wound case not found` is returned when the record does not exist or is outside the authenticated doctor's scope.

---

# Common status codes

| Status | Meaning |
|---|---|
| `200` | Request completed successfully. |
| `201` | Record created successfully. |
| `400` | Request validation failed. |
| `401` | Missing, invalid, or expired authentication. |
| `403` | Authenticated user is not a doctor. |
| `404` | Record was not found or is not owned by the doctor. |
| `409` | A unique value, such as MRN, already exists. |
| `500` | Server/database operation failed. |

# Postman setup

Create these collection variables:

```text
baseUrl = https://your-api-domain.com
doctorToken = <doctor access token>
patientId = <created patient id>
woundCaseId = <created wound case id>
```

Use this authorization header on every request:

```text
Authorization: Bearer {{doctorToken}}
```

Example URLs:

```text
{{baseUrl}}/api/doctor/patients
{{baseUrl}}/api/doctor/patients/{{patientId}}
{{baseUrl}}/api/doctor/wound-cases
{{baseUrl}}/api/doctor/wound-cases/{{woundCaseId}}
```
