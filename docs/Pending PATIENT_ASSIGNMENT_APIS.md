# Patient Assignment APIs

This document covers only direct patient assignment implemented in:

- `models/patientModel.js`
- `controllers/patientController.js`
- `controllers/doctorPatientController.js`
- `routes/patientRoutes.js`
- `routes/doctorPatientRoutes.js`

## Assignment fields

The `patients` table contains these assignment fields:

| Field | Meaning |
| --- | --- |
| `nurse_id` | Associated nurse's `users.id`. |
| `doctor_id` | Associated doctor's `users.id`. |
| `assigned_by` | `users.id` of the nurse or doctor who originally created the patient. |
| `assigned_to` | `users.id` of the current primary assignee. |

`assigned_by` is creation history and remains unchanged when a patient is reassigned. `assigned_to` changes to the target user's ID on every direct reassignment.

The target user must:

- Exist in the `users` table.
- Have the `nurse` or `doctor` role.
- Belong to the same organization when both users have an `organization_id`.

Direct patient reassignment changes only the patient record. It does not update tasks.

## Initial assignment on creation

### Nurse creates a patient

```http
POST /api/patients/create-patient
Authorization: Bearer <nurse-token>
```

The controller assigns the authenticated nurse automatically:

```txt
nurse_id   = req.user.id
doctor_id  = NULL
assigned_by = req.user.id
assigned_to = req.user.id
```

A client-supplied `nurse_id` cannot override the authenticated nurse.

### Doctor creates a patient

```http
POST /api/doctor/patients
Authorization: Bearer <doctor-token>
```

Without `nurse_id`:

```txt
doctor_id   = req.user.id
nurse_id    = NULL
assigned_by = req.user.id
assigned_to = req.user.id
```

With a valid `nurse_id`:

```json
{
  "first_name": "Ali",
  "last_name": "Khan",
  "mrn": "MRN-1001",
  "nurse_id": 8
}
```

The saved assignment is:

```txt
doctor_id   = req.user.id
nurse_id    = 8
assigned_by = req.user.id
assigned_to = 8
```

## Nurse patient reassignment

```http
PATCH /api/patients/reassign-patient/:id
Authorization: Bearer <nurse-token>
Content-Type: application/json
```

Only the nurse whose `users.id` matches the patient's current `nurse_id` can use this endpoint for that patient.

Request body:

```json
{
  "assigned_to": 12
}
```

`assignedTo` is also accepted:

```json
{
  "assignedTo": 12
}
```

If user `12` is a nurse:

```txt
nurse_id   = 12
assigned_to = 12
```

If user `12` is a doctor:

```txt
doctor_id   = 12
assigned_to = 12
```

The other role-specific field and `assigned_by` remain unchanged.

## Doctor patient reassignment

```http
PATCH /api/doctor/patients/:patientId/reassign
Authorization: Bearer <doctor-token>
Content-Type: application/json
```

Only the doctor whose `users.id` matches the patient's current `doctor_id` can use this endpoint for that patient.

Request body:

```json
{
  "assigned_to": 12
}
```

`assignedTo` is also accepted.

If user `12` is a nurse:

```txt
nurse_id   = 12
assigned_to = 12
```

If user `12` is a doctor:

```txt
doctor_id   = 12
assigned_to = 12
```

The other role-specific field and `assigned_by` remain unchanged.

## Successful response

Both reassignment endpoints return `200 OK`:

```json
{
  "message": "Patient reassigned successfully",
  "assigned_to": {
    "id": 12,
    "role": "nurse",
    "name": "Nurse Name"
  },
  "patient": {
    "id": 25,
    "nurse_id": 12,
    "doctor_id": 4,
    "assigned_by": 4,
    "assigned_to": 12,
    "first_name": "Ali",
    "last_name": "Khan",
    "mrn": "MRN-1001"
  }
}
```

## Error responses

| Status | Condition |
| --- | --- |
| `400` | `assigned_to` is missing, invalid, or not a positive integer. |
| `400` | Target user belongs to a different organization. |
| `401` | Bearer token is missing, invalid, or expired. |
| `403` | Authenticated user does not have the required nurse/doctor role. |
| `404` | Patient is not accessible to the authenticated nurse or doctor. |
| `404` | Target user does not exist or is not a nurse/doctor. |
| `500` | Unexpected patient reassignment failure. |

## Database migration

Run:

```txt
migrations/20260729_add_patient_assignment_fields.sql
```

The migration safely adds `assigned_by` and `assigned_to` and backfills existing patient rows:

```txt
assigned_by = existing doctor_id, otherwise existing nurse_id
assigned_to = existing nurse_id, otherwise existing doctor_id
```

Alternatively, development environments can enable Sequelize schema alteration with:

```env
DB_SYNC_ALTER=true
```
