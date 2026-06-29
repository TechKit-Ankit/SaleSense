import { ERROR_CODE_HTTP_STATUS } from "./error-codes.js";

/**
 * Domain / business-logic exception.
 *
 * Throw this anywhere in services or guards; the GlobalExceptionFilter
 * will catch it and render the standard error envelope.
 */
export class BusinessException extends Error {
  private readonly _code: string;
  private readonly _httpStatus: number;
  private readonly _details: unknown;

  constructor(
    code: string,
    message: string,
    httpStatus: number,
    details?: unknown,
  ) {
    super(message);
    this.name = "BusinessException";
    this._code = code;
    this._httpStatus = httpStatus;
    this._details = details ?? null;
  }

  get code(): string {
    return this._code;
  }

  get httpStatus(): number {
    return this._httpStatus;
  }

  get details(): unknown {
    return this._details;
  }

  /* ── convenience factories ── */

  static notFound(code: string, message: string): BusinessException {
    return new BusinessException(
      code,
      message,
      ERROR_CODE_HTTP_STATUS[code] ?? 404,
    );
  }

  static conflict(code: string, message: string): BusinessException {
    return new BusinessException(
      code,
      message,
      ERROR_CODE_HTTP_STATUS[code] ?? 409,
    );
  }

  static forbidden(code: string, message: string): BusinessException {
    return new BusinessException(
      code,
      message,
      ERROR_CODE_HTTP_STATUS[code] ?? 403,
    );
  }

  static unauthorized(code: string, message: string): BusinessException {
    return new BusinessException(
      code,
      message,
      ERROR_CODE_HTTP_STATUS[code] ?? 401,
    );
  }

  static badRequest(code: string, message: string): BusinessException {
    return new BusinessException(
      code,
      message,
      ERROR_CODE_HTTP_STATUS[code] ?? 400,
    );
  }

  static internal(code: string, message: string): BusinessException {
    return new BusinessException(
      code,
      message,
      ERROR_CODE_HTTP_STATUS[code] ?? 500,
    );
  }
}
