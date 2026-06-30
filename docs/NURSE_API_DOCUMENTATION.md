# Nurse App API Documentation

This document covers the nurse-side APIs for the AI-Enabled Wound app.

## Base URL

Local development:

```txt
http://localhost:3000
```

All request and response bodies are JSON.

```http
Content-Type: application/json
Accept: application/json
```

## Important Notes

- Authentication token is returned from `POST /api/auth/signin`.
- Current protected-route middleware is not enabled yet, so frontend can integrate APIs directly for now.
- Nurse-specific screens should pass `nurse_id` or `user_id` where documented.
- Dates use `YYYY-MM-DD`.
- Common error format:

```json
{
  "message": "Error message",
  "error": "Optional error detail"
}
```

## Recommended Nurse Flow

```txt
1. Sign in
2. Load dashboard with nurse_id
3. Load assigned patients / tasks
4. Open patient
5. Create or open wound case
6. Add updates, images, measurements, notes, reports
7. Manage notifications
8. Use profile/settings/handoff as needed
```

---

# Auth APIs

Base route:

```txt
/api/auth
```

## Sign In

```http
POST /api/auth/signin
```

Request:

```json
{
  "email": "nurse@example.com",
  "password": "Password123!"
}
```

Response:

```json
{
  "message": "Login successful",
  "token": "jwt_token",
  "user": {
    "id": 3,
    "name": "Jane Cooper",
    "first_name": "Jane",
    "last_name": "Cooper",
    "email": "nurse@example.com",
    "role": "nurse"
  }
}
```

## Create Account

```http
POST /api/auth/create-account
```

Request:

```json
{
  "first_name": "Jane",
  "last_name": "Cooper",
  "email": "jane@example.com",
  "phone_number": "+15551234567",
  "role": "nurse",
  "password": "Password123!",
  "confirm_password": "Password123!",
  "terms_accepted": true
}
```

## Create Organization Account

```http
POST /api/auth/create-organization-account
```

Request:

```json
{
  "first_name": "Jane",
  "last_name": "Cooper",
  "email": "jane@example.com",
  "phone_number": "+15551234567",
  "organization_hospital": "Memorial Hospital",
  "organization_code": "MH-001",
  "role": "nurse",
  "password": "Password123!",
  "confirm_password": "Password123!",
  "terms_accepted": true
}
```

## Verify Code

```http
POST /api/auth/verify-code
```

Request:

```json
{
  "email": "jane@example.com",
  "code": "123456"
}
```

## Forgot Password

```http
POST /api/auth/forgot-password
```

Request:

```json
{
  "email": "jane@example.com"
}
```

## Reset Password

```http
POST /api/auth/reset-password
```

Request:

```json
{
  "code": "123456",
  "new_password": "NewPassword123!",
  "confirm_new_password": "NewPassword123!"
}
```

---

# Dashboard APIs

Base route:

```txt
/api/dashboard
```

Use `nurse_id` or `user_id` query param.

## Home Dashboard

```http
GET /api/dashboard/home?nurse_id=3&limit=10
```

Response includes:

```json
{
  "greeting": {
    "message": "Good Morning",
    "user_name": "Jane Cooper",
    "role": "nurse"
  },
  "stats": {
    "patients": 8,
    "wounds": 5,
    "high": 2,
    "tasks": 3,
    "notifications": 4
  },
  "todays_tasks": [],
  "assigned_patients": [],
  "recent_updates": []
}
```

## Dashboard Stats

```http
GET /api/dashboard/stats?nurse_id=3
```

## Today Tasks

```http
GET /api/dashboard/today-tasks?nurse_id=3&limit=10
```

Optional:

```txt
today=false
```

## Assigned Patients

```http
GET /api/dashboard/assigned-patients?nurse_id=3&limit=10
```

## Recent Updates

```http
GET /api/dashboard/recent-updates?nurse_id=3&limit=10
```

---

# Patient APIs

Base route:

```txt
/api/patients
```

## Create Patient

