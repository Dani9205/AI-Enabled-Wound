# AI-Enabled Wound APIs - Project Documentation

Last updated: 2026-07-10

## 1. Project Overview

AI-Enabled Wound APIs is a Node.js and Express backend for a wound care application. It supports nurse, doctor, patient, admin, task, wound case, notification, handoff, profile, and subscription workflows.

Main responsibilities:

- User account creation, sign in, password reset, email/OTP verification, and role management.
- Nurse workflows for patients, tasks, wound cases, reports, dashboard, handoff, notifications, and profile settings.
- Doctor workflows for onboarding, dashboard, patient management, wound review, instructions, tasks, handoff, notifications, and profile settings.
- Patient app workflows for dashboard, healing progress, wound profile, reports, notifications, and profile settings.
- Admin login and account review support.
- MySQL persistence through Sequelize models.

## 2. Technology Stack

| Area | Technology |
| --- | --- |
| Runtime | Node.js |
| Framework | Express.js |
| Database | MySQL |
| ORM | Sequelize |
| Mail | Nodemailer |
| File uploads | Multer |
| PDF generation | PDFKit |
| Speech-to-text | Configurable Whisper service |
| AI report generation | OpenAI Responses API |
| Env loading | dotenv |
| Dev server | nodemon |
| Auth/security helpers | Node crypto, custom JWT-style HMAC token helpers |

## 3. Project Structure

```txt
.
|-- app.js
|-- config/
|   |-- config.js
|   `-- db.js
|-- controllers/
|-- docs/
|   |-- API_REFERENCE.md
|   |-- AUTH_ME_API.md
|   `-- PROJECT_DOCUMENTATION.md
|-- middleware/
|   |-- authMiddleware.js
|   |-- profilePhotoUpload.js
|   `-- woundImageUpload.js
|-- migrations/
|-- models/
|-- postman/
|-- routes/
|-- scripts/
|-- uploads/
|   |-- profile-photos/
|   |-- reports/
|   |-- voice-dictations/
|   `-- wound-images/
`-- utils/
```

Important folders:

| Path | Purpose |
| --- | --- |
| `app.js` | Express app bootstrap, middleware, route mounting, Sequelize sync, server start. |
| `config/` | Sequelize database configuration. |
| `controllers/` | Business logic for each API module. |
| `routes/` | Express route definitions and URL mapping. |
| `models/` | Sequelize models for database tables. |
| `middleware/` | Authentication, role, and multipart image upload middleware. |
| `utils/` | Shared helpers for security and mail. |
| `uploads/` | Runtime upload destination. Ignored by git; served publicly from `/uploads`. |
| `migrations/` | SQL migration/support scripts. |
| `scripts/` | Utility scripts for admin/user/data maintenance and smoke testing. |
| `postman/` | Postman collections and environments for API testing. |
| `docs/API_REFERENCE.md` | Detailed API request/response reference. |

## 4. Application Entry Point

`app.js` creates the Express app and mounts all route modules.

Server behavior:

- Loads `.env` using `dotenv`.
- Initializes Sequelize from `config/db.js`.
- Registers all Sequelize models.
- Enables JSON and URL-encoded request parsing.
- Serves uploaded files from `/uploads`.
- Mounts API route groups under `/api/...`.
- Runs `sequelize.sync(syncOptions)` before listening.
- Uses `DB_SYNC_ALTER=true` to run Sequelize sync with `{ alter: true }`.
- Starts on `process.env.PORT` or `3000`.

## 5. Environment Variables

Expected `.env` variables:

```env
PORT=3000
DB_NAME=database_name
DB_USER=database_user
DB_PASSWORD=database_password
DB_HOST=localhost
DB_PORT=3306
DB_DIALECT=mysql
JWT_SECRET=your_secret_key
JWT_EXPIRES_IN_SECONDS=86400
WHISPER_SERVICE_URL=http://localhost:8000/transcribe
WHISPER_SERVICE_API_KEY=optional_service_token
OPENAI_API_KEY=your_openai_api_key
OPENAI_REPORT_MODEL=gpt-4.1-mini
DB_SYNC_ALTER=false
APPLE_BUNDLE_ID=com.yourcompany.yourapp
APP_STORE_BASIC_PRODUCT_ID=com.yourcompany.yourapp.subscription.basic.monthly
APP_STORE_PROFESSIONAL_PRODUCT_ID=com.yourcompany.yourapp.subscription.professional.monthly
APP_STORE_ORGANIZATION_PRODUCT_ID=com.yourcompany.yourapp.subscription.organization.monthly
APPLE_STOREKIT_VERIFY_SIGNATURE=true
```

Mail-related variables used by `utils/mailer.js`:

```env
MAIL_HOST=smtp.example.com
MAIL_PORT=587
MAIL_SECURE=false
MAIL_USER=your_smtp_user
MAIL_PASS=your_smtp_password
MAIL_FROM=no-reply@example.com
```

## 6. Install and Run

Install dependencies:

```bash
npm install
```

Start production-style server:

```bash
npm start
```

Start development server:

```bash
npm run dev
```

The local server starts at:

```txt
http://localhost:3000
```

or the configured `PORT`. The production/reference URL used in the docs is `https://aiwond.appistansoft.com`.

