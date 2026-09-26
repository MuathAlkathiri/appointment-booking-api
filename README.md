# Appointment Booking API

A small appointment booking API built with NestJS, TypeScript, PostgreSQL, Prisma ORM, Socket.IO, and OpenAPI/Swagger.

The API provides predefined appointment slots, allows one active booking per slot, supports cancellation and re-booking, and broadcasts realtime availability changes.

No authentication, frontend, payment processing, or cloud deployment is included.

## Tech Stack

- TypeScript
- NestJS
- PostgreSQL
- Prisma ORM
- Socket.IO
- Swagger / OpenAPI
- Vitest
- Supertest

## Requirements

- Node.js 20.19+ recommended
- npm
- PostgreSQL

## Installation

Install dependencies:

```bash
npm install

Generate the Prisma client:
npm run prisma:generate

Environment Variables
Copy the example environment file:
cp .env.example .env

Example:
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/appointment_booking"
TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/appointment_booking_test"
PORT=3000

Update the PostgreSQL username, password, host, or database names as required for your local environment.
Database Setup
Create the development database:
createdb appointment_booking

Create the test database:
createdb appointment_booking_test

Apply migrations to the development database:
npm run prisma:migrate

Seed predefined appointment slots:
npm run prisma:seed

For a production-style migration deployment:
npm run prisma:migrate:deploy

Running the API
Start in development mode:
npm run start:dev

The API is available at:
http://localhost:3000

API Endpoints
GET /slots
Returns only currently available appointment slots.
Slots are ordered by:
1. startsAt ascending
2. id ascending
Example response:
{
  "slots": [
    {
      "id": "11111111-1111-4111-8111-111111111111",
      "startsAt": "2030-01-15T09:00:00.000Z",
      "endsAt": "2030-01-15T09:30:00.000Z"
    }
  ]
}

When no slots are available:
{
  "slots": []
}

POST /bookings
Creates an active booking.
Example request:
{
  "slotId": "11111111-1111-4111-8111-111111111111",
  "customerName": "Alex Morgan",
  "customerEmail": "alex@example.com"
}

Leading and trailing whitespace is removed from customerName and customerEmail before validation and persistence.
Successful response:
{
  "booking": {
    "id": "22222222-2222-4222-8222-222222222222",
    "slotId": "11111111-1111-4111-8111-111111111111",
    "customerName": "Alex Morgan",
    "customerEmail": "alex@example.com",
    "status": "active"
  }
}

Possible status codes:
- 201 booking created
- 400 VALIDATION_ERROR
- 404 SLOT_NOT_FOUND
- 409 SLOT_UNAVAILABLE
- 500 INTERNAL_ERROR
DELETE /bookings/{bookingId}
Cancels an active booking.
Cancellation changes the booking status from active to cancelled and makes the slot available again.
Cancelling an already cancelled booking is idempotent:
- returns 200
- returns the same cancelled booking
- does not perform another state change
- does not emit another realtime event
Cancelling an older cancelled booking does not affect a newer active booking for the same slot.
Possible status codes:
- 200 cancelled or already cancelled
- 400 VALIDATION_ERROR
- 404 BOOKING_NOT_FOUND
- 500 INTERNAL_ERROR
Error Format
All API errors follow this shape:
{
  "error": {
    "code": "SLOT_UNAVAILABLE",
    "message": "This slot already has an active booking."
  }
}

Internal database errors and stack traces are not exposed to clients.
Concurrency / Double Booking Protection
The database is the final authority for preventing double bookings.
The Booking table allows historical cancelled bookings, but PostgreSQL has a partial unique index:
CREATE UNIQUE INDEX "Booking_one_active_per_slot"
ON "Booking" ("slotId")
WHERE "status" = 'active';

This guarantees that only one active booking may exist for a slot, even when two valid requests arrive concurrently.
The application does not rely on a find-then-create check, because two concurrent requests could both observe the slot as available before either insert completes.
Instead:
1. the application verifies that the slot exists
2. it attempts to create the booking
3. PostgreSQL accepts exactly one active booking
4. a unique constraint violation is translated to 409 SLOT_UNAVAILABLE
This remains safe across multiple Node.js processes because the constraint is enforced by PostgreSQL rather than an in-memory lock.
The database also contains a check constraint ensuring:
endsAt > startsAt

Socket.IO
Socket.IO runs on the same server.
- namespace: /
- path: /socket.io
- no authentication
- no rooms
- no client application events are required
slot.booked
Emitted once after a booking is successfully persisted:
{
  "slotId": "11111111-1111-4111-8111-111111111111",
  "bookingId": "22222222-2222-4222-8222-222222222222",
  "available": false
}

slot.released
Emitted once when an active booking is successfully changed to cancelled:
{
  "slotId": "11111111-1111-4111-8111-111111111111",
  "bookingId": "22222222-2222-4222-8222-222222222222",
  "available": true
}

No event is emitted for:
- rejected booking requests
- validation errors
- missing resources
- repeated cancellation of an already cancelled booking
Customer information is never included in realtime events.
Durable delivery, replay, and exactly-once delivery guarantees are outside the scope of this exercise.
Testing Socket.IO Without a Frontend
Start the API:
npm run start:dev

In another terminal start the Socket.IO listener:
npm run socket:listen

Then create or cancel bookings through Swagger or curl.
The listener prints:
slot.booked
slot.released

with their payloads.
OpenAPI
Swagger UI:
GET http://localhost:3000/docs

Raw OpenAPI specification:
GET http://localhost:3000/openapi.json

The documentation describes the three HTTP endpoints, request validation, response schemas, error responses, status codes, examples, cancellation idempotency, and the absence of authentication.
Socket.IO is documented in this README rather than as HTTP operations.
Automated Tests
The required E2E tests use a real PostgreSQL database and exercise the HTTP API through Supertest.
The test database is separate from the development database.
Apply migrations to it before running tests:
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/appointment_booking_test" npm run prisma:migrate:deploy

Then run:
npm run test:e2e

The required automated tests verify:
1. a successful booking returns 201 and removes the slot from availability
2. two overlapping booking requests for the same slot return exactly one 201 and one 409, with exactly one active booking persisted
3. cancellation returns 200, releases the slot, and allows a new booking
Each test resets its own bookings and slots before running, making the suite repeatable.
The concurrency test uses two actual overlapping HTTP requests with Promise.all; it does not substitute sequential requests or mock database behavior.
Data Model
Slot
- id UUID
- startsAt UTC timestamp
- endsAt UTC timestamp
Slots are predefined by the seed.
Booking
- id UUID
- slotId UUID
- customerName
- customerEmail
- status: active | cancelled
- createdAt
Cancelled bookings are retained and remain addressable by their IDs.
Main Design Decisions
PostgreSQL constraint for concurrency
A partial unique index is used instead of an application-level mutex or a read-before-write availability check.
This makes PostgreSQL the source of truth and prevents race conditions reliably.
Historical bookings are retained
slotId is not globally unique because the same slot may be booked again after cancellation.
Only active bookings are unique per slot.
Atomic cancellation
Cancellation updates a booking only when its current status is active.
This lets the application distinguish between:
- a new cancellation
- an idempotent repeated cancellation
That distinction is also used to avoid duplicate slot.released events.
Minimal scope
No additional features such as authentication, pagination, payments, queues, Docker configuration, or frontend were added because they are outside the requested scope.
Possible Improvements
With more time, possible improvements would include:
- additional edge-case E2E tests
- automated OpenAPI contract validation
- structured application logging
- graceful shutdown configuration
- isolated ephemeral PostgreSQL databases for CI
- transactional outbox or message broker if durable realtime event delivery became a requirement
These are intentionally not required for the current scope.
Exercise Completion
Actual implementation time: 1 hour


Incomplete requirements:
None known.

## AI Disclosure

ChatGPT was used as a development assistant during this exercise.

It was used to help:
- clarify the requirements
- reason about the database model and concurrency strategy
- draft and review implementation code
- troubleshoot development issues
- draft E2E tests and documentation

I manually integrated and reviewed the implementation and verified it by:
- compiling the TypeScript project
- testing the API with curl
- verifying PostgreSQL constraints
- testing Socket.IO events
- running the required E2E tests against PostgreSQL
- reviewing Swagger UI and the generated OpenAPI specification

I understand the implementation and can explain or modify the code during review.