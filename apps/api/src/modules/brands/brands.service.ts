import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';
import { PrismaService } from '@salesense/db';
import { ArchiveStatus, Prisma } from '@salesense/db';

@Injectable()
export class BrandsService {
  constructor(private prisma: PrismaService) {}

  async create(storeId: string, createBrandDto: CreateBrandDto) {
    try {
      const brand = await this.prisma.brand.create({
        data: {
          storeId,
          name: createBrandDto.name,
          status: createBrandDto.status ?? ArchiveStatus.ACTIVE,
        },
      });
      return brand;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('A brand with this name already exists.');
      }
      throw error;
    }
  }

  async findAll(storeId: string) {
    return this.prisma.brand.findMany({
      where: { storeId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(storeId: string, id: string) {
    const brand = await this.prisma.brand.findUnique({
      where: { id },
    });

    if (!brand || brand.storeId !== storeId) {
      throw new NotFoundException('Brand not found');
    }

    return brand;
  }

  async update(storeId: string, id: string, updateBrandDto: UpdateBrandDto) {
    await this.findOne(storeId, id);

    try {
      const data: Prisma.BrandUncheckedUpdateInput = {};
      if (updateBrandDto.name !== undefined) data.name = updateBrandDto.name;
      if (updateBrandDto.status !== undefined) data.status = updateBrandDto.status;

      const brand = await this.prisma.brand.update({
        where: { id },
        data,
      });
      return brand;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('A brand with this name already exists.');
      }
      throw error;
    }
  }

  async remove(storeId: string, id: string) {
    await this.findOne(storeId, id);

    return this.prisma.brand.update({
      where: { id },
      data: { status: ArchiveStatus.ARCHIVED },
    });
  }
}
