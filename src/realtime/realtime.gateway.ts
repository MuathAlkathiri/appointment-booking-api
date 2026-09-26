import {
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway()
export class RealtimeGateway {
  @WebSocketServer()
  server: Server;

  emitSlotBooked(slotId: string, bookingId: string) {
    this.server.emit('slot.booked', {
      slotId,
      bookingId,
      available: false,
    });
  }

  emitSlotReleased(slotId: string, bookingId: string) {
    this.server.emit('slot.released', {
      slotId,
      bookingId,
      available: true,
    });
  }
}