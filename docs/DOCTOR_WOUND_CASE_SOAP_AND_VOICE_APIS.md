# Doctor Wound Case SOAP and Voice APIs

This document covers the doctor-side SOAP generation and voice dictation APIs.

Base path:

```http
/api/doctor/wound-cases
```

All APIs require a doctor bearer token.

```http
Authorization: Bearer <doctorToken>
```

These routes are mounted through:

```js
router.use(authenticateToken, requireRoles('doctor'));
```

## 1. Generate SOAP Note

```http
POST /api/doctor/wound-cases/:woundCaseId/generate-soap-note
```

Generates an AI SOAP note for a wound case and saves it in `clinical_notes`.

### Postman

Method:

```http
POST
```

URL:

```http
{{baseUrl}}/api/doctor/wound-cases/{{woundCaseId}}/generate-soap-note
```

Headers:

```http
Authorization: Bearer {{doctorToken}}
Content-Type: application/json
```

Body type:

```text
raw JSON
```

Body:

```json
{
  "text": "Patient reports mild pain around the wound. Wound is located on the left heel with moderate drainage. Dressing was changed today.",
  "instructions": "Generate concise professional SOAP note.",
  "created_by": "Dr. Sara"
}
```

### Body Fields

| Field | Type | Required | Description |
|---|---:|---:|---|
| `text` | string | No | Clinical narrative for SOAP generation. |
| `clinical_note` / `clinicalNote` | string | No | Alias for `text`. |
| `instructions` | string | No | Extra AI instructions. |
| `ai_instructions` / `aiInstructions` | string | No | Alias for `instructions`. |
| `created_by` / `createdBy` | string | No | Creator stored on the note. |

If `text` is not provided, the API uses the wound case `notes` field.

### Success Response

```json
{
  "message": "SOAP note generated successfully",
  "clinical_note": {
    "id": "note_1720000000000_abc123",
    "note_type": "soap",
    "title": "AI SOAP Note",
    "text": "Patient reports mild pain around the wound.",
    "soap": {
      "subjective": "Patient reports mild pain around the wound.",
      "objective": "Wound is located on the left heel with moderate drainage documented.",
      "assessment": "Wound requires continued monitoring.",
      "plan": "Continue dressing changes and reassess wound progress."
    },
    "audio_url": null,
    "is_ai_generated": true,
    "created_by": "Dr. Sara",
    "created_at": "2026-08-17T10:00:00.000Z"
  },
  "ai_model": "gpt-4.1-mini"
}
```

### Environment

Required:

```env
OPENAI_API_KEY=...
```

Optional:

```env
OPENAI_SOAP_MODEL=...
OPENAI_REPORT_MODEL=...
```

Fallback model:

```text
gpt-4.1-mini
```

## 2. Save Voice Dictation

```http
POST /api/doctor/wound-cases/:woundCaseId/save-voice-dictation
```

Saves a voice clinical note. It can save an uploaded audio file, a transcript, or both. This API does not perform transcription.

### Postman

Method:

```http
POST
```

URL:

```http
{{baseUrl}}/api/doctor/wound-cases/{{woundCaseId}}/save-voice-dictation
```

Headers:

```http
Authorization: Bearer {{doctorToken}}
```

Do not manually set `Content-Type`; Postman will set `multipart/form-data`.

Body type:

```text
form-data
```

Body fields:

| Key | Type | Value |
|---|---|---|
| `audio` | File | Select audio file |
| `transcript` | Text | `Patient reports pain near wound site.` |
| `title` | Text | `Voice Note` |
| `duration_seconds` | Text | `18` |
| `created_by` | Text | `Dr. Sara` |

Accepted file field names:

```text
audio
voice
file
voice_file
voiceFile
audio_file
audioFile
```

Accepted MIME types:

```text
audio/*
application/octet-stream
```

Maximum upload size:

```text
25 MB
```

At least one of `transcript`, `text`, uploaded audio file, `audio_url`, or `audioUrl` is required.

### Success Response

