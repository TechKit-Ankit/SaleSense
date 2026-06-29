import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@salesense/db';
import { CreateStoreDto, UpdateStoreDto } from './dto/store.dto';
import { BusinessException } from '../../common/errors/business-exception';
import * as ERROR_CODES from '../../common/errors/error-codes';

@Injectable()
export class StoresService {
  private readonly logger = new Logger(StoresService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateStoreDto) {
    return this.prisma.$transaction(async (tx: any) => {
      const store = await tx.store.create({
        data: {
          name: dto.name,
          gstNumber: dto.gstNumber,
          addressLine1: dto.addressLine1,
          addressLine2: dto.addressLine2,
          city: dto.city,
          state: dto.state,
          pincode: dto.pincode,
          upiId: dto.upiId,
          currency: dto.currency || 'INR',
          timezone: dto.timezone || 'Asia/Kolkata',
        },
      });

      await tx.storeUser.create({
        data: {
          storeId: store.id,
          userId,
          role: 'OWNER',
        },
      });

      return store;
    });
  }

  async findAllForUser(userId: string) {
    const storeUsers = await this.prisma.storeUser.findMany({
      where: {
        userId,
        status: 'ACTIVE',
        store: {
          status: {
            notIn: ['DELETED', 'PENDING_DELETION', 'DELETION_PAUSED'],
          },
        },
      },
      include: {
        store: true,
      },
    });

    return storeUsers.map((su) => ({
      ...su.store,
      role: su.role,
    }));
  }

  async findAllSettingsForUser(userId: string) {
    // Unlike findAllForUser, this includes PENDING_DELETION so the user can see it in settings
    const storeUsers = await this.prisma.storeUser.findMany({
      where: {
        userId,
        status: 'ACTIVE',
        store: {
          status: {
            not: 'DELETED',
          },
        },
      },
      include: {
        store: true,
      },
    });

    return storeUsers.map((su) => ({
      ...su.store,
      role: su.role,
    }));
  }

  async findOne(storeId: string) {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
    });

    if (!store) {
      throw BusinessException.notFound(ERROR_CODES.RESOURCE_NOT_FOUND, 'Store not found');
    }

    return store;
  }

  async update(storeId: string, dto: UpdateStoreDto) {
    return this.prisma.store.update({
      where: { id: storeId },
      data: dto,
    });
  }

  async requestDeletion(storeId: string) {
    const store = await this.findOne(storeId);
    
    if (store.status === 'PENDING_DELETION' || store.status === 'DELETED') {
      throw BusinessException.badRequest(ERROR_CODES.VALIDATION_FAILED, 'Store is already pending deletion or deleted');
    }

    const scheduledDate = new Date();
    scheduledDate.setDate(scheduledDate.getDate() + store.deletionCooldownDays);

    return this.prisma.store.update({
      where: { id: storeId },
      data: {
        status: 'PENDING_DELETION',
        deletionRequestedAt: new Date(),
        deletionScheduledAt: scheduledDate,
      },
    });
  }

  async cancelDeletion(storeId: string) {
    const store = await this.findOne(storeId);
    
    if (store.status !== 'PENDING_DELETION' && store.status !== 'DELETION_PAUSED') {
      throw BusinessException.badRequest(ERROR_CODES.VALIDATION_FAILED, 'Store is not pending deletion');
    }

    return this.prisma.store.update({
      where: { id: storeId },
      data: {
        status: 'ACTIVE',
        deletionRequestedAt: null,
        deletionScheduledAt: null,
        deletionPausedAt: null,
      },
    });
  }

  async pauseDeletion(storeId: string) {
    const store = await this.findOne(storeId);
    
    if (store.status !== 'PENDING_DELETION') {
      throw BusinessException.badRequest(ERROR_CODES.VALIDATION_FAILED, 'Store must be PENDING_DELETION to pause');
    }

    return this.prisma.store.update({
      where: { id: storeId },
      data: {
        status: 'DELETION_PAUSED',
        deletionPausedAt: new Date(),
      },
    });
  }

  async resumeDeletion(storeId: string) {
    const store = await this.findOne(storeId);
    
    if (store.status !== 'DELETION_PAUSED' || !store.deletionPausedAt || !store.deletionScheduledAt) {
      throw BusinessException.badRequest(ERROR_CODES.VALIDATION_FAILED, 'Store must be paused to resume');
    }

    const now = new Date();
    const pausedTimeMs = now.getTime() - store.deletionPausedAt.getTime();
    
    const newScheduledDate = new Date(store.deletionScheduledAt.getTime() + pausedTimeMs);

    return this.prisma.store.update({
      where: { id: storeId },
      data: {
        status: 'PENDING_DELETION',
        deletionPausedAt: null,
        deletionScheduledAt: newScheduledDate,
      },
    });
  }
}
