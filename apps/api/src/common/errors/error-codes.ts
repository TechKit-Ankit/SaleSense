/**
 * All application error codes.
 * Uppercase, stable, and documented — these appear in API responses.
 */

// Authentication & Authorization
export const UNAUTHENTICATED = "UNAUTHENTICATED" as const;
export const FORBIDDEN = "FORBIDDEN" as const;
export const UNAUTHORIZED_STORE_ACCESS = "UNAUTHORIZED_STORE_ACCESS" as const;

// Validation
export const VALIDATION_FAILED = "VALIDATION_FAILED" as const;

// Not Found
export const RESOURCE_NOT_FOUND = "RESOURCE_NOT_FOUND" as const;
export const PRODUCT_NOT_FOUND = "PRODUCT_NOT_FOUND" as const;
export const CATEGORY_NOT_FOUND = "CATEGORY_NOT_FOUND" as const;
export const BRAND_NOT_FOUND = "BRAND_NOT_FOUND" as const;
export const BATCH_NOT_FOUND = "BATCH_NOT_FOUND" as const;

// Conflict / Business Logic
export const INSUFFICIENT_STOCK = "INSUFFICIENT_STOCK" as const;
export const STOCK_RECONCILIATION_REQUIRED =
  "STOCK_RECONCILIATION_REQUIRED" as const;
export const SALE_ALREADY_PROCESSED = "SALE_ALREADY_PROCESSED" as const;
export const IDEMPOTENCY_CONFLICT = "IDEMPOTENCY_CONFLICT" as const;
export const INVOICE_SEQUENCE_CONFLICT =
  "INVOICE_SEQUENCE_CONFLICT" as const;
export const REFUND_APPROVAL_REQUIRED =
  "REFUND_APPROVAL_REQUIRED" as const;
export const SYNC_CONFLICT = "SYNC_CONFLICT" as const;

// Server
export const INVOICE_GENERATION_FAILED =
  "INVOICE_GENERATION_FAILED" as const;
export const INTERNAL_ERROR = "INTERNAL_ERROR" as const;

/**
 * Maps each error code to its default HTTP status.
 */
export const ERROR_CODE_HTTP_STATUS: Record<string, number> = {
  [UNAUTHENTICATED]: 401,
  [FORBIDDEN]: 403,
  [UNAUTHORIZED_STORE_ACCESS]: 403,
  [VALIDATION_FAILED]: 400,
  [RESOURCE_NOT_FOUND]: 404,
  [PRODUCT_NOT_FOUND]: 404,
  [CATEGORY_NOT_FOUND]: 404,
  [BRAND_NOT_FOUND]: 404,
  [BATCH_NOT_FOUND]: 404,
  [INSUFFICIENT_STOCK]: 409,
  [STOCK_RECONCILIATION_REQUIRED]: 200,
  [SALE_ALREADY_PROCESSED]: 409,
  [IDEMPOTENCY_CONFLICT]: 409,
  [INVOICE_SEQUENCE_CONFLICT]: 409,
  [REFUND_APPROVAL_REQUIRED]: 409,
  [INVOICE_GENERATION_FAILED]: 500,
  [SYNC_CONFLICT]: 409,
  [INTERNAL_ERROR]: 500,
};
