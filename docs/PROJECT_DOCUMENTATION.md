# AI-Enabled Wound APIs — Complete Project Documentation

Last verified against the source code: 2026-08-04

## 1. Project overview

AI-Enabled Wound APIs is a Node.js/Express backend for a wound-care platform used by nurses, doctors, patients, administrators, and organizations. It provides account onboarding, clinical patient and wound management, task assignment, handoffs, notifications, reports, subscriptions, local media storage, speech transcription, and AI-assisted clinical documentation.

Primary capabilities:

- Common, doctor-specific, and patient-specific signup/sign-in flows.
- Organization membership and account-review fields.
- Nurse and doctor patient ownership, assignment, reassignment, and archival.
- Wound cases with timelines, images, measurements, clinical notes, voice dictation, SOAP notes, and reports.
- Nurse and doctor task lifecycle management.
- Nurse and doctor handoff workflows.
- Patient dashboard, wound profile, healing progress, reports, and settings.
- Database notifications with Firebase Cloud Messaging push delivery.
- Subscription plans, StoreKit 2 verification/restore, and usage tracking.
- Local profile-photo, wound-image, voice-audio, and PDF storage.

## 2. Technology stack

| Area | Technology |
|---|---|
| Runtime | Node.js, CommonJS modules |
| HTTP framework | Express 4 |
| Database | MySQL |
| ORM | Sequelize 6 |
| Authentication | Custom HMAC SHA-256 JWT-like bearer tokens |
| Password hashing | PBKDF2-SHA512, per-password salt, 120,000 iterations |
| Email | Nodemailer/SMTP |
| Push notifications | Firebase Admin SDK / Firebase Cloud Messaging |
| Multipart uploads | Multer |
| PDF creation | PDFKit |
| AI generation | OpenAI Responses API |
| Voice transcription | Configurable external Whisper-compatible service |
| Development process | nodemon |

## 3. Repository structure

```text
.
|-- app.js
|-- config/
|   |-- config.js
|   |-- db.js
|   `-- firebase.js
|-- controllers/
|-- docs/
|-- middleware/
|-- migrations/
|-- models/
|-- postman/
|-- routes/
|-- scripts/
|-- services/
|-- uploads/
|-- utils/
|-- .env
|-- package.json
`-- package-lock.json
```

| Path | Responsibility |
|---|---|
| `app.js` | Express bootstrap, middleware, route mounts, Sequelize sync, and server startup. |
| `config/` | Database and Firebase Admin configuration. |
| `controllers/` | Request validation, business logic, persistence, and response formatting. |
| `routes/` | HTTP method/path definitions and route-level middleware. |
| `models/` | Sequelize table definitions and notification creation hook. |
| `middleware/` | Bearer authentication, role checks, and multipart file handling. |
| `services/` | Firebase push-delivery service. |
| `utils/` | Security, mail, organization resolution, and permanent-delete helpers. |
| `migrations/` | MySQL schema synchronization and incremental migrations. |
| `scripts/` | Admin creation, data synchronization, and API smoke testing. |
| `postman/` | Main and doctor Postman collections/environments. |
| `uploads/` | Runtime local storage, publicly served under `/uploads`. |

## 4. Runtime architecture

```text
Client application
      |
      v
Express route -> authentication/role middleware -> controller
      |                                           |
      |                                           +-> Sequelize model -> MySQL
      |                                           +-> Multer -> local uploads
      |                                           +-> OpenAI / Whisper / SMTP
      |                                           `-> PDFKit
      |
      `-> Notification.create()
                    |
                    v
             afterCreate hook
                    |
                    v
        user.fcm_token -> Firebase Cloud Messaging
```

### Startup sequence

`app.js` performs the following:

1. Loads `.env` through `dotenv`.
2. Imports the Sequelize instance; `config/db.js` immediately authenticates with MySQL.
3. Registers all eight Sequelize models.
4. Enables JSON and URL-encoded body parsing.
5. Serves `uploads/` as a public static directory.
6. Mounts 23 route modules under `/api`.
7. Runs `sequelize.sync()` or `sequelize.sync({ alter: true })` when `DB_SYNC_ALTER=true`.
8. Listens on `PORT`, defaulting to `3000`.

## 5. Installation and local run

### Prerequisites

- Node.js compatible with the installed dependencies.
- MySQL server and a database/user with schema permissions.
- SMTP credentials for verification/password-reset email flows.
- Optional Firebase, OpenAI, Whisper, and StoreKit configuration for those features.

### Install

```bash
npm install
```

### Start

```bash
npm start
```

Development mode:

```bash
npm run dev
```

Default local URL:

```text
http://localhost:3000
```

### NPM scripts

| Command | Behavior |
|---|---|
| `npm start` | Runs `node app.js`. |
| `npm run dev` | Runs `nodemon app.js`. |
| `npm test` | Placeholder; intentionally exits with an error because no automated suite is configured. |

## 6. Environment configuration

Do not commit `.env`, private keys, API keys, SMTP passwords, StoreKit credentials, or FCM registration tokens.

### Core server and database

```env
PORT=3000
NODE_ENV=development
DB_NAME=ai_enabled_wound_db
DB_USER=your_database_user
DB_PASSWORD=your_database_password
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DIALECT=mysql
DB_SYNC_ALTER=false
```

`NODE_ENV=production` makes the doctor password-reset session cookie use the `Secure` flag.

### Authentication

```env
JWT_SECRET=replace-with-a-long-random-secret
JWT_EXPIRES_IN_SECONDS=86400
```

`JWT_EXPIRES_IN_SECONDS` defaults to one day. Tokens use a JWT-like `header.payload.signature` format but are implemented locally rather than through a standard JWT package.

### SMTP email

```env
MAIL_HOST=smtp.example.com
MAIL_PORT=587
MAIL_SECURE=false
MAIL_USER=your_smtp_user
MAIL_PASS=your_smtp_password
MAIL_FROM=no-reply@example.com
```

`MAIL_HOST`, `MAIL_USER`, and `MAIL_PASS` are required by email-code flows.

### Firebase Cloud Messaging

Inline service-account credentials:

