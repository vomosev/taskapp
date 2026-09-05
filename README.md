# Taskapp

Taskapp is a full-stack task management application with JWT authentication, a responsive drag-and-drop Kanban board, task due dates, and scheduled email reminders.

The frontend uses the Next.js App Router, while the REST API and notification worker run on Express. Application data is stored in MySQL.

## Features

- User signup, login, logout, and authenticated profile retrieval
- JWT-based API authentication
- User-scoped task storage
- Todo, in-progress, and done Kanban columns
- Pointer and keyboard drag-and-drop
- Optimistic status and position updates
- Task creation, editing, and deletion
- Optional due dates
- Scheduled email reminders for due tasks
- Responsive desktop and mobile layouts
- Local and Docker-based development
- Jest unit tests for authentication utilities and task validation

## Technology Stack

- Next.js App Router
- React
- Express
- MySQL with `mysql2`
- JSON Web Tokens
- bcrypt
- Nodemailer
- node-cron
- dnd-kit
- Jest
- Docker Compose

## Prerequisites

For local development:

- Node.js 20 or later
- npm
- MySQL 8 or later
- Access to an SMTP server if email reminders are required

For container-based operation:

- Docker
- Docker Compose v2

## Environment Setup

Copy the example environment file before starting the application:

```bash
cp .env.example .env
```

Review every value in `.env` and configure it for the local or deployed environment. The file is ignored by Git and must not be committed.

### Application Variables

| Variable | Purpose |
| --- | --- |
| `NODE_ENV` | Selects development, test, or production behavior. |
| `APP_PORT` | Port used by the Express API. |
| `FRONTEND_URL` | Browser origin allowed by the API CORS configuration. |
| `NEXT_PUBLIC_API_URL` | Browser-accessible base URL of the Express API. |

`NEXT_PUBLIC_API_URL` is exposed to browser code and is incorporated into the Next.js build. After changing it for production, rebuild the frontend.

The value must be reachable from the user's browser. A Docker-only service hostname is not suitable for browser requests.

### Database Variables

| Variable | Purpose |
| --- | --- |
| `DB_HOST` | MySQL hostname. |
| `DB_PORT` | MySQL port. |
| `DB_USER` | MySQL application user. |
| `DB_PASSWORD` | MySQL application password. |
| `DB_NAME` | MySQL database name. |
| `DB_ROOT_PASSWORD` | Root password used to provision the Docker MySQL container. |

`DB_ROOT_PASSWORD` is used by Docker Compose and is not required by the application connection pool.

### Authentication Variables

| Variable | Purpose |
| --- | --- |
| `JWT_SECRET` | Secret used to sign and verify access tokens. |
| `JWT_EXPIRES_IN` | Token lifetime accepted by `jsonwebtoken`. |

Use a long, cryptographically random `JWT_SECRET` outside local development. Changing it invalidates existing access tokens.

### SMTP and Notification Variables

| Variable | Purpose |
| --- | --- |
| `SMTP_HOST` | SMTP server hostname. |
| `SMTP_PORT` | SMTP server port. |
| `SMTP_SECURE` | Enables implicit TLS when set to a true value. |
| `SMTP_USER` | SMTP authentication username. |
| `SMTP_PASSWORD` | SMTP password or application token. |
| `SMTP_FROM` | Sender address used for reminders. |
| `NOTIFICATION_POLL_CRON` | Cron expression controlling due-task polling. |

## Local Installation

Install dependencies:

```bash
npm install
```

Create the database identified by `DB_NAME` and grant the configured `DB_USER` access to it before initializing the schema.

## MySQL Schema Initialization

The database schema is defined in `schema.sql`. It creates:

- `users`, including unique normalized email addresses and bcrypt password hashes
- `tasks`, including ownership, status, position, due date, and notification timestamps
- Foreign keys and indexes needed for ownership-scoped task listing and due-task polling

After configuring and exporting the database environment variables, initialize the selected database:

```bash
mysql \
  --host="$DB_HOST" \
  --port="$DB_PORT" \
  --user="$DB_USER" \
  --password \
  "$DB_NAME" < schema.sql
```

The MySQL client prompts for the configured application user's password.

If the variables only exist in `.env`, they can first be exported into the current shell:

```bash
set -a
. ./.env
set +a
```

The database itself and its application user must already exist unless they are being provisioned by Docker Compose.

## Running Locally

Start the Next.js frontend and Express API in development mode:

```bash
npm run dev
```

The frontend and API run as separate processes through the shared development script. Use the ports configured in `.env`.

Open the frontend URL in a browser. The API health endpoint is available at:

```text
GET {NEXT_PUBLIC_API_URL}/health
```

