import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { Request } from "express";
import { BusinessException } from "../errors/business-exception.js";
import { VALIDATION_FAILED } from "../errors/error-codes.js";

/**
 * Extracts `x-store-id` from request headers.
 *
 * Throws VALIDATION_FAILED if the header is missing.
 *
 * @example
 * @Get('products')
 * listProducts(@StoreId() storeId: string) { ... }
 */
export const StoreId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const storeId = (request as any)["headers"]?.["x-store-id"] as string | undefined;

    if (!storeId) {
      throw BusinessException.badRequest(
        VALIDATION_FAILED,
        "x-store-id header is required",
      );
    }

    return storeId;
  },
);
