# Taskapp REST API

The Express API is available at the URL configured by `NEXT_PUBLIC_API_URL`. In local development, this is typically:

```text
http://localhost:4000
```

All request and response bodies use JSON unless otherwise noted.

## Conventions

### Content type

Requests containing a body must include:

```http
Content-Type: application/json
```

### Authentication

All `/api/tasks` endpoints and `GET /api/auth/me` require a JWT access token:

```http
Authorization: Bearer <token>
```

Missing, malformed, invalid, expired, or revoked-user tokens return `401 Unauthorized`.

### Error format

API errors use the following shape:

```json
{
  "error": {
    "message": "Human-readable error message"
  }
}
```

Validation failures may also include field-specific details:

```json
{
  "error": {
    "message": "Validation failed",
    "details": {
      "title": "Title is required",
      "status": "Status must be one of: todo, in_progress, done"
    }
  }
}
```

Depending on the validation failure, `details` may identify one or more invalid fields or payload entries.

### User object

```json
{
  "id": 1,
  "name": "Ada Lovelace",
  "email": "ada@example.com"
}
```

Passwords and password hashes are never returned.

### Task object

```json
{
  "id": 42,
  "title": "Prepare release notes",
  "description": "Summarize the changes in this release.",
  "status": "in_progress",
  "position": 0,
  "dueDate": "2026-09-03T15:00:00.000Z",
  "createdAt": "2026-09-01T10:00:00.000Z",
  "updatedAt": "2026-09-02T09:30:00.000Z"
}
```

Task fields have the following meanings:

| Field | Type | Description |
| --- | --- | --- |
| `id` | integer | Unique task identifier. |
| `title` | string | Required task title. Maximum 255 characters. |
| `description` | string | Optional task description. Maximum 5,000 characters. |
| `status` | string | One of `todo`, `in_progress`, or `done`. |
| `position` | integer | Zero-based ordering position within the task's status column. |
| `dueDate` | string or `null` | Due date as an ISO 8601 timestamp, or `null` when no due date is set. |
| `createdAt` | string | ISO 8601 creation timestamp. |
| `updatedAt` | string | ISO 8601 last-update timestamp. |

Task ownership is derived from the authenticated user and cannot be supplied in request bodies.

---

## Health

### `GET /health`

Checks whether the Express application is running.

Authentication is not required.

#### Success response

**Status:** `200 OK`

```json
{
  "status": "ok"
}
```

#### Status codes

| Status | Meaning |
| --- | --- |
| `200` | API process is healthy. |
| `500` | Unexpected server failure. |

---

## Authentication

## `POST /api/auth/signup`

Creates a user account and returns a signed JWT.

Authentication is not required.

### Request body

```json
{
  "name": "Ada Lovelace",
  "email": "ada@example.com",
  "password": "correct-horse-battery-staple"
}
```

| Field | Type | Required | Validation |
| --- | --- | --- | --- |
| `name` | string | Yes | Must contain a non-empty name after trimming. |
| `email` | string | Yes | Must be a valid email address. It is trimmed and normalized to lowercase. |
| `password` | string | Yes | Must meet the server's minimum password-length requirement. |

Unknown fields are ignored. The client must not send a precomputed password hash.

### Success response

**Status:** `201 Created`

```json
{
  "token": "<jwt-access-token>",
  "user": {
    "id": 1,
    "name": "Ada Lovelace",
    "email": "ada@example.com"
  }
}
```

### Validation errors

Examples include:

- Missing name, email, or password
- Empty name after trimming
- Invalid email format
- Password shorter than the required minimum
- Email longer than the supported database length
- A previously registered normalized email

Example:

```json
{
  "error": {
    "message": "An account with this email already exists"
  }
}
```

### Status codes

| Status | Meaning |
| --- | --- |
| `201` | Account created; token and safe user data returned. |
| `400` | Request body or one of its fields is invalid. |
| `409` | The normalized email address is already registered. |
| `500` | Unexpected server or database failure. |

---

## `POST /api/auth/login`

Authenticates an existing user and returns a signed JWT.

Authentication is not required.

### Request body

```json
{
  "email": "ada@example.com",
  "password": "correct-horse-battery-staple"
}
```

| Field | Type | Required | Validation |
| --- | --- | --- | --- |
| `email` | string | Yes | Must be a valid email address. It is trimmed and normalized to lowercase. |
| `password` | string | Yes | Must be a non-empty string. |

### Success response

**Status:** `200 OK`

```json
{
  "token": "<jwt-access-token>",
  "user": {
    "id": 1,
    "name": "Ada Lovelace",
    "email": "ada@example.com"
  }
}
```

### Validation and authentication errors

Missing or malformed credentials return `400 Bad Request`.

An unknown email address or incorrect password returns `401 Unauthorized` without revealing which credential was incorrect:

```json
{
  "error": {
    "message": "Invalid email or password"
  }
}
```

### Status codes

| Status | Meaning |
| --- | --- |
| `200` | Authentication succeeded. |
| `400` | Email or password is missing or malformed. |
| `401` | The supplied credentials are invalid. |
| `500` | Unexpected server or database failure. |

