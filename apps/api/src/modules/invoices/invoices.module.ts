import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { InvoicesController } from './invoices.controller';
import { PublicReceiptsController } from './public-receipts.controller';
import { InvoicesService } from './invoices.service';

@Module({
  // JwtService signs/verifies the stateless receipt share tokens (design 0009).
  imports: [JwtModule.register({})],
  controllers: [InvoicesController, PublicReceiptsController],
  providers: [InvoicesService],
})
export class InvoicesModule {}
