# Doctor Home API

This document covers the doctor-side home/feed API.

## Endpoint

```http
GET /api/doctor/home
```

## Authentication

Required role: `doctor`

Required header:

```http
Authorization: Bearer <doctorToken>
```

The API uses the authenticated doctor from `req.user`. It does not use `doctor_id` from query params or request body.

## Purpose

Fetch the doctor's home screen data:

- Doctor basic info
- Dashboard stats
- Pending tasks assigned to the doctor
- Patients owned by or assigned to the doctor

## Request Example

```http
GET {{baseUrl}}/api/doctor/home
Authorization: Bearer {{doctorToken}}
Accept: application/json
```

No request body is required.

## Backend Scope Logic

The logged-in doctor ID is read from:

```js
req.user.id
```

Patients are fetched only when:

```text
patients.doctor_id = loggedInDoctorId
OR patients.assigned_to = loggedInDoctorId
```

Wound cases are fetched only for those scoped patients.

Tasks are fetched only when:

```text
tasks.assigned_to = loggedInDoctorId
```

Only pending tasks are returned in `my_tasks` and counted in `stats.tasks`.

## Success Response

Status: `200 OK`

```json
{
  "message": "Doctor home fetched successfully",
  "doctor": {
    "id": 12,
    "name": "Dr. Ahmed",
    "title": "Consultant"
  },
  "stats": {
    "patients": 2,
    "wounds": 3,
    "tasks": 1,
    "reports": 4
  },
  "my_tasks": [
    {
      "id": 5,
      "title": "Review wound progress",
      "description": "Check latest wound images",
      "task_type": "review",
      "priority": "high",
      "status": "pending",
      "patient_id": 10,
      "patient_name": "Ali Khan",
      "wound_case": null,
      "due_date": "2026-08-14",
      "due_time": "10:00",
      "created_at": "2026-08-13T09:00:00.000Z"
    }
  ],
  "assigned_patients": [
    {
      "id": 10,
      "initials": "AK",
      "name": "Ali Khan",
      "mrn": "MRN-001",
      "age": 45,
      "gender": "male",
      "room": "203",
      "ward": "Ward A",
      "wound_type": "Diabetic foot ulcer",
      "diagnosis": "Diabetes",
      "assigned_nurse": "Nurse Sara",
      "last_activity_at": "2026-08-13T08:30:00.000Z",
      "active_wound_cases_count": 1
    }
  ]
}
```

## Empty Response Example

For a newly signed-up doctor with no assigned or owned patients:

```json
{
  "message": "Doctor home fetched successfully",
  "doctor": {
    "id": 12,
    "name": "Dr. Ahmed",
    "title": "Consultant"
  },
  "stats": {
    "patients": 0,
    "wounds": 0,
    "tasks": 0,
    "reports": 0
  },
  "my_tasks": [],
  "assigned_patients": []
}
```

## Response Fields

### `doctor`

Basic authenticated doctor info.

| Field | Type | Description |
|---|---|---|
| `id` | number | Doctor user ID. |
| `name` | string | Doctor full name. |
| `title` | string/null | Doctor professional title. |

### `stats`

Dashboard counters.

| Field | Type | Description |
|---|---|---|
| `patients` | number | Count of patients where `doctor_id` or `assigned_to` equals the logged-in doctor ID. |
| `wounds` | number | Count of scoped wound cases with status `active`, `monitoring`, or `healing`. |
| `tasks` | number | Count of pending tasks assigned to the logged-in doctor. |
| `reports` | number | Total report entries stored in scoped wound cases. |

### `my_tasks`

Up to five pending tasks assigned to the logged-in doctor.

| Field | Type | Description |
|---|---|---|
| `id` | number | Task ID. |
| `title` | string | Task title. |
| `description` | string/null | Task description. |
| `task_type` | string | Task type. |
| `priority` | string | Task priority. |
| `status` | string | Task status, normally `pending` here. |
| `patient_id` | number/null | Related patient ID. |
| `patient_name` | string/null | Related patient full name when available. |
| `wound_case` | object/string/null | Stored task wound-case reference. |
| `due_date` | string/null | Task due date. |
| `due_time` | string/null | Task due time. |
| `created_at` | string | Task creation timestamp. |

### `assigned_patients`

Up to six latest scoped patients.

| Field | Type | Description |
|---|---|---|
| `id` | number | Patient ID. |
| `initials` | string | Patient initials. |
| `name` | string | Patient full name. |
| `mrn` | string | Medical record number. |
| `age` | number/null | Calculated patient age. |
| `gender` | string/null | Patient gender. |
| `room` | string/null | Patient room. |
| `ward` | string/null | Currently mapped from patient address. |
| `wound_type` | string/null | Primary wound type from latest wound case or patient record. |
| `diagnosis` | string/null | Primary diagnosis. |
| `assigned_nurse` | string/null | Nurse full name when `nurse_id` is available, otherwise patient `primary_staff`. |
| `last_activity_at` | string/null | Latest wound-case activity timestamp or patient update timestamp. |
| `active_wound_cases_count` | number | Count of wound cases linked to that patient in the home response. |

## Error Responses

### Missing or Invalid Token

Status: `401 Unauthorized`

```json
{
  "message": "Authentication token is required"
}
```

or:

```json
{
  "message": "Authenticated doctor is required"
}
```

### Wrong Role

Status: `403 Forbidden`

```json
{
  "message": "Forbidden"
}
```

### Server Error

Status: `500 Internal Server Error`

```json
{
  "message": "Doctor home fetch failed",
  "error": "Error details"
}
```

## Frontend Notes

The frontend should send the doctor token in the `Authorization` header.

If `assigned_patients` is empty, show an empty state. Do not show cached or sample patients for a newly signed-up doctor.

If the API returns `401`, sign the doctor out or refresh the auth flow according to the app behavior.
