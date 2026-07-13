import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';

const MAX_JOIN_FAILURES = 5;

/**
 * Companion-scanner relay, hardened per design doc 0010:
 * - create_room requires a valid JWT in the Socket.IO handshake (the POS
 *   laptop is logged in) — attackers cannot camp arbitrary PINs.
 * - join_room stays PIN-only (the phone is deliberately login-free) but only
 *   succeeds for rooms that actually exist; 5 misses disconnect the socket.
 * - scan_barcode relays only from sockets that are members of the room.
 * - CORS origin comes from the same allowlist as the HTTP API.
 */
@WebSocketGateway({
  cors: {
    origin: (process.env.CORS_ORIGIN ?? 'http://localhost:3000')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
  },
  namespace: '/scanner',
})
export class ScannerGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(ScannerGateway.name);

  @WebSocketServer()
  server!: Server;

  /** roomId -> owning (authenticated) socket id */
  private activeRooms = new Map<string, string>();
  /** socketId -> joined roomId (phones) */
  private connectedClients = new Map<string, string>();
  /** socketId -> failed join attempts */
  private joinFailures = new Map<string, number>();

  constructor(private readonly jwtService: JwtService) {}

  handleConnection(client: Socket) {
    // Optional auth: laptops present their JWT; phones connect anonymously.
    const token = client.handshake.auth?.token as string | undefined;
    if (token) {
      try {
        this.jwtService.verify(token, {
          secret: process.env.JWT_SECRET || 'secret',
        });
        client.data.authenticated = true;
      } catch {
        client.data.authenticated = false;
      }
    }
    this.logger.log(`Client connected to scanner gateway: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected from scanner gateway: ${client.id}`);
    // Phone left → notify its room.
    const roomId = this.connectedClients.get(client.id);
    if (roomId) {
      this.server.to(roomId).emit('device_disconnected');
      this.connectedClients.delete(client.id);
    }
    // Laptop left → the room dies with it.
    for (const [pin, ownerId] of this.activeRooms) {
      if (ownerId === client.id) {
        this.activeRooms.delete(pin);
        this.server.to(pin).emit('device_disconnected');
      }
    }
    this.joinFailures.delete(client.id);
  }

  @SubscribeMessage('create_room')
  handleCreateRoom(
    @MessageBody() data: { pin: string },
    @ConnectedSocket() client: Socket,
  ) {
    if (!client.data.authenticated) {
      return { status: 'error', message: 'Authentication required to host a scanner room' };
    }
    if (!data?.pin || data.pin.length < 6) {
      return { status: 'error', message: 'Invalid room code' };
    }
    this.activeRooms.set(data.pin, client.id);
    client.join(data.pin);
    return { status: 'created', room: data.pin };
  }

  @SubscribeMessage('join_room')
  handleJoinRoom(
    @MessageBody() data: { pin: string },
    @ConnectedSocket() client: Socket,
  ) {
    const roomId = data?.pin;
    if (!roomId || !this.activeRooms.has(roomId)) {
      const failures = (this.joinFailures.get(client.id) ?? 0) + 1;
      this.joinFailures.set(client.id, failures);
      if (failures >= MAX_JOIN_FAILURES) {
        this.logger.warn(`Disconnecting ${client.id} after ${failures} failed room joins`);
        client.disconnect(true);
      }
      return { status: 'error', message: 'Room not found' };
    }

    client.join(roomId);
    this.connectedClients.set(client.id, roomId);
    this.server.to(roomId).emit('device_connected');
    return { status: 'joined', room: roomId };
  }

  @SubscribeMessage('scan_barcode')
  handleScanBarcode(
    @MessageBody() data: { pin: string; barcode: string },
    @ConnectedSocket() client: Socket,
  ) {
    // Only sockets that are actually members of the room may relay into it.
    if (!data?.pin || !client.rooms.has(data.pin)) {
      return { status: 'error', message: 'Not a member of this room' };
    }
    this.server.to(data.pin).emit('on_barcode_scanned', { barcode: data.barcode });
    return { status: 'sent' };
  }
}
