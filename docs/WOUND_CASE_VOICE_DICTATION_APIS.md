# Wound Case Voice Dictation APIs

This document covers the APIs used to save a voice clinical note and transcribe wound-case audio.

## Base URL

```text
{{baseUrl}}/api/wound-cases
```

Example local base URL:

```text
http://localhost:3000/api/wound-cases
```

## Authentication and access

Both APIs require a valid JWT belonging to a user with the `nurse` role.

```http
Authorization: Bearer <nurse_jwt_token>
```

A nurse can access a wound case only when its patient is assigned to that nurse. An inaccessible wound case is returned as not found.

## Audio upload rules

- Request content type: `multipart/form-data`
- Maximum file size: 25 MB
- Accepted MIME types: `audio/*` and `application/octet-stream`
- Maximum files per supported field: 1
- Uploaded files are stored in `uploads/voice-dictations/`

Any one of these multipart field names can be used:

```text
audio
voice
file
voice_file
voiceFile
audio_file
audioFile
```

## 1. Save Voice Dictation

Saves an existing transcript, an uploaded audio file, a remote audio URL, or a combination of transcript and audio as a `voice` clinical note.

This endpoint does not perform speech-to-text transcription. Use the Transcribe Voice Dictation endpoint when the server needs to generate the transcript from audio.

### Request

```http
POST /api/wound-cases/save-voice-dictation/:id
```

Example:

```http
POST /api/wound-cases/save-voice-dictation/42
```

### Path parameters

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | number | Yes | Wound case ID. |

### Form-data fields

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `audio` | file | Conditional | Audio upload. Any supported upload alias may be used instead. |
| `transcript` | string | Conditional | Existing transcript text. Alias: `text`. |
| `audio_url` | string | Conditional | Remote or existing audio URL. Alias: `audioUrl`. |
| `title` | string | No | Clinical note title. Default: `Voice Note`. |
| `duration_seconds` | number | No | Audio duration in seconds. Alias: `durationSeconds`. |
| `created_by` | string | No | Name or identifier of the note creator. Alias: `createdBy`. |

At least one of `transcript`, an uploaded audio file, or `audio_url` must be supplied. When an audio file and `audio_url` are both supplied, the uploaded file takes precedence.

### cURL: save uploaded audio and transcript

```bash
curl --request POST \
  "{{baseUrl}}/api/wound-cases/save-voice-dictation/42" \
  --header "Authorization: Bearer <nurse_jwt_token>" \
  --form "audio=@/path/to/voice-note.m4a" \
  --form "transcript=The wound bed shows healthy granulation tissue." \
  --form "title=Morning wound assessment" \
  --form "duration_seconds=18" \
  --form "created_by=Nurse Ayesha"
```

### cURL: save transcript only

```bash
curl --request POST \
  "{{baseUrl}}/api/wound-cases/save-voice-dictation/42" \
  --header "Authorization: Bearer <nurse_jwt_token>" \
  --header "Content-Type: application/json" \
  --data '{
    "title": "Follow-up note",
    "transcript": "Dressing changed and the wound was cleaned.",
    "created_by": "Nurse Ayesha"
  }'
```

### Success response

Status: `201 Created`

```json
{
  "message": "Voice dictation saved successfully",
  "clinical_note": {
    "id": "note_1784178000000_ab12cd",
    "note_type": "voice",
    "title": "Morning wound assessment",
    "text": "The wound bed shows healthy granulation tissue.",
    "soap": null,
    "audio_url": "http://localhost:3000/uploads/voice-dictations/1784178000000-123456789-voice-note.m4a",
    "audio_file_path": "/uploads/voice-dictations/1784178000000-123456789-voice-note.m4a",
    "audio_original_name": "voice-note.m4a",
    "audio_mime_type": "audio/mp4",
    "audio_size": 245760,
    "duration_seconds": 18,
    "is_ai_generated": false,
    "created_by": "Nurse Ayesha",
    "created_at": "2026-07-16T06:20:00.000Z"
  }
}
```

## 2. Transcribe Voice Dictation

Sends an uploaded audio file, or a local audio file belonging to an existing clinical note, to the configured Whisper-compatible transcription service. The generated transcript is saved in the wound case's clinical notes.

### Requests

Create a new transcribed clinical note:

```http
POST /api/wound-cases/transcribe-voice-dictation/:id
```

Transcribe or re-transcribe an existing clinical note:

```http
POST /api/wound-cases/transcribe-voice-dictation/:id/:noteId
```

### Path parameters

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | number | Yes | Wound case ID. |
| `noteId` | string | No | Existing clinical note ID. It may alternatively be supplied as `note_id` or `noteId` in the request body. |

### Form-data fields

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `audio` | file | Conditional | New audio to transcribe. Any supported upload alias may be used instead. |
| `note_id` | string | Conditional | Existing note ID when it is not included in the URL. Alias: `noteId`. |
| `title` | string | No | Note title. Existing title is retained when updating; otherwise defaults to `Voice Note`. |
| `duration_seconds` | number | No | Audio duration. Alias: `durationSeconds`. |
| `created_by` | string | No | Note creator. Alias: `createdBy`. |

An uploaded audio file is required when creating a new note. When an existing `noteId` is supplied without a new upload, that note must contain a valid local file path or `/uploads/...` URL whose file still exists on the server.

A remote external audio URL is not downloaded by this endpoint. The audio must be newly uploaded or already stored locally under the application's `uploads` directory.

### cURL: upload, transcribe, and create a note

