import { Controller, Get, Post, Body, Param, UseGuards, Delete } from '@nestjs/common';
import { InvitationsService } from './invitations.service';
import { CreateInvitationDto } from './dto/invitation.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { StoreAccessGuard } from '../../common/guards/store-access.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller()
@UseGuards(JwtAuthGuard)
export class InvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  // 1. Store Admin Endpoints (requires Store Access)
  
  @Post('stores/:storeId/invitations')
  @UseGuards(StoreAccessGuard, RolesGuard)
  @Roles('OWNER', 'MANAGER')
  create(
    @Param('storeId') storeId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateInvitationDto,
  ) {
    return this.invitationsService.create(storeId, userId, dto);
  }

  @Get('stores/:storeId/invitations')
  @UseGuards(StoreAccessGuard, RolesGuard)
  @Roles('OWNER', 'MANAGER')
  findAllForStore(@Param('storeId') storeId: string) {
    return this.invitationsService.findAllForStore(storeId);
  }

  @Delete('stores/:storeId/invitations/:id')
  @UseGuards(StoreAccessGuard, RolesGuard)
  @Roles('OWNER', 'MANAGER')
  cancel(
    @Param('storeId') storeId: string,
    @Param('id') invitationId: string,
  ) {
    return this.invitationsService.cancel(storeId, invitationId);
  }

  // 2. User Endpoints (User viewing/managing their own invitations)

  @Get('users/me/invitations')
  findMyInvitations(@CurrentUser('id') userId: string) {
    return this.invitationsService.findPendingForUser(userId);
  }

  @Post('invitations/:id/accept')
  accept(
    @Param('id') invitationId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.invitationsService.accept(invitationId, userId);
  }

  @Post('invitations/:id/reject')
  reject(
    @Param('id') invitationId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.invitationsService.reject(invitationId, userId);
  }
}
