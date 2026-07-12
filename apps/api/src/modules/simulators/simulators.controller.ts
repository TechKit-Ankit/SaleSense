import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { SimulatorsService } from './simulators.service';
import { SimulateDiscountDto } from './dto/simulate-discount.dto';
import { SimulateBogoDto } from './dto/simulate-bogo.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { StoreAccessGuard } from '../../common/guards/store-access.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { StoreId } from '../../common/decorators/store-id.decorator';
import { StoreUserRole } from '@salesense/db';

@Controller('simulators')
@UseGuards(JwtAuthGuard, StoreAccessGuard)
@Roles(StoreUserRole.OWNER, StoreUserRole.MANAGER)
export class SimulatorsController {
  constructor(private readonly simulatorsService: SimulatorsService) {}

  @Post('discount')
  simulateDiscount(@StoreId() storeId: string, @Body() dto: SimulateDiscountDto) {
    return this.simulatorsService.simulateDiscount(storeId, dto);
  }

  @Post('bogo')
  simulateBogo(@StoreId() storeId: string, @Body() dto: SimulateBogoDto) {
    return this.simulatorsService.simulateBogo(storeId, dto);
  }
}
