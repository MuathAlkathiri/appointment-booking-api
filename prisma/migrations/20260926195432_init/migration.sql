-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('active', 'cancelled');

-- CreateTable
CREATE TABLE "Slot" (
    "id" UUID NOT NULL,
    "startsAt" TIMESTAMPTZ(3) NOT NULL,
    "endsAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Slot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" UUID NOT NULL,
    "slotId" UUID NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Booking_slotId_idx" ON "Booking"("slotId");

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "Slot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- A slot's end time must always be after its start time.
ALTER TABLE "Slot"
ADD CONSTRAINT "Slot_endsAt_after_startsAt"
CHECK ("endsAt" > "startsAt");

-- Allow historical cancelled bookings, but only one active booking per slot.
CREATE UNIQUE INDEX "Booking_one_active_per_slot"
ON "Booking" ("slotId")
WHERE "status" = 'active';