## 7. Available Scripts

| Command | Purpose |
| --- | --- |
| `npm start` | Runs `node app.js`. |
| `npm run dev` | Runs `nodemon app.js`. |
| `npm test` | Placeholder script; currently exits with an error. |

Utility scripts:

| File | Purpose |
| --- | --- |
| `scripts/createAdminUser.js` | Creates an admin user. |
| `scripts/syncMissingUserReviewFields.js` | Syncs missing user review/account fields. |
| `scripts/apiSmokeTest.js` | Runs API smoke checks. |

## 8. Authentication and Authorization

Security helpers are implemented in `utils/security.js`.

Password handling:

- Passwords are hashed using PBKDF2.
- Salt is generated per password.
- Verification uses timing-safe comparison.

Code/OTP handling:

- Six digit codes are generated through `crypto.randomInt`.
- Common auth currently stores plain six digit codes on the user row for signup/reset verification.
- `utils/security.js` also contains SHA-256 code hash helpers that can be used if code storage is hardened later.

Token handling:

- Tokens are custom HMAC SHA-256 signed tokens with JWT-like `header.body.signature` format.
- `JWT_SECRET` is required.
- `JWT_EXPIRES_IN_SECONDS` controls expiry, defaulting to `86400`.

Middleware:

| Middleware | Purpose |
| --- | --- |
| `authenticateToken` | Reads `Authorization: Bearer <token>`, verifies token, loads user, rejects deleted users. |
| `requireRoles(...roles)` | Allows only users whose `role` matches one of the required roles. |
| `adminAuthMiddleware` | Combines token auth with `admin` / `super_admin` role checks. |

Current protection status:

- Nurse patient, task, wound case, and dashboard routes use `authenticateToken` and require `nurse`.
- Patient app/profile/notification routes use `authenticateToken` and require `patient`.
- `/api/auth/me` uses `authenticateToken`; it returns the current logged-in user from the bearer token.
- `/api/auth/upload-image` uses `authenticateToken`; it updates only the logged-in user's `profile_photo_url`.
- Some legacy/common profile, notification, handoff, doctor, and admin-adjacent routes still rely on URL/body identifiers or controller checks instead of consistent route-level RBAC.
- Route-level RBAC should be reviewed before production use.

## 9. API Base URL

Local base URL:

```txt
http://localhost:3000
```

Production/reference base URL used in the existing API reference:

```txt
https://aiwond.appistansoft.com
```

Common headers:

```http
Content-Type: application/json
Accept: application/json
Authorization: Bearer <token>
```

For file upload endpoints, use `multipart/form-data` instead of `application/json`.

Common error response:

```json
{
  "message": "Error message",
  "error": "Optional technical detail"
}
```

## 10. Route Groups

Routes are mounted in `app.js`.

