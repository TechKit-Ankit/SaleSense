import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { PrismaService } from '@salesense/db';
import { ArchiveStatus, Prisma } from '@salesense/db';

@Injectable()
export class SuppliersService {
  constructor(private prisma: PrismaService) {}

  async create(storeId: string, createSupplierDto: CreateSupplierDto) {
    try {
      return await this.prisma.supplier.create({
        data: {
          storeId,
          name: createSupplierDto.name,
          phone: createSupplierDto.phone ?? null,
          gstNumber: createSupplierDto.gstNumber ?? null,
          address: createSupplierDto.address ?? null,
          status: createSupplierDto.status ?? ArchiveStatus.ACTIVE,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('A supplier with this name already exists.');
      }
      throw error;
    }
  }

  async findAll(storeId: string) {
    return this.prisma.supplier.findMany({
      where: { storeId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(storeId: string, id: string) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id },
    });

    if (!supplier || supplier.storeId !== storeId) {
      throw new NotFoundException('Supplier not found');
    }

    return supplier;
  }

  async update(storeId: string, id: string, updateSupplierDto: UpdateSupplierDto) {
    await this.findOne(storeId, id);

    try {
      const data: Prisma.SupplierUncheckedUpdateInput = {};
      if (updateSupplierDto.name !== undefined) data.name = updateSupplierDto.name;
      if (updateSupplierDto.phone !== undefined) data.phone = updateSupplierDto.phone ?? null;
      if (updateSupplierDto.gstNumber !== undefined) data.gstNumber = updateSupplierDto.gstNumber ?? null;
      if (updateSupplierDto.address !== undefined) data.address = updateSupplierDto.address ?? null;
      if (updateSupplierDto.status !== undefined) data.status = updateSupplierDto.status;

      return await this.prisma.supplier.update({
        where: { id },
        data,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('A supplier with this name already exists.');
      }
      throw error;
    }
  }

  async remove(storeId: string, id: string) {
    await this.findOne(storeId, id);

    return this.prisma.supplier.update({
      where: { id },
      data: { status: ArchiveStatus.ARCHIVED },
    });
  }
}
