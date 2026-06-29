# ADR 0003: Observability and Error Handling

## Status

Proposed

## Date

2026-06-18

## Context

SaleSense handles billing, inventory, invoices, offline sync, and payments. Errors must be graceful for users and traceable for developers. A cashier should see a clear recovery message, while developers should be able to find the exact failing request, user, store, route, invoice, sale, or sync job.

The system must start simple but keep a clean upgrade path for logs, traces, metrics, alerts, and production monitoring.

## Decision

Use:

| Area | Choice | Reason |
| --- | --- | --- |
| Frontend error tracking | Sentry for Next.js | Captures runtime errors, source maps, performance traces, replay if enabled |
| Backend error tracking | Sentry for NestJS | Captures unhandled exceptions and important handled failures |
| Backend structured logging | Pino through `nestjs-pino` | Fast JSON logs with request context |
| API error shape | Standard JSON envelope | Consistent frontend handling and easier debugging |
| Request correlation | `requestId` on every request | Connect frontend error, API log, database event, and Sentry issue |
| Database audit trail | Audit/event tables for critical actions | Support billing, inventory, invoice, and sync investigation |
| Future tracing | OpenTelemetry | Vendor-neutral path for distributed traces and metrics |
| Future log storage | Loki/Grafana, Datadog, or cloud log service | Centralized searchable logs when traffic grows |

Verified package baselines on 2026-06-18:

| Package | Latest observed stable |
| --- | --- |
| `@sentry/nextjs` | `10.58.0` |
| `@sentry/nestjs` | `10.58.0` |
| `pino` | `10.3.1` |
| `nestjs-pino` | `4.6.1` |

## Why Sentry

Sentry gives us fast value for both frontend and backend error tracking. Its Next.js documentation covers error monitoring, logs, session replay, tracing, and source maps. This is useful because production frontend stack traces are hard to debug without source maps.

Sentry should capture:

- frontend render/runtime errors
- failed API actions where useful
- backend unhandled exceptions
- critical handled business failures
- sync failures
- invoice generation failures

Do not send sensitive customer data, payment details, or full invoice payloads to Sentry.

## Why Pino

Pino is a fast structured JSON logger for Node.js. Structured logs are better than plain strings because they can be searched by fields such as `requestId`, `storeId`, `userId`, `saleId`, `invoiceId`, and `idempotencyKey`.

Use Pino logs for:

- API requests and responses
- failed validations
- sale creation failures
- idempotency conflicts
- stock movement failures
- sync retries
- background jobs later

## Why OpenTelemetry Later

OpenTelemetry is the upgrade path for traces, metrics, logs, and cross-service context propagation. We should not start with a heavy observability platform before MVP, but we should design logs and request context so OpenTelemetry can be added later without rewriting the app.

## Standard API Error Shape

All API errors should return a consistent shape:

```json
{
  "success": false,
  "error": {
    "code": "PRODUCT_NOT_FOUND",
    "message": "Product was not found.",
    "details": null
  },
  "requestId": "req_01jz..."
}
```

Rules:

- `message` is safe for users.
- `code` is stable for frontend handling.
- `details` must not contain secrets or sensitive data.
- `requestId` must be visible in logs and support/debug screens.
- Internal stack traces are never returned to the client.

## Frontend Error Handling

The frontend should:

- show friendly messages for expected errors
- show retry actions for network/offline errors
- show a support/debug reference using `requestId` when available
- capture unexpected errors in Sentry
- keep offline billing recoverable whenever possible

Example user-facing messages:

- "Could not sync this sale. It is saved locally and will retry."
- "Product not found for this barcode."
- "Stock is low. Confirm before billing."
- "Invoice could not be printed. You can retry or share it digitally."

## Backend Error Handling

The backend should:

- use NestJS exception filters for consistent responses
- use typed domain errors for business failures
- log all unexpected errors with request context
- capture critical exceptions in Sentry
- return stable error codes
- never leak stack traces, secrets, SQL, tokens, or raw provider responses

## Correlation Fields

Whenever available, logs and Sentry events should include:

```text
requestId
userId
storeId
counterId
saleId
invoiceId
idempotencyKey
syncBatchId
route
method
```

## Database Persistence Rule

Do not store `requestId` on every table by default. Store it where it helps reconstruct important actions.

Persist request correlation in:

- `audit_logs` for important user/system actions
- `sync_events` for offline sync attempts and failures
- `idempotency_keys` for retried billing requests
- `sales` optionally as `createdRequestId`
- `invoices` optionally as `createdRequestId`
- `stock_movements` optionally as `createdRequestId`

This keeps operational tables clean while preserving enough history to debug high-risk flows.

Example audit record:

```json
{
  "requestId": "req_01jz...",
  "actorUserId": "usr_...",
  "storeId": "store_...",
  "action": "SALE_CREATED",
  "entityType": "sale",
  "entityId": "sale_...",
  "metadata": {
    "invoiceId": "inv_...",
    "idempotencyKey": "sale_..."
  }
}
```

## Upgrade Path

Phase 1:

- Pino JSON logs in API
- standard API error envelope
- frontend friendly error states
- request ID middleware

Phase 2:

- Sentry in Next.js and NestJS
- source map upload in CI
- Sentry releases tied to deployments
- alerting for critical billing/sync failures

Phase 3:

- OpenTelemetry instrumentation
- distributed traces from frontend to API
- metrics for sale creation, sync failures, invoice failures
- dashboard for uptime and error rates

Phase 4:

- centralized log storage with Loki/Grafana, Datadog, or cloud logs
- alert routing
- retention policy
- audit and compliance reporting

## Revisit When

- logs become hard to search locally
- production support needs real-time alerting
- API traffic grows enough to require tracing and metrics
- Sentry cost or privacy requirements need a different setup
- enterprise customers require self-hosted observability
