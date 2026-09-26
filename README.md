# Appointment Booking API

A small appointment booking API built with NestJS, TypeScript, PostgreSQL, Prisma ORM, Socket.IO, and OpenAPI/Swagger.

The API provides predefined appointment slots, allows one active booking per slot, supports cancellation and re-booking, and broadcasts realtime availability changes.

No authentication, frontend, payment processing, cloud deployment, or Docker setup is included.

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

- Node.js 20.19+
- npm
- PostgreSQL

## Installation

Install dependencies from the lock file:

```bash
npm ci
```

Copy the example environment file:

```bash
cp .env.example .env
```

Example environment configuration:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/appointment_booking"
TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/appointment_booking_test"
PORT=3000
```

Update the PostgreSQL username, password, host, port, or database names as required for your local environment.

Generate the Prisma client:

```bash
npm run prisma:generate
```

## Database Setup

Create the development database:

```bash
createdb appointment_booking
```

Create the test database:

```bash
createdb appointment_booking_test
```

Apply migrations to the development database:

```bash
npm run prisma:migrate
```

Seed the predefined appointment slots:

```bash
npm run prisma:seed
```

For a production-style migration deployment:

```bash
npm run prisma:migrate:deploy
```

## Running the API

Start the API in development mode:

```bash
npm run start:dev
```

The API is available at:

```text
http://localhost:3000
```

No authentication is required.

## API Endpoints

### GET /slots

Returns only currently available appointment slots.

A slot is available when it does not have an active booking.

Slots are ordered by:

1. `startsAt` ascending
2. `id` ascending

Example response:

```json
{
  "slots": [
    {
      "id": "11111111-1111-4111-8111-111111111111",
      "startsAt": "2030-01-15T09:00:00.000Z",
      "endsAt": "2030-01-15T09:30:00.000Z"
    }
  ]
}
```

When no slots are available:

```json
{
  "slots": []
}
```

### POST /bookings

Creates an active booking for an existing slot.

Example request:

```json
{
  "slotId": "11111111-1111-4111-8111-111111111111",
  "customerName": "Alex Morgan",
  "customerEmail": "alex@example.com"
}
```

All fields are required.

`slotId` must be a valid UUID. Leading and trailing whitespace is removed from `customerName` and `customerEmail` before validation and persistence. The customer name must not be empty after trimming, and the email must be valid.

Successful response:

```json
{
  "booking": {
    "id": "22222222-2222-4222-8222-222222222222",
    "slotId": "11111111-1111-4111-8111-111111111111",
    "customerName": "Alex Morgan",
    "customerEmail": "alex@example.com",
    "status": "active"
  }
}
```

Possible status codes:

- `201` — booking created
- `400 VALIDATION_ERROR` — missing or invalid input, including malformed JSON
- `404 SLOT_NOT_FOUND` — valid UUID for a slot that does not exist
- `409 SLOT_UNAVAILABLE` — the slot already has an active booking
- `500 INTERNAL_ERROR` — unexpected server error

### DELETE /bookings/{bookingId}

Cancels an active booking.

`bookingId` must be a valid UUID.

Cancellation changes the booking status from `active` to `cancelled` and makes the slot available again.

Cancelling an already cancelled booking is idempotent:

- returns `200`
- returns the same cancelled booking
- does not perform another state change
- does not emit another realtime event

Cancelling an older cancelled booking does not affect a newer active booking for the same slot.

Possible status codes:

- `200` — booking cancelled or already cancelled
- `400 VALIDATION_ERROR` — invalid booking UUID
- `404 BOOKING_NOT_FOUND` — valid UUID for a booking that does not exist
- `500 INTERNAL_ERROR` — unexpected server error

## Error Format

All API errors follow this structure:

```json
{
  "error": {
    "code": "SLOT_UNAVAILABLE",
    "message": "This slot already has an active booking."
  }
}
```

Database details, stack traces, and other internal implementation information are not exposed to API clients.

## Concurrency / Double Booking Protection

The database is the final authority for preventing double bookings.

The `Booking` table retains historical cancelled bookings, while PostgreSQL enforces a partial unique index:

```sql
CREATE UNIQUE INDEX "Booking_one_active_per_slot"
ON "Booking" ("slotId")
WHERE "status" = 'active';
```

This guarantees that only one active booking can exist for a slot, even when two valid requests arrive concurrently.

The application intentionally does not rely on a read-before-write availability check such as:

```text
find active booking
→ if none exists
→ create booking
```

That approach is vulnerable to a race condition because two concurrent requests could both observe the slot as available before either insert completes.

Instead, booking creation works as follows:

1. The application verifies that the slot exists.
2. It attempts to create the booking.
3. PostgreSQL accepts at most one active booking for the slot.
4. A unique constraint violation is translated into `409 SLOT_UNAVAILABLE`.

Because the guarantee is enforced by PostgreSQL, it remains effective across multiple Node.js processes and does not depend on an in-memory lock.

The database also contains a check constraint ensuring:

```text
endsAt > startsAt
```

## Socket.IO

Socket.IO runs on the same server as the HTTP API.

Configuration:

- namespace: `/`
- path: `/socket.io`
- no authentication
- no rooms
- no client-originated application events are required

### slot.booked

Emitted once after a booking is successfully persisted:

```json
{
  "slotId": "11111111-1111-4111-8111-111111111111",
  "bookingId": "22222222-2222-4222-8222-222222222222",
  "available": false
}
```

### slot.released

Emitted once after an active booking is successfully changed to `cancelled`:

```json
{
  "slotId": "11111111-1111-4111-8111-111111111111",
  "bookingId": "22222222-2222-4222-8222-222222222222",
  "available": true
}
```

No realtime event is emitted for:

- rejected booking requests
- validation errors
- missing resources
- repeated cancellation of an already cancelled booking

Customer information is never included in realtime event payloads.

Durable delivery, event replay, and exactly-once delivery guarantees are outside the scope of this exercise.

## Testing Socket.IO Without a Frontend

Start the API:

```bash
npm run start:dev
```

In another terminal, start the included Socket.IO listener:

```bash
npm run socket:listen
```

Then create or cancel bookings using Swagger UI or `curl`.

The listener prints events such as:

```text
slot.booked: {
  slotId: "...",
  bookingId: "...",
  available: false
}