A healthy API returns:

```json
{
  "status": "ok"
}
```

Stop the processes with `Ctrl+C`.

## Production Build and Startup

Build the Next.js frontend:

```bash
npm run build
```

Start the production frontend and Express API:

```bash
npm start
```

Before production startup, ensure that:

- `NODE_ENV` is set for production use
- MySQL is reachable and initialized
- `JWT_SECRET` is secure
- `FRONTEND_URL` matches the deployed browser origin
- `NEXT_PUBLIC_API_URL` was present during the frontend build
- SMTP settings are valid if reminders are enabled

The API verifies its MySQL connection before accepting traffic. The notification scheduler starts with the Express server.

## Docker

### Start the Application

Create `.env`, configure its values, and run:

```bash
docker compose up --build
```

Docker Compose starts:

- The Taskapp container containing the Next.js frontend and Express API
- A health-checked MySQL container
- A persistent MySQL data volume
- Automatic schema initialization from `schema.sql` for a new database volume

The configured frontend and API ports are published to the host.

### Run in the Background

```bash
docker compose up --build -d
```

### View Logs

```bash
docker compose logs -f
```

To follow only the application logs:

```bash
docker compose logs -f taskapp
```

### Stop Containers

```bash
docker compose down
```

### Reset the Docker Database

MySQL initialization files only run when the database data directory is first created. To remove all database data and initialize a fresh schema:

```bash
docker compose down -v
docker compose up --build
```

This operation permanently deletes users and tasks stored in the Docker volume.

### Rebuild After Public URL Changes

Because `NEXT_PUBLIC_API_URL` is used by browser code at build time, rebuild the application image after changing it:

```bash
docker compose build --no-cache taskapp
docker compose up -d
```

## Testing

Run the Jest unit test suite:

```bash
npm test
```

The tests under `server/tests` cover:

- bcrypt password hashing and comparison
- JWT signing, verification, invalid-token rejection, and payload preservation
- Task field normalization
- Required titles and field length limits
- Status and due-date validation
- Reorder payload validation
- Duplicate and malformed task IDs

The current unit tests do not require a running MySQL server.

## Build Verification

Verify that the frontend can produce a production build:

```bash
npm run build
```

The GitHub Actions workflow runs the Jest tests and the Next.js production build for pushes and pull requests.

## Notification Behavior

The Express process starts the notification scheduler after the database connection has been verified.

At each interval defined by `NOTIFICATION_POLL_CRON`, the worker:

1. Queries incomplete tasks whose due time has passed.
2. Selects tasks that do not have a `notified_at` value.
3. Loads the owning user's name and email.
4. Sends a plain-text and escaped HTML reminder through the configured SMTP server.
5. Marks a successfully delivered reminder with `notified_at`.
6. Logs failed deliveries without marking them, allowing a later polling cycle to retry.

Completed tasks are not included in due-task reminders. Relevant task due-date changes reset the notification state so the updated due task can be considered again.

Due dates sent by the frontend are converted to ISO timestamps. Use consistent MySQL and application time-zone configuration in production to avoid unexpected reminder times.

The scheduler runs inside the API process. Stopping the API also stops reminder polling.

## Authentication

The frontend stores the issued JWT in browser `localStorage`. Authenticated API requests send it through the `Authorization` header:

```text
Authorization: Bearer JWT
```

The authentication middleware verifies the signature and expiration and confirms that the referenced user still exists. Invalid, expired, or missing credentials receive a normalized HTTP 401 response.

Each task query and mutation is scoped to the authenticated user.

## REST API

The API base is the value of `NEXT_PUBLIC_API_URL`.

### Health

| Method | Endpoint | Authentication |
| --- | --- | --- |
| `GET` | `/health` | No |

### Authentication

| Method | Endpoint | Authentication |
| --- | --- | --- |
| `POST` | `/api/auth/signup` | No |
| `POST` | `/api/auth/login` | No |
| `GET` | `/api/auth/me` | Bearer JWT |

### Tasks

| Method | Endpoint | Authentication |
| --- | --- | --- |
| `GET` | `/api/tasks` | Bearer JWT |
| `POST` | `/api/tasks` | Bearer JWT |
| `PATCH` | `/api/tasks/reorder` | Bearer JWT |
| `PUT` | `/api/tasks/:id` | Bearer JWT |
| `DELETE` | `/api/tasks/:id` | Bearer JWT |

API failures use a consistent JSON structure:

```json
{
  "error": {
    "message": "Error message"
  }
}
```

Validation failures may also include structured `details`.

See [API.md](API.md) for complete request bodies, response shapes, authentication requirements, validation rules, and status codes.

