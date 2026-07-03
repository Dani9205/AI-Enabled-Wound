# AI-Enabled Wound APIs - Full API Reference

Last updated: 2026-07-01

Base URL:

```txt
https://aiwond.appistansoft.com
```

Headers:

```http
Content-Type: application/json
Accept: application/json
```

Common error response:

```json
{
  "message": "Error message",
  "error": "Optional technical detail"
}
```

Current note: most routes are not protected by auth middleware yet. `POST /api/auth/signin` and `POST /api/admin/login` return tokens, but route-level role protection still needs to be enabled.

## Status

| Side | Status |
| --- | --- |
| Nurse side | Complete |
| Doctor side | Auth APIs complete; clinical APIs pending |
| Patient side | Foundation ready, dedicated APIs pending |

## Enums

User roles:

```txt
doctor | nurse | patient | user | admin | super_admin
```

User account status:

```txt
active | signed_out | deactivated | deleted
```

Task fields:

```txt
task_type: all | wound | documentation | follow_up | other
priority: low | medium | high
status: pending | completed | cancelled
```

Wound case status:

```txt
active | monitoring | healing | healed | closed
```

Notification types:

```txt
wound_update | doctor_instruction | new_task | patient_assigned | task_completed | task_reassigned | login_alert | report_generated | system
```

Subscription fields:

```txt
plan_code: free | basic | professional | organization
billing_provider: manual | apple_pay | google_pay | app_store
interval: forever | month
status: active | trialing | cancelled | expired
```

---

# Auth APIs

Base route:

```txt
/api/auth
```

## Create Account

```http
POST /api/auth/create-account
```

Input:

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

Response `201`:

```json
{
  "message": "Account created successfully. Verification code sent to email",
  "email": "jane@example.com",
  "next_step": "verify-code",
  "user": {
    "id": 1,
    "name": "Jane Cooper",
    "first_name": "Jane",
    "last_name": "Cooper",
    "email": "jane@example.com",
    "phone_number": "+15551234567",
    "role": "nurse",
    "is_email_verified": false
  }
}
```

## Create Organization Account

```http
POST /api/auth/create-organization-account
```

Input:

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

Response `201`:

```json
{
  "message": "Account request submitted successfully. Verification code sent to email",
  "email": "jane@example.com",
  "next_step": "verify-code",
  "user": {
    "id": 1,
    "name": "Jane Cooper",
    "first_name": "Jane",
    "last_name": "Cooper",
    "email": "jane@example.com",
    "phone_number": "+15551234567",
    "role": "nurse",
    "is_email_verified": false,
    "organization_hospital": "Memorial Hospital",
    "organization_code": "MH-001",
    "request_accepted": false,
    "request_status": "pending"
  }
}
```

## Accept Organization Request

```http
PUT /api/auth/accept-organization-request
```

Input:

```json
{
  "email": "jane@example.com"
}
```

Response `200`:

```json
{
  "message": "Organization request accepted successfully",
  "user": {
    "id": 1,
    "name": "Jane Cooper",
    "email": "jane@example.com",
    "role": "nurse",
    "request_accepted": true,
    "request_status": "accepted",
    "reviewed_at": "2026-07-01T09:00:00.000Z"
  }
}
```

## Sign In

```http
POST /api/auth/signin
```

Input:

```json
{
  "email": "jane@example.com",
  "password": "Password123!"
}
```

Response `200`:

```json
{
  "message": "Login successful",
  "token": "jwt_token",
  "user": {
    "id": 1,
    "name": "Jane Cooper",
    "first_name": "Jane",
    "last_name": "Cooper",
    "email": "jane@example.com",
    "phone_number": "+15551234567",
    "role": "nurse",
    "is_email_verified": true
  }
}
```

## Verify Code

```http
POST /api/auth/verify-code
```

Input:

```json
{
  "email": "jane@example.com",
  "code": "123456"
}
```

Response `200`:

```json
{
  "message": "Account verified successfully",
  "token": "jwt_token",
  "user": {
    "id": 1,
    "email": "jane@example.com",
    "role": "nurse",
    "is_email_verified": true
  }
}
```

## Forgot Password

```http
POST /api/auth/forgot-password
```

Input:

```json
{
  "email": "jane@example.com"
}
```

Response `200`:

```json
{
  "message": "Password reset code sent to email",
  "email": "jane@example.com",
  "next_step": "reset-password"
}
```

## Reset Password

```http
POST /api/auth/reset-password
```

Input:

```json
{
  "code": "123456",
  "new_password": "NewPassword123!",
  "confirm_new_password": "NewPassword123!"
}
```

Response `200`:

```json
{
  "message": "Password updated successfully"
}
```

## Change Role

```http
PUT /api/auth/change-role
```

Input:

```json
{
  "email": "jane@example.com",
  "role": "doctor"
}
```

Response `200`:

```json
{
  "message": "Role updated successfully",
  "user": {
    "id": 1,
    "email": "jane@example.com",
    "role": "doctor"
  }
}
```

---

# Doctor Auth APIs

Base route:

```txt
/api/doctor/auth
```

These APIs use the same `users` table as the nurse side. Doctor account request details are saved on the same user row, with extra doctor fields stored in `app_settings.doctor_profile`.

## Account Request Options

```http
GET /api/doctor/auth/account-request/options
```

Response `200`:

```json
{
  "message": "Doctor account request options fetched successfully",
  "roles": [
    { "value": "nurse", "label": "Nurse" },
    { "value": "doctor", "label": "Doctor" },
    { "value": "patient", "label": "Patient" }
  ],
  "account_types": [
    {
      "value": "individual",
      "label": "Individual Account",
      "requires_code": false
    },
    {
      "value": "organization",
      "label": "Organization Account",
      "requires_code": true
    }
  ],
  "genders": ["male", "female", "other"],
  "title_designations": ["md", "mbbs", "resident"],
  "specializations": [
    "surgical care",
    "wound management",
    "internal medicine",
    "dermatology",
    "orthopedics"
  ]
}
```

## Submit Account Request

```http
POST /api/doctor/auth/account-request
```

Input:

```json
{
  "account_type": "organization",
  "first_name": "Dr.",
  "last_name": "Harrison",
  "email": "dr.harrison@centralmed.org",
  "phone_number": "+15552345678",
  "gender": "male",
  "date_of_birth": "1982-01-15",
  "profile_photo_url": "https://example.com/doctor.jpg",
  "hospital_institution": "Central Medical Hospital",
  "organization_code": "ORG-XXXX-2024",
  "doctor_license_number": "DR-2024-0118",
  "specializations": ["surgical care", "wound management"],
  "title_designation": "md",
  "password": "Password123!",
  "confirm_password": "Password123!",
  "terms_accepted": true
}
```

Response `201`:

