import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@salesense/db';
import { CreateInvitationDto } from './dto/invitation.dto';
import { BusinessException } from '../../common/errors/business-exception';
import * as ERROR_CODES from '../../common/errors/error-codes';

@Injectable()
export class InvitationsService {
  private readonly logger = new Logger(InvitationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(storeId: string, invitedBy: string, dto: CreateInvitationDto) {
    if (!dto.invitedEmail && !dto.invitedPhone) {
      throw BusinessException.badRequest(ERROR_CODES.VALIDATION_FAILED, 'Either email or phone is required');
    }

    // Check if user is already a member
    if (dto.invitedEmail) {
      const existingUser = await this.prisma.user.findUnique({ where: { email: dto.invitedEmail } });
      if (existingUser) {
        const membership = await this.prisma.storeUser.findUnique({
          where: { storeId_userId: { storeId, userId: existingUser.id } },
        });
        if (membership) {
          throw BusinessException.badRequest(ERROR_CODES.VALIDATION_FAILED, 'User is already a member of this store');
        }
      }
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

    return this.prisma.storeInvitation.create({
      data: {
        storeId,
        invitedEmail: dto.invitedEmail || null,
        invitedPhone: dto.invitedPhone || null,
        role: dto.role,
        invitedBy,
        status: 'PENDING',
        expiresAt,
      },
    });
  }

  async findAllForStore(storeId: string) {
    return this.prisma.storeInvitation.findMany({
      where: { storeId },
      include: {
        inviter: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findPendingForUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw BusinessException.notFound(ERROR_CODES.RESOURCE_NOT_FOUND, 'User not found');
    }

    const conditions: any[] = [];
    if (user.email) conditions.push({ invitedEmail: user.email });
    if (user.phone) conditions.push({ invitedPhone: user.phone });

    if (conditions.length === 0) return [];

    return this.prisma.storeInvitation.findMany({
      where: {
        status: 'PENDING',
        expiresAt: { gt: new Date() },
        OR: conditions,
      },
      include: {
        store: true,
        inviter: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async accept(invitationId: string, userId: string) {
    const invitation = await this.prisma.storeInvitation.findUnique({
      where: { id: invitationId },
    });

    if (!invitation || invitation.status !== 'PENDING') {
      throw BusinessException.badRequest(ERROR_CODES.VALIDATION_FAILED, 'Invalid or expired invitation');
    }

    if (invitation.expiresAt < new Date()) {
      await this.prisma.storeInvitation.update({
        where: { id: invitationId },
        data: { status: 'EXPIRED' },
      });
      throw BusinessException.badRequest(ERROR_CODES.VALIDATION_FAILED, 'Invitation has expired');
    }

    return this.prisma.$transaction(async (tx: any) => {
      // Mark as accepted
      await tx.storeInvitation.update({
        where: { id: invitationId },
        data: {
          status: 'ACCEPTED',
          respondedAt: new Date(),
        },
      });

      // Add user to store
      await tx.storeUser.create({
        data: {
          storeId: invitation.storeId,
          userId,
          role: invitation.role,
          status: 'ACTIVE',
        },
      });
    });
  }

  async reject(invitationId: string, userId: string) {
    const invitation = await this.prisma.storeInvitation.findUnique({
      where: { id: invitationId },
    });

    if (!invitation || invitation.status !== 'PENDING') {
      throw BusinessException.badRequest(ERROR_CODES.VALIDATION_FAILED, 'Invalid or expired invitation');
    }

    return this.prisma.storeInvitation.update({
      where: { id: invitationId },
      data: {
        status: 'REJECTED',
        respondedAt: new Date(),
      },
    });
  }

  async cancel(storeId: string, invitationId: string) {
    const invitation = await this.prisma.storeInvitation.findUnique({
      where: { id: invitationId, storeId },
    });

    if (!invitation || invitation.status !== 'PENDING') {
      throw BusinessException.badRequest(ERROR_CODES.VALIDATION_FAILED, 'Cannot cancel this invitation');
    }

    return this.prisma.storeInvitation.delete({
      where: { id: invitationId },
    });
  }
}
