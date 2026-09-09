# Campus Event Management & Booking System

## Project Development Instructions

## 1. Project Overview

Build a full-stack Campus Event Management & Booking System for a university.

The system allows:

- ADMIN users to manage the whole system.
- ORGANIZER users to create and manage campus events.
- STUDENT users to browse and register for events.
- The backend to integrate with Google Calendar.
- The backend to communicate with the peer project:
  AssistLink - Campus Research & Teaching Assistantship Platform.

The application must satisfy all course requirements including:

- Linux VPS deployment
- Nginx reverse proxy
- HTTPS / Let's Encrypt SSL
- Node.js + Express REST API
- PostgreSQL or MySQL
- Prisma ORM
- Microsoft Active Directory authentication
- JWT authentication
- Role-Based Access Control
- Azure Key Vault
- Third-party API integration
- Peer API integration
- GitHub source control
- Docker Compose or automated deployment

---

# 2. Recommended Technology Stack

## Frontend

Use:

- React
- Vite
- React Router
- Material UI or another simple UI library
- Fetch API or Axios

The frontend should communicate only with the REST API.

Example:

Frontend:
http://localhost:5173

Backend:
http://localhost:3000

## Backend

Use:

- Node.js
- Express.js
- Prisma ORM
- PostgreSQL

Recommended supporting packages:

- express
- cors
- helmet
- jsonwebtoken
- jwks-rsa or MSAL library
- @prisma/client
- zod
- axios
- bcrypt
- @azure/identity
- @azure/keyvault-secrets

---

# 3. Project Architecture

Use a structure similar to:

campus-event-booking/
│
├── client/
│ ├── src/
│ │ ├── components/
│ │ ├── pages/
│ │ ├── services/
│ │ ├── context/
│ │ ├── hooks/
│ │ └── App.jsx
│ │
│ ├── package.json
│ └── vite.config.js
│
├── server/
│ ├── src/
│ │ ├── controllers/
│ │ ├── routes/
│ │ ├── middleware/
│ │ ├── services/
│ │ ├── utils/
│ │ ├── config/
│ │ └── app.js
│ │
│ ├── prisma/
│ │ ├── schema.prisma
│ │ └── migrations/
│ │
│ ├── package.json
│ └── Dockerfile
│
├── docker-compose.yml
├── .gitignore
├── README.md
└── instruction.md

---

# 4. Core Database Entities

The database should follow the approved ERD.

Required entities:

1. User
2. Department
3. Event
4. EventRegistration
5. Room
6. EventRoomBooking
7. ApiKey

---

# 5. Prisma Schema Requirements

## User

Suggested fields:

- id
- adObjectId
- email
- name
- phone
- role
- departmentId
- createdAt
- updatedAt

Roles:

- ADMIN
- ORGANIZER
- STUDENT

## Department

Fields:

- id
- name
- code

## Event

Fields:

- id
- organizerId
- departmentId
- title
- description
- category
- location
- capacity
- startAt
- endAt
- status
- googleCalendarId
- createdAt
- updatedAt

Recommended Event Status:

- DRAFT
- PUBLISHED
- CANCELLED
- CLOSED

## EventRegistration

Fields:

- id
- eventId
- studentId
- status
- source
- externalRefId
- registeredAt

Recommended registration status:

- REGISTERED
- CANCELLED
- ATTENDED
- ABSENT

## Room

Fields:

- id
- name
- building
- capacity

## EventRoomBooking

Fields:

- id
- eventId
- roomId
- startAt
- endAt

## ApiKey

Fields:

- id
- ownerLabel
- keyHash
- scope
- active
- createdAt

IMPORTANT:

Never store the original peer API key in plain text.

Store only the hashed version of the API key.

---

# 6. Relationships

Required relationships:

Department
|
└── Users

Department
|
└── Events

User / Organizer
|
└── Events

Student
|
└── EventRegistration

Event
|
└── EventRegistration

Event
|
└── EventRoomBooking