```json
{
  "message": "Voice dictation saved successfully",
  "clinical_note": {
    "id": "note_1720000000000_abc123",
    "note_type": "voice",
    "title": "Voice Note",
    "text": "Patient reports pain near wound site.",
    "soap": null,
    "audio_url": "http://localhost:3000/uploads/voice-dictations/file.m4a",
    "audio_file_path": "/uploads/voice-dictations/file.m4a",
    "audio_original_name": "voice-note.m4a",
    "audio_mime_type": "audio/mp4",
    "audio_size": 123456,
    "duration_seconds": 18,
    "is_ai_generated": false,
    "created_by": "Dr. Sara",
    "created_at": "2026-08-17T10:00:00.000Z"
  }
}
```

## 3. Transcribe Voice Dictation

```http
POST /api/doctor/wound-cases/:woundCaseId/transcribe-voice-dictation/:noteId?
```

Uploads or reads a saved local audio file, sends it to the configured Whisper service, saves the transcript, and returns the clinical note.

### Postman: Upload New Audio

Method:

```http
POST
```

URL:

```http
{{baseUrl}}/api/doctor/wound-cases/{{woundCaseId}}/transcribe-voice-dictation
```

Headers:

```http
Authorization: Bearer {{doctorToken}}
```

Body type:

```text
form-data
```

Body fields:

| Key | Type | Value |
|---|---|---|
| `audio` | File | Select audio file |
| `title` | Text | `Voice Note` |
| `duration_seconds` | Text | `18` |
| `created_by` | Text | `Dr. Sara` |

### Postman: Transcribe Existing Voice Note

Use this when the clinical note already has a local `audio_file_path`.

```http
POST {{baseUrl}}/api/doctor/wound-cases/{{woundCaseId}}/transcribe-voice-dictation/{{noteId}}
```

Headers:

```http
Authorization: Bearer {{doctorToken}}
```

Body can be empty unless you want to override optional fields like `title`.

### Success Response

```json
{
  "message": "Voice transcribed successfully",
  "transcript": "Patient reports pain near wound site.",
  "clinical_note": {
    "id": "note_1720000000000_abc123",
    "note_type": "voice",
    "title": "Voice Note",
    "text": "Patient reports pain near wound site.",
    "audio_url": "http://localhost:3000/uploads/voice-dictations/file.m4a",
    "audio_file_path": "/uploads/voice-dictations/file.m4a",
    "is_ai_generated": false,
    "created_by": "Dr. Sara"
  },
  "wound_case": {}
}
```

### Environment

Required:

```env
WHISPER_SERVICE_URL=...
```

Optional:

```env
WHISPER_MODEL=whisper-1
WHISPER_SERVICE_API_KEY=...
```

## Common Errors

| Status | Message | Reason |
|---:|---|---|
| 400 | `transcript or audio file is required` | Save voice request has no transcript, text, audio file, or audio URL. |
| 400 | `Only audio files are allowed` | Uploaded file is not audio or octet-stream. |
| 400 | `File too large` | Audio file is larger than 25 MB. |
| 400 | `A saved local audio file or uploaded audio file is required` | Transcription request has no accessible audio file. |
| 401 | `Invalid or expired token` | Missing, invalid, or expired bearer token. |
| 403 | `Forbidden` | Token user role is not `doctor`. |
| 404 | `Wound case not found` | Wound case does not exist or is not assigned to the doctor. |
| 404 | `Voice note not found` | Provided `noteId` does not exist on the wound case. |
| 422 | `Audio transcription returned no text` | Whisper service returned no transcript. |
| 500 | `SOAP note generation failed` | OpenAI key/model/service issue. |
| 500 | `Voice dictation save failed` | Unexpected save error. |
| 500 | `Voice transcription failed` | Whisper config/service/runtime issue. |

## Doctor Assignment Rule

The underlying controller checks doctor access using the wound case's patient:

```text
patients.doctor_id = authenticated doctor id
OR
patients.assigned_to = authenticated doctor id
```

If this does not match, the API returns:

```json
{
  "message": "Wound case not found"
}
```

## Controller Functions Used

These doctor routes reuse existing wound case controller functions:

| Doctor Route | Controller Function |
|---|---|
| `POST /:woundCaseId/generate-soap-note` | `generateSoapNote` |
| `POST /:woundCaseId/save-voice-dictation` | `saveVoiceDictation` |
| `POST /:woundCaseId/transcribe-voice-dictation/:noteId?` | `transcribeVoiceDictation` |

The route maps `req.params.woundCaseId` to `req.params.id` before calling the shared controller.
