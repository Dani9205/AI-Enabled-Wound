# Sign-in and Create Notification APIs

This document describes the current sign-in endpoint and all notification-creation endpoints in the AI-Enabled Wound APIs project.

## Base URL

```text
http://localhost:3000
```

Use the deployed API host instead of `localhost:3000` in staging or production.

## Endpoint summary

| API | Method | Endpoint | Authentication |
|---|---|---|---|
| Sign in | `POST` | `/api/auth/signin` | Not required |
| Create notification for any user | `POST` | `/api/notifications/create-notification` | Not currently required |
| Create doctor notification | `POST` | `/api/doctor/notifications/:doctorId` | Not currently required |
| Create notification for signed-in patient | `POST` | `/api/patient/notifications` | Bearer token; patient role required |

## 1. Sign in

Authenticates a doctor, nurse, or patient and returns a JWT access token.

### Request

```http
POST /api/auth/signin
Content-Type: application/json
```

### Request body

| Field | Type | Required | Description |
|---|---|---:|---|
| `email` | string | Yes | User email. It is trimmed and converted to lowercase. |
| `role` | string | Yes | Account role to sign in as: `doctor`, `nurse`, or `patient`. |
| `account_type` / `accountType` | string | Yes | `individual` or `organizational`; selects the account type to sign in as. |
| `password` | string | Yes | User password. |
| `fcm_token` / `fcmToken` | string | No | FCM registration token for the current app installation. |
| `fcm_platform` / `fcmPlatform` | string | No | One of `android`, `ios`, or `web`. Defaults to `android` when an FCM token is supplied without a platform. |

### Example request

```json
{
  "email": "doctor@example.com",
  "role": "doctor",
  "account_type": "organizational",
  "password": "password123",
  "fcm_token": "device-fcm-registration-token",
  "fcm_platform": "android"
}
```

The FCM fields may be omitted when the client does not yet have a token:

```json
{
  "email": "doctor@example.com",
  "role": "doctor",
  "account_type": "organizational",
  "password": "password123"
}
```

### Success response

Status: `200 OK`

```json
{
  "message": "Login successful",
  "token": "jwt-access-token",
  "user": {
    "id": 12,
    "organization_id": 3,
    "name": "Dr. Ali Khan",
    "first_name": "Ali",
    "last_name": "Khan",
    "email": "doctor@example.com",
    "phone_number": "+923001234567",
    "profile_photo_url": null,
    "role": "doctor",
    "is_email_verified": true
  }
}
```

Use the returned JWT in protected endpoints:

```http
Authorization: Bearer <jwt-access-token>
```

### Error responses

#### Missing email, role, account type, or password

Status: `400 Bad Request`

```json
{
  "message": "Email, role, account type and password are required"
}
```

#### Invalid FCM platform

Status: `400 Bad Request`

```json
{
  "message": "fcm_platform must be one of: android, ios, web"
}
```

#### User not found

Status: `404 Not Found`

```json
{
  "message": "User not found"
}
```

#### Incorrect password

Status: `401 Unauthorized`

```json
{
  "message": "Invalid email or password"
}
```

#### Account request not accepted

Status: `403 Forbidden`

```json
{
  "message": "Your account request is pending admin approval",
  "request_status": "pending"
}
```

The message varies for `pending`, `suspended`, and other non-accepted request states.

#### Inactive account

Status: `403 Forbidden`

```json
{
  "message": "User account is not active"
}
```

#### Server error

Status: `500 Internal Server Error`

```json
{
  "message": "Signin failed",
  "error": "Error details"
}
```

### Sign-in processing

On successful sign-in, the API:

1. Verifies the email and password.
2. Confirms that `request_status` is `accepted`.
3. Rejects accounts whose `account_status` is `deactivated` or `deleted`.
4. Updates `last_login_at` and sets `account_status` to `active`.
5. Attempts to register the supplied FCM token, if present.
6. Creates and stores a JWT in `auth_token`.
7. Returns the JWT and public user data.

### Current implementation warning

The current `signin` implementation calls `registerPushToken(...)` when `fcm_token` is supplied, but that helper is not defined or imported in `authController.js`. Until it is implemented, a sign-in request containing `fcm_token` can return `500`. A sign-in request without `fcm_token` is not affected.

