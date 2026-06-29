import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@salesense/db';
import { BusinessException } from '../../../common/errors/business-exception';
import * as ERROR_CODES from '../../../common/errors/error-codes';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'secret',
    });
  }

  async validate(payload: any) {
    if (payload.type === 'refresh') {
      throw BusinessException.forbidden(ERROR_CODES.UNAUTHENTICATED, 'Invalid token type');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user) {
      throw BusinessException.forbidden(ERROR_CODES.UNAUTHENTICATED, 'User not found');
    }

    if (user.status !== 'ACTIVE') {
      throw BusinessException.forbidden(ERROR_CODES.UNAUTHENTICATED, 'User is not active');
    }

    return user;
  }
}
