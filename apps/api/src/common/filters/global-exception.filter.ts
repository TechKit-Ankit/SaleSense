import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Inject,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { INTERNAL_ERROR, VALIDATION_FAILED } from "../errors/error-codes.js";
import { BusinessException } from "../errors/business-exception.js";
import { Logger } from "nestjs-pino";

/**
 * Catches every exception thrown in the request pipeline and formats
 * the response into the standard error envelope.
 *
 * NEVER leaks stack traces, internal details, or raw ORM errors.
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(@Inject(Logger) private readonly logger: Logger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    const requestId =
      ((req as any)["requestId"] as string) ?? null;
    const method = req.method;
    const route = req.url;

    let code: string = INTERNAL_ERROR;
    let message = "An unexpected error occurred";
    let details: unknown = null;
    let httpStatus = 500;

    if (exception instanceof BusinessException) {
      code = exception.code;
      message = exception.message;
      details = exception.details;
      httpStatus = exception.httpStatus;
    } else if (exception instanceof HttpException) {
      httpStatus = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (httpStatus === 400) {
        code = VALIDATION_FAILED;

        if (
          typeof exceptionResponse === "object" &&
          exceptionResponse !== null &&
          "message" in exceptionResponse
        ) {
          const raw = (exceptionResponse as Record<string, unknown>)["message"];
          if (Array.isArray(raw)) {
            message = "Validation failed";
            details = {
              fields: raw.map((msg: unknown) => ({
                path: typeof msg === "string" ? msg.split(" ")[0] ?? "" : "",
                message: String(msg),
              })),
            };
          } else {
            message = String(raw);
          }
        } else {
          message =
            typeof exceptionResponse === "string"
              ? exceptionResponse
              : "Bad request";
        }
      } else {
        message =
          typeof exceptionResponse === "object" &&
          exceptionResponse !== null &&
          "message" in exceptionResponse
            ? String((exceptionResponse as Record<string, unknown>)["message"])
            : exception.message;
      }
    } else {
      // Unknown / unhandled exception — log full details, return generic message
      this.logger.error(
        {
          err: exception instanceof Error ? exception : new Error(String(exception)),
          requestId,
          method,
          route,
          statusCode: 500,
        },
        "Unhandled exception",
      );
    }

    // Always log the error context (structured)
    if (!(exception instanceof Error && !(exception instanceof BusinessException) && !(exception instanceof HttpException))) {
      this.logger.error(
        {
          errorCode: code,
          requestId,
          method,
          route,
          statusCode: httpStatus,
        },
        `${code}: ${message}`,
      );
    }

    res.status(httpStatus).json({
      success: false,
      error: {
        code,
        message,
        details,
      },
      requestId,
    });
  }
}
