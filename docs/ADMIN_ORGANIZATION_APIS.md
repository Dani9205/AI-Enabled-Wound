# Admin Organization APIs

This document covers the admin APIs used to retrieve organizations and the doctors and nurses associated with an organization.

## Base URL

```text
{{baseUrl}}/api/admin
```

Example local base URL:

```text
http://localhost:3000/api/admin
```

## Authentication

Both APIs require a valid JWT belonging to a user whose role is `admin` or `super_admin`.

```http
Authorization: Bearer <admin_jwt_token>
```

The token can be obtained from `POST /api/admin/login`.

## 1. Get Organizations

Returns all organizations, ordered by `created_at` in descending order (newest first).

### Request

```http
GET /api/admin/organizations
```

### Headers

| Header | Required | Value |
| --- | --- | --- |
| `Authorization` | Yes | `Bearer <admin_jwt_token>` |
| `Accept` | No | `application/json` |

This endpoint has no path parameters, query parameters, or request body.

### cURL example

```bash
curl --request GET \
  "{{baseUrl}}/api/admin/organizations" \
  --header "Authorization: Bearer <admin_jwt_token>" \
  --header "Accept: application/json"
```

### Success response

Status: `200 OK`

```json
{
  "message": "Organizations retrieved successfully",
  "total": 1,
  "organizations": [
    {
      "id": 1,
      "name": "Central Medical Hospital",
      "domain": "centralmed.org",
      "code": "ORG-CMH-2026",
      "admin_user_id": 10,
      "status": "active",
      "suspension_reason": null,
      "suspension_note": null,
      "suspended_by": null,
      "suspended_at": null,
      "decline_reason": null,
      "declined_by": null,
      "declined_at": null,
      "subscription_plan": "professional",
      "subscription_status": "active",
      "metadata": null,
      "created_at": "2026-07-15T08:30:00.000Z",
      "updated_at": "2026-07-15T08:30:00.000Z"
    }
  ]
}
```

If no organizations exist, `total` is `0` and `organizations` is an empty array.

### Response fields

| Field | Type | Description |
| --- | --- | --- |
| `message` | string | Success message. |
| `total` | number | Number of returned organizations. |
| `organizations` | array | Organization records. |
| `organizations[].status` | string | `active`, `pending`, `suspended`, or `declined`. |
| `organizations[].subscription_status` | string | `active`, `trialing`, `expired`, or `cancelled`. |

## 2. Get Organization Doctors and Nurses

Returns all users with role `doctor` or `nurse` whose `organization_code` exactly matches the supplied organization code. Results are ordered by role and then by name in ascending order.

### Request

```http
GET /api/admin/organizations/:organizationCode/users
```

Example:

```http
GET /api/admin/organizations/ORG-CMH-2026/users
```

### Headers

| Header | Required | Value |
| --- | --- | --- |
| `Authorization` | Yes | `Bearer <admin_jwt_token>` |
| `Accept` | No | `application/json` |

### Path parameters

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `organizationCode` | string | Yes | Organization's unique `code`. URL-encode the value when necessary. |

This endpoint has no query parameters or request body.

### cURL example

```bash
curl --request GET \
  "{{baseUrl}}/api/admin/organizations/ORG-CMH-2026/users" \
  --header "Authorization: Bearer <admin_jwt_token>" \
  --header "Accept: application/json"
```

### Success response

Status: `200 OK`

```json
{
  "message": "Organization doctors and nurses retrieved successfully",
  "organization": {
    "id": 1,
    "name": "Central Medical Hospital",
    "code": "ORG-CMH-2026",
    "status": "active"
  },
  "total": 2,
  "users": [
    {
      "id": 21,
      "name": "Dr. Sarah Ahmed",
      "first_name": "Sarah",
      "last_name": "Ahmed",
      "email": "sarah@centralmed.org",
      "phone_number": "+923001234567",
      "profile_photo_url": "https://example.com/sarah.jpg",
      "organization_hospital": "Central Medical Hospital",
      "organization_code": "ORG-CMH-2026",
      "role": "doctor",
      "shift": "Morning",
      "professional_title": "Wound Care Specialist",
      "request_accepted": true,
      "request_status": "accepted",
      "is_email_verified": true,
      "account_status": "active",
      "created_at": "2026-07-15T09:00:00.000Z"
    },
    {
      "id": 35,
      "name": "Ayesha Khan",
      "first_name": "Ayesha",
      "last_name": "Khan",
      "email": "ayesha@centralmed.org",
      "phone_number": "+923009876543",
      "profile_photo_url": null,
      "organization_hospital": "Central Medical Hospital",
      "organization_code": "ORG-CMH-2026",
      "role": "nurse",
      "shift": "Evening",
      "professional_title": "Registered Nurse",
      "request_accepted": true,
      "request_status": "accepted",
      "is_email_verified": true,
      "account_status": "active",
      "created_at": "2026-07-15T10:00:00.000Z"
    }
  ]
}
```

### Response fields

| Field | Type | Description |
| --- | --- | --- |
| `message` | string | Success message. |
| `organization` | object | Matching organization's basic details. |
| `organization.id` | number | Organization ID. Present when the organization record exists. |
| `organization.name` | string | Organization name. Present when the organization record exists. |
| `organization.code` | string | Requested organization code. |
| `organization.status` | string | Organization status. Present when the organization record exists. |
| `total` | number | Number of matching doctors and nurses. |
| `users` | array | Matching doctor and nurse accounts. |
| `users[].role` | string | Either `doctor` or `nurse`. |
| `users[].request_status` | string | `none`, `pending`, `accepted`, or `rejected`. |
| `users[].account_status` | string | `active`, `signed_out`, `deactivated`, or `deleted`. |

If no organization record matches the code, the current API still returns `200 OK` with this organization value:

```json
{
  "organization": {
    "code": "UNKNOWN-CODE"
  },
  "total": 0,
  "users": []
}
```

The API does not automatically filter users by `request_status`, email verification, or account status. It returns every matching `doctor` and `nurse`; clients can inspect these fields in each user record.

## Common error responses

### Invalid or expired token

Status: `401 Unauthorized`

```json
{
  "message": "Invalid or expired token"
}
```

### User is not authorized

Status: `401 Unauthorized`

```json
{
  "message": "User not authorized"
}
```

### Authenticated user is not an admin

Status: `403 Forbidden`

```json
{
  "message": "Forbidden"
}
```

### Server/database error: Get Organizations

Status: `500 Internal Server Error`

```json
{
  "message": "Failed to retrieve organizations",
  "error": "Error details"
}
```

### Server/database error: Get Organization Doctors and Nurses

Status: `500 Internal Server Error`

```json
{
  "message": "Failed to retrieve organization doctors and nurses",
  "error": "Error details"
}
```

## Source files

- Controller: `controllers/adminController.js`
- Routes: `routes/adminRoutes.js`
- Authentication middleware: `middleware/authMiddleware.js`
- Organization model: `models/organizationModel.js`
- User model: `models/userModel.js`
