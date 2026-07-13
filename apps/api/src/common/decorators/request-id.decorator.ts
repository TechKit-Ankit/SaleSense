import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { Request } from "express";

/**
 * Extracts the correlation `requestId` that `requestIdMiddleware`
 * attaches to every incoming request (see main.ts).
 *
 * Returns an empty string if the interceptor has not run (e.g. in isolated
 * unit tests), so callers can safely persist it as `createdRequestId`.
 *
 * @example
 * @Post()
 * create(@RequestId() requestId: string) { ... }
 */
export const RequestId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return ((request as any)["requestId"] as string | undefined) ?? "";
  },
);
