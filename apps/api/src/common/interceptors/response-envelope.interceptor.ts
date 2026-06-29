import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import type { Request } from "express";
import { Observable, map } from "rxjs";

interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
}

interface PaginatedResult {
  data: unknown;
  pagination: PaginationMeta;
}

interface WarningResult {
  data: unknown;
  warnings: unknown[];
}

/**
 * Wraps every controller return value in the standard success envelope:
 *   { success: true, data, requestId }
 *
 * Special handling:
 *  - If the return value has a `pagination` property, it is promoted to the top level.
 *  - If the return value has a `warnings` property, it is promoted to the top level.
 */
@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const requestId = (req as any)["requestId"] ?? null;

    return next.handle().pipe(
      map((body: unknown) => {
        // If the controller already returned a shaped response (e.g. health),
        // or if body is null/undefined, wrap it.
        if (body === null || body === undefined) {
          return { success: true, data: null, requestId: requestId ?? null };
        }

        // Check for pagination shape
        if (
          typeof body === "object" &&
          body !== null &&
          "pagination" in body &&
          "data" in body
        ) {
          const { data, pagination, ...rest } = body as PaginatedResult &
            Record<string, unknown>;
          return {
            success: true,
            data,
            pagination,
            ...rest,
            requestId: requestId ?? null,
          };
        }

        // Check for warnings shape
        if (
          typeof body === "object" &&
          body !== null &&
          "warnings" in body &&
          "data" in body
        ) {
          const { data, warnings, ...rest } = body as WarningResult &
            Record<string, unknown>;
          return {
            success: true,
            data,
            warnings,
            ...rest,
            requestId: requestId ?? null,
          };
        }

        return { success: true, data: body, requestId: requestId ?? null };
      }),
    );
  }
}
