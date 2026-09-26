import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RealtimeGateway } from '../realtime/realtime.gateway.js';
import { CreateBookingDto } from './dto/create-booking.dto.js';

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  async create(dto: CreateBookingDto) {
    const slot = await this.prisma.slot.findUnique({
      where: { id: dto.slotId },
      select: { id: true },
    });

    if (!slot) {
      throw new NotFoundException({
        error: {
          code: 'SLOT_NOT_FOUND',
          message: 'The requested slot does not exist.',
        },
      });
    }

    try {
      const booking = await this.prisma.booking.create({
        data: {
          slotId: dto.slotId,
          customerName: dto.customerName,
          customerEmail: dto.customerEmail,
        },
        select: {
          id: true,
          slotId: true,
          customerName: true,
          customerEmail: true,
          status: true,
        },
      });

      this.realtimeGateway.emitSlotBooked(
        booking.slotId,
        booking.id,
      );

      return booking;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException({
          error: {
            code: 'SLOT_UNAVAILABLE',
            message: 'This slot already has an active booking.',
          },
        });
      }

      throw error;
    }
  }

  async cancel(bookingId: string) {
    const result = await this.prisma.booking.updateMany({
      where: {
        id: bookingId,
        status: 'active',
      },
      data: {
        status: 'cancelled',
      },
    });

    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        slotId: true,
        customerName: true,
        customerEmail: true,
        status: true,
      },
    });

    if (!booking) {
      throw new NotFoundException({
        error: {
          code: 'BOOKING_NOT_FOUND',
          message: 'The requested booking does not exist.',
        },
      });
    }

    const wasCancelledNow = result.count === 1;

    if (wasCancelledNow) {
      this.realtimeGateway.emitSlotReleased(
        booking.slotId,
        booking.id,
      );
    }

    return {
      booking,
      wasCancelledNow,
    };
  }
}