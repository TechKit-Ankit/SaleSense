import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { Observable, tap } from "rxjs";
import { v4 as uuidv4 } from "uuid";

/**
 * Reads `x-request-id` from the incoming request header.
 * If absent, generates a UUID v4 and attaches it to both
 * the request object and the response header.
 */
@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    const requestId =
      (req.headers["x-request-id"] as string | undefined) ?? uuidv4();

    // Attach to the request so downstream code can read it
    (req as any)["requestId"] = requestId;

    // Set response header immediately
    res.setHeader("x-request-id", requestId);

    return next.handle().pipe(
      tap(() => {
        // Ensure the header is present even if something replaced it
        if (!res.getHeader("x-request-id")) {
          res.setHeader("x-request-id", requestId);
        }
      }),
    );
  }
}
