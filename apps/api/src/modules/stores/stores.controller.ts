import { Controller, Get, Post, Body, Patch, Param, UseGuards } from '@nestjs/common';
import { StoresService } from './stores.service';
import { CreateStoreDto, UpdateStoreDto } from './dto/store.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { StoreAccessGuard } from '../../common/guards/store-access.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { SystemAdminGuard } from '../../common/guards/system-admin.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { StoreId } from '../../common/decorators/store-id.decorator';

@Controller('stores')
@UseGuards(JwtAuthGuard)
export class StoresController {
  constructor(private readonly storesService: StoresService) {}

  @Post()
  create(@CurrentUser('id') userId: string, @Body() createStoreDto: CreateStoreDto) {
    return this.storesService.create(userId, createStoreDto);
  }

  @Get()
  findAllForUser(@CurrentUser('id') userId: string) {
    return this.storesService.findAllForUser(userId);
  }

  @Get('settings')
  findAllSettingsForUser(@CurrentUser('id') userId: string) {
    return this.storesService.findAllSettingsForUser(userId);
  }

  @Get(':storeId')
  @UseGuards(StoreAccessGuard, RolesGuard)
  @Roles('OWNER', 'MANAGER')
  findOne(@Param('storeId') storeId: string) {
    return this.storesService.findOne(storeId);
  }

  @Patch(':storeId')
  @UseGuards(StoreAccessGuard, RolesGuard)
  @Roles('OWNER')
  update(@Param('storeId') storeId: string, @Body() updateStoreDto: UpdateStoreDto) {
    return this.storesService.update(storeId, updateStoreDto);
  }

  @Post(':storeId/request-deletion')
  @UseGuards(StoreAccessGuard, RolesGuard)
  @Roles('OWNER')
  requestDeletion(@Param('storeId') storeId: string) {
    return this.storesService.requestDeletion(storeId);
  }

  @Post(':storeId/cancel-deletion')
  @UseGuards(StoreAccessGuard, RolesGuard)
  @Roles('OWNER')
  cancelDeletion(@Param('storeId') storeId: string) {
    return this.storesService.cancelDeletion(storeId);
  }

  @Post(':storeId/pause-deletion')
  @UseGuards(SystemAdminGuard)
  pauseDeletion(@Param('storeId') storeId: string) {
    return this.storesService.pauseDeletion(storeId);
  }

  @Post(':storeId/resume-deletion')
  @UseGuards(SystemAdminGuard)
  resumeDeletion(@Param('storeId') storeId: string) {
    return this.storesService.resumeDeletion(storeId);
  }
}
