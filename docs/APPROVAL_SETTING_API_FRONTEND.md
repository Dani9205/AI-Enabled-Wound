# Approval Switch API — Frontend Integration

This admin API controls whether new accounts require manual approval. No email or user ID is required. Existing signup request fields remain unchanged.

## Endpoint and authentication

```http
PUT {{BASE_URL}}/api/admin/approval-settings
Authorization: Bearer <admin_token>
Content-Type: application/json
```

Use the deployed backend origin as `BASE_URL`, or `http://localhost:3000` locally if the server uses port 3000. The route must be deployed before it is available on the live server.

Only users with the `admin` or `super_admin` role can update this setting. The token returned by `POST /api/admin/login` can be used.

## Request body

| Field | Required | Accepted values | Meaning |
| --- | --- | --- | --- |
| `approval_required` | Yes | `"ON"`, `"OFF"`, `true`, `false` | ON/true requires manual approval; OFF/false automatically accepts new signup requests. |

String values are case-insensitive and trimmed. Numbers `1`/`0` and strings `"true"`/`"false"` are not supported.

### Switch ON: manual approval

```json
{
  "approval_required": "ON"
}
```

HTTP `200`:

```json
{
  "message": "Manual approval enabled",
  "approval_required": true
}
```

### Switch OFF: automatic approval

```json
{
  "approval_required": "OFF"
}
```

HTTP `200`:

```json
{
  "message": "Automatic approval enabled",
  "approval_required": false
}
```

## Signup behavior

| Switch | Account creation | After signup email verification |
| --- | --- | --- |
| ON | `request_status: "none"`, `request_accepted: false` | `request_status: "pending"`; admin approval required |
| OFF | `request_status: "accepted"`, `request_accepted: true` | Acceptance is preserved |

This applies to these signup endpoints:

- `POST /api/auth/create-account`
- `POST /api/auth/create-organization-account`
- `POST /api/doctor/auth/signup/set-password`
- `POST /api/patient/auth/signup/set-password`

Email verification still runs through `POST /api/auth/verify-code`; this switch does not remove that step. For signup verification, its response includes `next_step: "pending-approval"` for pending accounts or `next_step: "signin"` for accepted accounts.

Changing the switch does not bulk-update existing accounts. An existing pending account is not approved merely by setting OFF. If an account still has signup email verification to complete, verification checks the current switch. Previously accepted accounts stay accepted even if the switch changes to ON before verification. Non-signup verification does not change approval status.

## Frontend switch example

Label the switch **Require admin approval**: checked = ON/manual; unchecked = OFF/automatic.

```js
async function updateApprovalRequired(baseUrl, adminToken, checked) {
  const response = await fetch(
    `${baseUrl.replace(/\/$/, '')}/api/admin/approval-settings`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ approval_required: checked ? 'ON' : 'OFF' }),
    }
  );

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Could not update approval setting');
  }
  return data;
}

// In the switch change handler:
// Disable the switch while saving to avoid overlapping requests.
// Update the confirmed UI state only after success; retain it on error.
// const data = await updateApprovalRequired(BASE_URL, adminToken, nextChecked);
// setChecked(data.approval_required);
```

## Errors

| HTTP status | Example message | Frontend action |
| --- | --- | --- |
| `400` | `approval_required must be true, false, "ON" or "OFF"` | Send a supported value. |
| `401` | `Invalid or expired token`, `User not authorized`, or `Authentication failed` | Handle authentication failure and sign in again as needed. |
| `403` | `Forbidden` | An admin or super_admin account is required. |
| `500` | `Approval setting update failed` | Show the failure; do not confirm the requested switch state. |

Error responses contain a `message` field. Use valid JSON and `Content-Type: application/json`.

## Current-state and persistence limitations

- There is currently no GET endpoint to read the saved switch value. Do not call GET on this URL or assume that the saved setting is ON whenever the panel opens. Until a read endpoint exists, show the initial state as unknown/unconfirmed and confirm changes from the PUT response.
- The backend defaults to ON only when the setting file does not exist.
- The setting is saved in `config/approval-settings.json` on the backend server. Restart preserves it if that file remains available. Replacing the server filesystem can reset it.
- The setting applies globally within that backend instance; it is not per organization. Multiple backend instances with separate filesystems do not share this setting.