```json
{
  "message": "Doctor account request submitted successfully",
  "next_step": "pending-approval",
  "doctor": {
    "id": 10,
    "name": "Dr. Harrison",
    "email": "dr.harrison@centralmed.org",
    "role": "doctor",
    "request_status": "pending",
    "doctor_profile": {
      "account_type": "organization",
      "doctor_license_number": "DR-2024-0118",
      "title_designation": "md",
      "specializations": ["surgical care", "wound management"]
    }
  },
  "request_summary": {
    "name": "Dr. Harrison",
    "email": "dr.harrison@centralmed.org",
    "role_requested": "doctor",
    "hospital_institution": "Central Medical Hospital",
    "status": "pending"
  }
}
```

## Account Request Status

```http
GET /api/doctor/auth/account-request/status?email=dr.harrison@centralmed.org
```

Response `200`:

```json
{
  "message": "Doctor account request status fetched successfully",
  "request_summary": {
    "name": "Dr. Harrison",
    "email": "dr.harrison@centralmed.org",
    "role_requested": "doctor",
    "hospital_institution": "Central Medical Hospital",
    "status": "pending"
  }
}
```

## Sign In

```http
POST /api/doctor/auth/signin
```

Input:

```json
{
  "email": "dr.harrison@centralmed.org",
  "password": "Password123!"
}
```

Response `200`:

```json
{
  "message": "Doctor login successful",
  "token": "jwt_token",
  "doctor": {
    "id": 10,
    "email": "dr.harrison@centralmed.org",
    "role": "doctor",
    "is_email_verified": true
  }
}
```

## Forgot Password

```http
POST /api/doctor/auth/forgot-password
```

Input supports email or phone:

```json
{
  "email": "dr.harrison@centralmed.org"
}
```

Response `200`:

```json
{
  "message": "Password reset code sent to email",
  "email": "dr.harrison@centralmed.org",
  "next_step": "verify-otp"
}
```

## Verify OTP

```http
POST /api/doctor/auth/verify-otp
```

Input:

```json
{
  "email": "dr.harrison@centralmed.org",
  "code": "123456"
}
```

Response `200`:

```json
{
  "message": "OTP verified successfully",
  "next_step": "reset-password"
}
```

## Reset Password

```http
POST /api/doctor/auth/reset-password
```

Input:

```json
{
  "new_password": "NewPassword123!",
  "confirm_new_password": "NewPassword123!"
}
```

Response `200`:

```json
{
  "message": "Doctor password updated successfully"
}
```

---

# Doctor Management APIs

Base route:

```txt
/api/doctor
```

These APIs power the doctor home, patient list, patient details, wound case timeline, and add instructions screens.

## Home

```http
GET /api/doctor/home?doctor_id=10
```

Response includes dashboard stats, my tasks, and assigned patient cards.

## Patients

```http
GET /api/doctor/patients?search=diabetic
```

Response includes patient cards with room, wound type, assigned nurse, and active wound count.

## Patient Details

```http
GET /api/doctor/patients/1
```

Response includes personal information, assigned staff, and active wound cases.

## Wound Case Details

```http
GET /api/doctor/wound-cases/1?doctor_id=10
```

Response includes wound case summary, patient summary, assigned staff, timeline, images, measures, notes, reports, and doctor instructions.

## Add Instructions

```http
POST /api/doctor/wound-cases/1/instructions
```

Input:

```json
{
  "doctor_id": 10,
  "instructions": "Increase dressing frequency to every 24h. Monitor for infection signs.",
  "frequency": "Every 24 hours",
  "priority": "high",
  "dressing_type": "Change dressing",
  "next_review_at": "2026-12-17",
  "tags": ["change dressing", "monitor for infection"]
}
```

Response `201`:

```json
{
  "message": "Doctor instructions saved successfully",
  "instruction": {
    "id": "instruction_...",
    "text": "Increase dressing frequency to every 24h. Monitor for infection signs.",
    "frequency": "Every 24 hours",
    "priority": "high",
    "dressing_type": "Change dressing",
    "next_review_at": "2026-12-17",
    "tags": ["change dressing", "monitor for infection"]
  }
}
```

## Update Instructions

```http
PUT /api/doctor/wound-cases/1/instructions/instruction_123
```

## Delete Instructions

```http
DELETE /api/doctor/wound-cases/1/instructions/instruction_123
```

## Mark Task Complete

```http
PATCH /api/doctor/tasks/1/complete
```

Input:

```json
{
  "work_notes": "Reviewed wound and added instructions."
}
```

---

# Doctor Wound Details APIs

Base route:

```txt
/api/doctor/wound-details
```

These APIs power the wound detail tabs: Images, Measures, Notes, and Reports.

## Images

```http
GET /api/doctor/wound-details/1/images
```

Returns grid images, supported view modes, and before/after pairs.

## Measurements

```http
GET /api/doctor/wound-details/1/measurements
```

Returns current length/width/depth/pain score, changes from previous measurement, healing trend, and measurement history.

## Notes

```http
GET /api/doctor/wound-details/1/notes?type=soap
```

Returns clinical notes. Supported filters are `all`, `voice`, `manual`, `soap`, and `ai`.

## Reports

```http
GET /api/doctor/wound-details/1/reports
```

Returns previous reports and shared-with users.

## Generate Report

```http
POST /api/doctor/wound-details/1/reports/generate
```

Input:

```json
{
  "title": "Complete Wound Report",
  "report_type": "full",
  "generated_by": "Dr. Harrison"
}
```

## Report Details

```http
GET /api/doctor/wound-details/1/reports/report_123
```

Returns report details and preview data.

## Share Report

```http
POST /api/doctor/wound-details/1/reports/report_123/share
```

Input:

```json
{
  "user_id": 5,
  "permission": "can_view"
}
```

You can also share by email:

```json
{
  "name": "Nurse Johnson",
  "email": "nurse.johnson@example.com",
  "role": "nurse",
  "permission": "can_view"
}
```

---

# Doctor Task Management APIs

Base route:

```txt
/api/doctor/tasks
```

These APIs power the doctor task dashboard, create task, task details, reassignment, complete, and delete confirmation screens.

## Task Dashboard

```http
GET /api/doctor/tasks/dashboard?doctor_id=10
```

Returns task stats, tabs, pending tasks, and completed tasks.

## Task List

```http
GET /api/doctor/tasks?doctor_id=10&tab=all_tasks&status=pending
```

Supported `tab` values:

```txt
all_tasks | assigned_to_me | created_by_me
```

## Create Task Options

```http
GET /api/doctor/tasks/options
```

Returns task types, priorities, patients, wound cases, nurses, and doctors for dropdowns.

## Create Task

```http
POST /api/doctor/tasks
```

Input:

```json
{
  "doctor_id": 10,
  "title": "Wound dressing change",
  "task_type": "wound",
  "priority": "high",
  "patient_id": 1,
  "wound_case": "Diabetic Foot Ulcer - Left Heel",
  "assigned_to": 5,
  "due_date": "2026-12-15",
  "due_time": "09:00:00",
  "task_notes": "Add special instructions or notes."
}
```

## Task Details

```http
GET /api/doctor/tasks/1
```

Returns task info, patient, wound case, assignee, creator, notes, status, and available actions.

