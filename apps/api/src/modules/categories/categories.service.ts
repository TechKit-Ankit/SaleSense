import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { PrismaService } from '@salesense/db';
import { ArchiveStatus, Prisma } from '@salesense/db';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  async create(storeId: string, createCategoryDto: CreateCategoryDto) {
    try {
      const category = await this.prisma.category.create({
        data: {
          storeId,
          name: createCategoryDto.name,
          parentId: createCategoryDto.parentId ?? null,
          status: createCategoryDto.status ?? ArchiveStatus.ACTIVE,
        },
      });
      return category;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('A category with this name already exists.');
      }
      throw error;
    }
  }

  async findAll(storeId: string) {
    return this.prisma.category.findMany({
      where: { storeId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(storeId: string, id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
    });

    if (!category || category.storeId !== storeId) {
      throw new NotFoundException('Category not found');
    }

    return category;
  }

  async update(storeId: string, id: string, updateCategoryDto: UpdateCategoryDto) {
    await this.findOne(storeId, id); // Ensure it exists and belongs to the store

    try {
      const data: Prisma.CategoryUncheckedUpdateInput = {};
      if (updateCategoryDto.name !== undefined) data.name = updateCategoryDto.name;
      if (updateCategoryDto.parentId !== undefined) data.parentId = updateCategoryDto.parentId ?? null;
      if (updateCategoryDto.status !== undefined) data.status = updateCategoryDto.status;

      const category = await this.prisma.category.update({
        where: { id },
        data,
      });
      return category;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('A category with this name already exists.');
      }
      throw error;
    }
  }

  async remove(storeId: string, id: string) {
    await this.findOne(storeId, id);

    return this.prisma.category.update({
      where: { id },
      data: { status: ArchiveStatus.ARCHIVED },
    });
  }
}
