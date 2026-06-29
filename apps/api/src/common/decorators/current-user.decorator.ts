import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { Request } from "express";

/**
 * Extracts the authenticated user from `request.user`.
 *
 * @example
 * @Get('me')
 * getProfile(@CurrentUser() user: User) { ... }
 */
export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const user = (request as any)["user"];
    return data ? user?.[data] : user;
  },
);