Room
|
└── EventRoomBooking

---

# 7. Authentication

Microsoft Active Directory must be used for university user authentication.

Use:

- Microsoft Entra ID / Azure AD
- OAuth2 / OIDC
- MSAL where appropriate

Basic authentication flow:

1. User opens the application.
2. User selects "Login with Microsoft".
3. Microsoft authenticates the university account.
4. The application receives the authenticated Microsoft identity.
5. Backend validates the Microsoft token.
6. Backend finds or creates the corresponding User record.
7. Backend determines the user's application role.
8. Backend issues or uses a JWT for protected application requests.

---

# 8. JWT Authentication

Protected API requests should require:

Authorization: Bearer <token>

Create middleware such as:

authMiddleware

Responsibilities:

- Read Authorization header.
- Validate JWT.
- Identify current user.
- Add user information to req.user.
- Reject unauthenticated requests.

---

# 9. Role-Based Access Control

Create RBAC middleware.

Example:

requireRole("ADMIN")

or:

requireRole("ADMIN", "ORGANIZER")

## ADMIN

Permissions:

- View published events
- Create events
- Edit any event
- Cancel any event
- Manage users
- Manage departments
- Manage rooms
- View registrations
- Manage attendance
- Issue peer API keys
- Revoke peer API keys

## ORGANIZER

Permissions:

- View events
- Create events
- Edit own events
- Cancel own events
- Publish own events
- View registrations for own events
- Mark attendance for own events

## STUDENT

Permissions:

- View published events
- View event details
- Register for events
- Cancel own registration
- View own registrations

Students must NOT:

- Create events
- Edit events
- Manage rooms
- Manage departments

---

# 10. User API

Example endpoints:

GET /api/users/me

Returns the currently authenticated user.

ADMIN endpoints:

GET /api/users

PATCH /api/users/:id/role

---

# 11. Event API

Required routes:

GET /api/events

Return published events.

GET /api/events/:id

Return one event.

POST /api/events

Allowed:

ADMIN
ORGANIZER

PATCH /api/events/:id

ADMIN:
Can update any event.

ORGANIZER:
Can update only events they created.

DELETE /api/events/:id

ADMIN:
Can cancel any event.

ORGANIZER:
Can cancel only their own event.

POST /api/events/:id/publish

Publish an event.

Publishing should also trigger Google Calendar integration.

POST /api/events/:id/close

Close registration for an event.

---

# 12. Student Registration API

POST /api/events/:id/registrations

STUDENT only.

Before accepting registration:

1. Verify event exists.
2. Verify event status is PUBLISHED.
3. Verify registration period is valid.
4. Verify student is not already registered.
5. Count current registrations.
6. Compare registration count with event capacity.
7. Reject registration if full.
8. Create EventRegistration.

Example error:

HTTP 409

{
"message": "Event is full"
}

Cancel registration:

DELETE /api/events/:id/registrations/me

View student's registrations:

GET /api/registrations/me

---

# 13. Event Capacity Control

The system must prevent registrations beyond the event capacity.

Example:

Event capacity = 50

Current active registrations = 50

New registration:

REJECT

Never rely only on frontend validation.

Capacity must always be validated by the backend.

---

# 14. Room Management

ADMIN should manage rooms.

Endpoints:

GET /api/rooms

POST /api/rooms

PATCH /api/rooms/:id

DELETE /api/rooms/:id

Before assigning a room to an event:

Check:

- Room exists.
- Room capacity is sufficient.
- Room is not already booked during that time.

---

# 15. Room Conflict Detection

Before creating EventRoomBooking:

Check for overlapping bookings.

Example:

Existing:

10:00 - 12:00

Requested:

11:00 - 13:00

Result:

REJECT

Possible response:

HTTP 409

{
"message": "Room is already booked during this time"
}

---

# 16. Google Calendar Integration

Third-party API:

Google Calendar API

When an event becomes PUBLISHED:

