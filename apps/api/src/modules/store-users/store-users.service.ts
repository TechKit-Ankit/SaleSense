import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@salesense/db';
import { AddStoreUserDto, UpdateStoreUserDto } from './dto/store-user.dto';
import { BusinessException } from '../../common/errors/business-exception';
import * as ERROR_CODES from '../../common/errors/error-codes';

@Injectable()
export class StoreUsersService {
  private readonly logger = new Logger(StoreUsersService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(storeId: string) {
    return this.prisma.storeUser.findMany({
      where: { storeId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async add(storeId: string, dto: AddStoreUserDto) {
    const existing = await this.prisma.storeUser.findUnique({
      where: { storeId_userId: { storeId, userId: dto.userId } },
    });

    if (existing) {
      throw BusinessException.badRequest(ERROR_CODES.VALIDATION_FAILED, 'User is already part of the store');
    }

    return this.prisma.storeUser.create({
      data: {
        storeId,
        userId: dto.userId,
        role: dto.role,
        status: 'ACTIVE',
      },
    });
  }

  async update(storeId: string, userId: string, dto: UpdateStoreUserDto) {
    const existing = await this.prisma.storeUser.findUnique({
      where: { storeId_userId: { storeId, userId } },
    });

    if (!existing) {
      throw BusinessException.notFound(ERROR_CODES.RESOURCE_NOT_FOUND, 'Store user not found');
    }

    if (existing.role === 'OWNER' && dto.role && dto.role !== 'OWNER') {
      // Must ensure there's at least one other OWNER before demoting
      const ownerCount = await this.prisma.storeUser.count({
        where: { storeId, role: 'OWNER', status: 'ACTIVE' },
      });

      if (ownerCount <= 1) {
        throw BusinessException.badRequest(ERROR_CODES.VALIDATION_FAILED, 'Cannot demote the only owner of the store');
      }
    }

    return this.prisma.storeUser.update({
      where: { storeId_userId: { storeId, userId } },
      data: dto,
    });
  }

  async remove(storeId: string, userId: string) {
    const existing = await this.prisma.storeUser.findUnique({
      where: { storeId_userId: { storeId, userId } },
    });

    if (!existing) {
      throw BusinessException.notFound(ERROR_CODES.RESOURCE_NOT_FOUND, 'Store user not found');
    }

    if (existing.role === 'OWNER') {
      const ownerCount = await this.prisma.storeUser.count({
        where: { storeId, role: 'OWNER', status: 'ACTIVE' },
      });

      if (ownerCount <= 1) {
        throw BusinessException.badRequest(ERROR_CODES.VALIDATION_FAILED, 'Cannot remove the only owner of the store');
      }
    }

    return this.prisma.storeUser.delete({
      where: { storeId_userId: { storeId, userId } },
    });
  }
}