---

## `GET /api/auth/me`

Returns the user represented by the current access token.

Authentication is required.

### Request headers

```http
Authorization: Bearer <token>
```

### Success response

**Status:** `200 OK`

```json
{
  "user": {
    "id": 1,
    "name": "Ada Lovelace",
    "email": "ada@example.com"
  }
}
```

### Authentication errors

```json
{
  "error": {
    "message": "Authentication required"
  }
}
```

A `401` response is returned if:

- The `Authorization` header is missing
- The header does not use the `Bearer` scheme
- The token is malformed
- The token signature is invalid
- The token has expired
- The token does not identify a valid user
- The referenced user no longer exists

### Status codes

| Status | Meaning |
| --- | --- |
| `200` | Current safe user data returned. |
| `401` | Authentication failed. |
| `500` | Unexpected server or database failure. |

---

## Tasks

Every task endpoint requires authentication. Users can only access tasks they own. A task belonging to another user is treated as unavailable and is not exposed.

## `GET /api/tasks`

Returns all tasks owned by the authenticated user.

Authentication is required.

### Query parameters

None.

### Success response

**Status:** `200 OK`

```json
{
  "tasks": [
    {
      "id": 10,
      "title": "Review backlog",
      "description": "",
      "status": "todo",
      "position": 0,
      "dueDate": null,
      "createdAt": "2026-09-01T10:00:00.000Z",
      "updatedAt": "2026-09-01T10:00:00.000Z"
    },
    {
      "id": 11,
      "title": "Prepare release notes",
      "description": "Summarize the changes in this release.",
      "status": "in_progress",
      "position": 0,
      "dueDate": "2026-09-03T15:00:00.000Z",
      "createdAt": "2026-09-01T11:00:00.000Z",
      "updatedAt": "2026-09-02T09:30:00.000Z"
    }
  ]
}
```

If the user has no tasks:

```json
{
  "tasks": []
}
```

Tasks are returned in stable Kanban order using their status and position values.

### Status codes

| Status | Meaning |
| --- | --- |
| `200` | Task list returned. |
| `401` | Authentication failed. |
| `500` | Unexpected server or database failure. |

---

## `POST /api/tasks`

Creates a task for the authenticated user.

Authentication is required.

### Request body

```json
{
  "title": "Prepare release notes",
  "description": "Summarize the changes in this release.",
  "status": "todo",
  "dueDate": "2026-09-03T15:00:00.000Z"
}
```

| Field | Type | Required | Validation |
| --- | --- | --- | --- |
| `title` | string | Yes | Must be non-empty after trimming and no longer than 255 characters. |
| `description` | string | No | Defaults to an empty string; maximum 5,000 characters. |
| `status` | string | No | Defaults to `todo`; must be `todo`, `in_progress`, or `done`. |
| `dueDate` | string or `null` | No | Must be a valid ISO 8601 date-time string, or `null`. Defaults to `null`. |

The server assigns the task's `id`, ownership, timestamps, and next available `position` in the selected status column.

### Success response

**Status:** `201 Created`

```json
{
  "task": {
    "id": 42,
    "title": "Prepare release notes",
    "description": "Summarize the changes in this release.",
    "status": "todo",
    "position": 3,
    "dueDate": "2026-09-03T15:00:00.000Z",
    "createdAt": "2026-09-02T12:00:00.000Z",
    "updatedAt": "2026-09-02T12:00:00.000Z"
  }
}
```

### Validation errors

Examples include:

- Missing or empty `title`
- `title` longer than 255 characters
- `description` longer than 5,000 characters
- Unsupported status
- Invalid or non-string due date
- Non-object JSON request body

Example:

```json
{
  "error": {
    "message": "Validation failed",
    "details": {
      "dueDate": "Due date must be a valid ISO 8601 date-time or null"
    }
  }
}
```

### Status codes

| Status | Meaning |
| --- | --- |
| `201` | Task created. |
| `400` | Task data is invalid. |
| `401` | Authentication failed. |
| `500` | Unexpected server or database failure. |

---

## `PATCH /api/tasks/reorder`

Atomically applies Kanban status and position changes to the authenticated user's tasks.

This route is declared before parameterized task routes, so `reorder` is not interpreted as a task ID.

Authentication is required.

### Request body

```json
{
  "tasks": [
    {
      "id": 10,
      "status": "todo",
      "position": 0
    },
    {
      "id": 12,
      "status": "todo",
      "position": 1
    },
    {
      "id": 11,
      "status": "in_progress",
      "position": 0
    }
  ]
}
```

Each reorder entry has the following fields:

| Field | Type | Required | Validation |
| --- | --- | --- | --- |
| `id` | integer | Yes | Must be a positive task ID owned by the authenticated user. |
| `status` | string | Yes | Must be `todo`, `in_progress`, or `done`. |
| `position` | integer | Yes | Must be a non-negative integer. |

Task IDs must not be repeated. Clients should send the complete desired ordering snapshot used by the Kanban board, with positions starting at `0` and increasing within each status column.

The operation is transactional: either all supplied updates are applied or none are applied.

### Success response

**Status:** `200 OK`