| Prefix | Route File | Main Purpose |
| --- | --- | --- |
| `/api/auth` | `routes/authRoutes.js` | Common/nurse auth and role management. |
| `/api/patients` | `routes/patientRoutes.js` | Nurse patient CRUD. |
| `/api/tasks` | `routes/taskRoutes.js` | Nurse/common task CRUD and assignment. |
| `/api/wound-cases` | `routes/woundCaseRoutes.js` | Wound case CRUD, images, measurements, notes, reports. |
| `/api/dashboard` | `routes/dashboardRoutes.js` | Nurse dashboard stats and lists. |
| `/api/profile` | `routes/profileRoutes.js` | Nurse/common profile and settings. |
| `/api/handoffs` | `routes/handoffRoutes.js` | Nurse patient handoff flow. |
| `/api/notifications` | `routes/notificationRoutes.js` | Common notification APIs. |
| `/api/subscriptions` | `routes/subscriptionRoutes.js` | Plans, checkout, subscribe, StoreKit verify/restore, usage, cancel. |
| `/api/admin` | `routes/adminRoutes.js` | Admin login. |
| `/api/doctor/auth` | `routes/doctorAuthRoutes.js` | Doctor signup/signin/password reset. |
| `/api/doctor` | `routes/doctorManagementRoutes.js` | Doctor home, patients, wound cases, instructions. |
| `/api/doctor/tasks` | `routes/doctorTaskRoutes.js` | Doctor task dashboard and task lifecycle. |
| `/api/doctor/wound-details` | `routes/doctorWoundDetailsRoutes.js` | Doctor wound tabs: images, measures, notes, reports. |
| `/api/doctor/profile-settings` | `routes/doctorProfileSettingsRoutes.js` | Doctor profile, security, settings, handoff. |
| `/api/doctor/patient-handoff` | `routes/doctorPatientHandoffRoutes.js` | Doctor 3-step patient handoff flow. |
| `/api/doctor/notifications` | `routes/doctorNotificationRoutes.js` | Doctor notification tabs/actions. |
| `/api/patient/auth` | `routes/patientAuthRoutes.js` | Patient signup/signin/password reset. |
| `/api/patient/app` | `routes/patientAppRoutes.js` | Patient dashboard, healing progress, wound profile, reports. |
| `/api/patient/profile` | `routes/patientProfileRoutes.js` | Patient profile, security, settings, delete/signout. |
| `/api/patient/notifications` | `routes/patientNotificationRoutes.js` | Patient notifications. |

## 11. Endpoint Catalog

### Common Auth: `/api/auth`

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/me` | Fetch current authenticated user from bearer token. |
| `POST` | `/create-account` | Create user account. |
| `POST` | `/create-organization-account` | Create organization account request. |
| `POST` | `/upload-image` | Authenticated profile image upload; updates current user's `profile_photo_url`. |
| `PUT` | `/accept-organization-request` | Accept an organization account request. |
| `POST` | `/signin` | Sign in user. |
| `POST` | `/verify-code` | Verify signup/signin code. |
| `POST` | `/forgot-password` | Send password reset code. |
| `POST` | `/reset-password` | Reset password. |
| `PUT` | `/change-role` | Change user role. |

### Patients: `/api/patients`

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/create-patient` | Create patient. |
| `GET` | `/get-patient` | List patients. |
| `GET` | `/get-patient/:id` | Get patient by ID. |
| `PUT` | `/update-patient/:id` | Update patient. |
| `DELETE` | `/delete-patient/:id` | Delete patient. |

### Tasks: `/api/tasks`

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/create-task` | Create task. |
| `GET` | `/get-task` | List tasks. |
| `GET` | `/get-task/:id` | Get task by ID. |
| `PUT` | `/update-task/:id` | Update task. |
| `PATCH` | `/complete-task/:id` | Mark task complete. |
| `PATCH` | `/reassign-task/:id` | Reassign task. |
| `DELETE` | `/delete-task/:id` | Delete task. |

### Wound Cases: `/api/wound-cases`

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/create-wound-case` | Create wound case. |
| `GET` | `/get-wound-case` | List wound cases. |
| `GET` | `/get-wound-case/:id` | Get wound case by ID. |
| `PUT` | `/update-wound-case/:id` | Update wound case. |
| `PATCH` | `/add-wound-update/:id` | Add wound update. |
| `GET` | `/get-timeline/:id` | Get wound timeline. |
| `GET` | `/get-images/:id` | Get wound images. |
| `PATCH` | `/add-wound-image/:id` | Upload/add wound image file or URL. |
| `DELETE` | `/delete-wound-image/:id/:imageId` | Delete image metadata. |
| `GET` | `/get-measurements/:id` | Get measurements. |
| `PATCH` | `/add-measurement/:id` | Add measurement. |
| `GET` | `/get-notes/:id` | Get clinical notes. |
| `PATCH` | `/add-note/:id` | Add clinical note. |
| `POST` | `/save-voice-dictation/:id` | Save voice dictation transcript and/or uploaded audio file. |
| `POST` | `/transcribe-voice-dictation/:id/:noteId?` | Transcribe uploaded or saved voice dictation audio and save transcript. |
| `POST` | `/generate-soap-note/:id` | Generate SOAP note placeholder. |
| `GET` | `/get-reports/:id` | Get reports. |
| `POST` | `/generate-report/:id` | Generate report metadata; uses AI report service when configured. |
| `POST` | `/generate-ai-report/:id` | Alias for AI-backed report generation. |
| `PATCH` | `/add-report/:id` | Add report metadata. |
| `GET` | `/preview-report/:id/:reportId` | Preview report data. |
| `GET` | `/download-report/:id/:reportId` | Generate/save report PDF and return download URL. |
| `PATCH` | `/share-report/:id/:reportId` | Share report. |
| `DELETE` | `/delete-wound-case/:id` | Delete wound case. |