```http
POST /api/patients/create-patient
```

Request:

```json
{
  "nurse_id": 3,
  "first_name": "Michael",
  "last_name": "Roberts",
  "date_of_birth": "1968-04-10",
  "gender": "male",
  "mrn": "MRN-20241001",
  "address": "Patient address",
  "room": "Surgical Ward, Room 204, Bed 7",
  "wound_type": "Diabetic Foot Ulcer",
  "primary_staff": "Nurse Johnson",
  "backup_staff": "Dr. Harrison",
  "primary_diagnosis": "Post-Op Incision",
  "allergies_notes": "Penicillin, Sulfa drugs"
}
```

## List Patients

```http
GET /api/patients/get-patient
```

## Get Patient Detail

```http
GET /api/patients/get-patient/:id
```

## Update Patient

```http
PUT /api/patients/update-patient/:id
```

Request can contain any create fields.

## Delete Patient

```http
DELETE /api/patients/delete-patient/:id
```

---

# Task APIs

Base route:

```txt
/api/tasks
```

Task enums:

```txt
task_type: all | wound | documentation | follow_up | other
priority: low | medium | high
status: pending | completed | cancelled
```

## Create Task

```http
POST /api/tasks/create-task
```

Request:

```json
{
  "title": "Wound dressing change",
  "description": "Change wound dressing and document progress.",
  "task_type": "wound",
  "priority": "high",
  "status": "pending",
  "patient_id": 1,
  "wound_case": "Diabetic Foot Ulcer",
  "assigned_by": 4,
  "assigned_to": 3,
  "due_date": "2026-06-30",
  "due_time": "10:30",
  "task_notes": "Use sterile dressing."
}
```

## List Tasks

```http
GET /api/tasks/get-task
```

Filters:

```txt
status=pending
priority=high
task_type=wound
assigned_to=3
assigned_by=4
patient_id=1
search=dressing
```

Example:

```http
GET /api/tasks/get-task?assigned_to=3&status=pending
```

## Get Task Detail

```http
GET /api/tasks/get-task/:id
```

## Update Task

```http
PUT /api/tasks/update-task/:id
```

## Complete Task

```http
PATCH /api/tasks/complete-task/:id
```

Request:

```json
{
  "work_notes": "Dressing changed successfully."
}
```

## Reassign Task

```http
PATCH /api/tasks/reassign-task/:id
```

Request:

```json
{
  "assigned_to": 5
}
```

## Delete Task

```http
DELETE /api/tasks/delete-task/:id
```

---

# Wound Case APIs

Base route:

```txt
/api/wound-cases
```

Status values:

```txt
active | monitoring | healing | healed | closed
```

## Create Wound Case

```http
POST /api/wound-cases/create-wound-case
```

Request:

```json
{
  "patient_id": 1,
  "wound_type": "Diabetic Foot Ulcer",
  "severity_stage": "Stage III",
  "pain_score": 7,
  "body_location": "Left Heel",
  "wound_etiology": "Diabetes",
  "status": "active",
  "healing_progress": 42,
  "length_cm": 3.5,
  "width_cm": 2.2,
  "depth_cm": 0.5,
  "images": [
    {
      "url": "https://example.com/wound.jpg",
      "caption": "Initial wound image"
    }
  ],
  "notes": "Initial wound case."
}
```

## List Wound Cases

```http
GET /api/wound-cases/get-wound-case
```

Filters:

```txt
patient_id=1
status=active
wound_type=Diabetic
search=heel
```

## Get Wound Case Detail

```http
GET /api/wound-cases/get-wound-case/:id
```

## Update Wound Case

```http
PUT /api/wound-cases/update-wound-case/:id
```

## Add Wound Update

Use this for the "Save Wound Update" screen.

```http
PATCH /api/wound-cases/add-wound-update/:id
```

Request:

