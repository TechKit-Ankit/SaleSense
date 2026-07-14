import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CreateCustomerDto, UpdateCustomerDto } from './dto/customer.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { StoreAccessGuard } from '../../common/guards/store-access.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { StoreId } from '../../common/decorators/store-id.decorator';
import { StoreUserRole } from '@salesense/db';

@Controller('customers')
@UseGuards(JwtAuthGuard, StoreAccessGuard)
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Roles(StoreUserRole.OWNER, StoreUserRole.MANAGER)
  @Get()
  list(@StoreId() storeId: string, @Query('q') q?: string) {
    return this.customersService.list(storeId, q);
  }

  // Cashiers may create customers at the counter (api/0001).
  @Post()
  create(@StoreId() storeId: string, @Body() dto: CreateCustomerDto) {
    return this.customersService.create(storeId, dto);
  }

  @Roles(StoreUserRole.OWNER, StoreUserRole.MANAGER)
  @Get(':customerId')
  get(@StoreId() storeId: string, @Param('customerId') customerId: string) {
    return this.customersService.get(storeId, customerId);
  }

  @Roles(StoreUserRole.OWNER, StoreUserRole.MANAGER)
  @Patch(':customerId')
  update(@StoreId() storeId: string, @Param('customerId') customerId: string, @Body() dto: UpdateCustomerDto) {
    return this.customersService.update(storeId, customerId, dto);
  }
}