The authenticated token endpoint can be used after sign-in:

```http
PUT /api/auth/fcm-token
Authorization: Bearer <jwt-access-token>
Content-Type: application/json

{
  "fcm_token": "device-fcm-registration-token",
  "fcm_platform": "android"
}
```

## 2. Notification payload

All three notification-creation APIs support these notification types:

```text
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

### Common fields

| Field | Type | Required | Description |
|---|---|---:|---|
| `type` | string | No | Notification type. Defaults to `system`. |
| `title` | string | Yes | Notification title, maximum 150 characters at the model level. |
| `message` | string | No | Notification body text. |
| `action_label` / `actionLabel` | string | No | Text shown for the notification action. |
| `action_url` / `actionUrl` | string | No | Route or URL opened when the notification is selected. |
| `metadata` | object or JSON string | No | Extra identifiers such as `task_id`, `patient_id`, `wound_case_id`, or `report_id`. Invalid JSON is converted to an empty object. |

## 3. Create notification for any user

Creates a notification for the supplied user ID.

### Request

```http
POST /api/notifications/create-notification
Content-Type: application/json
```

This route does not currently apply authentication middleware.

### Request body

The common notification fields are accepted, plus:

| Field | Type | Required | Description |
|---|---|---:|---|
| `user_id` / `userId` | positive integer | Yes | Recipient user ID. |

### Example request

```json
{
  "user_id": 12,
  "type": "new_task",
  "title": "New wound-care task",
  "message": "A dressing-change task has been assigned to you.",
  "action_label": "View Task",
  "action_url": "/tasks/245",
  "metadata": {
    "task_id": 245,
    "wound_case_id": 81
  }
}
```

### Success response

Status: `201 Created`

```json
{
  "message": "Notification created successfully",
  "notification": {
    "id": 901,
    "user_id": 12,
    "type": "new_task",
    "title": "New wound-care task",
    "message": "A dressing-change task has been assigned to you.",
    "action_label": "View Task",
    "action_url": "/tasks/245",
    "metadata": {
      "task_id": 245,
      "wound_case_id": 81
    },
    "is_read": false,
    "read_at": null,
    "cleared_at": null,
    "time_ago": "Just now",
    "created_at": "2026-08-04T10:00:00.000Z",
    "updated_at": "2026-08-04T10:00:00.000Z"
  }
}
```

### Error responses

| Status | Message or reason |
|---:|---|
| `400` | `user_id is required` |
| `400` | `title is required` |
| `400` | Invalid `type`; response lists all allowed types. |
| `404` | `User not found` |
| `500` | `Notification creation failed` with an `error` field. |

## 4. Create doctor notification

Creates a notification for a user whose role is `doctor`.

### Request

```http
POST /api/doctor/notifications/:doctorId
Content-Type: application/json
```

This route does not currently apply authentication middleware.

### Path parameter

| Parameter | Type | Required | Description |
|---|---|---:|---|
| `doctorId` | positive integer | Yes | Recipient doctor's user ID. The user must have the `doctor` role. |

### Example request

```http
POST /api/doctor/notifications/12
Content-Type: application/json
```

```json
{
  "type": "patient_assigned",
  "title": "Patient assigned",
  "message": "A new patient has been assigned to you.",
  "metadata": {
    "patient_id": 77
  }
}
```

### Success response

Status: `201 Created`

```json
{
  "message": "Doctor notification created successfully",
  "notification": {
    "id": 902,
    "user_id": 12,
    "type": "patient_assigned",
    "title": "Patient assigned",
    "message": "A new patient has been assigned to you.",
    "metadata": {
      "patient_id": 77
    },
    "is_read": false,
    "read_at": null,
    "time_ago": "Just now",
    "section": "Today",
    "action": {
      "label": "Open Patient",
      "url": "/doctor/patients/77"
    },
    "created_at": "2026-08-04T10:00:00.000Z",
    "updated_at": "2026-08-04T10:00:00.000Z"
  },
  "counts": {
    "all": 10,
    "unread": 4,
    "read": 6
  }
}
```

### Error responses

| Status | Message or reason |
|---:|---|
| `400` | `doctor_id is required` |
| `400` | `title is required` |
| `400` | Invalid `type`; response lists all allowed types. |
| `404` | `Doctor not found` when the user does not exist or does not have the `doctor` role. |
| `500` | `Doctor notification creation failed` with an `error` field. |

## 5. Create signed-in patient notification

Creates a notification for the currently authenticated patient. The recipient is always `req.user.id`; the client cannot select another `user_id` through this endpoint.

### Request

```http
POST /api/patient/notifications
Authorization: Bearer <patient-jwt-access-token>
Content-Type: application/json
```

### Example request

```json
{
  "type": "doctor_instruction",
  "title": "New doctor instruction",
  "message": "Please replace the dressing before bedtime.",
  "metadata": {
    "wound_case_id": 81
  }
}
```

Do not send `user_id`; the API uses the authenticated patient's ID.

### Success response

Status: `201 Created`

```json
{
  "message": "Patient notification created successfully",
  "notification": {
    "id": 903,
    "user_id": 45,
    "type": "doctor_instruction",
    "title": "New doctor instruction",
    "message": "Please replace the dressing before bedtime.",
    "metadata": {
      "wound_case_id": 81
    },
    "is_read": false,
    "read_at": null,
    "cleared_at": null,
    "time_ago": "Just now",
    "section": "Today",
    "action": {
      "label": "View Instructions",
      "url": "/patient/wound-profile/81/notes"
    },
    "created_at": "2026-08-04T10:00:00.000Z",
    "updated_at": "2026-08-04T10:00:00.000Z"
  },
  "counts": {
    "all": 5,
    "unread": 2,
    "read": 3
  }
}
```

### Error responses

| Status | Message or reason |
|---:|---|
| `400` | `title is required` |
| `400` | Invalid `type`; response lists all allowed types. |
| `401` | Missing, invalid, or expired JWT. |
| `403` | Authenticated user does not have the `patient` role. |
| `500` | `Patient notification creation failed` with an `error` field. |

## 6. Automatic push-notification behavior

Every successful `Notification.create(...)` triggers the notification model's `afterCreate` hook.

The hook performs this flow:

1. Reads the notification recipient from `notification.user_id`.
2. Looks up the recipient in the `users` table.
3. Checks the user's `fcm_token`.
4. Sends the saved title, message, type, action URL, notification ID, and metadata through Firebase when a token exists.
5. Skips push delivery when the user has no FCM token or Firebase is not configured.
6. Clears invalid FCM tokens from the user record.

Push delivery does not control database creation. The notification remains saved if push delivery is skipped or fails. The create-notification API response currently returns the saved notification but does not include a separate push status.

## 7. cURL examples

### Sign in

```bash
curl --request POST "http://localhost:3000/api/auth/signin" \
  --header "Content-Type: application/json" \
  --data '{
    "email": "doctor@example.com",
    "password": "password123"
  }'
