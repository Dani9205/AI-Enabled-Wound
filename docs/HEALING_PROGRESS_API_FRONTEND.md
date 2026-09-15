# Healing Progress API - Frontend Guide

This document covers the doctor wound healing progress API.

## Endpoint

```http
POST /api/doctor/wound-details/:woundCaseId/healing-progress
Authorization: Bearer <doctor_token>
Content-Type: application/json
```

Example:

```http
POST /api/doctor/wound-details/14/healing-progress
```

The query string is not required. Prefer this:

```http
POST /api/doctor/wound-details/14/healing-progress
```

Instead of this:

```http
POST /api/doctor/wound-details/{{woundCaseId}}/healing-progress?woundCaseId=14
```

## Purpose

Calculates wound healing progress percentage by comparing two saved wound measurements:

- First valid saved measurement = original measurement
- Last valid saved measurement = latest measurement

A valid measurement must include all three values:

```txt
length_cm
width_cm
depth_cm
```

The frontend does not need to send measurements in this API.

## Request Body

Send an empty JSON body:

```json
{}
```

Any measurements sent in the body are ignored. The API uses saved measurements from the wound case history.

## Required Data Before Calling

Before calling this API, the wound case should have at least two saved valid measurements.

Typical flow:

1. Wound case already has an original/baseline measurement.
2. Frontend calls AI detect measurement:

```http
POST /api/ai-wound-measurements/:woundCaseId/detect
```

3. Frontend reviews/adjusts values and saves latest measurement:

```http
PATCH /api/ai-wound-measurements/:woundCaseId/save
```

4. Frontend calls healing progress:

```http
POST /api/doctor/wound-details/:woundCaseId/healing-progress
```

## Calculation

The API calculates reduction for length, width, and depth, then averages them:

```txt
healing % = round((length reduction % + width reduction % + depth reduction %) / 3)
```

The result is clamped between `0` and `100`.

If latest length, width, and depth are all `0`, healing progress can be `100%`.

## Example Saved Measurements

Saved measurement history:

```json
[
  {
    "length_cm": 5,
    "width_cm": 4,
    "depth_cm": 2
  },
  {
    "length_cm": 3,
    "width_cm": 2,
    "depth_cm": 1
  }
]
```

API response healing percentage:

```json
{
  "healing_progress": {
    "percentage": 47
  }
}
```

## Success Response

```json
{
  "message": "Wound healing progress calculated successfully",
  "wound_case": {
    "id": 14,
    "patient_id": 3,
    "patient_name": "Test Patient",
    "wound_type": "Diabetic Foot Ulcer",
    "severity_stage": "Stage III",
    "body_location": "Left Heel",
    "duration_days": 12,
    "pain_score": 5,
    "healing_progress": 0,
    "last_updated_at": "2026-09-14T00:00:00.000Z"
  },
  "calculation_method": "healing % = round((length reduction % + width reduction % + depth reduction %) / 3), clamped to 0-100; capped at 99 while any latest dimension is above 0",
  "original_measurement": {
    "length_cm": 5,
    "width_cm": 4,
    "depth_cm": 2,
    "volume_cm3": 40,
    "healing_percentage": 0,
    "measured_at": "2026-01-01T00:00:00.000Z",
    "source": "measurement_history"
  },
  "previous_measurement": {
    "length_cm": 5,
    "width_cm": 4,
    "depth_cm": 2,
    "volume_cm3": 40,
    "healing_percentage": 0,
    "dimension_reductions": {
      "length_reduction_percentage": 0,
      "width_reduction_percentage": 0,
      "depth_reduction_percentage": 0
    },
    "measured_at": "2026-01-01T00:00:00.000Z"
  },
  "latest_measurement": {
    "length_cm": 3,
    "width_cm": 2,
    "depth_cm": 1,
    "volume_cm3": 6,
    "healing_percentage": 47,
    "dimension_reductions": {
      "length_reduction_percentage": 40,
      "width_reduction_percentage": 50,
      "depth_reduction_percentage": 50
    },
    "measured_at": "2026-01-10T00:00:00.000Z",
    "source": "measurement_history"
  },
  "healing_progress": {
    "percentage": 47,
    "status": "healing",
    "direction_since_previous": "increased",
    "change_since_previous_percentage_points": 47,
    "average_reduction_before_rounding": 46.67,
    "volume_change_from_original_cm3": -34
  }
}
```

## Frontend Fields To Display

Recommended:

```txt
healing_progress.percentage
healing_progress.status
healing_progress.direction_since_previous
latest_measurement.dimension_reductions
```

For a simple UI, display:

```txt
healing_progress.percentage + "%"
```

## Error Responses

### No Saved Original Measurement

This happens when there are no saved measurements with all three required fields.

```json
{
  "message": "Original wound measurement is not available",
  "error": "At least one saved measurement with length_cm, width_cm, and depth_cm greater than 0 is required"
}
```

### Less Than Two Valid Measurements

This happens when only one valid saved measurement exists.

```json
{
  "message": "Latest wound measurement is not available",
  "error": "At least two saved measurements with length_cm, width_cm, and depth_cm are required to calculate healing progress"
}
```

### Wound Case Not Found

```json
{
  "message": "Wound case not found"
}
```

## Frontend Notes

- Do not send measurement values to this API.
- Call the AI measurement save API first if the latest measurement has not been saved yet.
- The API uses saved measurement history only.
- `length_cm`, `width_cm`, and `depth_cm` are all required for both original and latest measurements.
- The first valid saved measurement is treated as original, and the last valid saved measurement is treated as latest.

