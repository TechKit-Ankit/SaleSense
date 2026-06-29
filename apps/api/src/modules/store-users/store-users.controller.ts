import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { StoreUsersService } from './store-users.service';
import { AddStoreUserDto, UpdateStoreUserDto } from './dto/store-user.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { StoreAccessGuard } from '../../common/guards/store-access.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { StoreId } from '../../common/decorators/store-id.decorator';

@Controller('stores/:storeId/users')
@UseGuards(JwtAuthGuard, StoreAccessGuard, RolesGuard)
export class StoreUsersController {
  constructor(private readonly storeUsersService: StoreUsersService) {}

  @Get()
  @Roles('OWNER', 'MANAGER')
  findAll(@StoreId() storeId: string) {
    return this.storeUsersService.findAll(storeId);
  }

  @Post()
  @Roles('OWNER')
  add(@StoreId() storeId: string, @Body() addStoreUserDto: AddStoreUserDto) {
    return this.storeUsersService.add(storeId, addStoreUserDto);
  }

  @Patch(':userId')
  @Roles('OWNER')
  update(
    @StoreId() storeId: string,
    @Param('userId') userId: string,
    @Body() updateStoreUserDto: UpdateStoreUserDto,
  ) {
    return this.storeUsersService.update(storeId, userId, updateStoreUserDto);
  }

  @Delete(':userId')
  @Roles('OWNER')
  remove(@StoreId() storeId: string, @Param('userId') userId: string) {
    return this.storeUsersService.remove(storeId, userId);
  }
}
