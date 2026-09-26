import { Module } from '@nestjs/common';
import { RealtimeModule } from '../realtime/realtime.module.js';
import { BookingsController } from './bookings.controller.js';
import { BookingsService } from './bookings.service.js';

@Module({
  imports: [RealtimeModule],
  controllers: [BookingsController],
  providers: [BookingsService],
})
export class BookingsModule {}