## Edit Task

```http
PUT /api/doctor/tasks/1
```

## Mark Complete

```http
PATCH /api/doctor/tasks/1/complete
```

Input:

```json
{
  "work_notes": "Wound dressing completed. Mild irrigation applied."
}
```

## Reassign Options

```http
GET /api/doctor/tasks/1/reassign-options
```

Returns nurses and doctors, with the current assignee marked as selected.

## Reassign Task

```http
PATCH /api/doctor/tasks/1/reassign
```

Input:

```json
{
  "assigned_to": 6
}
```

## Delete Task

```http
DELETE /api/doctor/tasks/1
```

---

# Doctor Profile & Settings APIs

Base route:

```txt
/api/doctor/profile-settings
```

These APIs power the doctor profile, edit profile, security, notifications, app settings, delete account, and sign-out screens.

## My Profile

```http
GET /api/doctor/profile-settings/10/profile
```

## Edit Profile

```http
PUT /api/doctor/profile-settings/10/profile
```

Input:

```json
{
  "first_name": "Dr.",
  "last_name": "Harrison",
  "phone_number": "+15552345678",
  "organization_hospital": "Central Medical Hospital",
  "doctor_license_number": "DR-2024-0118",
  "specializations": ["surgical care", "wound management"],
  "title_designation": "md"
}
```

## Security Settings

```http
GET /api/doctor/profile-settings/10/security
```

## Change Password

```http
PATCH /api/doctor/profile-settings/10/security/change-password
```

Input:

```json
{
  "current_password": "Password123!",
  "new_password": "NewPassword123!",
  "confirm_password": "NewPassword123!"
}
```

## Sign Out All Devices

```http
PATCH /api/doctor/profile-settings/10/security/sign-out-all-devices
```

## Notification Preferences

```http
GET /api/doctor/profile-settings/10/notifications
PATCH /api/doctor/profile-settings/10/notifications
```

Input:

```json
{
  "new_task_assigned": true,
  "task_reassigned": true,
  "task_cancelled": true,
  "task_completed": false,
  "wound_update_added": true,
  "security_alerts": true
}
```

## App Settings

```http
GET /api/doctor/profile-settings/10/app-settings
PATCH /api/doctor/profile-settings/10/app-settings
```

Input:

```json
{
  "auto_sync_when_online": true,
  "save_images_offline": true,
  "text_size": "medium",
  "language": "english"
}
```

## Patient Handoff

```http
GET /api/doctor/profile-settings/10/handoff
POST /api/doctor/profile-settings/10/handoff
```

Input:

```json
{
  "to_doctor_id": 12,
  "patient_ids": [1, 2, 3],
  "notes": "Transfer coverage for evening shift."
}
```

## Sign Out

```http
POST /api/doctor/profile-settings/10/sign-out
```

## Delete Account

```http
DELETE /api/doctor/profile-settings/10/delete-account
```

Input:

```json
{
  "reason": "Leaving the organization / hospital",
  "password": "Password123!",
  "confirm_delete": true
}
```

---

# Doctor Patient Handoff APIs

Base route:

```txt
/api/doctor/patient-handoff
```

These APIs power the 3-step patient handoff flow and success screen.

## Step 1 - Select Patients

```http
GET /api/doctor/patient-handoff/10/patients?selected_ids=1,2,3
```

Returns selectable patient cards with pending task counts.

## Step 2 - Select Receiving Staff

```http
GET /api/doctor/patient-handoff/10/available-staff?role=nurse
```

Supported `role` values:

```txt
nurse | doctor | all
```

## Create Handoff Draft

```http
POST /api/doctor/patient-handoff/draft
```

Input:

```json
{
  "doctor_id": 10,
  "patient_ids": [1, 2, 3],
  "shift_label": "Today, Morning"
}
```

## Select Receiving Staff

```http
PATCH /api/doctor/patient-handoff/1/select-staff
```

Input:

```json
{
  "to_staff_id": 5
}
```

## Step 3 - Add Notes

```http
PATCH /api/doctor/patient-handoff/1/notes
```

Input:

```json
{
  "general_notes": "Add shift summary and urgent observations.",
  "per_patient_notes": {
    "1": "Stage III wound - monitor closely."
  }
}
```

## Handoff Review

```http
GET /api/doctor/patient-handoff/1
```

## Confirm Handoff

```http
PATCH /api/doctor/patient-handoff/1/confirm
```

Input:

```json
{
  "shift_start": "Evening"
}
```

## Handoff Success

```http
GET /api/doctor/patient-handoff/1/success
```

---

# Doctor Notifications APIs

Base route:

```txt
/api/doctor/notifications
```

These APIs power notification tabs: All, Unread, and Read.

## Notifications

```http
GET /api/doctor/notifications/10?tab=all
GET /api/doctor/notifications/10?tab=unread
GET /api/doctor/notifications/10?tab=read
```

Supported `tab` values:

```txt
all | unread | read
```

Response includes counts and date sections:

```json
{
  "tab": "unread",
  "tabs": ["all", "unread", "read"],
  "counts": {
    "all": 12,
    "unread": 4,
    "read": 8
  },
  "sections": [
    {
      "title": "Today",
      "notifications": []
    }
  ]
}
```

## Create Notification

```http
POST /api/doctor/notifications/10
```

Input:

```json
{
  "type": "new_task",
  "title": "New Task Assigned to You",
  "message": "Dr. Harrison assigned you a wound dressing change.",
  "metadata": {
    "task_id": 1,
    "patient_id": 2
  }
}
```

## Mark One Read

```http
PATCH /api/doctor/notifications/10/1/read
```

## Mark All Read

```http
PATCH /api/doctor/notifications/10/mark-all-read
```

## Clear One

```http
DELETE /api/doctor/notifications/10/1
```

## Clear All

```http
DELETE /api/doctor/notifications/10/clear-all
```

---

# Admin APIs

Base route:

```txt
/api/admin
```

## Admin Login

```http
POST /api/admin/login
```

Input:

```json
{
  "email": "admin@example.com",
  "password": "Password123!"
}
```

Response `200`:

```json
{
  "message": "Admin login successful",
  "token": "jwt_token",
  "admin": {
    "id": 1,
    "name": "Admin User",
    "first_name": "Admin",
    "last_name": "User",
    "email": "admin@example.com",
    "role": "admin",
    "account_status": "active",
    "last_login_at": "2026-07-01T09:00:00.000Z"
  }
}
```

---

# Dashboard APIs

Base route:

```txt
/api/dashboard
```

Supported query params:

```txt
nurse_id
nurseId
user_id
userId
limit
today=false
```

## Home Dashboard

```http
GET /api/dashboard/home?nurse_id=3&limit=10
```

Input:

```txt
Query: nurse_id required for nurse-specific data, limit optional
```

Response `200`:

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

Response `200`:

```json
{
  "stats": {
    "patients": 8,
    "wounds": 5,
    "high": 2,
    "tasks": 3,
    "notifications": 4
  }
}
```