### Dashboard: `/api/dashboard`

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/home` | Home dashboard. |
| `GET` | `/stats` | Dashboard stats. |
| `GET` | `/today-tasks` | Today's tasks. |
| `GET` | `/assigned-patients` | Assigned patients. |
| `GET` | `/recent-updates` | Recent wound/task updates. |

### Profile: `/api/profile`

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/get-profile/:id` | Get profile. |
| `PUT` | `/update-profile/:id` | Update profile. |
| `GET` | `/security-settings/:id` | Get security settings. |
| `PATCH` | `/change-password/:id` | Change password. |
| `PATCH` | `/sign-out-all-devices/:id` | Sign out all devices. |
| `GET` | `/notification-preferences/:id` | Get notification preferences. |
| `PATCH` | `/notification-preferences/:id` | Update notification preferences. |
| `GET` | `/app-settings/:id` | Get app settings. |
| `PATCH` | `/app-settings/:id` | Update app settings. |
| `POST` | `/patient-handoff/:id` | Simple patient handoff. |
| `POST` | `/sign-out/:id` | Sign out. |
| `DELETE` | `/delete-account/:id` | Delete account. |

### Nurse Handoffs: `/api/handoffs`

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/patients/:nurseId` | Selectable handoff patients. |
| `GET` | `/available-nurses/:nurseId` | Available receiving nurses. |
| `POST` | `/create` | Create handoff draft. |
| `GET` | `/get/:id` | Get handoff details. |
| `PATCH` | `/select-nurse/:id` | Select receiving nurse. |
| `PATCH` | `/notes/:id` | Add handoff notes. |
| `PATCH` | `/confirm/:id` | Confirm handoff. |
| `GET` | `/success/:id` | Handoff success summary. |

### Notifications: `/api/notifications`

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/get-notifications/:userId` | Get user notifications. |
| `GET` | `/get-notifications` | Get notifications using query params. |
| `POST` | `/create-notification` | Create notification. |
| `PATCH` | `/mark-read/:id` | Mark notification read. |
| `PATCH` | `/mark-all-read/:userId` | Mark all read. |
| `DELETE` | `/clear/:id` | Clear one notification. |
| `DELETE` | `/clear-all/:userId` | Clear all notifications. |

### Subscriptions: `/api/subscriptions`

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/plans` | List plans. |
| `GET` | `/plans/:planCode` | Get plan detail. |
| `POST` | `/checkout-session` | Create checkout session data. |
| `POST` | `/subscribe` | Create/update subscription. |
| `POST` | `/apple/verify` | Verify a StoreKit 2 signed transaction and update subscription. |
| `POST` | `/apple/restore` | Verify restored StoreKit 2 transactions and restore subscription. |
| `GET` | `/current/:userId` | Get current subscription. |
| `GET` | `/manage/:userId` | Get subscription management data. |
| `PATCH` | `/usage/:userId` | Update usage. |
| `PATCH` | `/cancel/:userId` | Cancel subscription. |

### Admin: `/api/admin`

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/login` | Admin login. |

