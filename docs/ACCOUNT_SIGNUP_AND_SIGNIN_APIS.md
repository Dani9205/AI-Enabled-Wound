# Account Signup APIs

Base URL examples use `http://localhost:3000`.

All signup APIs are public. Passwords are stored as hashes. Signup creates a verification code and sends it by email where the controller calls the signup-code helper.

## Shared FCM Fields

Signup APIs that create the final user record can accept the current device FCM token:

| Field | Type | Required | Notes |
|---|---|---:|---|
| `fcm_token` / `fcmToken` | string | No | Firebase Cloud Messaging registration token. |
| `fcm_platform` / `fcmPlatform` | string | No | `android`, `ios`, or `web`. Defaults to `android` when an FCM token is supplied without a platform. |

The token is saved in `users.fcm_token`, `users.fcm_platform`, and `users.fcm_token_updated_at`.

## 1. Common Individual Signup

Creates an individual `doctor`, `nurse`, or `patient` account.

```http
POST /api/auth/create-account
Content-Type: multipart/form-data
```

JSON bodies also work when no image file is uploaded.

Required fields:

| Field | Aliases | Notes |
|---|---|---|
| `first_name` | `firstName` | First name. |
| `last_name` | `lastName` | Last name. |
| `email` | - | Valid email address. |
| `phone_number` | `phoneNumber` | Phone number. |
| `role` | - | `doctor`, `nurse`, or `patient`. |
| `password` | - | Minimum 8 characters. |
| `confirm_password` | `confirmPassword` | Must match `password`. |
| `terms_accepted` | `termsAccepted` | Must be truthy. |

Optional fields:

| Field | Aliases | Notes |
|---|---|---|
| `profile_photo` | file upload | Uploaded by `profilePhotoUpload` middleware. |
| `profile_photo_url` | `profilePhotoUrl` | Used when no file is uploaded. |
| `fcm_token` | `fcmToken` | Current device FCM token. |
| `fcm_platform` | `fcmPlatform` | `android`, `ios`, or `web`. |

Example:

```json
{
  "first_name": "Ayesha",
  "last_name": "Khan",
  "email": "ayesha@example.com",
  "phone_number": "+923001234567",
  "role": "nurse",
  "password": "password123",
  "confirm_password": "password123",
  "terms_accepted": true,
  "fcm_token": "device-registration-token",
  "fcm_platform": "android"
}
```

Success response: `201 Created`

```json
{
  "message": "Account created successfully. Verification code sent to email",
  "email": "ayesha@example.com",
  "user_id": 1,
  "role": "nurse",
  "account_type": "individual",
  "next_step": "verify-code",
  "user": {}
}
```

## 2. Common Organization Signup

Creates an organization-linked `doctor`, `nurse`, or `patient` account request.

```http
POST /api/auth/create-organization-account
Content-Type: multipart/form-data
```

Required fields are the same as common individual signup, plus:

| Field | Aliases | Notes |
|---|---|---|
| `organization_hospital` | `organizationHospital`, `organization`, `hospital` | Organization/hospital name. |
| `organization_code` | `organizationCode` | Must resolve to an existing organization. |

Optional fields are the same as common individual signup, including FCM fields.

Example:

```json
{
  "first_name": "Bilal",
  "last_name": "Ahmed",
  "email": "bilal@example.com",
  "phone_number": "+923001234567",
  "organization_hospital": "City Hospital",
  "organization_code": "CITY-001",
  "role": "doctor",
  "password": "password123",
  "confirm_password": "password123",
  "terms_accepted": true,
  "fcmToken": "device-registration-token",
  "fcmPlatform": "ios"
}
```

Success response: `201 Created`

```json
{
  "message": "Nurse account request submitted successfully. Verification code sent to email",
  "next_step": "verify-code",
  "email": "bilal@example.com",
  "user_id": 2,
  "role": "doctor",
  "account_type": "organizational",
  "user": {}
}
```

## 3. Doctor Signup: Personal Information

Validates and echoes the doctor's personal-information step. It does not create the user record.

```http
POST /api/doctor/auth/signup/personal-information
Content-Type: application/json
```

Required fields:

| Field | Aliases | Notes |
|---|---|---|
| `first_name` | `firstName` | First name. |
| `last_name` | `lastName` | Last name. |
| `email` | `work_email`, `workEmail` | Valid work email. |
| `phone_number` | `phoneNumber` | Phone number. |
| `gender` | - | `male`, `female`, or `other`. |

Optional fields: `date_of_birth` / `dateOfBirth`, `profile_photo_url` / `profilePhotoUrl`.

Success response: `200 OK`, with `next_step: "professional-credentials"`.

## 4. Doctor Signup: Professional Credentials

Validates professional details and resolves the organization. It does not create the user record.

```http
POST /api/doctor/auth/signup/professional-credentials
Content-Type: application/json
```

Required fields:

| Field | Aliases | Notes |
|---|---|---|
| `organization_hospital` | `organizationHospital`, `hospital_organization`, `hospital`, `hospital_institution`, `hospitalInstitution` | Organization/hospital name. |
| `doctor_license_number` | `doctorLicenseNumber`, `medical_license_number`, `medicalLicenseNumber`, `doctor_id`, `doctorId` | Doctor ID/license. |
| `title_designation` | `titleDesignation`, `professional_title`, `professionalTitle` | `md`, `mbbs`, or `resident`. |
| `specializations` | `specialization` | Array or comma-separated string; at least one required. |