```bash
curl --request POST \
  "{{baseUrl}}/api/wound-cases/transcribe-voice-dictation/42" \
  --header "Authorization: Bearer <nurse_jwt_token>" \
  --form "audio=@/path/to/voice-note.m4a" \
  --form "title=Morning wound assessment" \
  --form "duration_seconds=18" \
  --form "created_by=Nurse Ayesha"
```

### cURL: transcribe an existing saved note

```bash
curl --request POST \
  "{{baseUrl}}/api/wound-cases/transcribe-voice-dictation/42/note_1784178000000_ab12cd" \
  --header "Authorization: Bearer <nurse_jwt_token>"
```

### Success response: new note

Status: `201 Created`

```json
{
  "message": "Voice transcribed successfully",
  "transcript": "The wound bed shows healthy granulation tissue with no visible discharge.",
  "clinical_note": {
    "id": "note_1784178000000_ab12cd",
    "note_type": "voice",
    "title": "Morning wound assessment",
    "text": "The wound bed shows healthy granulation tissue with no visible discharge.",
    "soap": null,
    "audio_url": "http://localhost:3000/uploads/voice-dictations/1784178000000-123456789-voice-note.m4a",
    "audio_file_path": "/uploads/voice-dictations/1784178000000-123456789-voice-note.m4a",
    "audio_original_name": "voice-note.m4a",
    "audio_mime_type": "audio/mp4",
    "audio_size": 245760,
    "duration_seconds": 18,
    "is_ai_generated": false,
    "created_by": "Nurse Ayesha",
    "created_at": "2026-07-16T06:20:00.000Z"
  },
  "wound_case": {
    "id": 42,
    "patient_id": 15,
    "wound_type": "Diabetic foot ulcer",
    "clinical_notes": [
      {
        "id": "note_1784178000000_ab12cd",
        "note_type": "voice",
        "text": "The wound bed shows healthy granulation tissue with no visible discharge."
      }
    ],
    "notes_count": 1
  }
}
```

The actual `wound_case` object also contains the wound's status, location, measurements, images, updates, reports, progress, timestamps, and other wound-case fields.

### Success response: existing note updated

Status: `200 OK`

The response structure is the same as above. The existing note keeps its ID and metadata while its transcript is replaced with the newly generated text. If a new audio file is uploaded, its audio metadata replaces the existing audio metadata.

## Clinical note fields

| Field | Type | Description |
| --- | --- | --- |
| `id` | string | Generated note ID, or the existing ID when a note is updated. |
| `note_type` | string | Always `voice` for these endpoints. |
| `title` | string or null | Note title. |
| `text` | string or null | Saved or generated transcript. |
| `soap` | object/string or null | SOAP data; normally `null` for these endpoints. |
| `audio_url` | string or null | Public audio URL. |
| `audio_file_path` | string or null | Local public path under `/uploads/`. |
| `audio_original_name` | string or null | Original uploaded filename. |
| `audio_mime_type` | string or null | Uploaded file's MIME type. |
| `audio_size` | number or null | File size in bytes. |
| `duration_seconds` | number or null | Audio duration in seconds. |
| `is_ai_generated` | boolean | Currently `false`; transcription does not set this flag to `true`. |
| `created_by` | string or null | Supplied creator value. |
| `created_at` | string | ISO 8601 timestamp. |

## Error responses

### Invalid or expired token

Status: `401 Unauthorized`

```json
{
  "message": "Invalid or expired token"
}
```

### Authenticated user is not a nurse

Status: `403 Forbidden`

```json
{
  "message": "Forbidden"
}
```

### Wound case does not exist or is not assigned to the nurse

Status: `404 Not Found`

```json
{
  "message": "Wound case not found"
}
```

### Save request contains neither transcript nor audio

Status: `400 Bad Request`

```json
{
  "message": "transcript or audio file is required"
}
```

### Existing note does not exist

Status: `404 Not Found`

```json
{
  "message": "Voice note not found"
}
```

### No local audio is available for transcription

Status: `400 Bad Request`

```json
{
  "message": "A saved local audio file or uploaded audio file is required"
}
```

### Uploaded file is not audio

Status: `400 Bad Request`

```json
{
  "message": "Only audio files are allowed"
}
```

An oversized file also returns `400 Bad Request` with the upload middleware's error message.

### Transcription service returns no text

Status: `422 Unprocessable Entity`

```json
{
  "message": "Audio transcription returned no text"
}
```

### Save operation fails

Status: `500 Internal Server Error`

```json
{
  "message": "Voice dictation save failed",
  "error": "Error details"
}
```

### Transcription operation fails

Status: `500 Internal Server Error`

```json
{
  "message": "Voice transcription failed",
  "error": "Error details"
}
```

## Transcription service configuration

The server requires these environment variables for transcription:

```env
WHISPER_SERVICE_URL=https://api.openai.com/v1/audio/transcriptions
WHISPER_SERVICE_API_KEY=your_service_api_key
WHISPER_MODEL=whisper-1
```

- `WHISPER_SERVICE_URL` is required.
- `WHISPER_SERVICE_API_KEY` is optional at code level and is sent as a Bearer token when configured.
- `WHISPER_MODEL` is optional and defaults to `whisper-1`.
- The configured service must accept a multipart `file` and `model`, and return text in `text`, `transcript`, `transcription`, `data.text`, or `result.text` (or return plain text).

Keep API keys only in environment configuration and never include them in API requests from clients or commit them to documentation/source control.

## Source files

- Controller: `controllers/woundCaseController.js`
- Routes: `routes/woundCaseRoutes.js`
- Upload middleware: `middleware/voiceDictationUpload.js`
- Authentication middleware: `middleware/authMiddleware.js`
- Wound case model: `models/woundCaseModel.js`