### Doctor Auth: `/api/doctor/auth`

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/signup/personal-information` | Submit doctor personal info. |
| `POST` | `/signup/professional-credentials` | Submit professional credentials. |
| `POST` | `/signup/set-password` | Set account password. |
| `POST` | `/signin` | Doctor sign in. |
| `POST` | `/forgot-password` | Send reset OTP. |
| `POST` | `/verify-otp` | Verify OTP. |
| `POST` | `/reset-password` | Reset password. |

### Doctor Management: `/api/doctor`

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/home` | Doctor home dashboard. |
| `GET` | `/patients` | Doctor patient list. |
| `GET` | `/patients/:patientId` | Patient details. |
| `GET` | `/wound-cases/:woundCaseId` | Wound case details. |
| `POST` | `/wound-cases/:woundCaseId/instructions` | Add doctor instructions. |
| `PUT` | `/wound-cases/:woundCaseId/instructions/:instructionId` | Update instructions. |
| `DELETE` | `/wound-cases/:woundCaseId/instructions/:instructionId` | Delete instructions. |
| `PATCH` | `/tasks/:taskId/complete` | Mark doctor task complete. |

### Doctor Tasks: `/api/doctor/tasks`

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/dashboard` | Doctor task dashboard. |
| `GET` | `/options` | Create task dropdown options. |
| `GET` | `/` | List tasks. |
| `POST` | `/` | Create task. |
| `GET` | `/:taskId` | Task details. |
| `PUT` | `/:taskId` | Update task. |
| `PATCH` | `/:taskId/complete` | Complete task. |
| `GET` | `/:taskId/reassign-options` | Reassignment options. |
| `PATCH` | `/:taskId/reassign` | Reassign task. |
| `DELETE` | `/:taskId` | Delete task. |

### Doctor Wound Details: `/api/doctor/wound-details`

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/:woundCaseId/images` | Images tab. |
| `GET` | `/:woundCaseId/measurements` | Measurements tab. |
| `GET` | `/:woundCaseId/notes` | Notes tab. |
| `GET` | `/:woundCaseId/reports` | Reports tab. |
| `POST` | `/:woundCaseId/reports/generate` | Generate report metadata. |
| `GET` | `/:woundCaseId/reports/:reportId` | Report detail. |
| `POST` | `/:woundCaseId/reports/:reportId/share` | Share report. |

### Doctor Profile Settings: `/api/doctor/profile-settings`

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/:doctorId/profile` | Get profile. |
| `PUT` | `/:doctorId/profile` | Update profile. |
| `GET` | `/:doctorId/security` | Security settings. |
| `PATCH` | `/:doctorId/security/change-password` | Change password. |
| `PATCH` | `/:doctorId/security/sign-out-all-devices` | Sign out all devices. |
| `GET` | `/:doctorId/notifications` | Notification preferences. |
| `PATCH` | `/:doctorId/notifications` | Update notification preferences. |
| `GET` | `/:doctorId/app-settings` | App settings. |
| `PATCH` | `/:doctorId/app-settings` | Update app settings. |
| `GET` | `/:doctorId/handoff` | Handoff summary. |
| `POST` | `/:doctorId/handoff` | Initiate handoff. |
| `POST` | `/:doctorId/sign-out` | Sign out. |
| `DELETE` | `/:doctorId/delete-account` | Delete account. |

### Doctor Patient Handoff: `/api/doctor/patient-handoff`

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/:doctorId/patients` | Select patients. |
| `GET` | `/:doctorId/available-staff` | Select receiving staff. |
| `POST` | `/draft` | Create draft. |
| `GET` | `/:handoffId` | Handoff details/review. |
| `PATCH` | `/:handoffId/select-staff` | Select receiving staff. |
| `PATCH` | `/:handoffId/notes` | Add notes. |
| `PATCH` | `/:handoffId/confirm` | Confirm handoff. |
| `GET` | `/:handoffId/success` | Success summary. |

### Doctor Notifications: `/api/doctor/notifications`

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/:doctorId` | Get notifications. |
| `POST` | `/:doctorId` | Create notification. |
| `PATCH` | `/:doctorId/mark-all-read` | Mark all read. |
| `DELETE` | `/:doctorId/clear-all` | Clear all. |
| `PATCH` | `/:doctorId/:notificationId/read` | Mark one read. |
| `DELETE` | `/:doctorId/:notificationId` | Clear one. |

### Patient Auth: `/api/patient/auth`

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/signup/personal-information` | Submit patient personal info. |
| `POST` | `/signup/professional-credentials` | Submit patient professional/profile info. |
| `POST` | `/signup/professional-information` | Alias for professional credentials. |
| `POST` | `/signup/set-password` | Set password. |
| `POST` | `/signin` | Patient sign in. |
| `POST` | `/forgot-password` | Start password reset. |
| `POST` | `/reset-password` | Reset password. |

