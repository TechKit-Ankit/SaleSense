import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { StoreAccessGuard } from '../../common/guards/store-access.guard';
import { StoreId } from '../../common/decorators/store-id.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { StoreUserRole } from '@salesense/db';

@UseGuards(JwtAuthGuard, StoreAccessGuard)
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Roles(StoreUserRole.OWNER, StoreUserRole.MANAGER)
  @Post()
  create(@StoreId() storeId: string, @Body() createProductDto: CreateProductDto) {
    return this.productsService.create(storeId, createProductDto);
  }

  @Get()
  findAll(@StoreId() storeId: string) {
    return this.productsService.findAll(storeId);
  }

  @Get('barcode/:barcode')
  findByBarcode(@StoreId() storeId: string, @Param('barcode') barcode: string) {
    return this.productsService.findByBarcode(storeId, barcode);
  }

  @Get(':id')
  findOne(@StoreId() storeId: string, @Param('id') id: string) {
    return this.productsService.findOne(storeId, id);
  }

  @Roles(StoreUserRole.OWNER, StoreUserRole.MANAGER)
  @Patch(':id')
  update(
    @StoreId() storeId: string,
    @Param('id') id: string,
    @Body() updateProductDto: UpdateProductDto,
  ) {
    return this.productsService.update(storeId, id, updateProductDto);
  }

  @Roles(StoreUserRole.OWNER, StoreUserRole.MANAGER)
  @Delete(':id')
  remove(@StoreId() storeId: string, @Param('id') id: string) {
    return this.productsService.remove(storeId, id);
  }

  @Roles(StoreUserRole.OWNER, StoreUserRole.MANAGER)
  @Post(':id/barcodes')
  addBarcode(
    @StoreId() storeId: string,
    @Param('id') id: string,
    @Body('barcode') barcode: string,
  ) {
    return this.productsService.addBarcode(storeId, id, barcode);
  }

  @Roles(StoreUserRole.OWNER, StoreUserRole.MANAGER)
  @Delete(':id/barcodes/:barcodeId')
  removeBarcode(
    @StoreId() storeId: string,
    @Param('id') id: string,
    @Param('barcodeId') barcodeId: string,
  ) {
    return this.productsService.removeBarcode(storeId, id, barcodeId);
  }
}