```env
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

Or use Application Default Credentials:

```env
FIREBASE_PROJECT_ID=your-firebase-project-id
GOOGLE_APPLICATION_CREDENTIALS=C:\secure\firebase-service-account.json
```

If `FIREBASE_PROJECT_ID` is absent, push delivery is skipped without failing notification creation.

### OpenAI and voice transcription

```env
OPENAI_API_KEY=your_openai_api_key
OPENAI_SOAP_MODEL=gpt-4.1-mini
OPENAI_REPORT_MODEL=gpt-4.1-mini
OPENAI_REPORT_FALLBACK_MODEL=gpt-4.1-mini
WHISPER_SERVICE_URL=http://localhost:8000/transcribe
WHISPER_SERVICE_API_KEY=optional_service_token
WHISPER_MODEL=whisper-1
```

The code falls back to `gpt-4.1-mini` for SOAP/report generation and `whisper-1` for transcription when their model variables are absent.

### Apple subscriptions

```env
APPLE_BUNDLE_ID=com.example.woundapp
APP_STORE_BASIC_PRODUCT_ID=com.example.woundapp.basic.monthly
APP_STORE_PROFESSIONAL_PRODUCT_ID=com.example.woundapp.professional.monthly
APP_STORE_ORGANIZATION_PRODUCT_ID=com.example.woundapp.organization.monthly
APP_STORE_PRODUCT_IDS={"basic":"...","professional":"...","organization":"..."}
APPLE_STOREKIT_VERIFY_SIGNATURE=true
```

### Admin bootstrap script

```env
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=replace-with-a-strong-password
ADMIN_FIRST_NAME=System
ADMIN_LAST_NAME=Admin
ADMIN_ROLE=admin
```

## 7. Authentication and authorization

### Passwords and codes

- Passwords are stored as `iterations:salt:hash` using PBKDF2-SHA512.
- Password comparison uses timing-safe equality.
- Verification/reset codes contain six digits and expire after ten minutes in common auth flows.
- Common auth currently stores the six-digit code directly in the user row. SHA-256 code helper functions exist but are not consistently used.

### Bearer-token middleware

Protected endpoints expect:

```http
Authorization: Bearer <access-token>
```

`authenticateToken` verifies the signature/expiry, loads the user, rejects missing/deleted users, and assigns `req.auth` and `req.user`. `requireRoles(...)` then checks the loaded user's role.

### Roles

```text
doctor | nurse | patient | user | admin | super_admin
```

### Authentication labels used below

| Label | Meaning |
|---|---|
| Public | No route-level authentication middleware is applied. |
| Bearer | Any valid bearer token. |
| Nurse | Valid bearer token and `nurse` role. |
| Doctor | Valid bearer token and `doctor` role. |
| Patient | Valid bearer token and `patient` role. |

Public means only that middleware is absent in the current route definition; it does not mean the endpoint is safe to expose publicly.

## 8. Database design

The project defines eight Sequelize models. Column names are stored in snake case because all models use `underscored: true`.

| Model file | Sequelize model | Database table |
|---|---|---|
| `userModel.js` | `User` | `users` |
| `organizationModel.js` | `Organization` | `organizations` |
| `patientModel.js` | `Patient` | `patients` |
| `taskModel.js` | `Task` | `tasks` |
| `woundCaseModel.js` | `WoundCase` | `wound_cases` |
| `patientHandoffModel.js` | `PatientHandoff` | `patient_handoffs` |
| `notificationModel.js` | `Notification` | `notifications` |
| `subscriptionModel.js` | `Subscription` | `subscriptions` |

### `users`

Stores clinical users, patients, admins, account-review state, credentials, settings, and one current FCM token.

Important field groups:

- Identity: `id`, `name`, `first_name`, `last_name`, `email`, `phone_number`, `profile_photo_url`.
- Organization: `organization_id`, `organization_hospital`, `organization_code`.
- Review: `request_accepted`, `request_status`, `reviewed_by`, `reviewed_at`, `rejection_reason`.
- Access: `role`, `password_hash`, `auth_token`, `account_status`, `deleted_at`.
- Verification: `verification_code`, `verification_code_expires_at`, `verification_purpose`, `is_email_verified`.
- Push: `fcm_token`, `fcm_platform`, `fcm_token_updated_at`.
- Preferences: `notification_preferences`, `app_settings`, `security_settings`, `active_sessions`.
- Compliance/profile: `terms_accepted`, `terms_accepted_at`, `shift`, `professional_title`, `last_login_at`.

Enums:

```text
role: doctor | nurse | patient | user | admin | super_admin
request_status: none | pending | accepted | rejected
verification_purpose: signup | signin | reset_password
fcm_platform: android | ios | web
account_status: active | signed_out | deactivated | deleted
```

### `organizations`

Stores organization identity, approval/suspension state, admin ownership, and subscription state.

Key fields: `id`, `name`, `domain`, `code`, `admin_user_id`, `status`, `suspension_reason`, `suspension_note`, `suspended_by`, `suspended_at`, `decline_reason`, `declined_by`, `declined_at`, `subscription_plan`, `subscription_status`, and `metadata`.

```text
status: active | pending | suspended | declined
subscription_status: active | trialing | expired | cancelled
```

### `patients`

Stores demographics, clinical summary, current assignment, creator, and archive state.

Key fields: `id`, `nurse_id`, `doctor_id`, `assigned_by`, `assigned_to`, `first_name`, `last_name`, `date_of_birth`, `gender`, `mrn`, `address`, `phone_number`, `room`, `wound_type`, `primary_staff`, `backup_staff`, `primary_diagnosis`, `allergies_notes`, `status`, `archived_at`, and `archived_by`.

```text
gender: male | female | other
status: active | archived
```

Assignment rules:

- `assigned_by` records the user who originally created/assigned the patient.
- `assigned_to` records the current primary assignee.
- Nurse assignment uses `nurse_id`; doctor assignment uses `doctor_id`.

### `tasks`

Key fields: `id`, `title`, `description`, `task_type`, `priority`, `status`, `patient_id`, `wound_case`, `assigned_by`, `assigned_to`, `due_date`, `due_time`, `task_notes`, `work_notes`, and `completed_at`.

```text
task_type: all | wound | documentation | follow_up | other
priority: low | medium | high
status: pending | completed | cancelled
```

### `wound_cases`

Stores wound identity and current measurements plus JSON arrays for the clinical timeline.

Key fields: `id`, `patient_id`, `wound_type`, `severity_stage`, `pain_score`, `body_location`, `wound_etiology`, `status`, `healing_progress`, `length_cm`, `width_cm`, `depth_cm`, `images`, `measurements`, `updates`, `clinical_notes`, `reports`, `notes`, and `last_updated_at`.

```text
status: active | monitoring | healing | healed | closed
```

### `patient_handoffs`

Key fields: `id`, `from_nurse_id`, `to_nurse_id`, `patient_ids`, `pending_task_ids`, `general_notes`, `per_patient_notes`, `shift_label`, `shift_ends_at`, `status`, `completed_at`, and `summary`.

```text
status: draft | ready | completed | cancelled
```

Doctor handoff logic also uses these generic `from_nurse_id`/`to_nurse_id` columns for user IDs.

### `notifications`

Key fields: `id`, `user_id`, `type`, `title`, `message`, `action_label`, `action_url`, `metadata`, `read_at`, and `cleared_at`.

```text
type: wound_update | doctor_instruction | new_task | patient_assigned |
      task_completed | task_reassigned | login_alert | report_generated | system