```json
{
  "title": "Stage updated to III",
  "summary": "Wound bed shows 70% granulation tissue.",
  "severity_stage": "Stage III",
  "healing_progress": 70,
  "instructions": "Increase dressing frequency to every 24h.",
  "frequency": "Every 24 hours",
  "next_review_at": "2026-07-01",
  "measurement": {
    "length_cm": 3.5,
    "width_cm": 2.2,
    "depth_cm": 0.5,
    "pain_score": 7
  },
  "clinical_note": "Patient reports mild discomfort.",
  "images": [
    {
      "url": "https://example.com/update.jpg",
      "caption": "Wound update image"
    }
  ],
  "created_by": "Nurse Johnson"
}
```

## Timeline Tab

```http
GET /api/wound-cases/get-timeline/:id
```

## Images Tab

```http
GET /api/wound-cases/get-images/:id
```

## Add Wound Image

```http
PATCH /api/wound-cases/add-wound-image/:id
```

Request:

```json
{
  "url": "https://example.com/wound-image.jpg",
  "caption": "After dressing change"
}
```

Multiple images:

```json
{
  "images": [
    { "url": "https://example.com/1.jpg", "caption": "Image 1" },
    { "url": "https://example.com/2.jpg", "caption": "Image 2" }
  ]
}
```

## Delete Wound Image

```http
DELETE /api/wound-cases/delete-wound-image/:id/:imageId
```

## Measurements Tab

```http
GET /api/wound-cases/get-measurements/:id
```

## Add Measurement

```http
PATCH /api/wound-cases/add-measurement/:id
```

Request:

```json
{
  "length_cm": 3.5,
  "width_cm": 2.2,
  "depth_cm": 0.5,
  "pain_score": 7,
  "notes": "Measured after dressing change."
}
```

## Notes Tab

```http
GET /api/wound-cases/get-notes/:id
```

## Add Clinical Note

```http
PATCH /api/wound-cases/add-note/:id
```

Request:

```json
{
  "note_type": "manual",
  "title": "Clinical Note",
  "text": "Wound bed appears improved.",
  "created_by": "Nurse Johnson"
}
```

## Save Voice Dictation

```http
POST /api/wound-cases/save-voice-dictation/:id
```

Request:

```json
{
  "transcript": "Wound bed appears to have seventy percent granulation tissue.",
  "audio_url": "https://example.com/audio.mp3",
  "duration_seconds": 24,
  "created_by": "Nurse Johnson"
}
```

## Generate SOAP Note

```http
POST /api/wound-cases/generate-soap-note/:id
```

Request:

```json
{
  "text": "Patient reports pain 7/10 in left heel.",
  "created_by": "Nurse Johnson"
}
```

Response includes:

```json
{
  "clinical_note": {
    "note_type": "soap",
    "soap": {
      "subjective": "...",
      "objective": "...",
      "assessment": "...",
      "plan": "..."
    }
  }
}
```

## Reports Tab

```http
GET /api/wound-cases/get-reports/:id
```

## Generate Report

```http
POST /api/wound-cases/generate-report/:id
```

Request:

```json
{
  "title": "Complete Wound Report",
  "report_type": "full",
  "pages": 3,
  "file_size": "2.4 MB",
  "generated_by": "Nurse Johnson"
}
```

## Add Report

```http
PATCH /api/wound-cases/add-report/:id
```

Request:

```json
{
  "title": "Weekly Assessment",
  "report_type": "weekly",
  "url": "https://example.com/report.pdf",
  "pages": 1,
  "file_size": "1.1 MB",
  "summary": "Weekly wound assessment."
}
```

## Preview Report

```http
GET /api/wound-cases/preview-report/:id/:reportId
```

## Download Report

```http
GET /api/wound-cases/download-report/:id/:reportId
```

Note: Current API returns report data and optional `download_url`. Real PDF generation/storage can be added later.

## Share Report

```http
PATCH /api/wound-cases/share-report/:id/:reportId
```

Request:

```json
{
  "name": "Dr. Harrison",
  "email": "doctor@example.com",
  "role": "Doctor",
  "expires_at": "2026-07-07"
}
```

## Delete Wound Case