1. Validate the event.
2. Validate its room/time.
3. Create a Google Calendar event.
4. Receive the Google Calendar event ID.
5. Save the ID to:

Event.googleCalendarId

If the event time changes:

Update the corresponding Google Calendar event.

If the event is cancelled:

Update or cancel the corresponding Google Calendar event.

Create a service:

services/googleCalendar.service.js

Suggested functions:

createCalendarEvent()

updateCalendarEvent()

cancelCalendarEvent()

Google Calendar API logic should NOT be placed directly inside controllers.

---

# 17. Azure Key Vault

Production secrets must NOT be stored inside:

.env

Do NOT commit production secrets to GitHub.

Use Azure Key Vault to retrieve sensitive configuration.

Examples:

DATABASE_URL

JWT_SECRET

GOOGLE_CLIENT_SECRET

GOOGLE_REFRESH_TOKEN

ASSISTLINK_API_KEY

PEER_API_KEY

Use:

@azure/identity

@azure/keyvault-secrets

Example architecture:

Azure VPS
|
↓
Application
|
↓
Azure Key Vault
|
├── DATABASE_URL
├── JWT_SECRET
├── Google credentials
└── Peer API credentials

Create:

server/src/config/keyVault.js

The application should fetch secrets when the backend starts.

---

# 18. Development vs Production Secrets

Local development may use local environment variables if required for development.

Production MUST use Azure Key Vault.

Never commit:

.env

\*.pem

private keys

client secrets

API keys

Add these to:

.gitignore

---

# 19. Peer API Integration

Peer project:

AssistLink - Campus Research & Teaching Assistantship Platform

The integration has TWO directions:

1. We expose an API to AssistLink.
2. We consume an API from AssistLink.

---

# 20. Peer API Authentication

Peer APIs use:

x-api-key

Example request:

GET /events/api/peer/v1/events

Headers:

x-api-key: <issued-api-key>

The backend should:

1. Read x-api-key.
2. Hash the supplied key.
3. Compare it against ApiKey.keyHash.
4. Check active = true.
5. Check the API key scope.
6. Reject invalid requests.

Possible response:

HTTP 401

{
"message": "Invalid API key"
}

---

# 21. API We Expose to AssistLink

The proposal specifies these peer endpoints.

## List Events

GET /events/api/peer/v1/events

Purpose:

Return published campus events.

Authentication:

x-api-key

The response should contain only required information.

Example:

{
"events": [
{
"id": 10,
"title": "TA Training Workshop",
"category": "Training",
"location": "Room 402",
"capacity": 50,
"startAt": "...",
"endAt": "..."
}
]
}

---

## Get One Event

GET /events/api/peer/v1/events/:id

Purpose:

Allow AssistLink to retrieve details for one published event.

Authentication:

x-api-key

---

## Register AssistLink Student

POST /events/api/peer/v1/events/:id/registrations

Authentication:

x-api-key

Example request:

{
"externalStudentId": "12345",
"name": "Student Name",
"email": "student@university.edu",
"department": "Computer Science"
}

The backend must still perform:

- Capacity checking
- Duplicate checking
- Event status checking

Set:

source = "ASSISTLINK"

Store the external reference where appropriate.

---

# 22. API We Consume From AssistLink

Required endpoint:

GET {assistlink}/api/peer/v1/events/:externalEventId/registrations

Purpose:

Retrieve students registered through AssistLink.

Authentication:

x-api-key

Create:

services/assistLink.service.js

Example function:

getAssistLinkRegistrations(externalEventId)

Do NOT call AssistLink directly from the frontend.

Correct:

Frontend
↓
Our Backend
↓
AssistLink Backend

Incorrect:

Frontend
↓
AssistLink

---

# 23. Peer API Data Privacy

Only exchange necessary data.

The approved proposal identifies information such as:

- Name
- Email
- Department
- Registration time

Do not send unrelated user information.

---

# 24. API Key Generation

ADMIN should be able to create a peer API key.

