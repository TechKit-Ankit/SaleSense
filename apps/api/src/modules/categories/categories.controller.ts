import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { StoreAccessGuard } from '../../common/guards/store-access.guard';
import { StoreId } from '../../common/decorators/store-id.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { StoreUserRole } from '@salesense/db';

@UseGuards(JwtAuthGuard, StoreAccessGuard)
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Roles(StoreUserRole.OWNER, StoreUserRole.MANAGER)
  @Post()
  create(@StoreId() storeId: string, @Body() createCategoryDto: CreateCategoryDto) {
    return this.categoriesService.create(storeId, createCategoryDto);
  }

  @Get()
  findAll(@StoreId() storeId: string) {
    return this.categoriesService.findAll(storeId);
  }

  @Get(':id')
  findOne(@StoreId() storeId: string, @Param('id') id: string) {
    return this.categoriesService.findOne(storeId, id);
  }

  @Roles(StoreUserRole.OWNER, StoreUserRole.MANAGER)
  @Patch(':id')
  update(
    @StoreId() storeId: string,
    @Param('id') id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
  ) {
    return this.categoriesService.update(storeId, id, updateCategoryDto);
  }

  @Roles(StoreUserRole.OWNER, StoreUserRole.MANAGER)
  @Delete(':id')
  remove(@StoreId() storeId: string, @Param('id') id: string) {
    return this.categoriesService.remove(storeId, id);
  }
}
