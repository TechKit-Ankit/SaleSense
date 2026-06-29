import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: '*', // For dev. Configure properly in production.
  },
  namespace: '/scanner',
})
export class ScannerGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private connectedClients = new Map<string, string>(); // socketId -> roomId

  handleConnection(client: Socket) {
    console.log(`Client connected to scanner gateway: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected from scanner gateway: ${client.id}`);
    const roomId = this.connectedClients.get(client.id);
    if (roomId) {
      // Notify the room that a device disconnected (useful for UI)
      this.server.to(roomId).emit('device_disconnected');
      this.connectedClients.delete(client.id);
    }
  }

  @SubscribeMessage('join_room')
  handleJoinRoom(
    @MessageBody() data: { pin: string },
    @ConnectedSocket() client: Socket,
  ) {
    const roomId = data.pin;
    client.join(roomId);
    this.connectedClients.set(client.id, roomId);
    // Tell the room a device successfully joined
    this.server.to(roomId).emit('device_connected');
    return { status: 'joined', room: roomId };
  }

  @SubscribeMessage('scan_barcode')
  handleScanBarcode(
    @MessageBody() data: { pin: string; barcode: string },
    @ConnectedSocket() client: Socket,
  ) {
    // Broadcast the barcode to the desktop in the same room
    this.server.to(data.pin).emit('on_barcode_scanned', { barcode: data.barcode });
    return { status: 'sent' };
  }
}
