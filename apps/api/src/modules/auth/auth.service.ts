import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@salesense/db';
import * as bcrypt from 'bcrypt';
import { createHash, randomUUID } from 'crypto';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { BusinessException } from '../../common/errors/business-exception';
import * as ERROR_CODES from '../../common/errors/error-codes';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    if (!dto.email && !dto.phone) {
      throw BusinessException.badRequest(ERROR_CODES.VALIDATION_FAILED, 'Email or phone must be provided');
    }

    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          ...(dto.email ? [{ email: dto.email }] : []),
          ...(dto.phone ? [{ phone: dto.phone }] : []),
        ],
      },
    });

    if (existingUser) {
      throw BusinessException.conflict(ERROR_CODES.VALIDATION_FAILED, 'User with this email or phone already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const result = await this.prisma.$transaction(async (tx: any) => {
      const user = await tx.user.create({
        data: {
          name: dto.name,
          email: dto.email,
          phone: dto.phone,
          passwordHash,
        },
      });

      const store = await tx.store.create({
        data: {
          name: dto.storeName || `${dto.name}'s Store`,
        },
      });

      await tx.storeUser.create({
        data: {
          userId: user.id,
          storeId: store.id,
          role: 'OWNER',
        },
      });

      return { user, store };
    });

    const accessToken = this.generateAccessToken(result.user.id, result.user.email);
    const refreshToken = await this.issueRefreshToken(result.user.id);

    const { passwordHash: _, ...userWithoutPassword } = result.user;

    return {
      user: userWithoutPassword,
      store: result.store,
      accessToken,
      refreshToken,
    };
  }

  async login(dto: LoginDto) {
    if (!dto.email && !dto.phone) {
      throw BusinessException.badRequest(ERROR_CODES.VALIDATION_FAILED, 'Email or phone must be provided');
    }

    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          ...(dto.email ? [{ email: dto.email }] : []),
          ...(dto.phone ? [{ phone: dto.phone }] : []),
        ],
      },
    });

    if (!user) {
      throw BusinessException.unauthorized(ERROR_CODES.UNAUTHENTICATED, 'Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw BusinessException.unauthorized(ERROR_CODES.UNAUTHENTICATED, 'Invalid credentials');
    }

    if (user.status !== 'ACTIVE') {
      throw BusinessException.unauthorized(ERROR_CODES.UNAUTHENTICATED, 'User is not active');
    }

    // Opportunistic hygiene: drop this user's long-expired sessions.
    await this.prisma.refreshSession.deleteMany({
      where: { userId: user.id, expiresAt: { lt: new Date() } },
    });

    const accessToken = this.generateAccessToken(user.id, user.email);
    const refreshToken = await this.issueRefreshToken(user.id);

    const { passwordHash: _, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      accessToken,
      refreshToken,
    };
  }

  /**
   * Rotation + theft detection (design doc 0010):
   * - valid session  -> rotate: new refresh token issued, old session revoked
   *   with lineage (`replacedById`).
   * - REVOKED session presented again -> token reuse: someone holds a stolen
   *   copy. The whole family is revoked; both parties must re-login.
   * - unknown hash / expired -> 401.
   */
  async refresh(refreshToken: string) {
    let payload: any;
    try {
      payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET') || 'refresh-secret',
      });
      if (payload.type !== 'refresh') throw new Error('Invalid token type');
    } catch {
      throw BusinessException.unauthorized(ERROR_CODES.UNAUTHENTICATED, 'Invalid refresh token');
    }

    const tokenHash = this.hashToken(refreshToken);
    const session = await this.prisma.refreshSession.findUnique({ where: { tokenHash } });

    if (!session) {
      throw BusinessException.unauthorized(ERROR_CODES.UNAUTHENTICATED, 'Invalid refresh token');
    }

    if (session.revokedAt) {
      // Reuse of a rotated token — assume theft, burn the whole family.
      await this.prisma.refreshSession.updateMany({
        where: { familyId: session.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw BusinessException.unauthorized(ERROR_CODES.UNAUTHENTICATED, 'Invalid refresh token');
    }

    if (session.expiresAt < new Date()) {
      throw BusinessException.unauthorized(ERROR_CODES.UNAUTHENTICATED, 'Invalid refresh token');
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.status !== 'ACTIVE') {
      throw BusinessException.unauthorized(ERROR_CODES.UNAUTHENTICATED, 'Invalid refresh token');
    }

    const accessToken = this.generateAccessToken(user.id, user.email);
    const newRefreshToken = await this.issueRefreshToken(user.id, session.familyId, session.id);

    return { accessToken, refreshToken: newRefreshToken };
  }

  /** Revokes the session family server-side — logout becomes real. */
  async logout(refreshToken?: string) {
    if (!refreshToken) return { revoked: false };
    const session = await this.prisma.refreshSession.findUnique({
      where: { tokenHash: this.hashToken(refreshToken) },
    });
    if (!session) return { revoked: false };
    await this.prisma.refreshSession.updateMany({
      where: { familyId: session.familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { revoked: true };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        storeUsers: {
          where: { status: 'ACTIVE' },
          include: {
            store: true,
          },
        },
      },
    });

    if (!user) {
      throw BusinessException.notFound(ERROR_CODES.RESOURCE_NOT_FOUND, 'User not found');
    }

    // Expose the relation as `storeMemberships` (the API/0001 contract term
    // the web reads) rather than the raw Prisma relation name `storeUsers`.
    const { passwordHash: _, storeUsers, ...userWithoutPassword } = user;
    return { ...userWithoutPassword, storeMemberships: storeUsers };
  }

  private generateAccessToken(userId: string, email: string | null) {
    return this.jwtService.sign(
      { sub: userId, email },
      {
        secret: this.configService.get<string>('JWT_SECRET') || 'secret',
        expiresIn: (this.configService.get<string>('JWT_ACCESS_EXPIRY') || '15m') as any,
      },
    );
  }

  private generateRefreshToken(userId: string) {
    return this.jwtService.sign(
      // jti guarantees hash-unique tokens even for same-second logins.
      { sub: userId, type: 'refresh', jti: randomUUID() },
      {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET') || 'refresh-secret',
        expiresIn: (this.configService.get<string>('JWT_REFRESH_EXPIRY') || '7d') as any,
      },
    );
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /**
   * Signs a refresh token AND records its session (design doc 0010). Only the
   * SHA-256 hash is stored; expiry mirrors the JWT's own exp claim. On
   * rotation the previous session is revoked with lineage in one transaction.
   */
  private async issueRefreshToken(userId: string, familyId?: string, rotatedFromId?: string) {
    const token = this.generateRefreshToken(userId);
    const decoded: any = this.jwtService.decode(token);
    const data = {
      id: randomUUID(),
      userId,
      familyId: familyId ?? randomUUID(),
      tokenHash: this.hashToken(token),
      expiresAt: new Date((decoded?.exp ?? Math.floor(Date.now() / 1000) + 7 * 86400) * 1000),
    };

    if (rotatedFromId) {
      await this.prisma.$transaction([
        this.prisma.refreshSession.create({ data }),
        this.prisma.refreshSession.update({
          where: { id: rotatedFromId },
          data: { revokedAt: new Date(), replacedById: data.id },
        }),
      ]);
    } else {
      await this.prisma.refreshSession.create({ data });
    }

    return token;
  }
}
