# SaleSense Test Strategy

## Goal

Testing must protect billing accuracy, inventory correctness, sync safety, and invoice reliability. UI polish matters, but financial and stock correctness matter most.

## Test Levels

| Level | Tool | Purpose |
| --- | --- | --- |
| Unit | Vitest or Jest | Pricing, discounts, tax, stock calculations |
| API integration | Supertest | Controllers, validation, auth, database behavior |
| Database | Prisma migrate + test DB | Migration safety and relational constraints |
| End-to-end | Playwright | POS billing, offline queue, sync, invoice flow |
| Contract | OpenAPI validation | Keep frontend/API contracts stable |

## Critical Scenarios

1. Barcode scan adds the correct product.
2. Sale reduces stock exactly once.
3. Retry with same idempotency key does not double bill.
4. Offline sale is saved locally and syncs later.
5. Historical sale prices do not change when product price changes.
6. Discount and BOGO calculations show profit impact correctly.
7. GST invoice tax breakup is correct.
8. Refund restores stock according to refund rules.

## Release Rule

No billing, inventory, invoice, or sync feature should be marked complete unless it has automated tests and updated docs.