```

An `afterCreate` model hook attempts FCM delivery after each `Notification.create(...)`.

### `subscriptions`

Key fields: `id`, `user_id`, `plan_code`, `plan_name`, `billing_provider`, `provider_subscription_id`, `currency`, `amount`, `interval`, `status`, `usage`, `features`, `trial_ends_at`, `current_period_start`, `current_period_end`, `cancelled_at`, and `metadata`.

```text
plan_code: free | basic | professional | organization
billing_provider: manual | apple_pay | google_pay | app_store
interval: forever | month
status: active | trialing | cancelled | expired
```

### Relationship map

```text
users.organization_id           -> organizations.id
users.reviewed_by               -> users.id
patients.nurse_id               -> users.id
patients.doctor_id              -> users.id
patients.assigned_by            -> users.id
patients.assigned_to            -> users.id
patients.archived_by            -> users.id
tasks.patient_id                -> patients.id
tasks.assigned_by               -> users.id
tasks.assigned_to               -> users.id
wound_cases.patient_id          -> patients.id
patient_handoffs.from_nurse_id  -> users.id
patient_handoffs.to_nurse_id    -> users.id
notifications.user_id           -> users.id
subscriptions.user_id           -> users.id
```

The models define column-level references but do not define Sequelize `hasMany`, `belongsTo`, or eager-loading associations.

## 9. API conventions

### Base URL and headers

Local base URL:

```text
http://localhost:3000
```

Typical JSON headers:

```http
Accept: application/json
Content-Type: application/json
Authorization: Bearer <token>
```

Upload endpoints require `multipart/form-data`.

### Error format

Most controllers return:

```json
{
  "message": "Human-readable error",
  "error": "Optional technical detail"
}
```

Validation generally returns `400`, authentication returns `401`, authorization returns `403`, missing resources return `404`, conflicts often return `409`, external delivery failures can return `502`/`503`, and unexpected failures return `500`.

### Common resource payloads

Patient fields commonly include `first_name`, `last_name`, `date_of_birth`, `gender`, `mrn`, `address`, `phone_number`, `room`, `wound_type`, `primary_staff`, `backup_staff`, `primary_diagnosis`, `allergies_notes`, and assignment IDs.

Task fields commonly include `title`, `description`, `task_type`, `priority`, `status`, `patient_id`, `wound_case`, `assigned_by`, `assigned_to`, `due_date`, `due_time`, `task_notes`, and `work_notes`.

Wound-case fields commonly include `patient_id`, `wound_type`, `severity_stage`, `pain_score`, `body_location`, `wound_etiology`, `status`, `healing_progress`, `length_cm`, `width_cm`, `depth_cm`, and `notes`. Timeline data is stored inside JSON arrays.

Notification creation supports `user_id`, `type`, `title`, `message`, `action_label`, `action_url`, and `metadata`. `userId`, `actionLabel`, and `actionUrl` aliases are accepted by the general controller.

## 10. Complete endpoint catalog

The catalog below lists all 209 route declarations currently mounted by `app.js`.

### 10.1 Common authentication — `/api/auth`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/me` | Bearer | Return the authenticated user. |
| `POST` | `/create-account` | Public | Create a doctor, nurse, or patient account; supports an optional profile image and FCM fields. |
| `POST` | `/create-organization-account` | Public | Create an organization-linked account request. |
| `POST` | `/upload-image` | Bearer | Upload and save the authenticated user's profile image. |
| `PUT` | `/accept-organization-request` | Public | Accept an organization request by email. |
| `POST` | `/signin` | Public | Sign in using email/password and return an access token. |
| `PUT` | `/fcm-token` | Bearer | Register or refresh the authenticated user's FCM token. |
| `DELETE` | `/fcm-token` | Bearer | Remove the authenticated user's FCM token. |
| `POST` | `/verify-code` | Public | Verify a signup/sign-in verification code. |
| `POST` | `/forgot-password` | Public | Generate and email a reset code. |
| `POST` | `/reset-password` | Public | Reset a password using the reset code. |
| `PUT` | `/change-role` | Public | Change a user's role by email. |

Common signup accepts snake-case and camel-case aliases for names, phone, confirmation, terms, profile URL, and FCM fields. Allowed signup/change-role values are `doctor`, `nurse`, and `patient`. Sign-in requires `request_status=accepted` and rejects deactivated/deleted accounts.

### 10.2 Admin — `/api/admin`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/login` | Public | Sign in an `admin` or `super_admin`. |
| `GET` | `/organizations` | Public | List/filter organizations for admin review. |
| `GET` | `/organizations/:organizationCode/users` | Public | List organization clinical users. |

`adminAuthMiddleware` exists but is not applied in `adminRoutes.js`.

### 10.3 Nurse dashboard — `/api/dashboard`

All endpoints require a nurse bearer token.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/home` | Nurse | Combined home-dashboard response. |
| `GET` | `/stats` | Nurse | Counts for assigned patients, wounds, high-priority tasks, tasks, and notifications. |
| `GET` | `/today-tasks` | Nurse | Tasks due today for the nurse's scope. |
| `GET` | `/assigned-patients` | Nurse | Patients assigned to the nurse. |
| `GET` | `/recent-updates` | Nurse | Recent wound/task activity. |

### 10.4 Nurse patients — `/api/patients`

All endpoints require a nurse bearer token and are scoped to `req.user.id`.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/create-patient` | Nurse | Create a patient assigned by/to the current nurse. |
| `GET` | `/get-patient` | Nurse | List the nurse's active patients. |
| `GET` | `/get-patient/:id` | Nurse | Get one nurse-owned patient. |
| `PUT` | `/update-patient/:id` | Nurse | Update a nurse-owned patient. |
| `PATCH` | `/reassign-patient/:id` | Nurse | Reassign a patient to a nurse or doctor. |
| `DELETE` | `/delete-patient/:id` | Nurse | Permanently delete the patient and related wound cases/tasks. |

### 10.5 Nurse tasks — `/api/tasks`

