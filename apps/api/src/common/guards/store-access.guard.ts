import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { PrismaService } from "@salesense/db";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator.js";
import { BusinessException } from "../errors/business-exception.js";
import {
  UNAUTHORIZED_STORE_ACCESS,
  VALIDATION_FAILED,
} from "../errors/error-codes.js";

/**
 * Validates that x-store-id is present and that the authenticated
 * user has an active membership in the specified store.
 *
 * Use on store-scoped controllers/routes. Skipped for @Public() routes.
 */
@Injectable()
export class StoreAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const req = context.switchToHttp().getRequest<Request>();
    const storeId = req.headers["x-store-id"] as string | undefined;

    if (!storeId) {
      throw BusinessException.badRequest(
        VALIDATION_FAILED,
        "x-store-id header is required",
      );
    }

    const user = (req as any)["user"] as
      | { id: string }
      | undefined;

    if (!user) {
      throw BusinessException.forbidden(
        UNAUTHORIZED_STORE_ACCESS,
        "Authentication required to access store resources",
      );
    }

    const storeUser = await this.prisma.storeUser.findUnique({
      where: {
        storeId_userId: { storeId, userId: user.id },
      },
      include: { store: true },
    });

    if (!storeUser || storeUser.status !== "ACTIVE") {
      throw BusinessException.forbidden(
        UNAUTHORIZED_STORE_ACCESS,
        "You do not have active membership in this store",
      );
    }

    if (storeUser.store.status === "DELETED") {
      throw BusinessException.notFound(
        VALIDATION_FAILED,
        "Store not found",
      );
    }

    const blockedStatuses = ["PENDING_DELETION", "DELETION_PAUSED"];
    if (blockedStatuses.includes(storeUser.store.status)) {
      const path = req.path;
      const isDeletionEndpoint =
        path.endsWith("/cancel-deletion") ||
        path.endsWith("/request-deletion") ||
        path.endsWith("/pause-deletion") ||
        path.endsWith("/resume-deletion") ||
        (req.method === "GET" && path.match(/\/stores\/[^\/]+$/)); // Allow GET /stores/:storeId

      if (!isDeletionEndpoint) {
        throw BusinessException.forbidden(
          UNAUTHORIZED_STORE_ACCESS,
          "Store is currently pending deletion and inaccessible",
        );
      }
    }

    // Attach storeUser to request for downstream use
    (req as any)["storeUser"] = storeUser;

    return true;
  }
}
