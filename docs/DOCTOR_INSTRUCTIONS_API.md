# Doctor Instructions API

Doctor instructions are stored inside the wound case's `clinical_notes` JSON field
with `note_type: "doctor_instruction"`.

## Base URL

```text
https://aiwound.appistan.app/api/doctor
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

## 5. Calculate Wound Healing Progress

Calculates healing progress by comparing the original wound dimensions with the
latest dimensions. It calculates the percentage reduction of length, width, and
depth separately, then returns their rounded average.

```http
POST /api/doctor/wound-details/:woundCaseId/healing-progress
```

### Path parameters

| Parameter | Required | Description |
| --- | --- | --- |
| `woundCaseId` | Yes | Existing wound case whose progress is being measured. |

### Recommended request body

Send both original and latest measurements when the frontend already has both
measurement sets:

```json
{
  "original_measurements": {
    "length_cm": 9,
    "width_cm": 9,
    "depth_cm": 9
  },
  "latest_measurements": {
    "length_cm": 9,
    "width_cm": 9,
    "depth_cm": 9
  }
}
```

If `latest_measurements` is omitted, the API uses the current dimensions stored
on the wound case. If those are incomplete, it falls back to the latest item in
the wound-case measurement history.

```json
{
  "original_measurements": {
    "length_cm": 9,
    "width_cm": 9,
    "depth_cm": 9
  }
}
```

Accepted nested aliases include `originalMeasurements`, `originalMeasurement`,
`latestMeasurements`, and `latestMeasurement`. Dimension fields can use
`length_cm`, `lengthCm`, or `length`, with equivalent aliases for width and depth.

### Calculation

```text
Length reduction = ((original length - latest length) / original length) * 100
Width reduction  = ((original width  - latest width)  / original width)  * 100
Depth reduction  = ((original depth  - latest depth)  / original depth)  * 100

Healing progress = round(
  (length reduction + width reduction + depth reduction) / 3
)
```

Calculation rules:

- Every original dimension must be a number greater than `0`.
- Every latest dimension must be a number greater than or equal to `0`.
- The final percentage is limited to the range `0–100`.
- A negative average, caused by wound growth, is returned as `0%`.
- If any latest dimension remains above `0`, progress is limited to `99%`.
- Progress reaches `100%` only when all three latest dimensions are `0`.
- The API compares current progress with the previous stored measurement and
  returns `increased`, `decreased`, or `stable`.

### Example: unchanged wound

```text
Original = 9 × 9 × 9
Latest   = 9 × 9 × 9

Length reduction = 0%
Width reduction  = 0%
Depth reduction  = 0%
Healing progress = 0%
```

### Success response — `200 OK`

```json
{
  "message": "Wound healing progress calculated successfully",
  "calculation_method": "healing % = round((length reduction % + width reduction % + depth reduction %) / 3), clamped to 0-100; capped at 99 while any latest dimension is above 0",
  "original_measurement": {
    "length_cm": 9,
    "width_cm": 9,
    "depth_cm": 9,
    "volume_cm3": 729,
    "healing_percentage": 0
  },
  "latest_measurement": {
    "length_cm": 9,
    "width_cm": 9,
    "depth_cm": 9,
    "volume_cm3": 729,
    "healing_percentage": 0,
    "dimension_reductions": {
      "length_reduction_percentage": 0,
      "width_reduction_percentage": 0,
      "depth_reduction_percentage": 0
    },
    "source": "request_latest_measurement"
  },
  "healing_progress": {
    "percentage": 0,
    "status": "baseline",
    "direction_since_previous": "stable",
    "change_since_previous_percentage_points": 0,
    "average_reduction_before_rounding": 0,
    "volume_change_from_original_cm3": 0
  }
}
```

The `latest_measurement.source` value explains where the latest dimensions came
from:

- `request_latest_measurement`: supplied explicitly in the request.
- `wound_case_current_measurement`: read from the current wound-case columns.
- `measurement_history`: fallback to the latest stored measurement-history item.

Possible healing statuses:

- `baseline`: calculated progress is `0%`.
- `healing`: calculated progress is between `1%` and `99%`.
- `healed`: calculated progress is `100%`.

### Error responses

- `400`: An original dimension is missing, zero, negative, or invalid.
- `404`: `Wound case not found`
- `404`: `Patient not found`
- `422`: `Latest wound measurement is incomplete`
- `422`: `Previous wound measurement is incomplete`
- `500`: `Wound healing progress calculation failed`

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
