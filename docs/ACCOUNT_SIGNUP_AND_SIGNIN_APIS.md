# Account Signup and Sign-in APIs

## Base URL

```text
http://localhost:3000
```

Replace this URL with the deployed API host in staging or production.

## Account Classification

The application does not store an `account_type` column. It derives the account type from organization fields:

| Account type | How it is identified |
|---|---|
| `individual` | `organization_hospital` and `organization_code` are empty or null. |
| `organizational` | `organization_hospital` or `organization_code` is present. |

The common sign-in API requires `account_type` so it can select the correct record. The creation endpoint determines the type itself: `/create-account` creates an individual account and `/create-organization-account` creates an organizational account.

The controller prevents a duplicate of the same email, role, and derived account type. The live `users.email` unique database index must be removed before the database can store more than one record with the same email address.

## 1. Common Auth APIs

All three endpoints are public. `create-account` and `create-organization-account` also accept a profile-image upload through the configured `uploadProfilePhoto` middleware.

### `POST /api/auth/create-account`

Creates an individual doctor, nurse, or patient account. It stores no organization name or code.

Required fields: `first_name`/`firstName`, `last_name`/`lastName`, `email`, `phone_number`/`phoneNumber`, `role`, `password`, `confirm_password`/`confirmPassword`, and `terms_accepted`/`termsAccepted`.

Optional fields: `profile_photo_url`/`profilePhotoUrl`, `fcm_token`/`fcmToken`, and `fcm_platform`/`fcmPlatform`.

Allowed roles are `doctor`, `nurse`, and `patient`. Allowed FCM platforms are `android`, `ios`, and `web`. Passwords must be at least eight characters.

```json
{
  "first_name": "Ayesha",
  "last_name": "Khan",
  "email": "ayesha@example.com",
  "phone_number": "+923001234567",
  "role": "nurse",
  "password": "Password123!",
  "confirm_password": "Password123!",
  "terms_accepted": true
}
```

On success, the API creates the account with `request_status: pending`, generates a six-digit signup code, saves its 10-minute expiry, emails the code, and returns `201 Created` with `next_step: verify-code`.

### `POST /api/auth/create-organization-account`

Creates an organizational doctor, nurse, or patient account request. The submitted organization must resolve to an existing organization.

It accepts all `create-account` fields plus required `organization_hospital`/`organizationHospital` and `organization_code`/`organizationCode`.

```json
{
  "first_name": "Ayesha",
  "last_name": "Khan",
  "email": "ayesha@example.com",
  "phone_number": "+923001234567",
  "organization_hospital": "Memorial Hospital",
  "organization_code": "MH-001",
  "role": "nurse",
  "password": "Password123!",
  "confirm_password": "Password123!",
  "terms_accepted": true
}
```

On success, the API creates an account request with the resolved organization details, sends a six-digit signup code to the email, and returns `201 Created` with `next_step: verify-code`.

### `POST /api/auth/signin`

Signs in a common individual or organizational account.

Required fields: `email`, `password`, `role`, and `account_type`/`accountType`.

Optional fields: `fcm_token`/`fcmToken` and `fcm_platform`/`fcmPlatform`.

`role` must be `doctor`, `nurse`, or `patient`. `account_type` must be `individual` or `organizational`.

```json
{
  "email": "ayesha@example.com",
  "password": "Password123!",
  "role": "nurse",
  "account_type": "organizational",
  "fcm_token": "device-registration-token",
  "fcm_platform": "android"
}
```

The API finds the user by email, role, and organization-field-derived account type. It rejects pending, rejected, suspended, deactivated, and deleted accounts, then returns a JWT and public user data on success.

## 2. Doctor Organizational Signup APIs

All endpoints are public and mounted under `/api/doctor/auth`. These APIs create an organizational `doctor` account only.

### `POST /api/doctor/auth/signup/personal-information`

Validates personal information and rejects only an existing organizational doctor account with the same email.

Required fields: `first_name`/`firstName`, `last_name`/`lastName`, `email`/`work_email`/`workEmail`, `phone_number`/`phoneNumber`, and `gender`.

Optional fields: `date_of_birth`/`dateOfBirth` and `profile_photo_url`/`profilePhotoUrl`.

```json
{
  "first_name": "Ali",
  "last_name": "Khan",
  "work_email": "ali@example.com",
  "phone_number": "+923001234567",
  "gender": "male"
}
```

Success response: `next_step: professional-credentials`.

### `POST /api/doctor/auth/signup/professional-credentials`

Validates and resolves doctor professional credentials. It does not create a user or send an OTP.

