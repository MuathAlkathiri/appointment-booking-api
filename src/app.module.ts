import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module.js';
import { SlotsModule } from './slots/slots.module.js';
import { BookingsModule } from './bookings/bookings.module.js';
import { RealtimeModule } from './realtime/realtime.module.js';

@Module({
  imports: [
    PrismaModule,
    SlotsModule,
    BookingsModule,
    RealtimeModule,
  ],
})
export class AppModule {}