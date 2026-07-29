# Authentication: Signup and Signin API

Base URL:

```text
/api/auth
```

The signup endpoints register the user's FCM token. The signin endpoint only
authenticates the user and does not create, replace, or remove any stored FCM
token.

Both `snake_case` and the documented `camelCase` aliases are accepted for the
fields that show an alias below.

## 1. Create Account

Creates a doctor, nurse, or patient account without attaching it to an
organization.

```http
POST /api/auth/create-account
Content-Type: application/json
```

### Request body

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `first_name` (`firstName`) | string | Yes | User's first name. |
| `last_name` (`lastName`) | string | Yes | User's last name. |
| `email` | string | Yes | Must be a valid and unique email address. It is normalized to lowercase. |
| `phone_number` (`phoneNumber`) | string | Yes | User's phone number. |
| `role` | string | Yes | One of `doctor`, `nurse`, or `patient`. |
| `password` | string | Yes | Minimum 8 characters. |
| `confirm_password` (`confirmPassword`) | string | Yes | Must exactly match `password`. |
| `terms_accepted` (`termsAccepted`) | boolean/string | Yes | Accepted values include `true`, `1`, `"true"`, and `"1"`. |
| `profile_photo_url` (`profilePhotoUrl`) | string | No | Existing profile-photo URL. |
| `fcm_token` (`fcmToken`) | string | No | FCM registration token obtained from the client Firebase SDK. |
| `fcm_platform` (`fcmPlatform`) | string | No | One of `android`, `ios`, or `web`. Saved when `fcm_token` is supplied. |

The endpoint also accepts `multipart/form-data`. A profile image can be sent
using `image`, `file`, `photo`, `profile_photo`, or `profilePhoto`. Uploaded
images take priority over `profile_photo_url`; the maximum file size is 15 MB.

### Example

```json
{
  "first_name": "Ali",
  "last_name": "Khan",
  "email": "ali@example.com",
  "phone_number": "+923001234567",
  "role": "nurse",
  "password": "password123",
  "confirm_password": "password123",
  "terms_accepted": true,
  "fcm_token": "token-from-firebase-client-sdk",
  "fcm_platform": "android"
}
```

### Success response

Status: `201 Created`

```json
{
  "message": "Account created successfully. Verification code sent to email",
  "email": "ali@example.com",
  "next_step": "verify-code",
  "user": {
    "id": 15,
    "organization_id": null,
    "name": "Ali Khan",
    "first_name": "Ali",
    "last_name": "Khan",
    "email": "ali@example.com",
    "phone_number": "+923001234567",
    "profile_photo_url": null,
    "role": "nurse",
    "is_email_verified": false
  }
}
```

The FCM token is stored in the database but is intentionally not returned in
the public user response.

## 2. Create Organization Account

Creates an account request linked to an existing organization/hospital.

```http
POST /api/auth/create-organization-account
Content-Type: application/json
```

### Request body

This endpoint accepts all fields from `create-account`, plus:

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `organization_hospital` (`organizationHospital`) | string | Yes | The aliases `organization` and `hospital` are also accepted. |
| `organization_code` (`organizationCode`) | string | Yes | Must resolve to an existing organization. |

### Example

```json
{
  "first_name": "Sara",
  "last_name": "Ahmed",
  "email": "sara@example.com",
  "phone_number": "+923009876543",
  "organization_hospital": "City Hospital",
  "organization_code": "CITY-001",
  "role": "doctor",
  "password": "password123",
  "confirm_password": "password123",
  "terms_accepted": true,
  "fcm_token": "token-from-firebase-client-sdk",
  "fcm_platform": "ios"
}
```

### Success response

Status: `201 Created`

```json
{
  "message": "Account request submitted successfully. Verification code sent to email",
  "email": "sara@example.com",
  "next_step": "verify-code",
  "user": {
    "id": 16,
    "organization_id": 3,
    "name": "Sara Ahmed",
    "first_name": "Sara",
    "last_name": "Ahmed",
    "email": "sara@example.com",
    "phone_number": "+923009876543",
    "profile_photo_url": null,
    "role": "doctor",
    "is_email_verified": false,
    "organization_hospital": "City Hospital",
    "organization_code": "CITY-001",
    "request_accepted": false,
    "request_status": "pending"
  }
}
```

The account cannot sign in until its request status is accepted.

## 3. Signin

Authenticates an accepted, active account and returns its bearer token.

```http
POST /api/auth/signin
Content-Type: application/json
```

### Request body

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `email` | string | Yes | Email is normalized to lowercase. |
| `password` | string | Yes | Account password. |

### Example

```json
{
  "email": "ali@example.com",
  "password": "password123"
}
```

`fcm_token` and `fcm_platform` are not needed during signin. If a client sends
them, the signin handler ignores them and does not change the stored FCM data.

### Success response

Status: `200 OK`

```json
{
  "message": "Login successful",
  "token": "<bearer-token>",
  "user": {
    "id": 15,
    "organization_id": null,
    "name": "Ali Khan",
    "first_name": "Ali",
    "last_name": "Khan",
    "email": "ali@example.com",
    "phone_number": "+923001234567",
    "profile_photo_url": null,
    "role": "nurse",
    "is_email_verified": true
  }
}
```

Use the returned token on protected endpoints:

```http
Authorization: Bearer <bearer-token>
```

## Validation and error responses

| Status | When returned |
| --- | --- |
| `400 Bad Request` | Required input is missing, email is invalid, password is too short/mismatched, terms are not accepted, role is invalid, or FCM platform is invalid during signup. |
| `401 Unauthorized` | Signin password is incorrect. |
| `403 Forbidden` | Account request is not accepted, or the account is deactivated/deleted. |
| `404 Not Found` | Signin user is missing, or the selected organization cannot be resolved. |
| `409 Conflict` | Signup email already exists. |
| `500 Internal Server Error` | An unexpected database, email, or server error occurs. |

Error responses use this shape:

```json
{
  "message": "Human-readable error message"
}
```

Unexpected server errors may also include an `error` field.

## FCM token lifecycle

- Initial token registration: send the token with either signup endpoint.
- Token refresh/rotation: call `PUT /api/auth/fcm-token` with a bearer token.
- Token removal/logout: call `DELETE /api/auth/fcm-token` with a bearer token.
- Signin never changes FCM token data.