Required fields: organization/hospital, doctor license/ID, title/designation, and at least one specialization. Accepted title values are `md`, `mbbs`, and `resident`.

Organization inputs: `organization_id`/`organizationId`, `organization_code`/`organizationCode`, or organization/hospital aliases. The resolved `organization_id` returned by this endpoint is required by the next step.

```json
{
  "organization_code": "MH-001",
  "organization_hospital": "Memorial Hospital",
  "doctor_license_number": "DR-12345",
  "title_designation": "mbbs",
  "specializations": ["wound management"]
}
```

Success response: `next_step: set-password` and resolved organization details.

### `POST /api/doctor/auth/signup/set-password`

Combines personal and professional data, creates an organizational doctor account request, and emails a six-digit signup code with a 10-minute expiry.

The request accepts flat fields or nested `personal_information`/`personalInformation` and `professional_details`/`professionalDetails` objects. Required data includes the personal fields, professional fields, resolved `organization_id`, `password`, `confirm_password`/`confirmPassword`, and accepted terms.

```json
{
  "personal_information": {
    "first_name": "Ali",
    "last_name": "Khan",
    "work_email": "ali@example.com",
    "phone_number": "+923001234567",
    "gender": "male"
  },
  "professional_details": {
    "organization_id": 1,
    "organization_hospital": "Memorial Hospital",
    "doctor_license_number": "DR-12345",
    "title_designation": "mbbs",
    "specializations": ["wound management"]
  },
  "password": "Password123!",
  "confirm_password": "Password123!",
  "terms_accepted": true
}
```

Success response: `201 Created`, `next_step: pending-approval`, and a message confirming that the verification code was sent.

The doctor module's current `/verify-otp` route is for password-reset codes. It does not verify this signup OTP.

## 3. Patient Organizational Signup APIs

All endpoints are public and mounted under `/api/patient/auth`. These APIs create an organizational `patient` account only.

### `POST /api/patient/auth/signup/personal-information`

Validates patient personal information and rejects only an existing organizational patient account with the same email.

Required fields: `first_name`/`firstName`, `last_name`/`lastName`, `email`, `phone_number`/`phoneNumber`, and `gender`.

Optional fields: `date_of_birth`/`dateOfBirth` and `profile_photo_url`/`profilePhotoUrl`.

Success response: `next_step: professional-credentials`.

### `POST /api/patient/auth/signup/professional-credentials`

Validates patient organization and MRN information. It does not create a user or send an OTP.

Required fields: `hospital_institution`/`hospitalInstitution` and `patient_id_mrn`/`patientIdMrn`/`mrn`.

Optional field: `organization_code`/`organizationCode`.

```json
{
  "hospital_institution": "Memorial Hospital",
  "organization_code": "MH-001",
  "patient_id_mrn": "MRN-12345"
}
```

Success response: `next_step: set-password`.

### `POST /api/patient/auth/signup/set-password`

Combines personal and professional data, resolves the organization, creates an organizational patient account request, and emails a six-digit signup code with a 10-minute expiry.

The request accepts flat fields or nested `personal_information`/`personalInformation` and `professional_details`/`professionalDetails` objects. It requires all personal information, hospital/institution, patient MRN, password, confirmation, and accepted terms.

```json
{
  "personal_information": {
    "first_name": "Sara",
    "last_name": "Ahmed",
    "email": "sara@example.com",
    "phone_number": "+923001234568",
    "gender": "female"
  },
  "professional_details": {
    "hospital_institution": "Memorial Hospital",
    "organization_code": "MH-001",
    "patient_id_mrn": "MRN-12345"
  },
  "password": "Password123!",
  "confirm_password": "Password123!",
  "terms_accepted": true
}
```

Success response: `201 Created`, `next_step: pending-approval`, and a message confirming that the verification code was sent.

## Common Errors

| Status | When it is returned |
|---|---|
| `400` | Required field, password, role, account-type, FCM platform, or credential validation fails. |
| `404` | The requested organization cannot be resolved, or the sign-in account is not found. |
| `409` | The controller finds an existing account with the same email, role, and derived type. |
| `500` | Email configuration/send fails, database insertion fails, or an unexpected server error occurs. |

## OTP Delivery Requirements

Signup OTP delivery requires `MAIL_HOST`, `MAIL_USER`, and `MAIL_PASS` environment variables. The mail subject is `Your account verification code`; the code expires after 10 minutes.

## Live Database Requirement

The live database currently reports a unique index named `email` with `Non_unique = 0`. This blocks all second records with the same email, including a different role or organizational account. To allow the multi-account controller behavior, remove that email-only unique index and remove `unique: true` from the deployed `User` model. No `account_type` database column is required.
