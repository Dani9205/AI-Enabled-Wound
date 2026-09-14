# Fixed Language APIs - Frontend Guide

This document covers the APIs updated to accept a frontend-selected output language.

## Output language behavior

- Send `language`, `output_language`, or `outputLanguage` in the request.
- If no language is sent, the backend defaults to `English`.
- Input text or voice can be in any language. The final output is generated in the requested language.
- Examples: Urdu input to Spanish output, Australian English voice to English output, English input to Urdu output.

## 1. Generate SOAP Note

### Nurse API

```http
POST /api/wound-cases/generate-soap-note/:id
Authorization: Bearer <nurse_token>
Content-Type: application/json
```

### Doctor API

```http
POST /api/doctor/wound-cases/:woundCaseId/generate-soap-note
Authorization: Bearer <doctor_token>
Content-Type: application/json
```

### Request Body

```json
{
  "text": "Patient reports pain and drainage from the left heel wound.",
  "language": "Spanish",
  "instructions": "Keep the note concise.",
  "created_by": "Dr. Ali"
}
```

### Accepted Fields

| Field | Required | Notes |
|---|---:|---|
| `text` | No | Clinical narrative. If omitted, wound case `notes` may be used. |
| `clinical_note` | No | Alternative for `text`. |
| `clinicalNote` | No | Alternative for `text`. |
| `language` | No | Requested SOAP output language. Defaults to `English`. |
| `output_language` | No | Alternative for `language`. |
| `outputLanguage` | No | Alternative for `language`. |
| `instructions` | No | Extra AI guidance. |
| `ai_instructions` | No | Alternative for `instructions`. |
| `aiInstructions` | No | Alternative for `instructions`. |
| `created_by` | No | Optional creator display value. |
| `createdBy` | No | Alternative for `created_by`. |

### Success Response

```json
{
  "message": "SOAP note generated successfully",
  "clinical_note": {
    "id": "note_...",
    "note_type": "soap",
    "title": "AI SOAP Note",
    "text": "Patient reports pain and drainage from the left heel wound.",
    "soap": {
      "subjective": "El paciente informa dolor y secrecion...",
      "objective": "Herida en el talon izquierdo...",
      "assessment": "Ulcera activa que requiere seguimiento...",
      "plan": "Continuar cuidados de la herida..."
    },
    "language": "Spanish",
    "is_ai_generated": true,
    "created_by": "Dr. Ali",
    "created_at": "2026-09-14T00:00:00.000Z"
  },
  "ai_model": "gpt-4.1-mini",
  "language": "Spanish"
}
```

### Notes for Frontend

- Display `clinical_note.soap.subjective`, `objective`, `assessment`, and `plan`.
- `clinical_note.language` tells which output language was used.
- Input text language does not need to match output language.

## 2. Transcribe Voice Dictation

### Nurse API

```http
POST /api/wound-cases/transcribe-voice-dictation/:id/:noteId?
Authorization: Bearer <nurse_token>
Content-Type: multipart/form-data
```

### Doctor API

```http
POST /api/doctor/wound-cases/:woundCaseId/transcribe-voice-dictation/:noteId?
Authorization: Bearer <doctor_token>
Content-Type: multipart/form-data
```

`noteId` is optional.

- Without `noteId`: creates a new voice clinical note and returns `201`.
- With `noteId`: updates the existing voice note and returns `200`.

### Form Data Example

```txt
audio = wound-note.m4a
language = Urdu
title = Follow-up Voice Note
duration_seconds = 24
created_by = Dr. Ali
```

### Accepted Fields

| Field | Required | Notes |
|---|---:|---|
| `audio` | Conditional | Audio upload. Required when not reusing saved local audio from `noteId`. |
| `voice` | Conditional | Alternative audio field name. |
| `file` | Conditional | Alternative audio field name. |
| `voice_file` | Conditional | Alternative audio field name. |
| `voiceFile` | Conditional | Alternative audio field name. |
| `audio_file` | Conditional | Alternative audio field name. |
| `audioFile` | Conditional | Alternative audio field name. |
| `language` | No | Requested final transcript language. Defaults to `English`. |
| `output_language` | No | Alternative for `language`. |
| `outputLanguage` | No | Alternative for `language`. |
| `title` | No | Defaults to `Voice Note`. |
| `duration_seconds` | No | Optional audio duration. |
| `durationSeconds` | No | Alternative for `duration_seconds`. |
| `created_by` | No | Optional creator display value. |
| `createdBy` | No | Alternative for `created_by`. |

### Success Response

```json
{
  "message": "Voice transcribed successfully",
  "transcript": "زخم میں درد اور رطوبت کی شکایت ہے۔",
  "raw_transcript": "Patient reports pain and drainage from the wound.",
  "language": "Urdu",
  "translation_model": "gpt-4.1-mini",
  "clinical_note": {
    "id": "note_...",
    "note_type": "voice",
    "title": "Follow-up Voice Note",
    "text": "زخم میں درد اور رطوبت کی شکایت ہے۔",
    "language": "Urdu",
    "audio_url": "https://example.com/uploads/voice-dictations/file.m4a",
    "audio_file_path": "/uploads/voice-dictations/file.m4a",
    "audio_original_name": "wound-note.m4a",
    "audio_mime_type": "audio/mp4",
    "audio_size": 123456,
    "duration_seconds": 24,
    "is_ai_generated": false,
    "created_by": "Dr. Ali",
    "created_at": "2026-09-14T00:00:00.000Z"
  },
  "wound_case": {}
}
```

### Notes for Frontend

- Show `transcript` or `clinical_note.text` to users.
- `raw_transcript` is only for debugging or audit. It is the direct speech-to-text output before language conversion.
- `language` is the final output language.
- Voice input language/accent does not need to match output language.

## Error Responses

### Missing or Invalid Audio

```json
{
  "message": "A saved local audio file or uploaded audio file is required"
}
```

### Invalid Existing Voice Note

```json
{
  "message": "Voice note not found"
}
```

### SOAP Generation Failure

```json
{
  "message": "SOAP note generation failed",
  "error": "..."
}
```

### Voice Transcription Failure

```json
{
  "message": "Voice transcription failed",
  "error": "..."
}
```

## Frontend Display Rules

- SOAP UI should display `clinical_note.soap`.
- Voice UI should display `clinical_note.text` or top-level `transcript`.
- Do not display `raw_transcript` as the final note unless specifically needed for debugging.
- Always send the desired output language from the language selector.