All endpoints require a nurse bearer token and enforce nurse/patient scope in the controller.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/create-task` | Nurse | Create a task. |
| `GET` | `/get-task` | Nurse | List scoped tasks with optional filters. |
| `GET` | `/get-task/:id` | Nurse | Get one scoped task. |
| `PUT` | `/update-task/:id` | Nurse | Update a scoped task. |
| `PATCH` | `/complete-task/:id` | Nurse | Mark a task completed. |
| `PATCH` | `/reassign-task/:id` | Nurse | Change the task assignee. |
| `DELETE` | `/delete-task/:id` | Nurse | Delete a task. |

### 10.6 Nurse wound cases — `/api/wound-cases`

All endpoints require a nurse bearer token and scope patient/wound access to the nurse.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/create-wound-case` | Nurse | Create a wound case for a scoped patient. |
| `GET` | `/get-wound-case` | Nurse | List scoped wound cases. |
| `GET` | `/get-wound-case/:id` | Nurse | Get one scoped wound case. |
| `GET` | `/get-timeline/:id` | Nurse | Get formatted wound timeline entries. |
| `GET` | `/get-images/:id` | Nurse | Get wound images. |
| `GET` | `/get-measurements/:id` | Nurse | Get measurement history. |
| `GET` | `/get-notes/:id` | Nurse | Get clinical notes. |
| `GET` | `/get-reports/:id` | Nurse | Get report metadata. |
| `GET` | `/preview-report/:id/:reportId` | Nurse | Return report preview data. |
| `GET` | `/download-report/:id/:reportId` | Nurse | Generate/save a PDF and return download information. |
| `PUT` | `/update-wound-case/:id` | Nurse | Update wound-case fields and optional nested arrays. |
| `PATCH` | `/add-wound-update/:id` | Nurse | Append a wound update/timeline item. |
| `PATCH` | `/add-wound-image/:id` | Nurse | Upload up to ten wound images or append image metadata/URLs. |
| `DELETE` | `/delete-wound-image/:id/:imageId` | Nurse | Remove image metadata from a wound case. |
| `PATCH` | `/add-measurement/:id` | Nurse | Append a measurement record. |
| `PATCH` | `/add-note/:id` | Nurse | Append a manual/structured clinical note. |
| `POST` | `/save-voice-dictation/:id` | Nurse | Save an uploaded/local audio reference and/or supplied transcript as a voice note. |
| `POST` | `/transcribe-voice-dictation/:id/:noteId?` | Nurse | Transcribe uploaded or previously saved local audio and save the transcript. |
| `POST` | `/generate-soap-note/:id` | Nurse | Generate an AI SOAP note from narrative and wound facts. |
| `POST` | `/generate-report/:id` | Nurse | Generate and store an AI-assisted wound report. |
| `POST` | `/generate-ai-report/:id` | Nurse | Alias for the same report-generation controller. |
| `PATCH` | `/add-report/:id` | Nurse | Append manually supplied report metadata. |
| `PATCH` | `/share-report/:id/:reportId` | Nurse | Mark/share a report and record sharing metadata. |
| `DELETE` | `/delete-wound-case/:id` | Nurse | Delete a wound case. |

### 10.7 Common profile/settings — `/api/profile`

These routes currently identify users through URL parameters and have no route-level bearer middleware.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/get-profile/:id` | Public | Get user profile and related counts. |
| `PUT` | `/update-profile/:id` | Public | Update profile fields. |
| `GET` | `/security-settings/:id` | Public | Get security settings/session summary. |
| `PATCH` | `/change-password/:id` | Public | Change password after verifying the current password. |
| `PATCH` | `/sign-out-all-devices/:id` | Public | Clear token/session state. |
| `GET` | `/notification-preferences/:id` | Public | Get notification preferences. |
| `PATCH` | `/notification-preferences/:id` | Public | Merge notification-preference changes. |
| `GET` | `/app-settings/:id` | Public | Get app settings. |
| `PATCH` | `/app-settings/:id` | Public | Merge app-setting changes. |
| `POST` | `/patient-handoff/:id` | Public | Initiate a simple patient handoff. |
| `POST` | `/sign-out/:id` | Public | Mark account signed out and clear auth token. |
| `DELETE` | `/delete-account/:id` | Public | Permanently delete user-related data. |

### 10.8 Nurse handoffs — `/api/handoffs`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/patients/:nurseId` | Public | List patients selectable for handoff. |
| `GET` | `/available-nurses/:nurseId` | Public | List possible receiving nurses. |
| `POST` | `/create` | Public | Create a handoff draft. |
| `GET` | `/get/:id` | Public | Get handoff details/review. |
| `PATCH` | `/select-nurse/:id` | Public | Set the receiving nurse. |
| `PATCH` | `/notes/:id` | Public | Add general/per-patient notes. |
| `PATCH` | `/confirm/:id` | Public | Confirm the handoff and update assignments. |
| `GET` | `/success/:id` | Public | Get completed handoff summary. |

### 10.9 Common notifications — `/api/notifications`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/get-notifications/:userId` | Public | List a user's uncleared notifications. |
| `GET` | `/get-notifications` | Public | List notifications using `user_id`/`userId` and tab/status query filters. |
| `POST` | `/create-notification` | Public | Create a notification for any existing user and trigger push delivery. |
| `PATCH` | `/mark-read/:id` | Public | Mark one notification read. |
| `PATCH` | `/mark-all-read/:userId` | Public | Mark a user's uncleared notifications read. |
| `DELETE` | `/clear/:id` | Public | Soft-clear one notification using `cleared_at`. |
| `DELETE` | `/clear-all/:userId` | Public | Soft-clear all notifications for a user. |

Notification list tabs are `all`, `unread`, and `read`. Create type defaults to `system`.

### 10.10 Subscriptions — `/api/subscriptions`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/plans` | Public | List Free, Basic, Professional, and Organization plans. |
| `GET` | `/plans/:planCode` | Public | Get one plan and configured App Store product ID. |
| `POST` | `/checkout-session` | Public | Build provider-specific checkout/session metadata. |
| `POST` | `/subscribe` | Public | Create or update a manual/payment-provider subscription. |
| `POST` | `/apple/verify` | Public | Parse/verify a StoreKit 2 signed transaction and upsert subscription state. |
| `POST` | `/apple/restore` | Public | Verify restored StoreKit transactions and restore the newest known plan. |
| `GET` | `/current/:userId` | Public | Get current subscription and free fallback. |
| `GET` | `/manage/:userId` | Public | Return current plan and management options. |
| `PATCH` | `/usage/:userId` | Public | Merge usage counters. |
| `PATCH` | `/cancel/:userId` | Public | Mark the current subscription cancelled. |

Built-in monthly prices are CHF 19 for Basic, CHF 49 for Professional, and CHF 299 for Organization; Free has no recurring charge. These values are application data, not authoritative App Store pricing.

