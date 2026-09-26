import {
  Body,
  Controller,
  Delete,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { ErrorResponseDto } from '../common/dto/error-response.dto.js';
import { BookingsService } from './bookings.service.js';
import { BookingResponseDto } from './dto/booking-response.dto.js';
import { CreateBookingDto } from './dto/create-booking.dto.js';

@ApiTags('bookings')
@ApiExtraModels(ErrorResponseDto)
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a booking',
    description:
      'Creates an active booking for a slot. Each slot may have only one active booking. Leading and trailing whitespace is removed from the customer name and email before validation and storage. No authentication is required.',
  })
  @ApiCreatedResponse({
    description: 'Booking created successfully.',
    type: BookingResponseDto,
  })
  @ApiBadRequestResponse({
    description:
      'VALIDATION_ERROR — missing or invalid input, including malformed JSON.',
    schema: {
      $ref: getSchemaPath(ErrorResponseDto),
      example: {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'slotId must be a UUID',
        },
      },
    },
  })
  @ApiNotFoundResponse({
    description:
      'SLOT_NOT_FOUND — the supplied slotId is a valid UUID but the slot does not exist.',
    schema: {
      $ref: getSchemaPath(ErrorResponseDto),
      example: {
        error: {
          code: 'SLOT_NOT_FOUND',
          message: 'The requested slot does not exist.',
        },
      },
    },
  })
  @ApiConflictResponse({
    description:
      'SLOT_UNAVAILABLE — the slot already has an active booking.',
    schema: {
      $ref: getSchemaPath(ErrorResponseDto),
      example: {
        error: {
          code: 'SLOT_UNAVAILABLE',
          message: 'This slot already has an active booking.',
        },
      },
    },
  })
  @ApiInternalServerErrorResponse({
    description: 'INTERNAL_ERROR — unexpected server error.',
    schema: {
      $ref: getSchemaPath(ErrorResponseDto),
      example: {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred.',
        },
      },
    },
  })
  async create(@Body() dto: CreateBookingDto) {
    const booking = await this.bookingsService.create(dto);

    return { booking };
  }

  @Delete(':bookingId')
  @ApiOperation({
    summary: 'Cancel a booking',
    description:
      'Cancels an active booking and makes its slot available again. Cancelling an already cancelled booking is idempotent: it returns 200 with the same cancelled booking and does not perform another state change or emit another realtime event. Cancelling an older cancelled booking does not affect a newer active booking for the same slot. No authentication is required.',
  })
  @ApiParam({
    name: 'bookingId',
    required: true,
    schema: {
      type: 'string',
      format: 'uuid',
    },
    example: '22222222-2222-4222-8222-222222222222',
  })
  @ApiOkResponse({
    description:
      'Booking cancelled successfully, or the already-cancelled booking returned unchanged.',
    type: BookingResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'VALIDATION_ERROR — bookingId is not a valid UUID.',
    schema: {
      $ref: getSchemaPath(ErrorResponseDto),
      example: {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed (uuid is expected)',
        },
      },
    },
  })
  @ApiNotFoundResponse({
    description:
      'BOOKING_NOT_FOUND — bookingId is a valid UUID but no booking exists.',
    schema: {
      $ref: getSchemaPath(ErrorResponseDto),
      example: {
        error: {
          code: 'BOOKING_NOT_FOUND',
          message: 'The requested booking does not exist.',
        },
      },
    },
  })
  @ApiInternalServerErrorResponse({
    description: 'INTERNAL_ERROR — unexpected server error.',
    schema: {
      $ref: getSchemaPath(ErrorResponseDto),
      example: {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred.',
        },
      },
    },
  })
  async cancel(
    @Param('bookingId', new ParseUUIDPipe())
    bookingId: string,
  ) {
    const { booking } = await this.bookingsService.cancel(bookingId);

    return { booking };
  }
}