## Kanban Behavior

Tasks use one of three statuses:

- `todo`
- `in-progress`
- `done`

Each task also stores a numeric position within its status column. Dragging a card updates the interface optimistically and sends the resulting ordered column state to the reorder endpoint.

The backend validates the complete reorder payload, rejects malformed or duplicate task IDs, verifies ownership, and applies column changes in a transaction.

The board supports pointer and keyboard dragging. Edit and delete controls prevent their clicks from initiating card movement.

## Project Structure

```text
.
├── .dockerignore
├── .env.example
├── .github
│   └── workflows
│       └── ci.yml
├── .gitignore
├── API.md
├── Dockerfile
├── README.md
├── app
│   ├── dashboard
│   │   └── page.jsx
│   ├── globals.css
│   ├── layout.jsx
│   ├── login
│   │   └── page.jsx
│   ├── page.jsx
│   └── signup
│       └── page.jsx
├── components
│   ├── AuthForm.jsx
│   ├── Dashboard.jsx
│   ├── Header.jsx
│   ├── KanbanBoard.jsx
│   ├── TaskCard.jsx
│   ├── TaskColumn.jsx
│   └── TaskModal.jsx
├── docker-compose.yml
├── jest.config.js
├── lib
│   ├── api.js
│   └── auth.js
├── next.config.js
├── package.json
├── schema.sql
└── server
    ├── app.js
    ├── config
    │   └── db.js
    ├── controllers
    │   ├── authController.js
    │   └── taskController.js
    ├── index.js
    ├── middleware
    │   ├── auth.js
    │   └── errorHandler.js
    ├── routes
    │   ├── authRoutes.js
    │   └── taskRoutes.js
    ├── services
    │   ├── emailService.js
    │   ├── notificationScheduler.js
    │   └── taskService.js
    ├── tests
    │   ├── auth.test.js
    │   └── taskRules.test.js
    └── utils
        ├── auth.js
        └── taskRules.js
```

### Root Configuration

- `package.json` defines development, production, testing, and build scripts and all application dependencies.
- `next.config.js` configures the Next.js App Router build and standalone production output.
- `jest.config.js` configures Node-based server unit tests.
- `.env.example` documents the required environment variables.
- `schema.sql` defines the MySQL schema, relationships, and indexes.
- `Dockerfile` builds the shared application image.
- `docker-compose.yml` runs Taskapp with a health-checked MySQL database.
- `API.md` contains the detailed REST API contract.
- `.github/workflows/ci.yml` runs tests and build verification in GitHub Actions.

### Frontend

- `app/layout.jsx` defines global metadata, viewport settings, and the shared HTML layout.
- `app/globals.css` contains the responsive application styling.
- `app/page.jsx` routes visitors according to their current authentication state.
- `app/login/page.jsx` renders the login flow.
- `app/signup/page.jsx` renders the registration flow.
- `app/dashboard/page.jsx` renders the authenticated dashboard.
- `components/AuthForm.jsx` handles signup and login validation and requests.
- `components/Dashboard.jsx` coordinates authentication, task loading, mutations, and modal state.
- `components/Header.jsx` provides task creation and logout controls.
- `components/KanbanBoard.jsx` manages drag-and-drop behavior.
- `components/TaskColumn.jsx` renders a droppable status column.
- `components/TaskCard.jsx` renders a sortable task.
- `components/TaskModal.jsx` handles create and edit forms.
- `lib/auth.js` manages the browser JWT.
- `lib/api.js` provides the frontend API client.

### Backend

- `server/index.js` verifies MySQL, starts Express, starts notifications, and handles shutdown signals.
- `server/app.js` configures JSON parsing, CORS, routes, health checks, 404 responses, and error handling.
- `server/config/db.js` owns the MySQL connection pool.
- `server/routes/authRoutes.js` defines authentication endpoints.
- `server/routes/taskRoutes.js` defines protected task endpoints.
- `server/controllers/authController.js` handles signup, login, and current-user requests.
- `server/controllers/taskController.js` maps HTTP task requests to service operations.
- `server/services/taskService.js` performs validation, ownership checks, persistence, and transactional reordering.
- `server/services/emailService.js` configures Nodemailer and creates reminder messages.
- `server/services/notificationScheduler.js` polls for due tasks and records successful notifications.
- `server/middleware/auth.js` verifies JWTs and loads safe user data.
- `server/middleware/errorHandler.js` normalizes API errors.
- `server/utils/auth.js` provides bcrypt and JWT helpers.
- `server/utils/taskRules.js` defines task statuses and validation rules.
- `server/tests` contains the Jest unit tests.