```

### Create notification for any user

```bash
curl --request POST "http://localhost:3000/api/notifications/create-notification" \
  --header "Content-Type: application/json" \
  --data '{
    "user_id": 12,
    "type": "new_task",
    "title": "New task",
    "message": "A task has been assigned.",
    "metadata": {"task_id": 245}
  }'
```

### Create doctor notification

```bash
curl --request POST "http://localhost:3000/api/doctor/notifications/12" \
  --header "Content-Type: application/json" \
  --data '{
    "type": "patient_assigned",
    "title": "Patient assigned",
    "message": "A new patient has been assigned.",
    "metadata": {"patient_id": 77}
  }'
```

### Create signed-in patient notification

```bash
curl --request POST "http://localhost:3000/api/patient/notifications" \
  --header "Authorization: Bearer <patient-jwt-access-token>" \
  --header "Content-Type: application/json" \
  --data '{
    "type": "doctor_instruction",
    "title": "New instruction",
    "message": "Please replace the dressing before bedtime.",
    "metadata": {"wound_case_id": 81}
  }'
```

## 8. Security notes

- `/api/notifications/create-notification` and `/api/doctor/notifications/:doctorId` currently have no authentication middleware. They should be protected before production deployment.
- Never return or log passwords, password hashes, JWT signing secrets, Firebase service-account private keys, or full FCM registration tokens.
- Validate that the caller is allowed to notify the requested recipient when authorization is added.