### 10.11 Doctor authentication — `/api/doctor/auth`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/signup/personal-information` | Public | Validate/echo doctor personal-information step. |
| `POST` | `/signup/professional-credentials` | Public | Validate/echo professional-credentials step. |
| `POST` | `/signup/set-password` | Public | Combine signup data and create/update the doctor account. |
| `POST` | `/signin` | Public | Doctor-only email/password sign-in. |
| `POST` | `/forgot-password` | Public | Find doctor by email/phone/identifier and send reset code. |
| `POST` | `/verify-otp` | Public | Verify doctor reset OTP. |
| `POST` | `/reset-password` | Public | Set new doctor password after OTP verification. |

### 10.12 Doctor management — `/api/doctor`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/home` | Public | Doctor home/dashboard data. |
| `GET` | `/patients` | Doctor | Authenticated doctor's patient list. |
| `GET` | `/patients/:patientId` | Public | Patient details for doctor UI. |
| `GET` | `/wound-cases/:woundCaseId` | Public | Wound case detail for doctor review. |
| `POST` | `/wound-cases/:woundCaseId/instructions` | Public | Append doctor instructions to clinical notes. |
| `PUT` | `/wound-cases/:woundCaseId/instructions/:instructionId` | Public | Update doctor instructions. |
| `DELETE` | `/wound-cases/:woundCaseId/instructions/:instructionId` | Public | Delete doctor instructions. |
| `PATCH` | `/tasks/:taskId/complete` | Public | Mark a task complete. |

Only `GET /patients` has route-level doctor authentication in this route module.

### 10.13 Doctor-owned patients — `/api/doctor/patients`

All endpoints require a doctor bearer token and enforce ownership.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/` | Doctor | Create a patient owned/assigned by the authenticated doctor. |
| `GET` | `/ss` | Doctor | List patients owned by the authenticated doctor. |
| `GET` | `/:patientId` | Doctor | Get one owned patient. |
| `PUT` | `/:patientId` | Doctor | Replace/update an owned patient. |
| `PATCH` | `/:patientId` | Doctor | Partially update an owned patient. |
| `PATCH` | `/:patientId/reassign` | Doctor | Reassign an owned patient to a nurse or doctor. |
| `DELETE` | `/:patientId` | Doctor | Permanently delete owned patient dependencies. |

The list path is literally `/ss` in the current route file.

### 10.14 Doctor-owned wound cases — `/api/doctor/wound-cases`

All endpoints require a doctor bearer token and constrain access through doctor-owned patients.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/` | Doctor | Create wound case for an owned patient. |
| `GET` | `/` | Doctor | List wound cases for owned patients. |
| `GET` | `/:woundCaseId` | Doctor | Get one owned wound case. |
| `PUT` | `/:woundCaseId` | Doctor | Update an owned wound case. |
| `PATCH` | `/:woundCaseId` | Doctor | Partially update an owned wound case. |
| `DELETE` | `/:woundCaseId` | Doctor | Delete an owned wound case. |

### 10.15 Doctor tasks — `/api/doctor/tasks`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/dashboard` | Public | Task counts, tabs, and dashboard items. |
| `GET` | `/options` | Public | Patient/assignee options for task creation. |
| `GET` | `/` | Public | List/filter tasks. |
| `POST` | `/` | Public | Create a task. |
| `GET` | `/:taskId` | Public | Get enriched task details. |
| `PUT` | `/:taskId` | Public | Update a task. |
| `PATCH` | `/:taskId/complete` | Public | Complete a task. |
| `GET` | `/:taskId/reassign-options` | Public | Get possible reassignees. |
| `PATCH` | `/:taskId/reassign` | Public | Reassign a task. |
| `DELETE` | `/:taskId` | Public | Delete a task. |

### 10.16 Doctor wound details — `/api/doctor/wound-details`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/:woundCaseId/images` | Public | Images tab data. |
| `GET` | `/:woundCaseId/measurements` | Public | Measurement history. |
| `POST` | `/:woundCaseId/healing-progress` | Public | Calculate/update healing progress. |
| `GET` | `/:woundCaseId/notes` | Public | Clinical notes/instructions. |
| `GET` | `/:woundCaseId/reports` | Public | Report list. |
| `POST` | `/:woundCaseId/reports/generate` | Public | Generate report metadata. |
| `GET` | `/:woundCaseId/reports/:reportId` | Public | Get one report. |
| `POST` | `/:woundCaseId/reports/:reportId/share` | Public | Share/update report sharing state. |

### 10.17 Doctor profile/settings — `/api/doctor/profile-settings`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/:doctorId/profile` | Public | Get doctor profile and counts. |
| `PUT` | `/:doctorId/profile` | Public | Update doctor profile. |
| `GET` | `/:doctorId/security` | Public | Get security/session settings. |
| `PATCH` | `/:doctorId/security/change-password` | Public | Change doctor password. |
| `PATCH` | `/:doctorId/security/sign-out-all-devices` | Public | Clear doctor sessions/token. |
| `GET` | `/:doctorId/notifications` | Public | Get doctor notification preferences. |
| `PATCH` | `/:doctorId/notifications` | Public | Merge notification preferences. |
| `GET` | `/:doctorId/app-settings` | Public | Get doctor app settings. |
| `PATCH` | `/:doctorId/app-settings` | Public | Merge doctor app settings. |
| `GET` | `/:doctorId/handoff` | Public | Get handoff summary. |
| `POST` | `/:doctorId/handoff` | Public | Initiate doctor handoff. |
| `POST` | `/:doctorId/sign-out` | Public | Sign doctor out. |
| `DELETE` | `/:doctorId/delete-account` | Public | Permanently delete doctor account dependencies. |

### 10.18 Doctor patient handoff — `/api/doctor/patient-handoff`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/:doctorId/patients` | Public | List selectable doctor patients. |
| `GET` | `/:doctorId/available-staff` | Public | List receiving nurses/doctors. |
| `POST` | `/draft` | Public | Create a doctor handoff draft. |
| `GET` | `/:handoffId` | Public | Get handoff details/review. |
| `PATCH` | `/:handoffId/select-staff` | Public | Set receiving staff member. |
| `PATCH` | `/:handoffId/notes` | Public | Add handoff notes. |
| `PATCH` | `/:handoffId/confirm` | Public | Confirm handoff and update assignments. |
| `GET` | `/:handoffId/success` | Public | Get completed handoff summary. |

### 10.19 Doctor notifications — `/api/doctor/notifications`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/:doctorId` | Public | Get doctor notification tabs/counts. |
| `POST` | `/:doctorId` | Public | Create doctor notification and trigger push. |
| `PATCH` | `/:doctorId/mark-all-read` | Public | Mark all doctor notifications read. |
| `DELETE` | `/:doctorId/clear-all` | Public | Soft-clear all doctor notifications. |
| `PATCH` | `/:doctorId/:notificationId/read` | Public | Mark one doctor notification read. |
| `DELETE` | `/:doctorId/:notificationId` | Public | Soft-clear one doctor notification. |

