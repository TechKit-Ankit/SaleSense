import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { BrandsService } from './brands.service';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { StoreAccessGuard } from '../../common/guards/store-access.guard';
import { StoreId } from '../../common/decorators/store-id.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { StoreUserRole } from '@salesense/db';

@UseGuards(JwtAuthGuard, StoreAccessGuard)
@Controller('brands')
export class BrandsController {
  constructor(private readonly brandsService: BrandsService) {}

  @Roles(StoreUserRole.OWNER, StoreUserRole.MANAGER)
  @Post()
  create(@StoreId() storeId: string, @Body() createBrandDto: CreateBrandDto) {
    return this.brandsService.create(storeId, createBrandDto);
  }

  @Get()
  findAll(@StoreId() storeId: string) {
    return this.brandsService.findAll(storeId);
  }

  @Get(':id')
  findOne(@StoreId() storeId: string, @Param('id') id: string) {
    return this.brandsService.findOne(storeId, id);
  }

  @Roles(StoreUserRole.OWNER, StoreUserRole.MANAGER)
  @Patch(':id')
  update(
    @StoreId() storeId: string,
    @Param('id') id: string,
    @Body() updateBrandDto: UpdateBrandDto,
  ) {
    return this.brandsService.update(storeId, id, updateBrandDto);
  }

  @Roles(StoreUserRole.OWNER, StoreUserRole.MANAGER)
  @Delete(':id')
  remove(@StoreId() storeId: string, @Param('id') id: string) {
    return this.brandsService.remove(storeId, id);
  }
}