### Patient App: `/api/patient/app`

Requires patient bearer token.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/dashboard` | Patient dashboard. |
| `GET` | `/healing-progress` | Healing progress for default/latest wound. |
| `GET` | `/healing-progress/:woundCaseId` | Healing progress for wound case. |
| `GET` | `/reports` | Patient reports list. |
| `GET` | `/reports/:reportId` | Report details. |
| `GET` | `/reports/:reportId/download` | Report download URL/data. |
| `GET` | `/wound-profile/:woundCaseId` | Wound profile summary. |
| `GET` | `/wound-profile/:woundCaseId/timeline` | Wound timeline. |
| `GET` | `/wound-profile/:woundCaseId/images` | Images and before/after view. |
| `GET` | `/wound-profile/:woundCaseId/measurements` | Measurements. |
| `GET` | `/wound-profile/:woundCaseId/measures` | Alias for measurements. |
| `GET` | `/wound-profile/:woundCaseId/notes` | Clinical notes. |
| `GET` | `/wound-profile/:woundCaseId/reports` | Wound reports. |
| `GET` | `/wound-profile/:woundCaseId/reports/:reportId/preview` | PDF preview data. |
| `GET` | `/wound-profile/:woundCaseId/reports/:reportId/download` | Wound report download URL/data. |
| `POST` | `/wound-profile/:woundCaseId/reports/:reportId/share` | Share wound report. |
| `GET` | `/wound-profile/:woundCaseId/reports/:reportId` | Wound report details. |

### Patient Profile: `/api/patient/profile`

Requires patient bearer token.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/` | Get patient profile. |
| `GET` | `/edit-profile` | Get editable profile data. |
| `PATCH` | `/edit-profile` | Update profile. |
| `GET` | `/security-settings` | Security settings. |
| `PATCH` | `/change-password` | Change password. |
| `PATCH` | `/sign-out-all-devices` | Sign out all devices. |
| `GET` | `/notifications` | Notification preferences. |
| `PATCH` | `/notifications` | Update notification preferences. |
| `GET` | `/app-settings` | App settings. |
| `PATCH` | `/app-settings` | Update app settings. |
| `POST` | `/sign-out` | Sign out. |
| `DELETE` | `/delete-account` | Delete account. |

### Patient Notifications: `/api/patient/notifications`

