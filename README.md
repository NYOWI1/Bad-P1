# Campus Event Management and Booking System

The app supports event discovery, organizer event management, student registration, room booking, attendance tracking, administrator role/room/department/API-key management, Microsoft Entra ID authentication, Google Calendar sync hooks, Azure Key Vault production secrets, and protected peer API access.

## Stack

- React 19, Vite, Tailwind CSS, React Router, Lucide icons
- Node.js 22, Express 5, Zod validation
- Prisma ORM with PostgreSQL
- JWT authentication with Microsoft Entra ID access-token verification
- Docker Compose and Nginx reverse proxy under `/project`

## Project Layout

```text
client/                 React/Vite/Tailwind web app
server/                 Express API, Prisma schema, migrations, tests
deploy/nginx/           Nginx config for /project and /project/api
scripts/dev.mjs         One-command local dev runner with embedded PGlite
docker-compose.yml      Production-style web/API compose file
docker-compose.local.yml Local development override with PostgreSQL
```

## Local Development

Install dependencies:

```bash
npm install
```

Start the whole app with an embedded PostgreSQL-compatible PGlite socket:

```bash
npm run dev
```

Open:

```text
http://127.0.0.1:5173/project/
```

The dev runner applies migrations, seeds development seed data, starts the API on port `3000`, and starts Vite on port `5173`.

Development seed login is available only when DEMO_AUTH=true. Use it only for local testing:

- Student: browse events, register, cancel registration, download calendar files
- Organizer: create/edit events, publish/close/cancel events, manage attendees
- Admin: manage users, rooms, departments, API keys, and integration status

## Environment

Copy the example file for manual local PostgreSQL use:

```bash
cp server/.env.example server/.env
```

Important variables:

```text
DATABASE_URL=postgresql://campus:campus@localhost:5432/campus?schema=public
JWT_SECRET=replace-with-at-least-32-random-characters
DEMO_AUTH=false
CLIENT_ORIGIN=http://localhost:5173

MICROSOFT_TENANT_ID=
MICROSOFT_CLIENT_ID=
MICROSOFT_API_CLIENT_ID=
MICROSOFT_API_SCOPE=

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REFRESH_TOKEN=
GOOGLE_CALENDAR_ID=

AZURE_KEY_VAULT_URL=
```

Production refuses to start if `DEMO_AUTH=true`, `JWT_SECRET` is shorter than 32 characters, or `AZURE_KEY_VAULT_URL` is missing.

## Database

Generate Prisma client:

```bash
npm run db:generate
```

Apply migrations:

```bash
npm run db:migrate
```

Seed development seed data:

```bash
npm run db:seed
```

The migration includes database-level checks for valid event time ranges, registration deadlines, and event capacity.

## API

Main base path:

```text
/project/api
```

Compatibility base path:

```text
/api
```

Key endpoints:

```text
GET    /project/api/health
GET    /project/api/config
POST   /project/api/auth/demo        # development only
POST   /project/api/auth/microsoft
GET    /project/api/events
GET    /project/api/events/:id
POST   /project/api/events
PATCH  /project/api/events/:id
POST   /project/api/events/:id/publish
POST   /project/api/events/:id/close
DELETE /project/api/events/:id
POST   /project/api/events/:id/registrations
DELETE /project/api/events/:id/registrations/me
GET    /project/api/events/:id/registrations
PATCH  /project/api/registrations/:id
GET    /project/api/rooms
POST   /project/api/rooms
PATCH  /project/api/rooms/:id
DELETE /project/api/rooms/:id
GET    /project/api/departments
POST   /project/api/departments
GET    /project/api/users
PATCH  /project/api/users/:id/role
PATCH  /project/api/users/:id/department
GET    /project/api/admin/api-keys
POST   /project/api/admin/api-keys
DELETE /project/api/admin/api-keys/:id
GET    /project/api/peer/v1/events
GET    /project/api/peer/v1/events/:id
POST   /project/api/peer/v1/events/:id/registrations
```

## Business Rules

- Anonymous users can only view published events.
- Students cannot create or manage events.
- Organizers can manage their own events.
- Admins can manage all events, rooms, departments, users, and API keys.
- Draft events are private until published.
- Cancelled events are hidden from public discovery.
- Registration is blocked after the deadline, after the event closes, or when capacity is full.
- Duplicate active registrations are rejected.
- Concurrent registrations lock the event row to prevent overselling.
- Room bookings reject overlapping events and insufficient room capacity.
- Attendance can be marked only after the event starts.
- Cancelled registrations cannot be marked attended or absent.

