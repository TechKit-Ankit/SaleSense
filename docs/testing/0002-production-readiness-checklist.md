# Production Readiness Checklist

## Status

Approved (2026-07-12) — Gate 1 scope confirmed by the owner as the amended set
(items 1–7 below). Implementation of items 1–6 proceeds directly; item 7 (receipt)
requires design doc 0009 approval first.

## Source

Full end-to-end audit of 2026-07-12: static review of every layer plus a live E2E run
against the real Neon database (register → store → product → purchase → receive →
sales → oversell guard → offline sync → reconciliation → advisor). Verified working
live: money math (profit exact to the paisa), Indian-FY invoice numbering, idempotent
replay, `INSUFFICIENT_STOCK` 409, offline oversell → `requiresReconciliation` +
warning, reconciliation resolve loop, advisor rules, RBAC scoping, validation envelope.
86 unit tests green; both apps typecheck; production build clean.

**Verdict at audit time: not production-ready — blockers are configuration-shaped, not
architectural. The business core passed live E2E flawlessly.**

## Gate 1 — Fix NOW (before any further feature work ships)

| # | Item | Severity | Effort | Detail |
| --- | --- | --- | --- | --- |
| 1 | **Enable CORS on the HTTP API** | Blocker | ~1 line | Verified live: preflight from the web origin → 404, no `Access-Control-Allow-Origin`. Browser frontends cannot call the API at all. `app.enableCors({ origin: env allowlist })`. |
| 2 | **`@Public()` on `/health`** | Blocker | 1 line | Health endpoint currently returns 401 — load-balancer/uptime checks would mark the service dead. |
| 3 | **JWT secrets fail-fast** | Blocker | ~5 lines | `\|\| 'secret'` / `\|\| 'refresh-secret'` fallbacks issue forgeable tokens on a misconfigured deploy. Boot must throw if `JWT_SECRET`/`JWT_REFRESH_SECRET`/`DATABASE_URL` are missing in production. |
| 4 | **Baseline Prisma migrations** | Blocker | 1 command + scripts | No `migrations/` folder — schema exists only via `db push`. Create the init migration; prod deploys use `prisma migrate deploy`. |
| 5 | **Rate limiting** (login + AI chat) | High | small | `@nestjs/throttler` (new dependency — justified): brute-force protection on `/auth/login`, cost protection on `/analytics/chat`. |
| 6 | **Gate Swagger `/docs`** | High | ~3 lines | Serve only when `NODE_ENV !== 'production'` (or behind auth). |
| 7 | **Printable receipt** (invoice endpoints + print view) | High (feature) | largest item | The POS currently `alert()`s the invoice number. Needs `GET /invoices/:id` + receipt data endpoint and a printable web view. **Requires its own design doc (0009) before code** — the sale → invoice data already exists and is correct. |

Gate 1 exit: all seven done, full test battery green, receipt flow demonstrated
end-to-end (sale → printed/printable bill).

### Gate 1 progress (2026-07-12)

| # | Item | Status | Verified how |
| --- | --- | --- | --- |
| 1 | CORS | ✅ Done | Live preflight: 204 + `Access-Control-Allow-Origin` for the web origin |
| 2 | `/health` public | ✅ Done | Live: 200 unauthenticated, single envelope (double-wrap also fixed) |
| 3 | JWT fail-fast | ✅ Done | Live: `NODE_ENV=production` without secrets refuses to boot, names missing vars |
| 4 | Migrations baseline | ✅ Done | `0_init` (28 tables) generated + `migrate resolve --applied`; `migrate status`: up to date. New scripts: `db:migrate`, `db:deploy`, `db:migrate-status` |
| 5 | Rate limiting | ✅ Done | Live: login 429 on 6th attempt/min; chat capped 10/min; global 100/min (`@nestjs/throttler`) |
| 6 | Swagger gating | ✅ Done | Served in dev; skipped when `NODE_ENV=production` |
| 7 | Printable receipt + WhatsApp share | ✅ Done | Live E2E: sale → `GET /invoices/:id` full payload, no profit/cost leakage, foreign id → 404; `/receipt/[invoiceId]` print view + `wa.me` share; POS toast with Print action. Owner amendment honored: server PDF + public tokenized link stay on Gate 2 (below). |

**Gate 1 exit achieved (2026-07-12).** All seven items done and live-verified;
API suite 90/90; web typecheck + production build clean. Pilot deployment may proceed
per the Deployment shape section; Gate 2 items remain before public production.