### 10.20 Patient authentication — `/api/patient/auth`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/signup/personal-information` | Public | Validate/echo patient personal-information step. |
| `POST` | `/signup/professional-credentials` | Public | Validate/echo patient profile/medical-information step. |
| `POST` | `/signup/professional-information` | Public | Alias for professional credentials. |
| `POST` | `/signup/set-password` | Public | Combine signup data and create/update patient user. |
| `POST` | `/signin` | Public | Patient-only email/password sign-in. |
| `POST` | `/forgot-password` | Public | Generate and email patient reset code. |
| `POST` | `/reset-password` | Public | Reset patient password with OTP/code. |

### 10.21 Patient app — `/api/patient/app`

All endpoints require a patient bearer token. Patient context is resolved from query parameters or the user's `app_settings.patient_profile` configuration.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/dashboard` | Patient | Patient dashboard and wound summary. |
| `GET` | `/healing-progress` | Patient | Healing progress for the default/latest wound case. |
| `GET` | `/healing-progress/:woundCaseId` | Patient | Healing progress for a selected wound case. |
| `GET` | `/reports` | Patient | Reports across the patient's wound cases. |
| `GET` | `/reports/:reportId/download` | Patient | Get report download information. |
| `GET` | `/reports/:reportId` | Patient | Get report details. |
| `GET` | `/wound-profile/:woundCaseId` | Patient | Wound profile summary. |
| `GET` | `/wound-profile/:woundCaseId/timeline` | Patient | Wound timeline. |
| `GET` | `/wound-profile/:woundCaseId/images` | Patient | Images/before-and-after data. |
| `GET` | `/wound-profile/:woundCaseId/measurements` | Patient | Measurement history. |
| `GET` | `/wound-profile/:woundCaseId/measures` | Patient | Alias for measurements. |
| `GET` | `/wound-profile/:woundCaseId/notes` | Patient | Clinical notes/instructions. |
| `GET` | `/wound-profile/:woundCaseId/reports` | Patient | Reports for one wound case. |
| `GET` | `/wound-profile/:woundCaseId/reports/:reportId/preview` | Patient | Preview report metadata/content. |
| `GET` | `/wound-profile/:woundCaseId/reports/:reportId/download` | Patient | Download report information. |
| `POST` | `/wound-profile/:woundCaseId/reports/:reportId/share` | Patient | Share report/update sharing metadata. |
| `GET` | `/wound-profile/:woundCaseId/reports/:reportId` | Patient | Get wound report details. |

Patient lookup checks `patient_id`, `patientId`, or `mrn` query parameters, then `app_settings.patient_profile.patient_id_mrn` or `.mrn`.

### 10.22 Patient profile/settings — `/api/patient/profile`

All endpoints require a patient bearer token.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/` | Patient | Get combined user/linked-patient profile. |
| `GET` | `/edit-profile` | Patient | Get editable profile data. |
| `PATCH` | `/edit-profile` | Patient | Update user and linked-patient data. |
| `GET` | `/security-settings` | Patient | Get security/session settings. |
| `PATCH` | `/change-password` | Patient | Change password. |
| `PATCH` | `/sign-out-all-devices` | Patient | Clear session/token state. |
| `GET` | `/notifications` | Patient | Get notification preferences. |
| `PATCH` | `/notifications` | Patient | Merge notification preferences. |
| `GET` | `/app-settings` | Patient | Get app settings. |
| `PATCH` | `/app-settings` | Patient | Merge app settings. |
| `POST` | `/sign-out` | Patient | Sign out current account. |
| `DELETE` | `/delete-account` | Patient | Permanently delete user and linked patient dependencies. |

### 10.23 Patient notifications — `/api/patient/notifications`

All endpoints require a patient bearer token. The recipient is always the authenticated user.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/` | Patient | Get notification tabs, sections, and counts. |
| `POST` | `/` | Patient | Create self-notification and trigger push. |
| `PATCH` | `/mark-all-read` | Patient | Mark all own notifications read. |
| `DELETE` | `/clear-all` | Patient | Soft-clear all own notifications. |
| `PATCH` | `/:notificationId/read` | Patient | Mark one own notification read. |
| `DELETE` | `/:notificationId` | Patient | Soft-clear one own notification. |

## 11. Core workflows

### 11.1 Common account creation

`POST /api/auth/create-account` accepts:

- Required: first name, last name, email, phone number, role, password, confirmation, and accepted terms.
- Optional: profile photo/file or profile URL, `fcm_token`, and `fcm_platform`.
- Roles: `doctor`, `nurse`, or `patient`.
- Account types: `individual` for `/create-account` and `organizational` for `/create-organization-account`.
- FCM platforms: `android`, `ios`, or `web`.

It validates the email, role, and account-type combination and password confirmation, resolves optional organization data, hashes the password, creates the user, and sends a signup code by SMTP. One email can therefore have an individual and organizational account for each of `doctor`, `nurse`, and `patient`, but cannot register the same combination twice.

`POST /api/auth/create-organization-account` follows the same basic flow and additionally accepts organization/hospital name and organization code, creating an account request for review.

### 11.2 Common sign-in

Request:

```http
POST /api/auth/signin
Content-Type: application/json

{
  "email": "nurse@example.com",
  "role": "nurse",
  "account_type": "individual",
  "password": "password123"
}
```

Successful sign-in requires:

- A matching email, role, account type, and password.
- `request_status` equal to `accepted`.
- `account_status` not equal to `deactivated` or `deleted`.

It updates `last_login_at`, sets `account_status=active`, creates a signed token, stores the token in `auth_token`, and returns public user data.

Current implementation issue: if `fcm_token` is included, `signin` calls `registerPushToken(...)`, but that helper is not defined/imported in `authController.js`. Until fixed, sign-in with an FCM token can return `500`. Sign in without the token, then call the authenticated `PUT /api/auth/fcm-token` endpoint.

Detailed examples are available in [Sign-in and Create Notification APIs](SIGNIN_AND_CREATE_NOTIFICATION_APIS.md).

### 11.3 FCM token lifecycle

Register or refresh after sign-in and whenever the client SDK rotates the token:

```http
PUT /api/auth/fcm-token
Authorization: Bearer <token>
Content-Type: application/json

{
  "fcm_token": "current-device-token",
  "fcm_platform": "android"
}
```

Remove it during logout:

```http
DELETE /api/auth/fcm-token
Authorization: Bearer <token>
```

The schema stores one token per user, so signing in on another device can replace the previous device token.

### 11.4 Notification and push flow