```http
DELETE /api/wound-cases/delete-wound-case/:id
```

---

# Profile & Settings APIs

Base route:

```txt
/api/profile
```

## Get Profile

```http
GET /api/profile/get-profile/:id
```

Response includes:

```json
{
  "profile": {},
  "counts": {
    "patients": 8,
    "wounds": 5,
    "reports": 12,
    "tasks": 3
  },
  "notification_preferences": {},
  "app_settings": {},
  "security_settings": {},
  "active_sessions": []
}
```

## Update Profile

```http
PUT /api/profile/update-profile/:id
```

Request:

```json
{
  "first_name": "Jane",
  "last_name": "Cooper",
  "phone_number": "+15551234567",
  "profile_photo_url": "https://example.com/profile.jpg",
  "organization_hospital": "Memorial Hospital",
  "shift": "Day Shift",
  "professional_title": "RN"
}
```

## Security Settings

```http
GET /api/profile/security-settings/:id
```

## Change Password

```http
PATCH /api/profile/change-password/:id
```

Request:

```json
{
  "current_password": "Password123!",
  "new_password": "NewPassword123!",
  "confirm_password": "NewPassword123!"
}
```

## Sign Out All Devices

```http
PATCH /api/profile/sign-out-all-devices/:id
```

## Notification Preferences

```http
GET /api/profile/notification-preferences/:id
PATCH /api/profile/notification-preferences/:id
```

Update request:

```json
{
  "task_alerts": true,
  "task_reassigned": true,
  "task_cancelled": true,
  "task_completed": false,
  "wound_updates_added": true,
  "doctor_added_instructions": true,
  "security_alerts": true
}
```

## App Settings

```http
GET /api/profile/app-settings/:id
PATCH /api/profile/app-settings/:id
```

Update request:

```json
{
  "auto_sync_when_online": true,
  "save_images_offline": true,
  "text_size": "medium",
  "language": "english"
}
```

## Simple Patient Handoff

This is a shortcut endpoint. Prefer the full handoff flow under `/api/handoffs`.

```http
POST /api/profile/patient-handoff/:id
```

Request:

```json
{
  "to_nurse_id": 5,
  "patient_ids": [1, 2, 3]
}
```

## Sign Out

```http
POST /api/profile/sign-out/:id
```

## Delete Account

```http
DELETE /api/profile/delete-account/:id
```

Request:

```json
{
  "password": "Password123!",
  "confirm_delete": true,
  "reason": "Leaving organization"
}
```

---

# Patient Handoff APIs

Base route:

```txt
/api/handoffs
```

## Step 1: Get Patients For Handoff

```http
GET /api/handoffs/patients/:nurseId
```

Response includes each patient with `selected`, `task_count`, wound type, room, etc.

## Step 1: Create Handoff Draft

```http
POST /api/handoffs/create
```

Request:

```json
{
  "from_nurse_id": 3,
  "patient_ids": [1, 2, 3],
  "shift_label": "Evening",
  "shift_ends_at": "2026-06-30T19:00:00.000Z"
}
```

## Step 2: Get Available Nurses

```http
GET /api/handoffs/available-nurses/:nurseId
```

## Step 2: Select Receiving Nurse

```http
PATCH /api/handoffs/select-nurse/:id
```

Request:

```json
{
  "to_nurse_id": 5
}
```

## Step 3: Add Handoff Notes

```http
PATCH /api/handoffs/notes/:id
```

Request:

```json
{
  "general_notes": "Monitor high-risk patients closely.",
  "per_patient_notes": {
    "1": "Stage III wound, monitor drainage.",
    "2": "Pain score increased today."
  }
}
```

## Confirm Handoff

```http
PATCH /api/handoffs/confirm/:id
```

This transfers selected patients and pending tasks to the receiving nurse.

## Handoff Detail

```http
GET /api/handoffs/get/:id
```

## Handoff Success Screen

```http
GET /api/handoffs/success/:id
```

---

# Notification APIs

Base route:

```txt
/api/notifications
```

Notification types:

```txt
wound_update
doctor_instruction
new_task
patient_assigned
task_completed
task_reassigned
login_alert
report_generated
system
```

## Get Notifications

```http
GET /api/notifications/get-notifications/:userId
```

Tabs:

```http
GET /api/notifications/get-notifications/:userId?tab=all
GET /api/notifications/get-notifications/:userId?tab=unread
GET /api/notifications/get-notifications/:userId?tab=read
```

Optional:

```txt
type=wound_update
limit=30
```

Response:

```json
{
  "tab": "all",
  "counts": {
    "all": 12,
    "unread": 4,
    "read": 8
  },
  "notifications": []
}
```

## Create Notification

Usually backend/system should call this.

```http
POST /api/notifications/create-notification
```

Request:

```json
{
  "user_id": 3,
  "type": "wound_update",
  "title": "Wound Update - Michael Roberts",
  "message": "Nurse Johnson added a new wound update.",
  "action_label": "View Task",
  "action_url": "/wound-cases/1",
  "metadata": {
    "patient_id": 1,
    "wound_case_id": 1
  }
}
```

## Mark One Notification Read

```http
PATCH /api/notifications/mark-read/:id
```

## Mark All Read

```http
PATCH /api/notifications/mark-all-read/:userId
```

## Clear One Notification

```http
DELETE /api/notifications/clear/:id
```

## Clear All Notifications

```http
DELETE /api/notifications/clear-all/:userId
```

---

# Frontend Integration Checklist

## Home Screen

```txt
GET /api/dashboard/home?nurse_id={nurseId}
```

Use:

```txt
greeting
stats
todays_tasks
assigned_patients
recent_updates
```

## Patient List Screen

```txt
GET /api/dashboard/assigned-patients?nurse_id={nurseId}
```

## Task List Screen

```txt
GET /api/tasks/get-task?assigned_to={nurseId}
```

or

```txt
GET /api/dashboard/today-tasks?nurse_id={nurseId}
```

## Wound Case Detail Screen

```txt
GET /api/wound-cases/get-wound-case/{woundCaseId}
GET /api/wound-cases/get-timeline/{woundCaseId}
GET /api/wound-cases/get-images/{woundCaseId}
GET /api/wound-cases/get-measurements/{woundCaseId}
GET /api/wound-cases/get-notes/{woundCaseId}
GET /api/wound-cases/get-reports/{woundCaseId}
```

## Add Wound Update Screen

```txt
PATCH /api/wound-cases/add-wound-update/{woundCaseId}
```

## Voice Dictation Screen

```txt
POST /api/wound-cases/save-voice-dictation/{woundCaseId}
POST /api/wound-cases/generate-soap-note/{woundCaseId}
```

## Handoff Flow

```txt
GET   /api/handoffs/patients/{nurseId}
POST  /api/handoffs/create
GET   /api/handoffs/available-nurses/{nurseId}
PATCH /api/handoffs/select-nurse/{handoffId}
PATCH /api/handoffs/notes/{handoffId}
PATCH /api/handoffs/confirm/{handoffId}
GET   /api/handoffs/success/{handoffId}
```

## Notifications

```txt
GET    /api/notifications/get-notifications/{nurseId}?tab=all
PATCH  /api/notifications/mark-read/{notificationId}
PATCH  /api/notifications/mark-all-read/{nurseId}
DELETE /api/notifications/clear/{notificationId}
DELETE /api/notifications/clear-all/{nurseId}
```

---

# QA Status

Nurse-side live API smoke test passed:

```txt
Total: 74
Passed: 74
Failed: 0
```

Test script:

```txt
node scripts/apiSmokeTest.js
```

---

# Known Limitations

- Auth middleware is not enabled on protected APIs yet.
- PDF generation currently returns preview/report data and optional download URL. It does not generate a binary PDF file.
- Automatic notification creation for every business event is not fully wired. Notifications can be created with `POST /api/notifications/create-notification`.
