# AGENTS.md — SaleSense

Canonical guidance for **any** AI coding agent (Claude, Antigravity, Cursor, Codex,
Gemini, etc.) working in this repo. Read this first.

- Claude Code also reads `CLAUDE.md` if present.
- Antigravity/framework-specific gotchas (Prisma v7, NestJS test mocks, etc.) live in
  [`.agents/AGENTS.md`](.agents/AGENTS.md) — still authoritative for those details.
- Deep rationale for decisions lives in [`docs/adr/`](docs/adr).

## What this is

SaleSense is a retail intelligence platform for small/medium stores: POS billing,
inventory batches, purchases, invoices, offline sync, analytics, and an AI advisor.
Turborepo + pnpm monorepo — `apps/web` (Next.js PWA), `apps/api` (NestJS), `packages/db`
(Prisma), `packages/shared`, `packages/config`.

## Non-negotiable invariants

1. **Money is integer paise stored as `BigInt`.** Never floats for money.
2. **Every tenant-owned row is scoped by `storeId`.** Queries and related-record checks
   must enforce it; cross-store access returns not-found/forbidden.
3. **Stock changes only through `stock_movements`** inside a DB transaction — sale, stock
   movement, and invoice creation are one atomic unit, never separate code paths.
4. **Preserve historical snapshots** on `sale_items` / `purchase_items`; changing a
   product must not alter past invoices.
5. **Errors use the standard envelope** with stable codes (`common/errors/error-codes.ts`)
   thrown as `BusinessException`; never leak stack traces, secrets, or raw ORM errors.
6. **`requestId`** comes from `RequestIdInterceptor` (read via `@RequestId()`), returned
   in every response and persisted on high-risk records — never ad-hoc strings.
7. **Web `apiClient` returns unwrapped `data`.** `apiClient.get/post/patch/delete` strip
   the `{ success, data, requestId }` envelope and return `data` directly (type it via the
   optional generic, e.g. `apiClient.get<Foo>()`). **Never read `.data` again** on the
   result; pass query params via the `params` option, not by hand-building the URL.
   Double-unwrapping silently broke POS checkout, offline sync, and analytics.

## Sales flow rules (see ADR-0004 for full rationale)

- **Online sale** blocks overselling with `INSUFFICIENT_STOCK` (409) unless
  `store.allowNegativeStock` is true.
- **Offline sync** never blocks: it accepts the sale, sets `requiresReconciliation`, and
  returns a `STOCK_RECONCILIATION_REQUIRED` warning. `saleSource` is the discriminator.
- **Invoices** use the **Indian financial year** (April–March, `getIndianFinancialYear`),
  numbered per `(storeId, financialYear)` via an atomic sequence upsert.
- **Idempotency**: unique `(storeId, idempotencyKey)` + pre-check + `P2002` race fallback.
- Every sale writes a `SALE_CREATED` audit log with safe metadata only.

Full detail + implementation status: [`docs/adr/0004-sales-transaction-rules.md`](docs/adr/0004-sales-transaction-rules.md).

## Working agreement

- **Test every change.** Prefer unit tests with a **mocked `PrismaService`** over real-DB
  E2E (E2E here leaks connections). After editing a Nest service, update its `.spec.ts`
  mocks or the test module fails to compile.
  - Typecheck: `corepack pnpm --filter @salesense/api exec tsc --noEmit -p tsconfig.json`
  - Unit tests: `corepack pnpm --filter @salesense/api test`
- **Confirm blast radius before touching shared contracts.** The offline sync response
  shape is consumed by `apps/web/src/lib/offline/sync-worker.ts` — change both together.
- **No schema drift without a migration note.** Money = `BigInt`, keys = UUID,
  uniqueness is store-scoped.
- Keep controllers thin; business rules live in services. Organize by domain module.
- When you make or change an architectural decision, add/update an ADR and reflect the
  summary here.

## Key commands

```bash
corepack pnpm install
corepack pnpm dev            # web + api in parallel
corepack pnpm --filter @salesense/api test
corepack pnpm build
```

## Docs map

- `docs/adr/` — architecture decisions (start at 0001)
- `docs/system-design/`, `docs/database/`, `docs/api/` — design + contracts
- `docs/developer-reference/` — setup, folder structure, error/logging conventions
- `docs/testing/` — test strategy