Requires patient bearer token.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/` | Get notifications. |
| `POST` | `/` | Create notification. |
| `PATCH` | `/mark-all-read` | Mark all read. |
| `DELETE` | `/clear-all` | Clear all. |
| `PATCH` | `/:notificationId/read` | Mark one read. |
| `DELETE` | `/:notificationId` | Clear one. |

## 12. Database Models

### `users`

Purpose: Accounts for doctors, nurses, patients, admins, and super admins.

Important fields:

- Identity: `id`, `name`, `first_name`, `last_name`, `email`, `phone_number`, `profile_photo_url`.
- Organization/review: `organization_hospital`, `organization_code`, `request_accepted`, `request_status`, `reviewed_by`, `reviewed_at`, `rejection_reason`.
- Role: `role`.
- Profile: `shift`, `professional_title`.
- Auth: `password_hash`, `verification_code`, `verification_code_expires_at`, `verification_purpose`, `is_email_verified`, `last_login_at`, `auth_token`.
- Settings: `notification_preferences`, `app_settings`, `security_settings`, `active_sessions`.
- Status: `account_status`, `deleted_at`, `terms_accepted`, `terms_accepted_at`.

Enums:

```txt
role: doctor | nurse | patient | user | admin | super_admin
request_status: none | pending | accepted | rejected
verification_purpose: signup | signin | reset_password
account_status: active | signed_out | deactivated | deleted
```

### `patients`

Purpose: Patient demographic and assignment data.

Important fields:

- `id`, `nurse_id`, `first_name`, `last_name`, `date_of_birth`, `gender`, `mrn`, `address`, `room`, `wound_type`, `primary_staff`, `backup_staff`, `primary_diagnosis`, `allergies_notes`.

### `tasks`

Purpose: Task assignment and completion tracking.

Important fields:

- `id`, `title`, `description`, `task_type`, `priority`, `status`, `patient_id`, `wound_case`, `assigned_by`, `assigned_to`, `due_date`, `due_time`, `task_notes`, `work_notes`, `completed_at`.

Enums:

```txt
task_type: all | wound | documentation | follow_up | other
priority: low | medium | high
status: pending | completed | cancelled
```

### `wound_cases`

Purpose: Wound record and nested clinical data.

Important fields:

- `id`, `patient_id`, `wound_type`, `severity_stage`, `pain_score`, `body_location`, `wound_etiology`, `status`, `healing_progress`, `length_cm`, `width_cm`, `depth_cm`, `images`, `measurements`, `updates`, `clinical_notes`, `reports`, `notes`, `last_updated_at`.

Enums:

```txt
status: active | monitoring | healing | healed | closed
```

### `patient_handoffs`

Purpose: Shift/staff patient handoff records.

Important fields:

- `id`, `from_nurse_id`, `to_nurse_id`, `patient_ids`, `pending_task_ids`, `general_notes`, `per_patient_notes`, `shift_label`, `shift_ends_at`, `status`, `completed_at`, `summary`.

Enums:

```txt
status: draft | ready | completed | cancelled
```

### `notifications`

Purpose: User notifications with read/clear state.

Important fields:

- `id`, `user_id`, `type`, `title`, `message`, `action_label`, `action_url`, `metadata`, `read_at`, `cleared_at`.

Enums:

```txt
type: wound_update | doctor_instruction | new_task | patient_assigned | task_completed | task_reassigned | login_alert | report_generated | system
```

### `subscriptions`

Purpose: Plan, billing, subscription status, and usage.

Important fields:

- `id`, `user_id`, `plan_code`, `plan_name`, `billing_provider`, `provider_subscription_id`, `currency`, `amount`, `interval`, `status`, `usage`, `features`, `trial_ends_at`, `current_period_start`, `current_period_end`, `cancelled_at`, `metadata`.

Enums:

```txt
plan_code: free | basic | professional | organization
billing_provider: manual | apple_pay | google_pay | app_store
interval: forever | month
status: active | trialing | cancelled | expired
```

## 13. Database Relationships

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

## 14. Patient App Context Resolution

Patient app endpoints identify the patient record using one of these:

- `patient_id` query parameter.
- `patientId` query parameter.
- `mrn` query parameter.
- `req.user.app_settings.patient_profile.patient_id_mrn`.
- `req.user.app_settings.patient_profile.mrn`.

If no matching `patients` row is found, patient app endpoints return:

```json
{
  "message": "Patient profile not found. Make sure patient_id_mrn in users.app_settings matches patients.mrn"
}
```

## 15. File Uploads

The project supports local disk image uploads through Multer. Uploaded files are written under `uploads/` and are served publicly by Express at `/uploads`.

Runtime upload folders:

| Folder | Used By | Public URL Prefix |
| --- | --- | --- |
| `uploads/profile-photos/` | Auth profile image upload and account creation profile photos. | `/uploads/profile-photos/...` |
| `uploads/reports/` | Generated wound report PDFs. | `/uploads/reports/...` |
| `uploads/voice-dictations/` | Wound clinical note voice dictation audio files. | `/uploads/voice-dictations/...` |
| `uploads/wound-images/` | Wound case image upload. | `/uploads/wound-images/...` |

Profile photo uploads:

| Endpoint | Auth | Form-data File Keys | Max Size | Behavior |
| --- | --- | --- | --- | --- |
| `POST /api/auth/upload-image` | Bearer token required | `image`, `file`, `photo`, `profile_photo`, `profilePhoto` | 15 MB | Saves image and updates only `req.user.profile_photo_url`. |
| `POST /api/auth/create-account` | Public | Same keys | 15 MB | Optional image is saved and assigned to the newly created user's `profile_photo_url`. |
| `POST /api/auth/create-organization-account` | Public | Same keys | 15 MB | Optional image is saved and assigned to the newly created organization request user's `profile_photo_url`. |

Wound image uploads:

| Endpoint | Auth | Form-data File Keys | Limits | Behavior |
| --- | --- | --- | --- | --- |
| `PATCH /api/wound-cases/add-wound-image/:id` | Bearer token required, `nurse` role | `image`, `images`, `file`, `files`, `wound_image`, `wound_images` | 20 MB per file, up to 10 files | Saves image files and appends their public URLs/metadata to the wound case `images` JSON array. |

Voice dictation uploads:

| Endpoint | Auth | Form-data File Keys | Max Size | Behavior |
| --- | --- | --- | --- | --- |
| `POST /api/wound-cases/save-voice-dictation/:id` | Bearer token required, `nurse` role | `audio`, `voice`, `file`, `voice_file`, `voiceFile`, `audio_file`, `audioFile` | 25 MB | Saves an audio file and/or transcript as a `voice` clinical note. |
| `POST /api/wound-cases/transcribe-voice-dictation/:id/:noteId?` | Bearer token required, `nurse` role | Same keys when uploading a new file | 25 MB | Sends uploaded audio, or an existing local note audio file when `noteId` is provided, to the configured Whisper service and saves the returned text as a `voice` clinical note. |

Report PDF generation:

| Endpoint | Auth | Behavior |
| --- | --- | --- |
| `GET /api/wound-cases/download-report/:id/:reportId` | Bearer token required, `nurse` role | Builds a PDF from wound case/report data, saves it under `uploads/reports/`, updates the report metadata with `url`, `file_url`, `file_path`, `file_size`, and returns `download_url`. |

AI report generation:

| Endpoint | Auth | Behavior |
| --- | --- | --- |
| `POST /api/wound-cases/generate-report/:id` | Bearer token required, `nurse` role | Sends structured wound case data to OpenAI, saves the AI summary/report data, and requires `OPENAI_API_KEY`. |
| `POST /api/wound-cases/generate-ai-report/:id` | Bearer token required, `nurse` role | Alias for the same AI-backed report generation behavior. |

All upload middleware rejects non-image MIME types. Upload URLs use the current request host, for example:

```txt
http://localhost:3000/uploads/profile-photos/filename.jpg
http://localhost:3000/uploads/reports/filename.pdf
http://localhost:3000/uploads/voice-dictations/filename.m4a
http://localhost:3000/uploads/wound-images/filename.jpg
```

The `uploads/` directory is ignored by git. Production deployments should replace local disk uploads with durable object storage if files need to survive server replacement.

## 16. Postman

Postman files are stored in `postman/`.

| File | Purpose |
| --- | --- |
| `AI-Enabled-Wound-APIs.postman_collection.json` | Main API collection. |
| `AI-Enabled-Wound-APIs.postman_environment.json` | Main API environment. |
| `AI-Enabled-Wound-Doctor-APIs.postman_collection.json` | Doctor API collection. |
| `AI-Enabled-Wound-Doctor-APIs.postman_environment.json` | Doctor API environment. |
| `README.md` | Postman usage notes. |

## 17. Migrations

Migration/support SQL files:

| File | Purpose |
| --- | --- |
| `migrations/20260630_admin_cms_user_review_fields.sql` | Admin CMS/user review fields. |
| `migrations/20260701_sync_app_tables.sql` | Sync application tables. |

The app also uses `sequelize.sync()`. In production, prefer explicit migrations over automatic schema alteration.

## 18. Detailed API Reference

For full request and response examples, see:

```txt
docs/API_REFERENCE.md
```

This project documentation is a high-level single-file guide. The API reference contains longer example payloads and response bodies.

## 19. Known Limitations and Production Notes

- Some legacy/common routes are still not protected by authentication middleware.
- Full role-based access control is not consistently enforced across every route group.
- SOAP note generation is placeholder/rule-based logic, not a real AI service integration yet.
- Wound report PDFs are generated locally; doctor/patient report endpoints still mostly return metadata/URLs and should be aligned if binary PDF behavior is required there too.
- Profile photo, wound image, voice dictation, and wound report PDF storage use local disk.
- Local uploaded files are not backed by cloud/object storage and may be lost if the runtime filesystem is replaced.
- Automatic notification creation is not wired for every business event.
- `npm test` is a placeholder and there is no automated test suite yet.
- `sequelize.sync({ alter: true })` can change schema at runtime; use carefully outside local development.
- The custom token implementation is JWT-like but not using a standard JWT library.

## 20. Recommended Next Improvements

- Apply `authenticateToken` and `requireRoles` consistently to all protected routes.
- Add integration tests for auth, patient app, wound cases, reports, notifications, and subscriptions.
- Replace placeholder SOAP/report generation with the final AI/PDF services.
- Move image/audio/report uploads to durable storage.
- Add migration-based deployment workflow.
- Add API versioning, for example `/api/v1/...`.
- Add request validation middleware for payloads and query params.
