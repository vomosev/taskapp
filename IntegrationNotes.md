# Integration Notes for taskapp

## Overview

Taskapp is a full-stack task management application featuring:

- JWT-based signup, login, and authenticated sessions
- A responsive three-column Kanban dashboard
- Drag-and-drop task status and position updates using dnd-kit
- Task creation, editing, deletion, and due dates
- Automated email reminders for incomplete due tasks
- A Next.js App Router frontend
- An Express REST API
- MySQL persistence
- Jest unit tests
- Local and Docker-based execution

The frontend normally runs at `http://localhost:3000`, while the Express API runs at `http://localhost:4000`. The API exposes a health endpoint at `GET /health` and authenticated application endpoints under `/api/auth` and `/api/tasks`.

The notification scheduler runs as part of the Express server process. It polls for eligible due tasks according to `NOTIFICATION_POLL_CRON`, sends reminders through SMTP, and records successful notifications to avoid duplicate delivery.

## Prerequisites

### Local development

Install the following:

- Node.js and npm, using the Node.js version supported by `package.json` and `.github/workflows/ci.yml`
- MySQL Server
- An SMTP account if email reminders need to be tested
- Git, if cloning the repository

Ensure the following ports are available unless their configuration is changed:

- `3000` for Next.js
- `4000` for Express
- `3306` for MySQL

### Docker development

Install:

- Docker Engine or Docker Desktop
- Docker Compose with support for the `docker compose` command

A separate local MySQL installation is not required when using `docker-compose.yml`.

## Installation

### 1. Install application dependencies

From the repository root:

```bash
npm install
```

All frontend, backend, testing, database, authentication, email, scheduler, and drag-and-drop dependencies are managed by the root `package.json`.

### 2. Create the environment file

Copy the supplied example:

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Edit `.env` and replace all placeholder passwords, JWT secrets, and SMTP credentials before starting the application.

A typical local configuration is:

```dotenv
NODE_ENV=development
APP_PORT=4000
FRONTEND_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:4000

DB_HOST=localhost
DB_PORT=3306
DB_USER=taskapp
DB_PASSWORD=replace-with-a-strong-password
DB_NAME=taskapp
DB_ROOT_PASSWORD=replace-with-a-different-strong-password

JWT_SECRET=replace-with-a-long-random-secret
JWT_EXPIRES_IN=7d

SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=notifications@example.com
SMTP_PASSWORD=replace-with-smtp-credential
SMTP_FROM=Taskapp <notifications@example.com>

NOTIFICATION_POLL_CRON=* * * * *
```

### 3. Provision MySQL for local operation

Create the database and application user using a MySQL administrative account. For example:

```sql
CREATE DATABASE taskapp
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER 'taskapp'@'localhost'
  IDENTIFIED BY 'replace-with-a-strong-password';

GRANT ALL PRIVILEGES ON taskapp.* TO 'taskapp'@'localhost';

FLUSH PRIVILEGES;
```

If the API runs in a container or from another host, replace `'localhost'` with the appropriate MySQL user host restriction.

Initialize the tables and indexes from the repository root:

```bash
mysql -h localhost -P 3306 -u taskapp -p taskapp < schema.sql
```

Enter the value configured in `DB_PASSWORD` when prompted.

The schema creates the `users` and `tasks` tables, ownership relationships, status and position fields, due-date notification fields, foreign keys, and indexes used by task listing and reminder polling.

### 4. Docker installation alternative

After creating and configuring `.env`, build and start the complete stack:

```bash
docker compose up --build
```

`docker-compose.yml` starts:

- The Taskapp application container
- A health-checked MySQL container
- Persistent MySQL storage
- Frontend and API port mappings
- Initial schema loading from `schema.sql`

MySQL initialization scripts run only when the database volume is first created. To discard all container data and initialize a fresh database:

```bash
docker compose down -v
docker compose up --build
```

This permanently removes the Docker-managed database volume and all stored users and tasks.

## Environment Variables