Example:

POST /api/admin/api-keys

Process:

1. Generate a secure random API key.
2. Return the original key only once.
3. Hash the API key.
4. Store only the hash.
5. Store ownerLabel.
6. Store scope.
7. Store active status.

Example scopes:

assistlink:events:read

assistlink:events:register

---

# 25. Department Management

ADMIN routes:

GET /api/departments

POST /api/departments

PATCH /api/departments/:id

DELETE /api/departments/:id

Example departments:

- Computer Science
- Business Administration
- Engineering

---

# 26. Attendance

ORGANIZER should be able to view attendees for their own events.

Example:

GET /api/events/:id/registrations

ADMIN can view all event registrations.

ORGANIZER can view only registrations belonging to their own event.

Attendance can be marked using:

PATCH /api/registrations/:id

Example:

{
"status": "ATTENDED"
}

---

# 27. Validation

Validate all important API inputs.

Recommended library:

Zod

Validate:

- Email
- Event title
- Event start time
- Event end time
- Capacity
- Room ID
- Registration requests
- Peer API payloads

Example condition:

endAt must be later than startAt.

---

# 28. Error Handling

Use centralized Express error handling.

Create:

middleware/errorHandler.js

Use appropriate HTTP codes.

200
Successful request

201
Created

400
Invalid input

401
Not authenticated

403
Not authorized

404
Resource not found

409
Conflict

500
Server error

Example error response:

{
"error": {
"message": "Room is already booked"
}
}

---

# 29. Security Requirements

Use:

helmet()

Configure CORS properly.

Validate request bodies.

Protect authenticated routes.

Protect peer routes with x-api-key.

Do not expose stack traces in production.

Do not return secrets from APIs.

Hash API keys.

Validate Microsoft authentication tokens.

Apply RBAC on the backend.

Never depend on frontend permissions for security.

---

# 30. Database Migrations

Use Prisma migrations.

Development:

npx prisma migrate dev

Production:

npx prisma migrate deploy

Do NOT manually modify production database tables when Prisma migrations should be used.

---

# 31. Prisma Commands

Generate client:

npx prisma generate

Create migration:

npx prisma migrate dev --name init

Open Prisma Studio:

npx prisma studio

Production migration:

npx prisma migrate deploy

---

# 32. Docker

The application should support Docker.

Recommended containers:

- Backend
- Frontend or static frontend build
- PostgreSQL if database is hosted locally

Recommended:

docker-compose.yml

Example architecture:

Nginx
|
+---- /events → React frontend
|
+---- /events/api → Express backend
|
↓
PostgreSQL

---

# 33. Deployment URL

The project must run under a distinct path.

Recommended:

https://your-domain.com/events

Backend API:

https://your-domain.com/events/api

Peer API:

https://your-domain.com/events/api/peer/v1

Do NOT break the existing:

/content

/api

routes used by previous class projects.

---

# 34. Nginx Reverse Proxy

Create a new location block specifically for this project.

Concept:

/events/
→ frontend

/events/api/
→ Node.js backend

Be careful with route precedence because the VPS may already contain:

/content

/api

The new route must coexist with those routes.

---

# 35. HTTPS

Use:

Let's Encrypt

Certbot

Final public system must use:

https://

Do not present the final project using only:

http://server-ip:3000

---

# 36. Linux VPS

Deploy on a hardened Linux server.

Allowed examples:

- Azure VM
- Oracle Cloud VPS

Recommended production steps:

1. Update packages.
2. Configure firewall.
3. Disable unnecessary ports.
4. Use SSH keys.
5. Do not expose PostgreSQL publicly.
6. Run applications as non-root where practical.
7. Install Docker.
8. Install Nginx.
9. Configure Let's Encrypt.
10. Deploy project.

---

# 37. Firewall

Recommended exposed ports:

22
SSH

80
HTTP

443
HTTPS

Do not expose:

3000

5432

directly to the public internet unless specifically required.

