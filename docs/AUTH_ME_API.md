# Auth Current User API

## Overview

Fetch the currently logged-in user using the bearer token.

## Endpoint

```http
GET /api/auth/me
```

## Authentication

Required.

```http
Authorization: Bearer <token>
```

## Success Response

Status: `200 OK`

```json
{
  "message": "User fetched successfully",
  "user": {
    "id": 1,
    "name": "Jane Cooper",
    "first_name": "Jane",
    "last_name": "Cooper",
    "email": "jane@example.com",
    "phone_number": "+15551234567",
    "profile_photo_url": "http://localhost:3000/uploads/profile-photos/photo.jpg",
    "role": "nurse",
    "is_email_verified": true
  }
}
```

## Error Responses

Missing, invalid, or expired token:

```json
{
  "message": "Invalid or expired token"
}
```

Deleted or unauthorized user:

```json
{
  "message": "User not authorized"
}
```

## Frontend Usage

```js
const response = await fetch(`${baseUrl}/api/auth/me`, {
  method: 'GET',
  headers: {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json'
  }
});

const data = await response.json();
```

## Notes

- Do not send `user_id` in the request.
- The API identifies the user from the token.
- Response does not include sensitive fields like `password_hash`, OTP code, or auth token.