## Gate 2 — Before production go-live (pilot can start once Gate 1 ships)

| # | Item | Severity | Notes |
| --- | --- | --- | --- |
| 1 | Refresh-token rotation/revocation; reconsider localStorage | High | Stolen refresh token currently valid 7 days; logout is client-side only. |
| 2 | Scanner WebSocket hardening | Medium | 6-digit `Math.random()` PIN with unlimited join attempts is brute-forceable; impact is low (barcode inject/snoop). Crypto-random longer code + join throttle + restrict WS `origin: '*'`. Deferral decision (owner): acceptable for pilot. |
| 3 | Refunds module | High (feature) | Schema + approval flow designed since day one (`db 0002`, `api 0001`); not built. Needed before real customer disputes. |
| 4 | CI pipeline (GitHub Actions) | ✅ Done (Wave A) | `.github/workflows/ci.yml`: install → prisma generate → build packages → typecheck both apps → 90 API tests → both builds → schema validate. First push proves it live. `migrate deploy` moves to the release workflow at deploy time. |
| 5 | Sentry both apps | ✅ Done (Wave A) | `@sentry/nestjs` via `instrument.ts` + capture in `GlobalExceptionFilter` (5xx only, tagged requestId/route); `@sentry/nextjs` via instrumentation files. Optional at runtime (no DSN = no-op). Pino-vs-Sentry division recorded in `developer-reference/error-handling-and-logging.md`. Source-map upload deferred to deploy (with `@sentry/cli` build flip). |
| 6 | Customers / devices / payments / audit endpoints | Medium (features) | Designed in `api 0001`, unimplemented. |
| 6b | Server-side PDF (`GET /invoices/:id/pdf`) + public tokenized receipt link | Medium (feature) | **Owner-mandated, not removed** (design-0009 amendment): paper-free bills cut printing costs. WhatsApp text share ships in Gate 1; PDF + customer-openable link land here. |
| 7 | Docs errata for route drift | Low | Implemented `/purchases` vs documented `/purchase-orders`; `/sales/sync` vs `/sync/sales`. |
| 8 | `requestId` on guard-phase errors | ✅ Done (Wave A) | Replaced the interceptor with `requestIdMiddleware` (middleware → guards → interceptors ordering). Live-verified: 401 now returns `requestId` in body + `x-request-id` header; client-supplied ids round-trip. |
| 9 | Web test runner + E2E test stabilization | Medium | Web has zero tests; Jest E2E specs flaky per AGENTS notes. **Runner decision (2026-07-12): Jest via `next/jest` + @testing-library/react — NOT Vitest.** One runner monorepo-wide (matches the 90 API tests, AGENTS.md mocking rules, testing-strategy.md); Vitest's advantages are Vite-specific and this web app is Next/webpack. Resolves ADR-0001's "Vitest/Jest" ambiguity toward Jest. |
| 10 | Hygiene | ✅ Mostly done (Wave A) | Scanner gateway → Nest Logger (web keeps browser console — it *is* the client logger); duplicate testing doc merged into `0001-test-strategy.md`; BigInt policy documented in `api/0002` Money Contract; **bonus security fix: Pino now redacts `authorization`/`cookie` headers** (they were being logged). Remaining: owner decision on the uncommitted `next.config.ts`. |

## Deployment shape (Phase B reference)

- **DB**: Neon production branch, PITR/backups on; `prisma migrate deploy` only.
- **API**: Railway/Render/Fly, Dockerfile entry `node dist/src/main.js` (monorepo build
  outputs to `dist/src/`). Env: `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`
  (32+ random bytes each), `GEMINI_API_KEY`, `CORS_ORIGIN`, `NODE_ENV=production`.
- **Web**: Vercel, `NEXT_PUBLIC_API_BASE_URL` → public API URL.
- **Pilot**: one friendly store; UAT = the eight critical scenarios in
  `testing/0001-test-strategy.md`; watch reconciliation + error rates for a week.

## Decision record

- Owner decision (2026-07-12): Gate 1 scope = rate limiting, Swagger gating, printable
  receipt **plus** the four blockers (accepted after review — blockers total <1 hour and
  the receipt feature cannot be browser-tested without CORS).
- Owner decision: scanner hardening deferred to Gate 2 — random PIN + low impact
  acceptable for pilot.
- E2E audit test data (`E2E Audit Store`, `e2e-audit-*@test.salesense.local`) remains in
  the dev database; harmless, labeled, ledger-append-only by design.