## Microsoft Entra ID

Create two app registrations:

1. SPA client app for the React frontend.
2. API app registration that exposes the API scope.

Set:

```text
MICROSOFT_TENANT_ID=<tenant id>
MICROSOFT_CLIENT_ID=<SPA client id>
MICROSOFT_API_CLIENT_ID=<API application id URI or client id audience>
MICROSOFT_API_SCOPE=<scope requested by MSAL>
```

The API verifies JWT issuer, audience, scope, and authorized client. Roles are loaded from the application database, so admin role changes apply to existing Microsoft sessions.

## Google Calendar

Set Google OAuth credentials and `GOOGLE_CALENDAR_ID`. Publishing an event attempts to create or update a Google Calendar event. If Google credentials are missing, the event still publishes with `calendarSyncStatus=NOT_CONFIGURED`. Organizers and admins can retry calendar sync from the event management flow.

## Peer API Access

Admins create hashed API keys in **Admin > API keys**. The raw key is shown once and only its SHA-256 hash is stored.

Admin API key endpoints require a signed-in admin JWT:

```text
GET    /project/api/admin/api-keys
POST   /project/api/admin/api-keys
DELETE /project/api/admin/api-keys/:id
```

Create key request:

```json
{
  "ownerLabel": "Partner Team Name",
  "scope": ["peer:events:read", "peer:events:register"]
}
```

Create key response includes the one-time raw key:

```json
{
  "id": "...",
  "ownerLabel": "Partner Team Name",
  "scope": ["peer:events:read", "peer:events:register"],
  "active": true,
  "createdAt": "...",
  "key": "campus_..."
}
```

Peer systems call your exposed endpoints with the raw key in the `x-api-key` header:

```text
x-api-key: campus_...
```

Exposed peer endpoints:

```text
GET  /project/api/peer/v1/events
GET  /project/api/peer/v1/events/:id
POST /project/api/peer/v1/events/:id/registrations
```

Peer registration request body:

```json
{
  "externalStudentId": "partner-user-123",
  "name": "Student Name",
  "email": "student@example.com",
  "department": "Computer Science"
}
```

Inbound peer API registrations reuse the same capacity, deadline, duplicate, and cancellation rules as normal student registrations. They appear in the attendees list with source `External API`.

## Docker

Production-style build:

```bash
AZURE_KEY_VAULT_URL=https://your-vault.vault.azure.net/ \
MICROSOFT_TENANT_ID=... \
MICROSOFT_CLIENT_ID=... \
MICROSOFT_API_CLIENT_ID=... \
MICROSOFT_API_SCOPE=... \
CLIENT_ORIGIN=https://your-domain.example \
WEB_PORT=80 \
docker compose up --build -d
```

Local Docker development stack with PostgreSQL:

```bash
docker compose -f docker-compose.yml -f docker-compose.local.yml up --build
```

Open:

```text
http://localhost:8080/project/
```

## VPS Deployment

Recommended production setup:

1. Provision PostgreSQL or use a managed PostgreSQL service.
2. Store `DATABASE_URL`, `JWT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`, and `GOOGLE_CALENDAR_ID` in Azure Key Vault. Secret names use hyphens, for example `DATABASE-URL`.
3. Give the VPS managed identity, workload identity, or service principal read access to the Key Vault.
4. Run `docker compose up --build -d`.
5. Put HTTPS in front of the web container with Nginx or your cloud load balancer.

Example host Nginx block:

```nginx
server {
  listen 443 ssl http2;
  server_name your-domain.example;

  ssl_certificate /etc/letsencrypt/live/your-domain.example/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/your-domain.example/privkey.pem;

  location /project/ {
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto https;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_pass http://127.0.0.1:80/project/;
  }
}
```

The API container loads Key Vault secrets, runs `prisma migrate deploy`, connects to PostgreSQL, and then starts Express.

## Verification

Run:

```bash
npm test
npm run build
```

Current verification:

- `npm test`: 15 backend integration tests passing
- `npm run build`: production frontend build passing

`npm audit` currently reports four high-severity findings in Prisma CLI transitive dependencies (`@prisma/config` through `deepmerge-ts` and `effect`). npm recommends downgrading `prisma` to `6.12.0`; this project keeps `prisma` and `@prisma/client` aligned at `6.19.0` to avoid a generated-client/tooling mismatch.