## Today Tasks

```http
GET /api/dashboard/today-tasks?nurse_id=3&limit=10
```

Input:

```txt
Query:
nurse_id optional
limit optional
today=false optional, includes all pending tasks instead of today/null due date only
```

Response `200`:

```json
{
  "tasks": [
    {
      "id": 1,
      "title": "Wound dressing change",
      "description": "Change wound dressing.",
      "task_type": "wound",
      "priority": "high",
      "status": "pending",
      "patient_id": 1,
      "patient_name": "Michael Roberts",
      "wound_case": "Diabetic Foot Ulcer",
      "assigned_to": 3,
      "assigned_to_name": "Jane Cooper",
      "due_date": "2026-07-01",
      "due_time": "10:30:00",
      "task_notes": "Use sterile dressing.",
      "created_at": "2026-07-01T09:00:00.000Z",
      "updated_at": "2026-07-01T09:00:00.000Z"
    }
  ]
}
```

## Assigned Patients

```http
GET /api/dashboard/assigned-patients?nurse_id=3&limit=10
```

Response `200`:

```json
{
  "patients": [
    {
      "id": 1,
      "initials": "MR",
      "first_name": "Michael",
      "last_name": "Roberts",
      "display_name": "Michael Roberts",
      "mrn": "MRN-001",
      "room": "Room 204",
      "wound_type": "Diabetic Foot Ulcer",
      "primary_diagnosis": "Post-Op Incision",
      "updated_minutes_ago": 20,
      "created_at": "2026-07-01T09:00:00.000Z",
      "updated_at": "2026-07-01T09:00:00.000Z"
    }
  ]
}
```

## Recent Updates

```http
GET /api/dashboard/recent-updates?nurse_id=3&limit=10
```

Response `200`:

```json
{
  "updates": [
    {
      "id": "update_1",
      "wound_case_id": 1,
      "patient_id": 1,
      "title": "Stage updated to III",
      "summary": "Wound is improving.",
      "wound_type": "Diabetic Foot Ulcer",
      "severity_stage": "Stage III",
      "created_by": "Nurse Johnson",
      "created_at": "2026-07-01T09:00:00.000Z",
      "minutes_ago": 12
    }
  ]
}
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

Input:

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

Response `201`:

```json
{
  "message": "Patient created successfully",
  "patient": {
    "id": 1,
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
    "allergies_notes": "Penicillin, Sulfa drugs",
    "created_at": "2026-07-01T09:00:00.000Z",
    "updated_at": "2026-07-01T09:00:00.000Z"
  }
}
```

## List Patients

```http
GET /api/patients/get-patient
```

Response `200`:

```json
{
  "patients": [
    {
      "id": 1,
      "nurse_id": 3,
      "first_name": "Michael",
      "last_name": "Roberts",
      "mrn": "MRN-20241001",
      "room": "Surgical Ward, Room 204, Bed 7",
      "wound_type": "Diabetic Foot Ulcer",
      "created_at": "2026-07-01T09:00:00.000Z",
      "updated_at": "2026-07-01T09:00:00.000Z"
    }
  ]
}
```

## Get Patient Detail

```http
GET /api/patients/get-patient/:id
```

Path params:

```txt
id: patient id
```

Response `200`:

```json
{
  "patient": {
    "id": 1,
    "nurse_id": 3,
    "first_name": "Michael",
    "last_name": "Roberts",
    "mrn": "MRN-20241001"
  }
}
```

## Update Patient

```http
PUT /api/patients/update-patient/:id
```

Input: any create-patient field.

```json
{
  "room": "Room 205",
  "backup_staff": "Dr. Harrison"
}
```

Response `200`:

```json
{
  "message": "Patient updated successfully",
  "patient": {
    "id": 1,
    "room": "Room 205",
    "backup_staff": "Dr. Harrison"
  }
}
```

## Delete Patient

```http
DELETE /api/patients/delete-patient/:id
```

Response `200`:

```json
{
  "message": "Patient deleted successfully"
}
```

---

# Task APIs

Base route:

```txt
/api/tasks
```

## Create Task

```http
POST /api/tasks/create-task
```

Input:

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
  "due_date": "2026-07-01",
  "due_time": "10:30",
  "task_notes": "Use sterile dressing."
}
```

Response `201`:

```json
{
  "message": "Task created successfully",
  "task": {
    "id": 1,
    "title": "Wound dressing change",
    "description": "Change wound dressing and document progress.",
    "task_type": "wound",
    "priority": "high",
    "status": "pending",
    "patient_id": 1,
    "wound_case": "Diabetic Foot Ulcer",
    "assigned_by": 4,
    "assigned_to": 3,
    "due_date": "2026-07-01",
    "due_time": "10:30:00",
    "task_notes": "Use sterile dressing.",
    "work_notes": null,
    "completed_at": null,
    "created_at": "2026-07-01T09:00:00.000Z",
    "updated_at": "2026-07-01T09:00:00.000Z"
  }
}
```

## List Tasks

```http
GET /api/tasks/get-task?assigned_to=3&status=pending
```

Query filters:

```txt
status
priority
task_type
assigned_to
assigned_by
patient_id
search
```

Response `200`:

```json
{
  "tasks": [
    {
      "id": 1,
      "title": "Wound dressing change",
      "priority": "high",
      "status": "pending",
      "assigned_to": 3
    }
  ]
}
```

## Get Task Detail

```http
GET /api/tasks/get-task/:id
```

Response `200`:

```json
{
  "task": {
    "id": 1,
    "title": "Wound dressing change",
    "status": "pending"
  }
}
```

## Update Task

```http
PUT /api/tasks/update-task/:id
```

Input: any create-task field.

```json
{
  "priority": "medium",
  "status": "pending",
  "task_notes": "Updated task notes."
}
```

Response `200`:

```json
{
  "message": "Task updated successfully",
  "task": {
    "id": 1,
    "priority": "medium",
    "task_notes": "Updated task notes."
  }
}
```

## Complete Task

```http
PATCH /api/tasks/complete-task/:id
```

Input:

```json
{
  "work_notes": "Dressing changed successfully."
}
```

Response `200`:

```json
{
  "message": "Task marked as completed",
  "task": {
    "id": 1,
    "status": "completed",
    "work_notes": "Dressing changed successfully.",
    "completed_at": "2026-07-01T09:00:00.000Z"
  }
}
```

## Reassign Task

```http
PATCH /api/tasks/reassign-task/:id
```

Input:

```json
{
  "assigned_to": 5
}
```

Response `200`:

```json
{
  "message": "Task reassigned successfully",
  "task": {
    "id": 1,
    "assigned_to": 5,
    "status": "pending",
    "completed_at": null
  }
}
```

## Delete Task

```http
DELETE /api/tasks/delete-task/:id
```

Response `200`:

```json
{
  "message": "Task deleted successfully"
}
```

---

# Wound Case APIs

Base route:

```txt
/api/wound-cases
```

## Create Wound Case

```http
POST /api/wound-cases/create-wound-case
```