Nginx should communicate internally with the application.

---

# 38. Source Control

All code must be stored on GitHub.

Use proper commits.

Examples:

feat: add event registration

feat: integrate Google Calendar

feat: implement Microsoft AD authentication

feat: add peer API authentication

fix: prevent duplicate event registration

docs: add peer API documentation

Never push secrets.

---

# 39. Git Branches

Recommended:

main

develop

feature/auth

feature/events

feature/registration

feature/google-calendar

feature/peer-api

feature/deployment

Merge stable code into main.

---

# 40. README.md Requirements

The final README must include:

## Project Name

Campus Event Management & Booking

## Project Description

Explain the problem and solution.

## Team Members

List all team members.

## Architecture

Explain:

Frontend
Backend
Database
Azure Key Vault
Google Calendar
AssistLink
Nginx
VPS

## Tech Stack

List all technologies.

## Local Setup

Explain how to:

- Clone repository
- Install dependencies
- Configure development environment
- Run Prisma migrations
- Start frontend
- Start backend

## Deployment

Explain:

- Docker
- VPS
- Nginx
- SSL
- Azure Key Vault

## RBAC

Document:

ADMIN
ORGANIZER
STUDENT

## Third Party Integration

Explain Google Calendar API.

## Peer API Documentation

Explicitly document:

Peer Partner:

AssistLink - Campus Research & Teaching Assistantship Platform

We expose:

GET /events/api/peer/v1/events

GET /events/api/peer/v1/events/:id

POST /events/api/peer/v1/events/:id/registrations

We consume:

GET {assistlink}/api/peer/v1/events/:externalEventId/registrations

Authentication:

x-api-key

---

# 41. Frontend Pages

Recommended frontend pages:

## Public / Auth

Login

## Student

Event List

Event Details

My Registrations

## Organizer

Organizer Dashboard

Create Event

Edit Event

My Events

Event Registrations

Attendance

## Admin

Admin Dashboard

Users

Departments

Rooms

Events

API Keys

---

# 42. Minimum Demonstration Flow

The final system should be able to demonstrate this complete workflow.

### Demo 1 — Login

Login using Microsoft university authentication.

### Demo 2 — RBAC

Show that:

ADMIN has administrator functions.

ORGANIZER can create an event.

STUDENT cannot create an event.

### Demo 3 — Create Event

Organizer creates:

TA Training Workshop

Set:

- Date
- Time
- Room
- Capacity

### Demo 4 — Publish Event

Organizer publishes event.

Backend creates corresponding Google Calendar event.

Show:

googleCalendarId

### Demo 5 — Student Registration

Student logs in.

Student opens event.

Student registers.

Database creates EventRegistration.

### Demo 6 — Capacity

Fill an event to capacity.

Attempt another registration.

Backend rejects it.

### Demo 7 — Peer API

Call:

GET /events/api/peer/v1/events

without API key.

Show:

401 Unauthorized

Then call with:

x-api-key

Show successful response.

### Demo 8 — AssistLink Integration

Our backend calls AssistLink.

Show registration data returned from their API.

### Demo 9 — Azure Key Vault

Show code responsible for retrieving secrets from Azure Key Vault.

Do NOT display the secret values.

### Demo 10 — Deployment

Open:

https://your-domain.com/events

Show:

- HTTPS
- Working frontend
- Working backend
- Nginx reverse proxy

---

# 43. Testing Requirements

At minimum test:

Authentication

RBAC

Event creation

Event update

Event registration

Duplicate registration

Capacity checking

Room conflicts

Peer API authentication

Invalid API keys

Google Calendar service

AssistLink API service

Recommended:

Jest

Supertest

---

# 44. Important Business Rules

The following rules must always be enforced by the backend.

1. Only ADMIN and ORGANIZER can create events.

2. ORGANIZER can modify only their own events.

3. ADMIN can manage all events.

4. Only STUDENT can make normal student registrations.

5. Students cannot register twice for the same event.

