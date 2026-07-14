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

---

# Tooling and Commands (merged from testing-strategy.md, Wave A hygiene)
This document outlines the testing strategy for the SaleSense monorepo.

## Automated Testing Tooling

We use **Jest** as our primary test runner across the backend applications. Jest provides a comprehensive assertion library, mocking capabilities, and integrates seamlessly with NestJS (`@nestjs/testing`).

### Core Commands
- **Run all tests:** `pnpm test` (Runs tests across all packages)
- **Watch mode:** `pnpm --filter @salesense/api test:watch` (Runs tests interactively)
- **Coverage report:** `pnpm --filter @salesense/api test:cov` (Generates coverage metrics)

## Backend (`apps/api`)

The backend follows the NestJS testing guidelines.
1. **Unit Tests**: Business logic within Services (e.g., `AuthService`) should be isolated and tested by mocking out the `PrismaService` and external providers (like `JwtService`). Files are suffixed with `.spec.ts` and reside next to the service they test.
2. **Integration / E2E Tests**: We use **Supertest** to simulate live HTTP traffic against the API without needing to bind to a real port. These tests live in the `apps/api/test` folder and end with `.e2e-spec.ts`. Supertest tests the entire request-response lifecycle, from hitting the routing decorators through the guards and interceptors, all the way to the JSON response formatting.
   - Run via: `pnpm --filter @salesense/api test:e2e`

### Module Path Resolution
Our backend `jest.config.js` leverages `moduleNameMapper` to resolve explicit `.js` extension imports (e.g., `import { X } from './file.js'`) by mapping them to their `.ts` counterparts seamlessly during execution.

## Continuous Integration
Tests are automatically mapped via **Turborepo** (`turbo.json`). Calling `pnpm test` from the root intelligently caches successful test runs. If code hasn't changed in a package, the test phase for that package resolves instantly from the turbo cache.

## Frontend (`apps/web`) — implemented (Wave D, 2026-07-13)

Runner decision (2026-07-12, production checklist item 9): **Jest via `next/jest`
+ @testing-library/react** — one runner monorepo-wide; Vitest rejected because its
advantages are Vite-specific and this app is Next/webpack.

- `pnpm --filter @salesense/web test` — 20 unit tests over the riskiest client logic:
  the offline **sync-worker** (de-queue by clientMutationId, reconciliation toast,
  failed-stays-queued, offline guard), the **apiClient** contract (envelope unwrap,
  params serialization, typed ApiError, and the 401 → refresh → **rotated-token
  persistence** → retry lockstep from design-0010), **receipt-utils** (wa.me
  normalization, WhatsApp bill text incl. the /r/ link, GST breakup), and formatters.
- Receipt helpers were extracted from the page into `src/lib/receipt-utils.ts` to be
  testable — pages stay thin per the folder-structure rules.
- CI runs the web suite after the web typecheck.

Browser E2E: **Playwright** (`pnpm --filter @salesense/web test:e2e`) with a smoke
spec (login → dashboard → sales history; tampered public receipt link) that is
**gated on `E2E_BASE_URL`/`E2E_EMAIL`/`E2E_PASSWORD`** — it runs against a live
deployment or preview only and self-skips otherwise, so CI stays green until a
deployed target exists. The flaky real-DB Jest E2E specs in `apps/api/test` are
superseded by this path (unit-first stays the house rule).
