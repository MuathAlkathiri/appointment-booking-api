import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { beforeAll, beforeEach, afterAll, describe, expect, it } from 'vitest';

import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { ApiExceptionFilter } from '../src/common/filters/api-exception.filter.js';

const SLOT_ID = '11111111-1111-4111-8111-111111111111';

describe('Bookings API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    if (!process.env.TEST_DATABASE_URL) {
      throw new Error('TEST_DATABASE_URL is required for e2e tests');
    }

    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    );

    app.useGlobalFilters(new ApiExceptionFilter());

    await app.init();

    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await prisma.booking.deleteMany();
    await prisma.slot.deleteMany();

    await prisma.slot.create({
      data: {
        id: SLOT_ID,
        startsAt: new Date('2030-01-15T09:00:00.000Z'),
        endsAt: new Date('2030-01-15T09:30:00.000Z'),
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('creates a booking and removes the slot from availability', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/bookings')
      .send({
        slotId: SLOT_ID,
        customerName: 'Alex Morgan',
        customerEmail: 'alex@example.com',
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.booking).toMatchObject({
      slotId: SLOT_ID,
      customerName: 'Alex Morgan',
      customerEmail: 'alex@example.com',
      status: 'active',
    });

    const slotsResponse = await request(app.getHttpServer())
      .get('/slots');

    expect(slotsResponse.status).toBe(200);
    expect(slotsResponse.body).toEqual({
      slots: [],
    });
  });

  it('allows only one active booking when two requests overlap', async () => {
    const requestA = request(app.getHttpServer())
      .post('/bookings')
      .send({
        slotId: SLOT_ID,
        customerName: 'Customer A',
        customerEmail: 'a@example.com',
      });

    const requestB = request(app.getHttpServer())
      .post('/bookings')
      .send({
        slotId: SLOT_ID,
        customerName: 'Customer B',
        customerEmail: 'b@example.com',
      });

    const [responseA, responseB] = await Promise.all([
      requestA,
      requestB,
    ]);

    const statuses = [responseA.status, responseB.status].sort();

    expect(statuses).toEqual([201, 409]);

    const conflictResponse =
      responseA.status === 409 ? responseA : responseB;

    expect(conflictResponse.body).toEqual({
      error: {
        code: 'SLOT_UNAVAILABLE',
        message: 'This slot already has an active booking.',
      },
    });

    const activeBookings = await prisma.booking.count({
      where: {
        slotId: SLOT_ID,
        status: 'active',
      },
    });

    expect(activeBookings).toBe(1);
  });

  it('cancels a booking, releases the slot, and allows a new booking', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/bookings')
      .send({
        slotId: SLOT_ID,
        customerName: 'First Customer',
        customerEmail: 'first@example.com',
      });

    expect(createResponse.status).toBe(201);

    const bookingId = createResponse.body.booking.id as string;

    const cancelResponse = await request(app.getHttpServer())
      .delete(`/bookings/${bookingId}`);

    expect(cancelResponse.status).toBe(200);
    expect(cancelResponse.body.booking.status).toBe('cancelled');

    const slotsResponse = await request(app.getHttpServer())
      .get('/slots');

    expect(slotsResponse.status).toBe(200);
    expect(slotsResponse.body.slots).toHaveLength(1);
    expect(slotsResponse.body.slots[0].id).toBe(SLOT_ID);

    const newBookingResponse = await request(app.getHttpServer())
      .post('/bookings')
      .send({
        slotId: SLOT_ID,
        customerName: 'Second Customer',
        customerEmail: 'second@example.com',
      });

    expect(newBookingResponse.status).toBe(201);
    expect(newBookingResponse.body.booking).toMatchObject({
      slotId: SLOT_ID,
      status: 'active',
    });
  });
});