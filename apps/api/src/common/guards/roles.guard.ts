import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { PrismaService } from "@salesense/db";
import { ROLES_KEY } from "../decorators/roles.decorator.js";
import { BusinessException } from "../errors/business-exception.js";
import {
  FORBIDDEN,
  UNAUTHORIZED_STORE_ACCESS,
} from "../errors/error-codes.js";

/**
 * Checks that the authenticated user holds one of the required
 * store-level roles (OWNER, MANAGER, CASHIER) for the store
 * specified via x-store-id.
 *
 * If no @Roles() decorator is present, the guard passes through.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<string[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const req = context.switchToHttp().getRequest<Request>();
    const user = (req as any)["user"] as
      | { id: string }
      | undefined;

    if (!user) {
      throw BusinessException.unauthorized(
        FORBIDDEN,
        "Authentication required",
      );
    }

    const storeId = req.headers["x-store-id"] as string | undefined;
    if (!storeId) {
      throw BusinessException.forbidden(
        UNAUTHORIZED_STORE_ACCESS,
        "x-store-id header is required",
      );
    }

    const storeUser = await this.prisma.storeUser.findUnique({
      where: {
        storeId_userId: { storeId, userId: user.id },
      },
    });

    if (!storeUser || storeUser.status !== "ACTIVE") {
      throw BusinessException.forbidden(
        UNAUTHORIZED_STORE_ACCESS,
        "You do not have active membership in this store",
      );
    }

    if (!requiredRoles.includes(storeUser.role)) {
      throw BusinessException.forbidden(
        FORBIDDEN,
        "You do not have the required role for this action",
      );
    }

    // Attach storeUser to request for downstream use
    (req as any)["storeUser"] = storeUser;

    return true;
  }
}