The general, doctor, and patient notification-create APIs call `Notification.create(...)`. The model's centralized `afterCreate` hook then:

1. Reads `notification.user_id`.
2. Loads that user.
3. Skips with `fcm_token_not_registered` if the user has no token.
4. Skips with `firebase_not_configured` if Firebase is unavailable.
5. Sends a notification payload containing title/body.
6. Sends stringified data containing `notification_id`, `type`, `action_url`, and notification metadata.
7. Uses Android channel `wound_updates`, high priority, and default sound.
8. Uses APNs default sound and badge `1`.
9. Clears invalid/unregistered tokens from the user record.

Database creation remains successful when delivery is skipped or fails. If a Sequelize transaction is used, delivery is scheduled after commit. Raw SQL and `bulkCreate()` without individual hooks do not invoke this `afterCreate` behavior.

### 11.5 Nurse patient, task, and wound scope

Nurse route groups use `req.user.id` rather than trusting a client-supplied nurse ID. Patient, task, and wound-case controllers check ownership/assignment before reads and writes. Reassignment can move a patient/task to another nurse or doctor after validating the destination user.

### 11.6 Doctor-owned resource scope

`/api/doctor/patients` and `/api/doctor/wound-cases` are the doctor route groups with consistent bearer/RBAC enforcement. Patient ownership is based on `doctor_id`/`assigned_to`; wound access is resolved through owned patient IDs.

Several older doctor modules use path/body IDs without route authentication. See the security section before exposing them.

### 11.7 Patient context resolution

Patient app endpoints resolve the linked `patients` record using this order:

1. `patient_id` query parameter.
2. `patientId` query parameter.
3. `mrn` query parameter.
4. `req.user.app_settings.patient_profile.patient_id_mrn`.
5. `req.user.app_settings.patient_profile.mrn`.

If no matching row is found, the patient app reports that the patient profile could not be resolved. The authenticated user's role must be `patient`.

### 11.8 Wound clinical timeline

The wound model stores structured arrays in JSON columns:

- `images`: uploaded image metadata and URLs.
- `measurements`: dimensions, area/progress, timestamps, and creator metadata.
- `updates`: general wound timeline events.
- `clinical_notes`: manual notes, doctor instructions, voice notes, and SOAP structures.
- `reports`: report metadata, AI output, sharing state, and generated PDF information.

Controllers normalize old/new snake-case and camel-case shapes when returning these arrays.

### 11.9 Voice dictation and transcription

Two related endpoints exist:

- `save-voice-dictation`: stores supplied transcript text and/or uploaded audio metadata. It does not perform speech-to-text.
- `transcribe-voice-dictation`: uploads audio or reuses a saved local audio path, sends it to `WHISPER_SERVICE_URL`, and stores the returned text as a voice clinical note.

The configured service receives multipart audio and an optional `model` field. An optional bearer service token is sent from `WHISPER_SERVICE_API_KEY`.

### 11.10 AI SOAP notes

`POST /api/wound-cases/generate-soap-note/:id` sends the clinical narrative and wound-case context to the OpenAI Responses API. It requests a structured SOAP note and stores the result in `clinical_notes`.

Requirements:

- `OPENAI_API_KEY`.
- Narrative text/instructions sufficient for generation.
- Nurse bearer token and scoped wound case.

AI clinical output must be reviewed by qualified clinical staff before use.

### 11.11 AI reports and PDFs

The nurse report-generation endpoint sends wound and report inputs to OpenAI and stores AI output in the wound case's `reports` JSON array. The download endpoint separately renders a PDF with PDFKit, saves it under `uploads/reports`, and updates report file metadata.

Doctor/patient report modules mainly operate on stored metadata and URLs; they do not all perform the same binary/PDF generation behavior as the nurse download endpoint.

### 11.12 Patient and doctor handoffs

Both handoff modules follow a staged workflow:

1. List/select patients.
2. List/select receiving staff.
3. Create a draft.
4. Add general/per-patient notes.
5. Review details.
6. Confirm the handoff.
7. Return a success summary.

Confirmation updates patient assignments and marks the handoff completed. Handoff records use JSON arrays for selected patient/task IDs and notes.

### 11.13 Subscriptions and StoreKit

Plans are defined in code:

| Plan | Amount | Interval | Trial | Intended audience |
|---|---:|---|---:|---|
| Free | CHF 0 | Forever | 0 days | Patients/basic users |
| Basic | CHF 19 | Monthly | 0 days | Independent clinicians |
| Professional | CHF 49 | Monthly | 7 days | Advanced clinical wound care |
| Organization | CHF 299 | Monthly | 0 days | Clinics/hospitals/care facilities |

StoreKit endpoints parse JWS transaction payloads, optionally verify signatures, compare configured bundle/product IDs, derive subscription status from transaction dates/revocation, and upsert subscription records. Production billing security should be reviewed independently.

### 11.14 Permanent deletion

Patient deletion removes dependent tasks and wound cases in a transaction. User deletion also removes notifications/subscriptions/handoffs, nulls references, and deletes a linked patient record for patient-role users when its MRN can be resolved from app settings.

These endpoints are destructive and should require strong authentication, authorization, audit logging, and confirmation in production.

## 12. File uploads and generated files

Express publicly serves local files at:

```text
/uploads/<folder>/<filename>
```

### Profile photos

| Detail | Value |
|---|---|
| Folder | `uploads/profile-photos/` |
| Max file size | 15 MB |
| File aliases | `image`, `file`, `photo`, `profile_photo`, `profilePhoto` |
| Accepted | Image MIME types or common image extensions (`jpg`, `jpeg`, `png`, `webp`, `heic`, `heif`, `gif`) |
| Endpoints | Common account creation and authenticated `/api/auth/upload-image` |

### Wound images

| Detail | Value |
|---|---|
| Folder | `uploads/wound-images/` |
| Max file size | 20 MB per image |
| Max count | 10 files per request |
| File aliases | `image`, `images`, `file`, `files`, `wound_image`, `wound_images`, `woundImage`, `woundImages` |
| Endpoint | `PATCH /api/wound-cases/add-wound-image/:id` |

### Voice dictation

| Detail | Value |
|---|---|
| Folder | `uploads/voice-dictations/` |
| Max file size | 25 MB |
| Accepted | `audio/*` or `application/octet-stream` |
| File aliases | `audio`, `voice`, `file`, `voice_file`, `voiceFile`, `audio_file`, `audioFile` |
| Endpoints | Save/transcribe voice-dictation endpoints |

### Report PDFs

Generated nurse wound-report PDFs are stored under `uploads/reports/`. Report metadata can include `url`, `file_url`, `file_path`, and `file_size`.