```json
{
  "tasks": [
    {
      "id": 10,
      "title": "Review backlog",
      "description": "",
      "status": "todo",
      "position": 0,
      "dueDate": null,
      "createdAt": "2026-09-01T10:00:00.000Z",
      "updatedAt": "2026-09-02T12:05:00.000Z"
    },
    {
      "id": 12,
      "title": "Prioritize defects",
      "description": "",
      "status": "todo",
      "position": 1,
      "dueDate": null,
      "createdAt": "2026-09-01T12:00:00.000Z",
      "updatedAt": "2026-09-02T12:05:00.000Z"
    },
    {
      "id": 11,
      "title": "Prepare release notes",
      "description": "Summarize the changes in this release.",
      "status": "in_progress",
      "position": 0,
      "dueDate": "2026-09-03T15:00:00.000Z",
      "createdAt": "2026-09-01T11:00:00.000Z",
      "updatedAt": "2026-09-02T12:05:00.000Z"
    }
  ]
}
```

### Validation errors

Examples include:

- Missing `tasks` array
- Empty or malformed reorder entries
- Duplicate task IDs
- Non-positive or non-integer IDs
- Invalid statuses
- Negative or non-integer positions
- Repeated positions within a status column
- A referenced task that does not exist or is not owned by the user

Example duplicate-ID response:

```json
{
  "error": {
    "message": "Validation failed",
    "details": {
      "tasks": "Task IDs must not be duplicated"
    }
  }
}
```

### Status codes

| Status | Meaning |
| --- | --- |
| `200` | Reorder completed and the current ordered tasks were returned. |
| `400` | Reorder payload is malformed or internally inconsistent. |
| `401` | Authentication failed. |
| `404` | One or more referenced tasks are unavailable to the current user. |
| `500` | Unexpected server, database, or transaction failure. |

---

## `PUT /api/tasks/:id`

Replaces the editable fields of an owned task.

Authentication is required.

### Path parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `id` | positive integer | ID of the task to update. |

### Request body

```json
{
  "title": "Publish release notes",
  "description": "Complete the final review and publish.",
  "status": "done",
  "dueDate": null
}
```

| Field | Type | Required | Validation |
| --- | --- | --- | --- |
| `title` | string | Yes | Must be non-empty after trimming and no longer than 255 characters. |
| `description` | string | No | Empty string is allowed; maximum 5,000 characters. |
| `status` | string | Yes | Must be `todo`, `in_progress`, or `done`. |
| `dueDate` | string or `null` | No | Must be a valid ISO 8601 date-time string, or `null`. |

This is a full editable-field update. Clients should send the complete current title, description, status, and due date rather than only changed fields.

The `position` field is managed by the server. When a status change moves a task to another column, the server maintains valid column positions. Use `PATCH /api/tasks/reorder` when an exact Kanban order is required.

Changing due-date-related task data resets the internal reminder state when necessary, allowing the notification scheduler to process the updated due date.

### Success response

**Status:** `200 OK`

```json
{
  "task": {
    "id": 42,
    "title": "Publish release notes",
    "description": "Complete the final review and publish.",
    "status": "done",
    "position": 2,
    "dueDate": null,
    "createdAt": "2026-09-02T12:00:00.000Z",
    "updatedAt": "2026-09-02T14:15:00.000Z"
  }
}
```

### Validation errors

Examples include:

- Invalid or non-positive path ID
- Missing or empty title
- Title or description exceeding its maximum length
- Unsupported status
- Invalid due date
- Attempting to set server-managed ownership or ordering data instead of using the reorder endpoint

### Status codes

| Status | Meaning |
| --- | --- |
| `200` | Task updated. |
| `400` | Path parameter or task data is invalid. |
| `401` | Authentication failed. |
| `404` | The task does not exist or is not owned by the authenticated user. |
| `500` | Unexpected server or database failure. |

---

## `DELETE /api/tasks/:id`

Deletes an owned task and compacts the remaining positions in its status column.

Authentication is required.

### Path parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `id` | positive integer | ID of the task to delete. |

### Request body

None.

### Success response

**Status:** `200 OK`

```json
{
  "message": "Task deleted successfully"
}
```

### Errors

An invalid ID returns `400 Bad Request`:

```json
{
  "error": {
    "message": "Task ID must be a positive integer"
  }
}
```

A task that does not exist or is not owned by the authenticated user returns `404 Not Found`:

```json
{
  "error": {
    "message": "Task not found"
  }
}
```

### Status codes

| Status | Meaning |
| --- | --- |
| `200` | Task deleted. |
| `400` | Task ID is malformed or invalid. |
| `401` | Authentication failed. |
| `404` | The task does not exist or is not owned by the authenticated user. |
| `500` | Unexpected server or database failure. |

---

## Unmatched routes

Requests to undefined API routes return:

**Status:** `404 Not Found`

```json
{
  "error": {
    "message": "Route not found"
  }
}
```

Malformed JSON request bodies return `400 Bad Request` using the standard error response shape. Unexpected failures return `500 Internal Server Error` without exposing database credentials, password hashes, JWT secrets, stack traces, or other sensitive implementation details.