Optional field: `organization_id` / `organizationId`, `organization_code` / `organizationCode`.

Success response: `200 OK`, with `next_step: "set-password"` and normalized `professional_details`.

## 5. Doctor Signup: Set Password

Combines personal information, professional credentials, password, terms, and optional FCM fields, then creates the doctor user.

```http
POST /api/doctor/auth/signup/set-password
Content-Type: application/json
```

Required fields:

| Field | Notes |
|---|---|
| All required personal-information fields | Can be sent at top level or inside `personal_information` / `personalInformation`. |
| All required professional-credentials fields | Can be sent at top level or inside `professional_details`, `professionalDetails`, `professional_information`, or `professionalInformation`. |
| `organization_id` / `organizationId` | Required by the final doctor signup step. |
| `password` | Minimum 8 characters. |
| `confirm_password` / `confirmPassword` | Must match `password`. |
| `terms_accepted` / `termsAccepted` | Must be truthy. |

Optional FCM fields: `fcm_token` / `fcmToken`, `fcm_platform` / `fcmPlatform`.

Example:

```json
{
  "personal_information": {
    "first_name": "Sara",
    "last_name": "Malik",
    "work_email": "sara.doctor@example.com",
    "phone_number": "+923001234567",
    "gender": "female"
  },
  "professional_details": {
    "organization_id": 1,
    "organization_hospital": "City Hospital",
    "doctor_license_number": "DOC-123",
    "title_designation": "md",
    "specializations": ["wound care"]
  },
  "password": "password123",
  "confirm_password": "password123",
  "terms_accepted": true,
  "fcm_token": "device-registration-token",
  "fcm_platform": "android"
}
```

Success response: `201 Created`, with `next_step: "verify-code"`.

## 6. Patient Signup: Personal Information

Validates and echoes the patient's personal-information step. It does not create the user record.

```http
POST /api/patient/auth/signup/personal-information
Content-Type: application/json
```

Required fields:

| Field | Aliases | Notes |
|---|---|---|
| `first_name` | `firstName` | First name. |
| `last_name` | `lastName` | Last name. |
| `email` | - | Valid email. |
| `phone_number` | `phoneNumber` | Phone number. |
| `gender` | - | `male`, `female`, or `other`. |

Optional fields: `date_of_birth` / `dateOfBirth`, `profile_photo_url` / `profilePhotoUrl`.

Success response: `200 OK`, with `next_step: "professional-credentials"`.

## 7. Patient Signup: Professional Credentials

Validates patient hospital/profile information. It does not create the user record.

```http
POST /api/patient/auth/signup/professional-credentials
POST /api/patient/auth/signup/professional-information
Content-Type: application/json
```

Required fields:

| Field | Aliases | Notes |
|---|---|---|
| `hospital_institution` | `hospitalInstitution`, `hospital`, `organization_hospital`, `organizationHospital` | Hospital/institution name. |
| `patient_id_mrn` | `patientIdMrn`, `patient_id`, `patientId`, `mrn` | Patient ID/MRN. |

Optional field: `organization_code` / `organizationCode`.

Success response: `200 OK`, with `next_step: "set-password"`.

## 8. Patient Signup: Set Password

Combines personal information, patient professional/profile information, password, terms, and optional FCM fields, then creates the patient user.

```http
POST /api/patient/auth/signup/set-password
Content-Type: application/json
```

Required fields:

| Field | Notes |
|---|---|
| All required personal-information fields | Can be sent at top level or inside `personal_information` / `personalInformation`. |
| All required professional-credentials fields | Can be sent at top level or inside `professional_details`, `professionalDetails`, `professional_information`, or `professionalInformation`. |
| `password` | Minimum 8 characters. |
| `confirm_password` / `confirmPassword` | Must match `password`. |
| `terms_accepted` / `termsAccepted` | Must be truthy. |

Optional FCM fields: `fcm_token` / `fcmToken`, `fcm_platform` / `fcmPlatform`.

Example:

```json
{
  "personalInformation": {
    "firstName": "Ali",
    "lastName": "Raza",
    "email": "ali.patient@example.com",
    "phoneNumber": "+923001234567",
    "gender": "male"
  },
  "professionalInformation": {
    "hospitalInstitution": "City Hospital",
    "organizationCode": "CITY-001",
    "patientIdMrn": "MRN-789"
  },
  "password": "password123",
  "confirmPassword": "password123",
  "termsAccepted": true,
  "fcmToken": "device-registration-token",
  "fcmPlatform": "web"
}
```

Success response: `201 Created`, with `next_step: "verify-code"`.

## Verification After Signup

Common signup and the dedicated doctor/patient final signup steps send a signup code by email. Verify it with:

```http
POST /api/auth/verify-code
Content-Type: application/json
```

```json
{
  "email": "user@example.com",
  "role": "nurse",
  "code": "123456"
}
```

After signup verification, the user request moves to review/pending state where applicable. Sign-in requires `request_status` to be `accepted`.

## Common Error Responses

| Status | Reason |
|---:|---|
| `400` | Missing required field, invalid email, invalid role, invalid password confirmation, invalid terms value, invalid gender/title, or invalid FCM platform. |
| `404` | Organization could not be resolved. |
| `409` | Duplicate account for the same email, role, and account type. |
| `500` | Server-side signup failure. |
