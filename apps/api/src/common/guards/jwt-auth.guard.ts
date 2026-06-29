import { ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AuthGuard } from "@nestjs/passport";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator.js";
import { BusinessException } from "../errors/business-exception.js";
import { UNAUTHENTICATED } from "../errors/error-codes.js";

/**
 * Global JWT guard.
 * Skips authentication for routes decorated with @Public().
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }

  handleRequest<T>(err: Error | null, user: T | false): T {
    if (err || !user) {
      throw (
        err ??
        BusinessException.unauthorized(
          UNAUTHENTICATED,
          "Authentication required",
        )
      );
    }
    return user;
  }
}
