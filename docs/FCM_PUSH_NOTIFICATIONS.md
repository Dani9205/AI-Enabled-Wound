# FCM push notifications

## Backend environment

Choose either inline service-account credentials:

```env
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

Or Application Default Credentials:

```env
FIREBASE_PROJECT_ID=your-firebase-project-id
GOOGLE_APPLICATION_CREDENTIALS=C:\secure\firebase-service-account.json
```

Never commit the service-account JSON or real private key.

## Database

Run `migrations/20260716_add_fcm_columns_to_users.sql` once. The same columns
are also present in `20260701_sync_app_tables.sql` for its idempotent sync flow.

## Mobile flow

The mobile app obtains its FCM registration token and includes it during
account signup. After signup, it can refresh the token using the authenticated
endpoint.

### Register token during signup

```http
POST /api/auth/create-account
Content-Type: application/json

{
  "first_name": "Ali",
  "last_name": "Khan",
  "email": "doctor@example.com",
  "phone_number": "+923001234567",
  "role": "doctor",
  "password": "password123",
  "confirm_password": "password123",
  "terms_accepted": true,
  "fcm_token": "token-from-firebase-client-sdk",
  "fcm_platform": "android"
}
```

The same FCM fields are accepted by
`POST /api/auth/create-organization-account`. They are optional, and
`fcm_platform` supports `android`, `ios`, and `web`.

Signin only requires `email` and `password`; it does not update FCM data.

### Refresh token

```http
PUT /api/auth/fcm-token
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "fcm_token": "new-token-from-firebase-client-sdk",
  "fcm_platform": "android"
}
```

### Remove token on logout

```http
DELETE /api/auth/fcm-token
Authorization: Bearer <jwt>
```

## Sending

The existing general, doctor, and patient notification-create endpoints now
save the notification and send the same notification through FCM. Their response
contains `push.status`: `sent`, `failed`, or `skipped`.

Push is skipped without failing the database notification when the user has no
token or Firebase credentials are not configured. Invalid tokens are removed
automatically. Android clients must create a `wound_updates` notification channel.
