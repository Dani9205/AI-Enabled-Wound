# SOAP Note and Voice Dictation API

This document describes the `generateSoapNote` and `saveVoiceDictation` functions
from `controllers/woundCaseController.js`.

## Common Requirements

- Base path: `/api/wound-cases`
- Authentication: `Authorization: Bearer <token>`
- Required role: `nurse`
- The wound case must belong to a patient assigned to the authenticated nurse.
- JSON requests must use `Content-Type: application/json`.

---

## 1. Generate SOAP Note

Generates a structured SOAP clinical note through OpenAI and saves it in the wound
case's `clinical_notes` collection.

### Endpoint

```http
POST /api/wound-cases/generate-soap-note/:id
```

### Path Parameter

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | Positive integer | Yes | Wound case ID. |

### Request Fields

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `text` | String | No | Clinical narrative used to generate the SOAP note. |
| `clinical_note` | String | No | Alias of `text`. |
| `clinicalNote` | String | No | Camel-case alias of `text`. |
| `instructions` | String | No | Additional instructions for SOAP generation. |
| `ai_instructions` | String | No | Alias of `instructions`. |
| `aiInstructions` | String | No | Camel-case alias of `instructions`. |
| `created_by` | String | No | Name or identifier stored as the note creator. |
| `createdBy` | String | No | Camel-case alias of `created_by`. |

If no clinical narrative is supplied, the function uses the wound case's `notes`
value. SOAP generation also receives the following stored case information:

- Wound type, stage, location, etiology, and status
- Pain score and healing progress
- Current length, width, and depth
- Existing case notes
- Latest measurement entry

The AI is instructed to reorganize and synthesize the information, not merely copy
the input. It must not invent patient facts and must identify relevant information
that was not documented.

### Request Example

```bash
curl -X POST "http://localhost:3000/api/wound-cases/generate-soap-note/1" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Patient reports left heel pain rated 7/10. Dressing changed today.",
    "instructions": "Keep every section concise.",
    "created_by": "Nurse Johnson"
  }'
```

### Success Response

Status: `200 OK`

```json
{
  "message": "SOAP note generated successfully",
  "clinical_note": {
    "id": "note_1720602000000_abc123",
    "note_type": "soap",
    "title": "AI SOAP Note",
    "text": "Patient reports left heel pain rated 7/10. Dressing changed today.",
    "soap": {
      "subjective": "The patient reports left heel pain rated 7/10.",
      "objective": "A left heel wound and dressing change are documented; other examination findings are not provided.",
      "assessment": "Left heel wound with significant reported pain. Interval healing and infection findings are not documented.",
      "plan": "Continue documented wound care and reassess pain, wound measurements, drainage, and signs of infection."
    },
    "audio_url": null,
    "audio_file_path": null,
    "audio_original_name": null,
    "audio_mime_type": null,
    "audio_size": null,
    "duration_seconds": null,
    "is_ai_generated": true,
    "created_by": "Nurse Johnson",
    "created_at": "2026-07-10T09:00:00.000Z"
  },
  "ai_model": "gpt-4.1-mini"
}
```

### OpenAI Configuration

| Environment Variable | Required | Description |
| --- | --- | --- |
| `OPENAI_API_KEY` | Yes | API key used to call OpenAI. |
| `OPENAI_SOAP_MODEL` | No | Preferred model for SOAP generation. |
| `OPENAI_REPORT_MODEL` | No | Model used when `OPENAI_SOAP_MODEL` is not configured or fails. |

The final fallback model is `gpt-4.1-mini`. The AI response uses a strict JSON schema
and must provide non-empty `subjective`, `objective`, `assessment`, and `plan` fields.

### Error Responses

#### Wound case not found

Status: `404 Not Found`

```json
{
  "message": "Wound case not found"
}
```

This response is also returned when the wound case is outside the authenticated
nurse's patient scope.

#### Generation failure

Status: `500 Internal Server Error`

```json
{
  "message": "SOAP note generation failed",
  "error": "OPENAI_API_KEY is required for SOAP note generation"
}
```

Possible causes include missing or invalid OpenAI configuration, rate limiting,
model failure, incomplete model output, and database persistence failure.

---

## 2. Save Voice Dictation