6. Registrations cannot exceed event capacity.

7. Cancelled events cannot accept registrations.

8. Unpublished events should not appear publicly.

9. Rooms cannot have overlapping event bookings.

10. Peer endpoints require a valid x-api-key.

11. API keys must not be stored in plain text.

12. Production secrets must come from Azure Key Vault.

13. Google Calendar operations must be handled by the backend.

14. Peer API calls must be made by the backend.

15. Authorization must be checked by the backend.

---

# 45. Development Priority

Build the project in this order.

## Phase 1

Project setup

- Express
- React
- PostgreSQL
- Prisma
- Basic Docker setup

## Phase 2

Database

- Prisma schema
- Migrations
- Seed data

## Phase 3

Authentication

- Microsoft AD
- JWT
- User synchronization

## Phase 4

RBAC

- ADMIN
- ORGANIZER
- STUDENT

## Phase 5

Core Events

- Event CRUD
- Departments
- Rooms

## Phase 6

Registration

- Student registration
- Capacity checking
- Cancellation
- Attendance

## Phase 7

Google Calendar

- Create calendar event
- Update calendar event
- Cancel calendar event

## Phase 8

Peer API

Expose:

- Event list
- Event detail
- Registration endpoint

Consume:

- AssistLink registration API

## Phase 9

Azure Key Vault

Move all production secrets into Key Vault.

## Phase 10

Deployment

- Docker
- Linux VPS
- Nginx
- HTTPS

## Phase 11

Testing

Test all major workflows.

## Phase 12

Documentation

Complete:

README.md

Peer API documentation

Architecture diagram

Setup instructions

---

# 46. Recommended Team Division

For three team members:

## Member 1 — Backend / Database

Responsible for:

- Prisma
- PostgreSQL
- Event API
- Registration
- Rooms
- Departments
- Validation

## Member 2 — Authentication / Integration

Responsible for:

- Microsoft AD
- JWT
- RBAC
- Azure Key Vault
- Google Calendar
- Peer API

## Member 3 — Frontend / Deployment

Responsible for:

- React frontend
- Dashboards
- API integration
- Docker
- Nginx
- VPS
- HTTPS

All team members should understand the whole architecture for the final presentation.

---

# 47. Definition of Done

The project is complete only when:

- [ ] Microsoft AD login works
- [ ] JWT authentication works
- [ ] ADMIN RBAC works
- [ ] ORGANIZER RBAC works
- [ ] STUDENT RBAC works
- [ ] Prisma migrations work
- [ ] PostgreSQL/MySQL database works
- [ ] Events can be created
- [ ] Events can be updated
- [ ] Events can be published
- [ ] Students can register
- [ ] Duplicate registration is prevented
- [ ] Capacity limits are enforced
- [ ] Rooms can be assigned
- [ ] Room conflicts are prevented
- [ ] Google Calendar API works
- [ ] Azure Key Vault retrieves production secrets
- [ ] Peer API endpoints are protected using x-api-key
- [ ] AssistLink can consume our API
- [ ] Our backend can consume AssistLink's API
- [ ] API keys are securely stored
- [ ] GitHub repository is complete
- [ ] README.md is complete
- [ ] Docker deployment works
- [ ] Nginx reverse proxy works
- [ ] Existing /content route still works
- [ ] Existing /api route still works
- [ ] Project runs under /events
- [ ] HTTPS works
- [ ] Live VPS system works

---

# 48. Final Project Goal

The final result should be a secure, deployed university event management platform demonstrating:

- Full REST API development
- Relational database design
- Prisma ORM
- Authentication
- Authorization
- Microsoft Active Directory
- Azure Key Vault
- Third-party API integration
- Backend-to-backend API integration
- API-key security
- Docker
- Linux deployment
- Nginx reverse proxy
- HTTPS
- GitHub source control

The priority is not to create an extremely large application.

The priority is to make all required course technologies work together correctly in one complete and demonstrable system.
