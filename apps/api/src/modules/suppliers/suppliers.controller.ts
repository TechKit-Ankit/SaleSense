import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { SuppliersService } from './suppliers.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { StoreAccessGuard } from '../../common/guards/store-access.guard';
import { StoreId } from '../../common/decorators/store-id.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { StoreUserRole } from '@salesense/db';

@UseGuards(JwtAuthGuard, StoreAccessGuard)
@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Roles(StoreUserRole.OWNER, StoreUserRole.MANAGER)
  @Post()
  create(@StoreId() storeId: string, @Body() createSupplierDto: CreateSupplierDto) {
    return this.suppliersService.create(storeId, createSupplierDto);
  }

  @Get()
  findAll(@StoreId() storeId: string) {
    return this.suppliersService.findAll(storeId);
  }

  @Get(':id')
  findOne(@StoreId() storeId: string, @Param('id') id: string) {
    return this.suppliersService.findOne(storeId, id);
  }

  @Roles(StoreUserRole.OWNER, StoreUserRole.MANAGER)
  @Patch(':id')
  update(
    @StoreId() storeId: string,
    @Param('id') id: string,
    @Body() updateSupplierDto: UpdateSupplierDto,
  ) {
    return this.suppliersService.update(storeId, id, updateSupplierDto);
  }

  @Roles(StoreUserRole.OWNER, StoreUserRole.MANAGER)
  @Delete(':id')
  remove(@StoreId() storeId: string, @Param('id') id: string) {
    return this.suppliersService.remove(storeId, id);
  }
}
