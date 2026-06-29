import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@salesense/db';
import * as bcrypt from 'bcrypt';
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
    const refreshToken = this.generateRefreshToken(result.user.id);

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

    const accessToken = this.generateAccessToken(user.id, user.email);
    const refreshToken = this.generateRefreshToken(user.id);

    const { passwordHash: _, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      accessToken,
      refreshToken,
    };
  }

  async refresh(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET') || 'refresh-secret',
      });

      if (payload.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user || user.status !== 'ACTIVE') {
        throw new Error('User not found or inactive');
      }

      const accessToken = this.generateAccessToken(user.id, user.email);

      return { accessToken };
    } catch (error) {
      throw BusinessException.unauthorized(ERROR_CODES.UNAUTHENTICATED, 'Invalid refresh token');
    }
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

    const { passwordHash: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
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
      { sub: userId, type: 'refresh' },
      {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET') || 'refresh-secret',
        expiresIn: (this.configService.get<string>('JWT_REFRESH_EXPIRY') || '7d') as any,
      },
    );
  }
}
