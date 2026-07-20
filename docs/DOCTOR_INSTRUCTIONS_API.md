# Doctor Instructions API

Doctor instructions are stored inside the wound case's `clinical_notes` JSON field
with `note_type: "doctor_instruction"`.

## Base URL

```text
http://localhost:3000/api/doctor
```

Recommended Postman variables:

```text
baseUrl=http://localhost:3000
woundCaseId=<existing wound case ID>
instructionId=<ID returned by Add Instructions>
doctorId=<existing doctor user ID>
```

All request and response bodies use `application/json`.

## Instruction object

| Field | Type | Description |
| --- | --- | --- |
| `id` | string | Server-generated instruction identifier. |
| `text` | string | Clinical instruction text. |
| `frequency` | string or null | Treatment/dressing frequency. |
| `priority` | string | `low`, `medium`, or `high`. Defaults to `medium`. |
| `dressing_type` | string or null | Dressing or treatment type. |
| `next_review_at` | string or null | Next review date/time. |
| `tags` | array | Instruction tags. |
| `created_by` | string or null | Doctor display name. |
| `created_at` | ISO datetime | Creation timestamp. |
| `updated_at` | ISO datetime or null | Latest update timestamp. |

## 1. Add Instructions

Creates a doctor instruction against an existing wound case.

```http
POST /api/doctor/wound-cases/:woundCaseId/instructions
```

### Path parameters

| Parameter | Required | Description |
| --- | --- | --- |
| `woundCaseId` | Yes | Existing wound-case numeric ID. |

### Request body

Only `instructions` (or its alias `text`) is required.

```json
{
  "doctor_id": 5,
  "instructions": "Increase dressing frequency to every 24 hours.",
  "frequency": "Every 24 hours",
  "priority": "high",
  "dressing_type": "Foam dressing",
  "next_review_at": "2026-07-25",
  "tags": ["dressing", "monitor infection"]
}
```

Accepted aliases:

- Instruction text: `instructions`, `text`, `clinical_instructions`, or `clinicalInstructions`.
- Dressing type: `dressing_type` or `dressingType`.
- Next review: `next_review_at` or `nextReviewAt`.
- Doctor ID can alternatively be supplied as the `doctor_id` query parameter.

### Success response — `201 Created`

```json
{
  "message": "Doctor instructions saved successfully",
  "instruction": {
    "id": "instruction_1753000000000_ab12cd",
    "text": "Increase dressing frequency to every 24 hours.",
    "frequency": "Every 24 hours",
    "priority": "high",
    "dressing_type": "Foam dressing",
    "next_review_at": "2026-07-25",
    "tags": ["dressing", "monitor infection"],
    "created_by": "Doctor Name",
    "created_at": "2026-07-20T10:00:00.000Z",
    "updated_at": null
  }
}
```

Save the returned ID in Postman:

```javascript
const json = pm.response.json();
pm.environment.set('instructionId', json.instruction.id);
```

### Error responses

- `400`: `Clinical instructions are required`
- `400`: `Priority must be low, medium or high`
- `404`: `Wound case not found`
- `500`: `Doctor instructions save failed`

## 2. Get Instructions

Instructions are returned as part of the wound-case details response. There is no
standalone doctor-side `GET /instructions` route.

```http
GET /api/doctor/wound-cases/:woundCaseId
```

The optional `doctor_id` query parameter populates doctor information in
`assigned_staff`:

```http
GET /api/doctor/wound-cases/{{woundCaseId}}?doctor_id={{doctorId}}
```

### Success response — `200 OK`

```json
{
  "message": "Doctor wound case details fetched successfully",
  "id": 12,
  "doctor_instructions": [
    {
      "id": "instruction_1753000000000_ab12cd",
      "text": "Increase dressing frequency to every 24 hours.",
      "frequency": "Every 24 hours",
      "priority": "high",
      "dressing_type": "Foam dressing",
      "next_review_at": "2026-07-25",
      "tags": ["dressing", "monitor infection"],
      "created_by": "Doctor Name",
      "created_at": "2026-07-20T10:00:00.000Z",
      "updated_at": null
    }
  ],
  "tabs": {
    "notes": [
      {
        "id": "instruction_1753000000000_ab12cd",
        "note_type": "doctor_instruction",
        "text": "Increase dressing frequency to every 24 hours."
      }
    ]
  }
}
```

Use `doctor_instructions` for the instruction UI. `tabs.notes` contains the raw
clinical-note records, including doctor instructions and other note types.

### Error responses

- `404`: `Wound case not found`
- `404`: `Patient not found`
- `500`: `Doctor wound case details fetch failed`

## 3. Update Instructions

Updates an existing instruction stored against a wound case.

```http
PUT /api/doctor/wound-cases/:woundCaseId/instructions/:instructionId
```

### Path parameters

| Parameter | Required | Description |
| --- | --- | --- |
| `woundCaseId` | Yes | Wound case containing the instruction. |
| `instructionId` | Yes | Exact instruction ID returned by Add/Get. |

### Request body

All fields are optional, but at least one meaningful field should be supplied.
Fields not supplied retain their existing values.

```json
{
  "instructions": "Continue dressing changes every 12 hours and reassess drainage.",
  "frequency": "Every 12 hours",
  "priority": "high",
  "dressing_type": "Foam dressing",
  "next_review_at": "2026-07-27",
  "tags": ["updated", "drainage"]
}
```

### Success response — `200 OK`

```json
{
  "message": "Doctor instructions updated successfully",
  "instruction": {
    "id": "instruction_1753000000000_ab12cd",
    "text": "Continue dressing changes every 12 hours and reassess drainage.",
    "frequency": "Every 12 hours",
    "priority": "high",
    "dressing_type": "Foam dressing",
    "next_review_at": "2026-07-27",
    "tags": ["updated", "drainage"],
    "created_by": "Doctor Name",
    "created_at": "2026-07-20T10:00:00.000Z",
    "updated_at": "2026-07-20T11:00:00.000Z"
  }
}
```

After updating, call Get Instructions and verify the same value appears in both
`doctor_instructions` and `tabs.notes`.

### Error responses

- `400`: `Priority must be low, medium or high`
- `404`: `Wound case not found`
- `404`: `Doctor instruction not found`
- `500`: `Doctor instructions update failed`

## 4. Delete Instructions

Permanently removes one instruction from the wound case's clinical notes.

```http
DELETE /api/doctor/wound-cases/:woundCaseId/instructions/:instructionId
```

No request body is required.

### Success response — `200 OK`

```json
{
  "message": "Doctor instructions deleted successfully"
}
```

### Error responses

- `404`: `Wound case not found`
- `404`: `Doctor instruction not found`
- `500`: `Doctor instructions delete failed`

## Postman test sequence

1. Call Add Instructions.
2. Save `instruction.id` as `instructionId`.
3. Call Get Instructions and confirm the instruction exists.
4. Call Update Instructions using the same `woundCaseId` and `instructionId`.
5. Call Get Instructions again and confirm the update persisted.
6. Call Delete Instructions.
7. Call Get Instructions and confirm the instruction is no longer returned.

## Current authentication note

At present, `routes/doctorManagementRoutes.js` does not apply authentication or a
doctor-role middleware. Before production deployment, these routes should be
protected with `authenticateToken` and `requireRoles('doctor')`, and `doctor_id`
should be taken from `req.user.id` instead of trusting request input.