Input:

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

Response `201`:

```json
{
  "message": "Wound case created successfully",
  "wound_case": {
    "id": 1,
    "patient_id": 1,
    "wound_type": "Diabetic Foot Ulcer",
    "severity_stage": "Stage III",
    "pain_score": 7,
    "body_location": "Left Heel",
    "wound_etiology": "Diabetes",
    "status": "active",
    "healing_progress": "42.00",
    "length_cm": "3.50",
    "width_cm": "2.20",
    "depth_cm": "0.50",
    "images": [],
    "measurements": [],
    "updates": [],
    "clinical_notes": [],
    "reports": [],
    "updates_count": 0,
    "images_count": 0,
    "notes_count": 0,
    "duration_days": 0,
    "notes": "Initial wound case.",
    "last_updated_at": "2026-07-01T09:00:00.000Z",
    "created_at": "2026-07-01T09:00:00.000Z",
    "updated_at": "2026-07-01T09:00:00.000Z"
  }
}
```

## List Wound Cases

```http
GET /api/wound-cases/get-wound-case?patient_id=1&status=active
```

Query filters:

```txt
patient_id
status
wound_type
search
```

Response `200`:

```json
{
  "wound_cases": [
    {
      "id": 1,
      "patient_id": 1,
      "wound_type": "Diabetic Foot Ulcer",
      "status": "active"
    }
  ]
}
```

## Get Wound Case Detail

```http
GET /api/wound-cases/get-wound-case/:id
```

Response `200`:

```json
{
  "wound_case": {
    "id": 1,
    "patient_id": 1,
    "wound_type": "Diabetic Foot Ulcer",
    "images": [],
    "measurements": [],
    "updates": [],
    "clinical_notes": [],
    "reports": []
  }
}
```

## Update Wound Case

```http
PUT /api/wound-cases/update-wound-case/:id
```

Input: any create-wound-case scalar field.

```json
{
  "status": "healing",
  "healing_progress": 65,
  "notes": "Wound is improving."
}
```

Response `200`:

```json
{
  "message": "Wound case updated successfully",
  "wound_case": {
    "id": 1,
    "status": "healing",
    "healing_progress": "65.00"
  }
}
```

## Add Wound Update

```http
PATCH /api/wound-cases/add-wound-update/:id
```

Input:

```json
{
  "title": "Stage updated to III",
  "summary": "Wound bed shows 70% granulation tissue.",
  "severity_stage": "Stage III",
  "healing_progress": 70,
  "priority": "high",
  "dressing_type": "Foam dressing",
  "instructions": "Increase dressing frequency to every 24h.",
  "frequency": "Every 24 hours",
  "next_review_at": "2026-07-02",
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

Response `200`:

```json
{
  "message": "Wound update saved successfully",
  "update": {
    "id": "update_...",
    "title": "Stage updated to III",
    "summary": "Wound bed shows 70% granulation tissue.",
    "severity_stage": "Stage III",
    "healing_progress": 70,
    "instructions": "Increase dressing frequency to every 24h.",
    "created_by": "Nurse Johnson",
    "created_at": "2026-07-01T09:00:00.000Z"
  },
  "wound_case": {
    "id": 1,
    "updates": [],
    "measurements": [],
    "clinical_notes": [],
    "images": []
  }
}
```

## Get Timeline

```http
GET /api/wound-cases/get-timeline/:id
```

Response `200`:

```json
{
  "timeline": [],
  "measurements": [],
  "images": [],
  "clinical_notes": []
}
```

## Get Images

```http
GET /api/wound-cases/get-images/:id
```

Response `200`:

```json
{
  "images": [
    {
      "id": "img_...",
      "url": "https://example.com/wound.jpg",
      "caption": "After dressing change",
      "uploaded_at": "2026-07-01T09:00:00.000Z"
    }
  ]
}
```

## Add Wound Image

```http
PATCH /api/wound-cases/add-wound-image/:id
```

Input:

```json
{
  "url": "https://example.com/wound-image.jpg",
  "caption": "After dressing change"
}
```

Alternative input:

```json
{
  "images": [
    {
      "url": "https://example.com/1.jpg",
      "caption": "Image 1"
    }
  ]
}
```

Response `200`:

```json
{
  "message": "Wound image added successfully",
  "wound_case": {
    "id": 1,
    "images": []
  }
}
```

## Delete Wound Image

```http
DELETE /api/wound-cases/delete-wound-image/:id/:imageId
```

Response `200`:

```json
{
  "message": "Wound image deleted successfully",
  "wound_case": {
    "id": 1,
    "images": []
  }
}
```

## Get Measurements

```http
GET /api/wound-cases/get-measurements/:id
```

Response `200`:

```json
{
  "current": {
    "length_cm": "3.50",
    "width_cm": "2.20",
    "depth_cm": "0.50",
    "pain_score": 7
  },
  "measurements": []
}
```

## Add Measurement

```http
PATCH /api/wound-cases/add-measurement/:id
```

Input:

```json
{
  "length_cm": 3.5,
  "width_cm": 2.2,
  "depth_cm": 0.5,
  "pain_score": 7,
  "notes": "Measured after dressing change."
}
```

Response `200`:

```json
{
  "message": "Measurement added successfully",
  "wound_case": {
    "id": 1,
    "measurements": []
  }
}
```

## Get Clinical Notes

```http
GET /api/wound-cases/get-notes/:id
```

Response `200`:

```json
{
  "clinical_notes": []
}
```

## Add Clinical Note

```http
PATCH /api/wound-cases/add-note/:id
```

Input:

```json
{
  "note_type": "manual",
  "title": "Clinical Note",
  "text": "Wound bed appears improved.",
  "created_by": "Nurse Johnson"
}
```

Response `200`:

```json
{
  "message": "Clinical note added successfully",
  "clinical_note": {
    "id": "note_...",
    "note_type": "manual",
    "title": "Clinical Note",
    "text": "Wound bed appears improved.",
    "created_by": "Nurse Johnson",
    "created_at": "2026-07-01T09:00:00.000Z"
  },
  "wound_case": {
    "id": 1
  }
}
```

## Save Voice Dictation

```http
POST /api/wound-cases/save-voice-dictation/:id
```

Input:

```json
{
  "transcript": "Wound bed appears to have seventy percent granulation tissue.",
  "audio_url": "https://example.com/audio.mp3",
  "duration_seconds": 24,
  "created_by": "Nurse Johnson"
}
```

Response `201`:

```json
{
  "message": "Voice dictation saved successfully",
  "clinical_note": {
    "id": "note_...",
    "note_type": "voice",
    "text": "Wound bed appears to have seventy percent granulation tissue.",
    "audio_url": "https://example.com/audio.mp3",
    "duration_seconds": 24
  }
}
```

## Generate SOAP Note

```http
POST /api/wound-cases/generate-soap-note/:id
```

Input:

```json
{
  "text": "Patient reports pain 7/10 in left heel.",
  "created_by": "Nurse Johnson"
}
```

Response `200`:

```json
{
  "message": "SOAP note generated successfully",
  "clinical_note": {
    "id": "note_...",
    "note_type": "soap",
    "title": "AI SOAP Note",
    "text": "Patient reports pain 7/10 in left heel.",
    "soap": {
      "subjective": "Pain score 7/10.",
      "objective": "Diabetic Foot Ulcer at Left Heel...",
      "assessment": "Patient reports pain 7/10 in left heel.",
      "plan": "Continue wound care, monitor pain, drainage, and signs of infection."
    },
    "is_ai_generated": true
  }
}
```

## Get Reports

```http
GET /api/wound-cases/get-reports/:id
```

Response `200`:

```json
{
  "reports": []
}
```

## Generate Report

```http
POST /api/wound-cases/generate-report/:id
```

Input:

```json
{
  "title": "Complete Wound Report",
  "report_type": "full",
  "pages": 3,
  "file_size": "2.4 MB",
  "url": "https://example.com/report.pdf",
  "generated_by": "Nurse Johnson"
}
```

Response `201`:

```json
{
  "message": "Report generated successfully",
  "report": {
    "id": "report_...",
    "title": "Complete Wound Report",
    "report_type": "full",
    "url": "https://example.com/report.pdf",
    "summary": "Diabetic Foot Ulcer report for Left Heel.",
    "pages": 3,
    "file_size": "2.4 MB",
    "status": "new",
    "shared_with": [],
    "report_data": {},
    "generated_by": "Nurse Johnson",
    "generated_at": "2026-07-01T09:00:00.000Z"
  }
}
```

## Add Report

```http
PATCH /api/wound-cases/add-report/:id
```

Input:

```json
{
  "title": "Weekly Assessment",
  "report_type": "weekly",
  "url": "https://example.com/report.pdf",
  "summary": "Weekly wound assessment.",
  "pages": 1,
  "file_size": "1.1 MB",
  "generated_by": "Nurse Johnson"
}
```

Response `200`:

```json
{
  "message": "Report added successfully",
  "report": {
    "id": "report_...",
    "title": "Weekly Assessment"
  },
  "wound_case": {
    "id": 1,
    "reports": []
  }
}
```

## Preview Report

```http
GET /api/wound-cases/preview-report/:id/:reportId
```

Response `200`:

```json
{
  "report": {
    "id": "report_...",
    "title": "Complete Wound Report"
  },
  "preview": {
    "patient_id": 1,
    "wound_type": "Diabetic Foot Ulcer",
    "measurements": [],
    "generated_at": "2026-07-01T09:00:00.000Z"
  }
}
```

## Download Report

```http
GET /api/wound-cases/download-report/:id/:reportId
```

Response `200`:

```json
{
  "message": "Report download URL ready",
  "download_url": "https://example.com/report.pdf",
  "report": {
    "id": "report_..."
  },
  "preview": {}
}
```

## Share Report

```http
PATCH /api/wound-cases/share-report/:id/:reportId
```

Input:

```json
{
  "name": "Dr. Harrison",
  "email": "doctor@example.com",
  "role": "Doctor",
  "expires_at": "2026-07-07"
}
```

Response `200`:

```json
{
  "message": "Report shared successfully",
  "report": {
    "id": "report_...",
    "shared_with": [
      {
        "id": "share_...",
        "name": "Dr. Harrison",
        "email": "doctor@example.com",
        "role": "Doctor",
        "expires_at": "2026-07-07",
        "shared_at": "2026-07-01T09:00:00.000Z"
      }
    ]
  }
}
```

## Delete Wound Case

```http
DELETE /api/wound-cases/delete-wound-case/:id
```

Response `200`:

```json
{
  "message": "Wound case deleted successfully"
}
```

---

# Profile And Settings APIs

Base route:

```txt
/api/profile
```

## Get Profile

```http
GET /api/profile/get-profile/:id
```

Response `200`:

```json
{
  "profile": {
    "id": 3,
    "name": "Jane Cooper",
    "first_name": "Jane",
    "last_name": "Cooper",
    "email": "jane@example.com",
    "phone_number": "+15551234567",
    "profile_photo_url": "https://example.com/profile.jpg",
    "role": "nurse",
    "professional_title": "RN",
    "organization_hospital": "Memorial Hospital",
    "organization_code": "MH-001",
    "shift": "Day Shift",
    "account_status": "active",
    "last_login_at": "2026-07-01T09:00:00.000Z",
    "created_at": "2026-07-01T09:00:00.000Z",
    "updated_at": "2026-07-01T09:00:00.000Z"
  },
  "counts": {
    "patients": 8,
    "wounds": 5,
    "reports": 3,
    "tasks": 2
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

Input:

```json
{
  "first_name": "Jane",
  "last_name": "Cooper",
  "phone_number": "+15551234567",
  "profile_photo_url": "https://example.com/profile.jpg",
  "organization_hospital": "Memorial Hospital",
  "organization_code": "MH-001",
  "shift": "Day Shift",
  "professional_title": "RN"
}
```

Response `200`:

```json
{
  "message": "Profile updated successfully",
  "profile": {
    "id": 3,
    "name": "Jane Cooper",
    "phone_number": "+15551234567"
  }
}
```

## Get Security Settings

```http
GET /api/profile/security-settings/:id
```

Response `200`:

```json
{
  "security_settings": {
    "password_last_changed_at": null,
    "sign_out_all_devices_at": null
  },
  "active_sessions": []
}
```

## Change Password

```http
PATCH /api/profile/change-password/:id
```

Input:

```json
{
  "current_password": "Password123!",
  "new_password": "NewPassword123!",
  "confirm_password": "NewPassword123!"
}
```

Response `200`:

```json
{
  "message": "Password changed successfully"
}
```

## Sign Out All Devices

```http
PATCH /api/profile/sign-out-all-devices/:id
```

Response `200`:

```json
{
  "message": "Signed out from all devices successfully"
}
```

## Get Notification Preferences

```http
GET /api/profile/notification-preferences/:id
```

Response `200`:

```json
{
  "notification_preferences": {
    "task_alerts": true,
    "task_reassigned": true,
    "task_cancelled": true,
    "task_completed": false,
    "wound_updates_added": true,
    "doctor_added_instructions": true,
    "security_alerts": true
  }
}
```

## Update Notification Preferences

```http
PATCH /api/profile/notification-preferences/:id
```

Input:

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

Response `200`:

```json
{
  "message": "Notification preferences updated successfully",
  "notification_preferences": {
    "task_alerts": true
  }
}
```

## Get App Settings

```http
GET /api/profile/app-settings/:id
```

Response `200`:

```json
{
  "app_settings": {
    "auto_sync_when_online": true,
    "save_images_offline": true,
    "text_size": "medium",
    "language": "english"
  },
  "app_version": "v1.0.0"
}
```

## Update App Settings

```http
PATCH /api/profile/app-settings/:id
```

Input:

```json
{
  "auto_sync_when_online": true,
  "save_images_offline": true,
  "text_size": "large",
  "language": "english"
}
```

Response `200`:

```json
{
  "message": "App settings updated successfully",
  "app_settings": {
    "auto_sync_when_online": true,
    "save_images_offline": true,
    "text_size": "large",
    "language": "english"
  }
}
```

## Simple Patient Handoff

```http
POST /api/profile/patient-handoff/:id
```

Path params:

```txt
id: from nurse user id
```

Input:

```json
{
  "to_nurse_id": 5,
  "patient_ids": [1, 2, 3]
}
```

Response `200`:

```json
{
  "message": "Patient handoff initiated successfully",
  "from_nurse_id": 3,
  "to_nurse_id": 5,
  "patient_ids": [1, 2, 3],
  "updated_count": 3,
  "reassigned_task_count": 4
}
```

## Sign Out

```http
POST /api/profile/sign-out/:id
```

Response `200`:

```json
{
  "message": "Signed out successfully"
}
```

## Delete Account

```http
DELETE /api/profile/delete-account/:id
```

Input:

```json
{
  "password": "Password123!",
  "confirm_delete": true,
  "reason": "Leaving organization"
}
```

Response `200`:

```json
{
  "message": "Account deleted successfully"
}
```

---

# Handoff APIs

Base route:

```txt
/api/handoffs
```

## Get Handoff Patients

```http
GET /api/handoffs/patients/:nurseId
```

Optional query:

```txt
selected_ids=[1,2]
```

Response `200`:

```json
{
  "patients": [
    {
      "id": 1,
      "initials": "MR",
      "first_name": "Michael",
      "last_name": "Roberts",
      "display_name": "Michael Roberts",
      "room": "Room 204",
      "wound_type": "Diabetic Foot Ulcer",
      "severity_stage": "Stage III",
      "task_count": 2,
      "selected": false
    }
  ],
  "selected_count": 0,
  "total_count": 1
}
```

## Get Available Nurses

```http
GET /api/handoffs/available-nurses/:nurseId
```

Response `200`:

```json
{
  "nurses": [
    {
      "id": 5,
      "initials": "AB",
      "name": "Alice Brown",
      "first_name": "Alice",
      "last_name": "Brown",
      "email": "alice@example.com",
      "role": "nurse",
      "shift": "Night",
      "professional_title": "RN",
      "organization_hospital": "Memorial Hospital",
      "available": true
    }
  ]
}
```

## Create Handoff Draft

```http
POST /api/handoffs/create
```

Input:

```json
{
  "from_nurse_id": 3,
  "patient_ids": [1, 2, 3],
  "shift_label": "Evening",
  "shift_ends_at": "2026-07-01T19:00:00.000Z"
}
```

Response `201`:

```json
{
  "message": "Handoff draft created successfully",
  "handoff": {
    "id": 1,
    "from_nurse": {},
    "to_nurse": null,
    "patient_ids": [1, 2, 3],
    "pending_task_ids": [10, 11],
    "patient_count": 3,
    "pending_task_count": 2,
    "patients": [],
    "pending_tasks": [],
    "general_notes": null,
    "per_patient_notes": {},
    "shift_label": "Evening",
    "shift_ends_at": "2026-07-01T19:00:00.000Z",
    "status": "draft",
    "completed_at": null,
    "summary": {},
    "created_at": "2026-07-01T09:00:00.000Z",
    "updated_at": "2026-07-01T09:00:00.000Z"
  }
}
```

## Get Handoff Detail

```http
GET /api/handoffs/get/:id
```

Response `200`:

```json
{
  "handoff": {
    "id": 1,
    "status": "draft",
    "patient_ids": [1, 2, 3],
    "pending_task_ids": [10, 11]
  }
}
```

## Select Receiving Nurse

```http
PATCH /api/handoffs/select-nurse/:id
```

Input:

```json
{
  "to_nurse_id": 5
}
```

Response `200`:

```json
{
  "message": "Handoff nurse selected successfully",
  "handoff": {
    "id": 1,
    "to_nurse": {},
    "status": "ready"
  }
}
```

## Add Handoff Notes

```http
PATCH /api/handoffs/notes/:id
```

Input:

```json
{
  "general_notes": "Monitor high-risk patients closely.",
  "per_patient_notes": {
    "1": "Stage III wound, monitor drainage.",
    "2": "Pain score increased today."
  },
  "shift_label": "Evening",
  "shift_ends_at": "2026-07-01T19:00:00.000Z"
}
```

Response `200`:

```json
{
  "message": "Handoff notes saved successfully",
  "handoff": {
    "id": 1,
    "general_notes": "Monitor high-risk patients closely.",
    "per_patient_notes": {
      "1": "Stage III wound, monitor drainage."
    }
  }
}
```

## Confirm Handoff

```http
PATCH /api/handoffs/confirm/:id
```

Input:

```json
{}
```

Response `200`:

```json
{
  "message": "Handoff completed successfully",
  "handoff": {
    "id": 1,
    "status": "completed",
    "completed_at": "2026-07-01T09:00:00.000Z",
    "summary": {
      "patients_transferred": 3,
      "tasks_transferred": 2,
      "completed_at": "2026-07-01T09:00:00.000Z"
    }
  }
}
```

## Handoff Success

```http
GET /api/handoffs/success/:id
```

Response `200`:

```json
{
  "success": true,
  "message": "Handoff successful",
  "summary": {
    "from_nurse": {},
    "to_nurse": {},
    "patients": 3,
    "tasks": 2,
    "shift_label": "Evening",
    "completed_at": "2026-07-01T09:00:00.000Z"
  },
  "handoff": {}
}
```

---

# Notification APIs

Base route:

```txt
/api/notifications
```

## Get Notifications

```http
GET /api/notifications/get-notifications/:userId?tab=all&limit=30
```

Alternative:

```http
GET /api/notifications/get-notifications?user_id=3&tab=unread&type=wound_update
```

Query:

```txt
tab: all | unread | read
status: alias for tab
type: optional notification type
limit: optional, default 30
```

Response `200`:

```json
{
  "tab": "all",
  "counts": {
    "all": 12,
    "unread": 4,
    "read": 8
  },
  "notifications": [
    {
      "id": 1,
      "user_id": 3,
      "type": "wound_update",
      "title": "Wound Update - Michael Roberts",
      "message": "Nurse Johnson added a new wound update.",
      "action_label": "View Task",
      "action_url": "/wound-cases/1",
      "metadata": {
        "patient_id": 1,
        "wound_case_id": 1
      },
      "is_read": false,
      "read_at": null,
      "cleared_at": null,
      "time_ago": "5m ago",
      "created_at": "2026-07-01T09:00:00.000Z",
      "updated_at": "2026-07-01T09:00:00.000Z"
    }
  ]
}
```

## Create Notification

```http
POST /api/notifications/create-notification
```

Input:

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

Response `201`:

```json
{
  "message": "Notification created successfully",
  "notification": {
    "id": 1,
    "user_id": 3,
    "type": "wound_update",
    "title": "Wound Update - Michael Roberts",
    "is_read": false
  }
}
```

## Mark Notification Read

```http
PATCH /api/notifications/mark-read/:id
```

Response `200`:

```json
{
  "message": "Notification marked as read",
  "notification": {
    "id": 1,
    "is_read": true,
    "read_at": "2026-07-01T09:00:00.000Z"
  }
}
```

## Mark All Notifications Read

```http
PATCH /api/notifications/mark-all-read/:userId
```

Response `200`:

```json
{
  "message": "All notifications marked as read",
  "updated_count": 4,
  "counts": {
    "all": 12,
    "unread": 0,
    "read": 12
  }
}
```

## Clear Notification

```http
DELETE /api/notifications/clear/:id
```

Response `200`:

```json
{
  "message": "Notification cleared successfully"
}
```

## Clear All Notifications

```http
DELETE /api/notifications/clear-all/:userId
```

Response `200`:

```json
{
  "message": "All notifications cleared successfully",
  "updated_count": 12,
  "counts": {
    "all": 0,
    "unread": 0,
    "read": 0
  }
}
```

---

# Subscription APIs

Base route:

```txt
/api/subscriptions
```

## Get Plans

```http
GET /api/subscriptions/plans
```

Response `200`:

```json
{
  "plans": [
    {
      "code": "free",
      "name": "Free",
      "audience": "For Patients & Basic Users",
      "currency": "CHF",
      "amount": 0,
      "interval": "forever",
      "badge": null,
      "trial_days": 0,
      "limits": {
        "ai_notes": 0,
        "patients": 0,
        "staff_members": 0
      },
      "features": [],
      "disabled_features": []
    }
  ]
}
```

## Get Plan Detail

```http
GET /api/subscriptions/plans/:planCode
```

Example:

```http
GET /api/subscriptions/plans/professional
```

Response `200`:

```json
{
  "plan": {
    "code": "professional",
    "name": "Professional",
    "currency": "CHF",
    "amount": 49,
    "interval": "month",
    "trial_days": 7,
    "features": []
  }
}
```

## Create Checkout Session

```http
POST /api/subscriptions/checkout-session
```

Input:

```json
{
  "plan_code": "professional",
  "provider": "apple_pay"
}
```

Response `200`:

```json
{
  "message": "Checkout session created successfully",
  "checkout": {
    "plan": {
      "code": "professional",
      "name": "Professional",
      "amount": 49
    },
    "provider": "apple_pay",
    "payment_summary": {
      "title": "AI-Enabled Wound Professional",
      "amount": 49,
      "currency": "CHF",
      "interval": "month",
      "trial_days": 7,
      "no_commitment": true
    },
    "apple_pay": {
      "supported": true,
      "merchant_label": "AI-Enabled Wound"
    },
    "google_pay": {
      "supported": false,
      "merchant_label": "AI-Enabled Wound"
    }
  }
}
```

## Subscribe

```http
POST /api/subscriptions/subscribe
```

Input:

```json
{
  "user_id": 3,
  "plan_code": "professional",
  "provider": "apple_pay",
  "provider_subscription_id": "sub_123",
  "start_trial": true,
  "source": "mobile_app"
}
```

Response `201` or `200`:

```json
{
  "message": "Subscription created successfully",
  "subscription": {
    "id": 1,
    "user_id": 3,
    "plan_code": "professional",
    "plan_name": "Professional",
    "billing_provider": "apple_pay",
    "provider_subscription_id": "sub_123",
    "currency": "CHF",
    "amount": "49.00",
    "interval": "month",
    "status": "trialing",
    "usage": {
      "ai_notes": 0,
      "patients": 0
    },
    "features": [],
    "trial_ends_at": "2026-07-08T09:00:00.000Z",
    "current_period_start": "2026-07-01T09:00:00.000Z",
    "current_period_end": "2026-08-01T09:00:00.000Z",
    "cancelled_at": null,
    "metadata": {
      "source": "mobile_app",
      "original_plan_code": null
    },
    "created_at": "2026-07-01T09:00:00.000Z",
    "updated_at": "2026-07-01T09:00:00.000Z"
  }
}
```

## Get Current Subscription

```http
GET /api/subscriptions/current/:userId
```

Response `200`:

```json
{
  "subscription": {
    "id": 1,
    "user_id": 3,
    "plan_code": "professional",
    "status": "trialing"
  },
  "available_plans": []
}
```

## Manage Subscription

```http
GET /api/subscriptions/manage/:userId
```

Response `200`:

```json
{
  "current_plan": {
    "id": 1,
    "plan_code": "professional",
    "status": "trialing"
  },
  "usage": {
    "ai_notes": 0,
    "patients": 0
  },
  "upgrade_options": [],
  "can_cancel": true
}
```

## Update Subscription Usage

```http
PATCH /api/subscriptions/usage/:userId
```

Input:

```json
{
  "usage": {
    "ai_notes": 12,
    "patients": 8
  }
}
```

Alternative input:

```json
{
  "ai_notes": 12,
  "patients": 8
}
```

Response `200`:

```json
{
  "message": "Subscription usage updated successfully",
  "subscription": {
    "id": 1,
    "usage": {
      "ai_notes": 12,
      "patients": 8
    }
  }
}
```

## Cancel Subscription

```http
PATCH /api/subscriptions/cancel/:userId
```

Input:

```json
{
  "reason": "No longer needed"
}
```

Response `200`:

```json
{
  "message": "Subscription cancelled successfully",
  "subscription": {
    "id": 1,
    "status": "cancelled",
    "cancelled_at": "2026-07-01T09:00:00.000Z",
    "metadata": {
      "cancellation_reason": "No longer needed"
    }
  }
}
```

---

# Database Tables

Runtime tables:

| Table | Purpose |
| --- | --- |
| `users` | Auth, roles, profile, settings, organization review |
| `patients` | Patient details and nurse assignment |
| `tasks` | Nurse/doctor/user tasks |
| `wound_cases` | Wound case, measurements, images, notes, reports |
| `patient_handoffs` | Nurse shift handoff |
| `notifications` | User notifications |
| `subscriptions` | Plan, billing, status, usage |

Relationships:

```txt
patients.nurse_id -> users.id
tasks.patient_id -> patients.id
tasks.assigned_by -> users.id
tasks.assigned_to -> users.id
wound_cases.patient_id -> patients.id
patient_handoffs.from_nurse_id -> users.id
patient_handoffs.to_nurse_id -> users.id
notifications.user_id -> users.id
subscriptions.user_id -> users.id
```

---

# Known Limitations

- Auth middleware is not applied to all protected routes yet.
- Role-based access control is not fully enforced yet.
- Doctor side and patient side have shared foundations but not separate complete API modules yet.
- SOAP note generation is rule-based placeholder logic.
- Report/PDF APIs return report data and optional URLs; they do not generate binary PDFs yet.
- Image/audio/report upload storage is not implemented; APIs store URLs.
- Automatic notification creation is not wired for every business event.