slot.released: {
  slotId: "...",
  bookingId: "...",
  available: true
}
```

Repeating cancellation of an already cancelled booking should still return `200` through the HTTP API but should not print another `slot.released` event.

## OpenAPI

Swagger UI:

```text
GET http://localhost:3000/docs
```

Raw OpenAPI specification:

```text
GET http://localhost:3000/openapi.json
```

The OpenAPI documentation describes:

- all three HTTP endpoints
- required request fields
- UUID, email, and date-time formats
- validation behavior
- success response schemas
- error response schemas
- HTTP status codes
- request and response examples
- cancellation idempotency
- the absence of authentication

Socket.IO is documented in this README rather than as HTTP operations.

## Automated Tests

The required E2E tests use a real PostgreSQL database and exercise the HTTP API through Supertest.

The test database is separate from the development database.

Ensure `TEST_DATABASE_URL` in `.env` points to the test database.

Apply the same migrations to the test database before running the test suite:

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/appointment_booking_test" npm run prisma:migrate:deploy
```

Adjust the connection string above if your local PostgreSQL credentials differ.

Run the E2E tests:

```bash
npm run test:e2e
```

The required automated tests verify:

1. A successful booking returns `201` and removes the slot from availability.
2. Two overlapping booking requests for the same slot return exactly one `201` and one `409`, with exactly one active booking persisted.
3. Cancellation returns `200`, releases the slot, and allows a new booking for the same slot.

Each test resets the relevant bookings and slots before running, making the suite repeatable.

The concurrency test sends two real overlapping HTTP requests using `Promise.all`. It does not substitute sequential requests or mocked database behavior.

The test also queries PostgreSQL after the concurrent requests to verify that exactly one active booking was persisted.

## Data Model

### Slot

- `id` — UUID
- `startsAt` — timestamp with timezone
- `endsAt` — timestamp with timezone

Slots are predefined through the database seed.

### Booking

- `id` — UUID
- `slotId` — UUID
- `customerName` — string
- `customerEmail` — string
- `status` — `active | cancelled`
- `createdAt` — timestamp with timezone

Cancelled bookings are retained and remain addressable by their IDs.

A slot can therefore have multiple historical bookings, but only one active booking at a time.

## Main Design Decisions

### PostgreSQL Constraint for Concurrency

A partial unique index is used instead of an application-level mutex or read-before-write availability check.

This makes PostgreSQL the source of truth and prevents double-booking race conditions reliably.

### Historical Bookings Are Retained

`slotId` is not globally unique because the same slot can be booked again after a previous booking has been cancelled.

Only active bookings are unique per slot.

### Atomic Cancellation

Cancellation updates a booking only when its current status is `active`.

This allows the application to distinguish between:

- a new cancellation
- an idempotent repeated cancellation

That distinction is also used to prevent duplicate `slot.released` events.

### Minimal Scope

No additional features such as authentication, pagination, payments, queues, Docker configuration, CI/CD, or frontend were added because they are outside the requested scope.

## Possible Improvements

With additional time, possible improvements could include:

- additional edge-case E2E tests
- automated OpenAPI contract validation
- structured application logging
- graceful shutdown handling
- isolated ephemeral PostgreSQL databases for CI
- transactional outbox or a message broker if durable realtime event delivery became a requirement

These improvements are intentionally outside the requested scope.

## Exercise Completion

Actual implementation time: approximately 1 hour and 20 minutes.

Incomplete requirements: None known.

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
- testing the API with `curl`
- verifying PostgreSQL constraints directly
- testing Socket.IO events
- running the required E2E tests against PostgreSQL
- reviewing Swagger UI and the generated OpenAPI specification
- performing a clean-install/build verification from the committed project files

