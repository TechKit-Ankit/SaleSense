import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ScannerGateway } from './scanner.gateway';

@Module({
  // JwtService authenticates the ROOM CREATOR's socket handshake (design
  // doc 0010); phones join rooms with the PIN only, by design.
  imports: [JwtModule.register({})],
  providers: [ScannerGateway],
})
export class ScannerModule {}
