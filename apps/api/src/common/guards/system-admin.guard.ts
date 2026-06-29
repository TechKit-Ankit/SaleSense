import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import type { Request } from "express";
import { PrismaService } from "@salesense/db";
import { BusinessException } from "../errors/business-exception.js";
import { UNAUTHORIZED_STORE_ACCESS } from "../errors/error-codes.js";

/**
 * Validates that the authenticated user has SUPER_ADMIN systemRole.
 */
@Injectable()
export class SystemAdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    
    const user = (req as any)["user"] as
      | { id: string }
      | undefined;

    if (!user) {
      throw BusinessException.forbidden(
        UNAUTHORIZED_STORE_ACCESS,
        "Authentication required",
      );
    }

    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { systemRole: true }
    });

    if (!dbUser || dbUser.systemRole !== "SUPER_ADMIN") {
      throw BusinessException.forbidden(
        UNAUTHORIZED_STORE_ACCESS,
        "Super Admin privileges required",
      );
    }

    return true;
  }
}