Saves a transcript, an uploaded audio recording, a remote audio URL, or a combination
of these as a `voice` clinical note. This endpoint does not convert speech to text.
Use `/transcribe-voice-dictation/:id/:noteId?` when transcription is required.

### Endpoint

```http
POST /api/wound-cases/save-voice-dictation/:id
```

### Path Parameter

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | Positive integer | Yes | Wound case ID. |

### Request Formats

The endpoint accepts:

- `application/json` for a transcript and/or existing audio URL
- `multipart/form-data` for an audio upload and optional text fields

At least one transcript, uploaded audio file, or audio URL must be provided.

### Request Fields

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `transcript` | String | Conditional | Existing voice transcript. |
| `text` | String | Conditional | Alias of `transcript`. |
| `audio_url` | String | Conditional | URL of an already hosted audio recording. |
| `audioUrl` | String | Conditional | Camel-case alias of `audio_url`. |
| `audio` | File | Conditional | Audio file upload. See supported aliases below. |
| `title` | String | No | Note title. Defaults to `Voice Note`. |
| `duration_seconds` | Number | No | Recording duration in seconds. |
| `durationSeconds` | Number | No | Camel-case alias of `duration_seconds`. |
| `created_by` | String | No | Name or identifier stored as the note creator. |
| `createdBy` | String | No | Camel-case alias of `created_by`. |

Supported audio file field names:

- `audio`
- `voice`
- `file`
- `voice_file`
- `voiceFile`
- `audio_file`
- `audioFile`

### Upload Rules

- Maximum file size: 25 MB
- Accepted MIME types: `audio/*` and `application/octet-stream`
- Only one audio file is accepted per supported field.
- When a file is uploaded, its generated server URL takes precedence over `audio_url`.
- Files are stored under `uploads/voice-dictations/`.

### Multipart Request Example

```bash
curl -X POST "http://localhost:3000/api/wound-cases/save-voice-dictation/1" \
  -H "Authorization: Bearer <token>" \
  -F "audio=@voice-note.m4a" \
  -F "transcript=Patient reports reduced pain today." \
  -F "duration_seconds=24" \
  -F "created_by=Nurse Johnson"
```

Do not manually add a `Content-Type` header to this multipart request. The HTTP
client must generate the correct boundary.

### JSON Request Example

```bash
curl -X POST "http://localhost:3000/api/wound-cases/save-voice-dictation/1" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "transcript": "Wound bed appears to have seventy percent granulation tissue.",
    "audio_url": "https://example.com/audio/voice-note.mp3",
    "duration_seconds": 24,
    "created_by": "Nurse Johnson"
  }'
```

### Success Response

Status: `201 Created`

```json
{
  "message": "Voice dictation saved successfully",
  "clinical_note": {
    "id": "note_1720602000000_def456",
    "note_type": "voice",
    "title": "Voice Note",
    "text": "Patient reports reduced pain today.",
    "soap": null,
    "audio_url": "http://localhost:3000/uploads/voice-dictations/1720602000000-123456789-voice-note.m4a",
    "audio_file_path": "/uploads/voice-dictations/1720602000000-123456789-voice-note.m4a",
    "audio_original_name": "voice-note.m4a",
    "audio_mime_type": "audio/mp4",
    "audio_size": 251204,
    "duration_seconds": 24,
    "is_ai_generated": false,
    "created_by": "Nurse Johnson",
    "created_at": "2026-07-10T09:00:00.000Z"
  }
}
```

For a JSON request containing a remote URL, the local audio metadata fields are
returned as `null`.

### Error Responses

#### Missing transcript and audio

Status: `400 Bad Request`

```json
{
  "message": "transcript or audio file is required"
}
```

Despite the message wording, a valid `audio_url` also satisfies this requirement.

#### Unsupported upload type

Status: `400 Bad Request`

```json
{
  "message": "Only audio files are allowed"
}
```

#### Wound case not found

Status: `404 Not Found`

```json
{
  "message": "Wound case not found"
}
```

#### Save failure

Status: `500 Internal Server Error`

```json
{
  "message": "Voice dictation save failed",
  "error": "Database error details"
}
```

## Related Source Files

- `controllers/woundCaseController.js`
- `routes/woundCaseRoutes.js`
- `middleware/voiceDictationUpload.js`