| Variable | Description | Example |
|---|---|---|
| `NODE_ENV` | Runtime environment used to select development, test, or production behavior. | `development` |
| `APP_PORT` | Port on which the Express API server listens. | `4000` |
| `FRONTEND_URL` | Allowed frontend origin used by the Express CORS configuration. It must match the browser-visible frontend origin, including protocol and port. | `http://localhost:3000` |
| `NEXT_PUBLIC_API_URL` | Public base URL used by the browser to call the Express API. Because it is exposed to client-side Next.js code, it must be reachable from users' browsers and must not contain secrets. | `http://localhost:4000` |
| `DB_HOST` | Hostname of the MySQL server. Use `localhost` for a local database or the Compose MySQL service name when configured by Docker Compose. | `localhost` |
| `DB_PORT` | Port of the MySQL server. | `3306` |
| `DB_USER` | MySQL application user used by the Express API and notification worker. | `taskapp` |
| `DB_PASSWORD` | Password for the MySQL application user. | `replace-with-a-strong-password` |
| `DB_NAME` | Name of the MySQL database used by the application. | `taskapp` |
| `DB_ROOT_PASSWORD` | MySQL root password used when provisioning the Docker database container. It is primarily required by the Compose MySQL service. | `replace-with-a-different-strong-password` |
| `JWT_SECRET` | Secret used to sign and verify authentication JWTs. Use a long, cryptographically random value and never expose it to the frontend. | `replace-with-a-long-random-secret` |
| `JWT_EXPIRES_IN` | A `jsonwebtoken`-compatible lifetime for issued access tokens. | `7d` |
| `SMTP_HOST` | Hostname of the SMTP server used for due-task notifications. | `smtp.example.com` |
| `SMTP_PORT` | Port of the SMTP server. Common values are `587` for STARTTLS and `465` for implicit TLS. | `587` |
| `SMTP_SECURE` | Whether SMTP should use an implicit TLS connection. Set to `true` for providers using implicit TLS, commonly on port `465`; otherwise use `false`. | `false` |
| `SMTP_USER` | Username used to authenticate with the SMTP server. | `notifications@example.com` |
| `SMTP_PASSWORD` | Password or application token used to authenticate with the SMTP server. | `replace-with-smtp-credential` |
| `SMTP_FROM` | From address used for due-task notification emails. | `Taskapp <notifications@example.com>` |
| `NOTIFICATION_POLL_CRON` | Cron expression controlling how frequently incomplete due tasks without a notification timestamp are checked. | `* * * * *` |

`NEXT_PUBLIC_API_URL` is embedded into the browser bundle during the Next.js build. Set it to the final browser-accessible API URL before running `npm run build` or building the Docker image.

Do not commit `.env`. The repository’s `.gitignore` and `.dockerignore` exclude local environment files, but deployment secrets should still be supplied through the target platform’s secret manager.

## Running the Application

### Local development

Start the frontend and Express API using the root development script:

```bash
npm run dev
```

The expected local endpoints are:

- Frontend: `http://localhost:3000`
- Express API: `http://localhost:4000`
- API health check: `http://localhost:4000/health`

Verify the API:

```bash
curl http://localhost:4000/health
```

Expected response:

```json
{"status":"ok"}
```

The Express startup process verifies the MySQL connection before accepting traffic. It also starts the due-task notification scheduler. Database or required authentication configuration errors should therefore be resolved before testing signup or task operations.

### Production build and startup

Set the production values, especially the browser-visible `NEXT_PUBLIC_API_URL`, and build the Next.js application:

```bash
npm run build
```

Start the production Next.js and Express processes through the root start script:

```bash
npm start
```

The Next.js configuration supports standalone production Docker execution.

### Docker startup

Build and run the frontend, API, notification scheduler, and MySQL database:

```bash
docker compose up --build
```

Run in the background:

```bash
docker compose up --build -d
```

Inspect service logs:

```bash
docker compose logs -f
```

Stop the services without deleting database data:

```bash
docker compose down
```

### Tests

Run the Jest test suite:

```bash
npm test
```

Jest uses `jest.config.js` and executes Node-based tests under `server/tests`. The test suite covers:

- bcrypt password hashing and verification
- JWT issuance, payload preservation, verification, and invalid-token rejection
- Task field normalization and validation
- Status and due-date validation
- Title and description limits
- Kanban reorder payload validation
- Duplicate and malformed task ID rejection

Tests requiring environment settings should use safe test-only values, matching the approach in `.github/workflows/ci.yml`.

### REST API reference

See `API.md` for the complete API contract, including request bodies, response shapes, authentication requirements, validation failures, and status codes.

Primary routes include:

- `GET /health`
- `POST /api/auth/signup`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/tasks`
- `POST /api/tasks`
- `PATCH /api/tasks/reorder`
- `PUT /api/tasks/:id`
- `DELETE /api/tasks/:id`

Authenticated routes require:

```http
Authorization: Bearer <jwt>
```

The frontend stores the JWT in browser `localStorage` through `lib/auth.js` and attaches it to API calls through `lib/api.js`.

### Notification behavior

The scheduler is started by `server/index.js`. On each cron interval it:

1. Queries incomplete tasks whose due date has arrived and whose `notified_at` value is empty.
2. Loads the owning user information.
3. Sends a plain-text and HTML email through Nodemailer.
4. Atomically marks successfully delivered reminders as notified.
5. Logs failures without marking the task, allowing a later poll to retry.

Relevant task updates reset `notified_at`, allowing a new reminder when due-date information changes as defined by the task service.

## Project Structure

### Root configuration

- `package.json` — Defines shared Next.js and Express development scripts, production startup, builds, Jest tests, and all application dependencies.
- `next.config.js` — Configures the Next.js App Router application and standalone-compatible production output.
- `jest.config.js` — Configures Node-based Jest tests under `server/tests`.
- `.env.example` — Contains non-secret example values for every required environment variable.
- `.gitignore` — Excludes dependencies, builds, coverage, local environment files, logs, and editor artifacts.
- `.dockerignore` — Reduces the Docker build context and excludes secrets, dependencies, build output, coverage, logs, and Git metadata.
- `Dockerfile` — Installs the shared Node.js project, builds Next.js with `NEXT_PUBLIC_API_URL`, and starts the production frontend and API.
- `docker-compose.yml` — Defines the Taskapp and MySQL services, health checks, ports, runtime settings, schema initialization, and persistent storage.
- `schema.sql` — Creates the MySQL users and tasks schema.
- `README.md` — Provides the main project usage and development documentation.
- `API.md` — Documents all public REST endpoints and response formats.

### Next.js application

- `app/layout.jsx` — Root layout, metadata, viewport configuration, shared HTML body, and global stylesheet import.
- `app/globals.css` — Responsive styling for authentication, the dashboard, Kanban columns, cards, forms, modals, errors, and mobile layouts.
- `app/page.jsx` — Root client entry that redirects users according to JWT availability.
- `app/login/page.jsx` — Login route.
- `app/signup/page.jsx` — Registration route.
- `app/dashboard/page.jsx` — Authenticated dashboard route.

### Frontend components

- `components/AuthForm.jsx` — Shared login and signup form with validation, API calls, token persistence, and navigation.
- `components/Header.jsx` — Dashboard header with user information, task creation, and logout controls.
- `components/Dashboard.jsx` — Coordinates authentication, task loading, mutations, modal state, redirects, and dashboard rendering.
- `components/KanbanBoard.jsx` — dnd-kit drag-and-drop context and optimistic status/position updates.
- `components/TaskColumn.jsx` — Droppable task status column and sortable task list.
- `components/TaskCard.jsx` — Sortable task card with due-date state and edit/delete controls.
- `components/TaskModal.jsx` — Accessible create/edit form with status and due-date handling.

### Frontend libraries

- `lib/auth.js` — Browser-safe JWT storage and authentication helpers using `localStorage`.
- `lib/api.js` — Authenticated fetch wrapper and functions for all authentication and task API operations.

### Express server

- `server/index.js` — Loads configuration, verifies MySQL, starts Express and the scheduler, and performs graceful shutdown.
- `server/app.js` — Configures JSON parsing, CORS, health checks, routers, JSON 404 handling, and centralized errors.
- `server/config/db.js` — Creates the `mysql2/promise` connection pool and provides verification and shutdown helpers.
- `server/middleware/auth.js` — Verifies bearer tokens, confirms the user still exists, and populates `req.user`.
- `server/middleware/errorHandler.js` — Produces consistent JSON errors and logs unexpected failures.
- `server/routes/authRoutes.js` — Declares signup, login, and current-user routes.
- `server/routes/taskRoutes.js` — Declares protected task CRUD and reorder routes.
- `server/controllers/authController.js` — Validates authentication requests, hashes passwords, checks credentials, and issues JWTs.
- `server/controllers/taskController.js` — Connects authenticated task routes to the task service.
- `server/services/taskService.js` — Implements ownership-scoped task CRUD, validation, position maintenance, and transactional reordering.
- `server/services/emailService.js` — Configures Nodemailer and sends escaped plain-text and HTML due-task reminders.
- `server/services/notificationScheduler.js` — Polls due tasks, sends reminders, records successful sends, and schedules future checks.
- `server/utils/auth.js` — Wraps bcrypt and JWT operations.
- `server/utils/taskRules.js` — Defines task statuses and task/reorder validation rules.

### Tests and CI

- `server/tests/auth.test.js` — Tests password and JWT utilities.
- `server/tests/taskRules.test.js` — Tests task and reorder validation.
- `.github/workflows/ci.yml` — Installs dependencies, supplies safe test settings, runs Jest, and verifies the Next.js production build on pushes and pull requests.

## Next Steps / Production Considerations

1. **Replace all example secrets.** Generate a high-entropy `JWT_SECRET` and unique database and SMTP passwords. Do not reuse `DB_ROOT_PASSWORD` as `DB_PASSWORD`.

2. **Use a managed secret store.** Inject secrets through the production platform rather than storing a production `.env` file in the image or repository.

3. **Configure public URLs carefully.** Set `FRONTEND_URL` to the exact deployed frontend origin and set `NEXT_PUBLIC_API_URL` to the API URL reachable from browsers. Rebuild Next.js after changing `NEXT_PUBLIC_API_URL`.

4. **Enable HTTPS.** Terminate TLS at a reverse proxy, ingress controller, or managed load balancer. Use HTTPS URLs for both frontend and API in production.

5. **Harden token handling.** The generated frontend stores JWTs in `localStorage`. Review the application’s XSS protections and consider secure, `HttpOnly`, `SameSite` cookies if the deployment’s security model requires reducing token exposure to browser JavaScript.

6. **Restrict CORS.** Keep `FRONTEND_URL` limited to the deployed frontend origin rather than allowing arbitrary origins.

7. **Use least-privilege MySQL credentials.** The API should connect with `DB_USER`, not the MySQL root account. Restrict network access to the database and enable encrypted database connections when supported.

8. **Plan database migrations and backups.** `schema.sql` is suitable for initial provisioning, but production schema changes should use a versioned migration process. Configure automated backups and regularly test restoration.

9. **Coordinate scheduler instances.** Each Express process starts a notification scheduler. If the API is horizontally scaled, multiple instances may poll simultaneously. Although successful notification marking is atomic, production deployments should consider a dedicated worker, distributed locking, or a durable job queue to minimize duplicate delivery risks.

10. **Configure SMTP delivery.** Use a verified sender domain, SPF, DKIM, and DMARC. Prefer provider-issued application tokens over account passwords. Confirm that `SMTP_SECURE` and `SMTP_PORT` match the provider.

11. **Tune the notification schedule.** The example `* * * * *` runs every minute. Choose a frequency appropriate for expected database volume and reminder timing.

12. **Add observability.** Forward API, scheduler, database, and SMTP errors to centralized logging and monitoring. Add alerts for repeated scheduler failures, database connection failures, and elevated HTTP error rates.

13. **Review process supervision.** In non-Docker deployments, run `npm start` under a process supervisor or orchestration platform that restarts failed processes and forwards `SIGINT` and `SIGTERM` for graceful shutdown.

14. **Preserve Docker database data.** Treat the Compose MySQL volume as persistent state. Do not use `docker compose down -v` in environments where data must be retained.

15. **Run CI checks before deployment.** At minimum, execute:

    ```bash
    npm test
    npm run build
    ```

    Keep `.github/workflows/ci.yml` enabled for both pushes and pull requests.

16. **Expand test coverage.** Add API integration tests against a test database, frontend component tests, drag-and-drop interaction tests, SMTP transport tests, and end-to-end authentication and task-management tests.

17. **Review API limits and abuse controls.** Consider request-size limits, login rate limiting, account lockout or throttling, security headers, and audit logging before exposing the application publicly.

## Database Provisioning

A mysql database has been automatically provisioned for this app.

- **Database:** taskapp
- **Host:** testdb.gridiron-app.com
- **Port:** 3306
- **User:** victorgridirontestcom
- **Credentials stored in Vault at:** `secret/data/mysql/taskapp`

Retrieve the password securely from Vault and set it as an environment variable (e.g. `DB_PASSWORD`) in your deployment settings — do not commit it to source control.