Local disk is not durable across all hosting platforms. Production deployments should use private object storage, signed URLs, file scanning, retention policies, and access control for clinical media.

## 13. Migrations and schema management

| Migration | Purpose |
|---|---|
| `20260630_admin_cms_user_review_fields.sql` | Adds/normalizes roles, review status, reviewer, timestamps, rejection reason, and indexes. |
| `20260701_sync_app_tables.sql` | Idempotent-style table/column synchronization for the application models. |
| `20260716_add_fcm_columns_to_users.sql` | Adds single-device FCM token, platform, and update timestamp. |
| `20260723_add_doctor_id_to_patients.sql` | Adds doctor ownership/assignment column when absent. |
| `20260729_add_patient_assignment_fields.sql` | Adds `assigned_by`/`assigned_to` and backfills them. |

Recommended deployment approach:

1. Back up the database.
2. Review SQL against the target schema.
3. Run explicit migrations in order as needed.
4. Keep `DB_SYNC_ALTER=false` outside controlled development environments.
5. Verify foreign keys/indexes and application startup.

Some SQL files contain `USE ai_enabled_wound_db`; update or remove it when the deployed database has a different name.

## 14. Utility scripts

| File | Purpose | Notes |
|---|---|---|
| `scripts/createAdminUser.js` | Create/update an admin bootstrap account. | Uses `ADMIN_*` environment variables. |
| `scripts/syncMissingUserReviewFields.js` | Synchronize missing review/account columns or data. | Requires database access. |
| `scripts/apiSmokeTest.js` | Create temporary records, launch an API server, call multiple endpoints, print results, and clean up. | Written for an older protection state and may need bearer-token updates before it passes current nurse-protected routes. |

Run scripts explicitly with Node, for example:

```bash
node scripts/createAdminUser.js
```

## 15. Postman assets

| File | Purpose |
|---|---|
| `postman/AI-Enabled-Wound-APIs.postman_collection.json` | Main project collection. |
| `postman/AI-Enabled-Wound-APIs.postman_environment.json` | Main environment variables. |
| `postman/AI-Enabled-Wound-Doctor-APIs.postman_collection.json` | Doctor-specific collection. |
| `postman/AI-Enabled-Wound-Doctor-APIs.postman_environment.json` | Doctor environment variables. |
| `postman/README.md` | Import/use instructions. |

Collections should be revalidated whenever route authentication or response contracts change.

## 16. Operational checks

### Basic health verification

There is no dedicated health endpoint. Startup success requires both database authentication and `sequelize.sync()` success. A practical check is to call a known public read endpoint or add a dedicated `/health` route for production.

### Manual verification sequence

1. Start MySQL and configure `.env`.
2. Run necessary migrations.
3. Start the API and confirm database/server logs.
4. Create or seed accepted users for each role.
5. Sign in and capture bearer tokens.
6. Test one protected endpoint per role.
7. Register a real device FCM token.
8. Create a notification and confirm both DB persistence and device delivery.
9. Test image/audio/PDF storage.
10. Test AI/Whisper paths only with non-production clinical test data.

### Automated testing status

- `npm test` is a placeholder.
- No unit/integration test framework is configured.
- A custom smoke-test script exists but should be updated to match current authentication requirements.
- No lint or formatting script is configured.

## 17. Security and production-readiness audit

### Route-level protection gaps

The following groups are wholly or mostly public in current code despite exposing sensitive or mutating behavior:

- Admin organization/user listing.
- Common profile/settings, including password/session/account deletion actions.
- Common notifications.
- Nurse handoffs.
- Subscriptions and StoreKit verification/restore.
- Doctor management except `GET /api/doctor/patients`.
- Doctor tasks, wound details, profile/settings, handoffs, and notifications.

Apply `authenticateToken` and role/ownership checks before production deployment.

### Other important findings

- `registerPushToken` is referenced by common `signin` but is undefined.
- Admin routes import `adminAuthMiddleware` but never apply it.
- A custom JWT-like implementation increases maintenance/security-review burden compared with a well-tested JWT library.
- Common verification codes are stored in plaintext.
- Some endpoints accept target user IDs directly without verifying caller ownership.
- Local upload files are publicly accessible and can contain sensitive clinical data.
- There is no request-rate limiting, centralized validation framework, audit log, CSRF strategy, security-header middleware, or API versioning.
- No CORS middleware is configured; cross-origin browser clients require an API proxy, same-origin deployment, or an explicit CORS policy.
- Technical error messages are often returned to clients.
- StoreKit signature verification can be disabled by environment configuration and deserves a dedicated production security review.
- `sequelize.sync({ alter: true })` can make uncontrolled runtime schema changes.
- Database configuration calls `process.exit(1)` during import when authentication fails, which complicates tests and tooling.
- `app.js` uses both `express.json()` and `bodyParser.json()`; `body-parser` is not declared as a direct project dependency and the second parser is redundant.
- One FCM token per user does not support reliable multi-device delivery.
- FCM push results are not exposed by create-notification API responses or persisted for delivery auditing/retry.
- AI-generated clinical content is not a substitute for clinician review.

## 18. Recommended improvement roadmap

### Immediate

1. Fix or replace the undefined `registerPushToken` call.
2. Apply authentication/RBAC/ownership checks to every sensitive route.
3. Protect destructive endpoints and add audit logging.
4. Move secrets out of local/shared files and rotate any exposed credentials.
5. Add a health endpoint and structured application logging.

### Short term

1. Add request-schema validation and consistent error handling.
2. Add unit/integration tests for auth, ownership, notifications, wound cases, handoffs, reports, and subscriptions.
3. Update the smoke test and Postman collections for bearer auth.
4. Replace runtime schema alteration with a formal migration workflow.
5. Add rate limiting, secure headers, and brute-force protection.
6. Store verification codes as hashes.

### Medium term

1. Move clinical files to private durable object storage.
2. Add multi-device push-token storage and delivery records/retries.
3. Standardize nurse/doctor/patient APIs under `/api/v1`.
4. Define Sequelize associations and transactional boundaries for cross-table workflows.
5. Add background jobs for email, push, transcription, AI generation, and PDF creation.
6. Add observability, metrics, error tracking, backups, and disaster-recovery procedures.

## 19. Documentation maintenance

This guide describes the current route and source implementation. Keep it synchronized when any of these change:

- Route path, method, prefix, or middleware.
- Controller request/response contract.
- Model field, enum, or relationship.
- Environment variable or third-party integration.
- Upload limit/file type.
- Migration/deployment process.
- Authentication/authorization behavior.

For detailed sign-in and notification-create examples, see [Sign-in and Create Notification APIs](SIGNIN_AND_CREATE_NOTIFICATION_APIS.md).
