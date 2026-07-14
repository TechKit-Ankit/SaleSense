import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService, Prisma } from '@salesense/db';
import { BusinessException } from '../../common/errors/business-exception.js';
import { RESOURCE_NOT_FOUND, ERROR_CODE_HTTP_STATUS } from '../../common/errors/error-codes.js';
import { CreateCustomerDto, UpdateCustomerDto } from './dto/customer.dto.js';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  private notFound(): never {
    throw new BusinessException(
      RESOURCE_NOT_FOUND,
      'Customer was not found.',
      ERROR_CODE_HTTP_STATUS[RESOURCE_NOT_FOUND] ?? 404,
    );
  }

  list(storeId: string, q?: string) {
    return this.prisma.customer.findMany({
      where: {
        storeId,
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: 'insensitive' as const } },
                { phone: { contains: q } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async get(storeId: string, customerId: string) {
    const customer = await this.prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer || customer.storeId !== storeId) this.notFound();
    return customer;
  }

  async create(storeId: string, dto: CreateCustomerDto) {
    if (!dto.name && !dto.phone) {
      throw new BadRequestException('A name or phone is required');
    }
    try {
      return await this.prisma.customer.create({
        data: { storeId, name: dto.name ?? null, phone: dto.phone ?? null, gstNumber: dto.gstNumber ?? null },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new BadRequestException('A customer with this phone already exists');
      }
      throw e;
    }
  }

  async update(storeId: string, customerId: string, dto: UpdateCustomerDto) {
    await this.get(storeId, customerId); // scoping check
    try {
      return await this.prisma.customer.update({
        where: { id: customerId },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
          ...(dto.gstNumber !== undefined ? { gstNumber: dto.gstNumber } : {}),
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new BadRequestException('A customer with this phone already exists');
      }
      throw e;
    }
  }
}
