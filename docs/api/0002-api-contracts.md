# API Contracts

## Status

Draft for review

## Goal

Define cross-cutting API contracts for errors, request IDs, idempotency, pagination, validation, and sensitive data handling.

## Request ID Contract

Every request must have a `requestId`.

Rules:

1. Client may send `x-request-id`.
2. API generates a new ID if missing.
3. API returns `requestId` in every response.
4. API includes `requestId` in logs.
5. API persists `requestId` for high-risk operations.

Response example:

```json
{
  "success": true,
  "data": {},
  "requestId": "req_01jz..."
}
```

## Error Contract

All errors use:

```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_STOCK",
    "message": "Insufficient stock for this product.",
    "details": {
      "productId": "prod_...",
      "availableQuantity": 1
    }
  },
  "requestId": "req_01jz..."
}
```

Rules:

- `code` is stable and machine-readable.
- `message` is safe to display to users.
- `details` is optional and must not contain secrets.
- Stack traces are never returned.
- Validation errors should point to fields.

## Initial Error Codes

| Code | HTTP Status | Meaning |
| --- | --- | --- |
| `UNAUTHENTICATED` | 401 | Missing/invalid auth |
| `FORBIDDEN` | 403 | User lacks permission |
| `UNAUTHORIZED_STORE_ACCESS` | 403 | User cannot access store |
| `VALIDATION_FAILED` | 400 | Request body/query invalid |
| `RESOURCE_NOT_FOUND` | 404 | Generic missing resource |
| `PRODUCT_NOT_FOUND` | 404 | Product or barcode missing |
| `CATEGORY_NOT_FOUND` | 404 | Category missing |
| `BRAND_NOT_FOUND` | 404 | Brand missing |
| `BATCH_NOT_FOUND` | 404 | Inventory batch missing |
| `INSUFFICIENT_STOCK` | 409 | Stock unavailable for online sale |
| `STOCK_RECONCILIATION_REQUIRED` | 200 warning | Offline sync succeeded but stock needs review |
| `SALE_ALREADY_PROCESSED` | 200 or 409 | Idempotency replay or conflict |
| `IDEMPOTENCY_CONFLICT` | 409 | Same key with different request body |
| `INVOICE_SEQUENCE_CONFLICT` | 409 | Invoice number concurrency issue |
| `REFUND_APPROVAL_REQUIRED` | 409 | Refund cannot complete without approval |
| `INVOICE_GENERATION_FAILED` | 500 | Invoice creation failed |
| `SYNC_CONFLICT` | 409 | Offline mutation conflict |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

## Validation Error Example

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Some fields are invalid.",
    "details": {
      "fields": [
        {
          "path": "items.0.quantity",
          "message": "Quantity must be greater than 0."
        }
      ]
    }
  },
  "requestId": "req_01jz..."
}
```

## Idempotency Contract

Idempotency is required for operations where retrying could create duplicate business records.

Required for:

- `POST /sales`
- `POST /sync/sales`
- `POST /sales/:saleId/refunds`
- `POST /refunds/:refundId/approve`
- `POST /refunds/:refundId/complete`
- future payment capture endpoints

Header:

```text
idempotency-key: sale_01jz...
```

Server behavior:

1. Check `(storeId, idempotencyKey)`.
2. If missing, create an `idempotency_keys` row with `PROCESSING`.
3. Hash sanitized request body into `requestHash`.
4. Process the operation transactionally.
5. Store `resourceType`, `resourceId`, and `COMPLETED`.
6. If the same key and same hash repeats, return the original resource.
7. If the same key and different hash repeats, return `IDEMPOTENCY_CONFLICT`.

## Idempotent Replay Response

```json
{
  "success": true,
  "data": {
    "saleId": "sale_...",
    "invoiceId": "inv_...",
    "replayed": true
  },
  "requestId": "req_01jz..."
}
```

## Store Scoping Contract

Protected store routes require `x-store-id`.

Rules:

- User must have active membership in the store.
- Every query must be scoped by `storeId`.
- Related resources must belong to the same store.
- Cross-store IDs must return `RESOURCE_NOT_FOUND` or `UNAUTHORIZED_STORE_ACCESS`, depending on context.

## Money Contract

All money values are integer paise:

```json
{
  "sellingPricePaise": 3000,
  "taxPaise": 150,
  "totalPaise": 3150
}
```

Never send or accept floating-point money values like `31.5`.

## Quantity Contract

MVP uses integer quantities.

```json
{
  "quantity": 2
}
```

Future weighted products may introduce `quantityMilliUnits` or decimal quantities. Do not add floating-point quantity handling casually.

## Warning Contract

Some successful responses may include warnings:

```json
{
  "success": true,
  "data": {},
  "warnings": [
    {
      "code": "STOCK_RECONCILIATION_REQUIRED",
      "message": "Sale synced, but one item needs stock review."
    }
  ],
  "requestId": "req_01jz..."
}
```

Use warnings for recoverable business conditions, especially offline sync.

## Sensitive Data Rules

Never return:

- `passwordHash`
- auth tokens except through auth endpoints
- full internal exception details
- raw provider/payment secrets
- private connection strings

Mask where possible:

- phone numbers in logs
- customer metadata in audit logs
- payment references in support views

## Date And Time Contract

Use ISO 8601 strings in API responses.

```json
{
  "createdAt": "2026-06-18T10:30:00.000Z"
}
```

Store timezone is used for business display and reports, not for raw timestamp storage.

## OpenAPI Requirements

Every endpoint should document:

1. Required roles
2. Required headers
3. Request body
4. Response body
5. Error codes
6. Idempotency behavior if applicable

