# Pilot Deployment Runbook

Concrete steps to take SaleSense from GitHub to a live pilot. Design + rationale:
`system-design/0013-deployment-design.md`. 👤 = an action only the owner can do
(creating accounts, pasting secrets).

## Artifacts (already in the repo)

- `apps/api/Dockerfile` — multi-stage, root build context, boots `node dist/src/main.js`.
- `.github/workflows/ci.yml` — the CI gate (typecheck + tests + builds), runs on every push.
- `.github/workflows/smoke.yml` — manual post-deploy Playwright smoke.
- `packages/db` scripts: `db:deploy` = `prisma migrate deploy` (the release command).

## 1. Database — Neon 👤

1. Neon console → your project → **Branches → New branch** named `production`.
   Recommended: start **empty** (dev data has E2E test debris) — decision in 0013.
2. Enable **PITR / history retention** on the branch.
3. Copy the **pooled** connection string → this is `DATABASE_URL` for the API.

## 2. API — Railway 👤

1. Railway → **New Project → Deploy from GitHub repo** → pick this repo.
2. Settings → **Build**: Dockerfile path `apps/api/Dockerfile` (context = repo root).
3. Settings → **Deploy → Pre-deploy Command**:
   `corepack pnpm --filter @salesense/db db:deploy`
   (applies migrations to prod before the new container takes traffic).
4. Settings → **Deploy → Wait for CI** (or "Check Suites") = **ON** — makes the
   existing CI the deploy gate; a red build never ships.
5. **Variables** (see matrix below). Generate JWT secrets fresh:
   `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` (×2).
6. Note the public URL, e.g. `https://salesense-api-production.up.railway.app`.

## 3. Web — Vercel 👤

1. Vercel → **Add New → Project** → import this repo.
2. **Root Directory** = `apps/web`. Framework auto-detects Next.js.
3. **Environment Variables**: `NEXT_PUBLIC_API_BASE_URL` = `<railway-url>/api/v1`,
   plus `NEXT_PUBLIC_SENTRY_DSN` (optional).
4. Deploy. Note the URL, e.g. `https://salesense.vercel.app`.

## 4. Wire the two together 👤

1. Back on Railway, set `CORS_ORIGIN` = the exact Vercel URL → redeploy the API.
2. (When a custom domain is added later, update both `CORS_ORIGIN` and
   `NEXT_PUBLIC_API_BASE_URL`.)

## 5. Environment matrix

| Var | Where | Value |
| --- | --- | --- |
| `DATABASE_URL` | Railway | Neon **prod** pooled URL |
| `JWT_SECRET`, `JWT_REFRESH_SECRET` | Railway | 48 random bytes each, fresh (never reuse dev) |
| `NODE_ENV` | Railway | `production` (activates fail-fast, hides Swagger) |
| `CORS_ORIGIN` | Railway | the Vercel URL |
| `GEMINI_API_KEY` | Railway | optional (chat 501s gracefully if absent) |
| `SENTRY_DSN` | Railway | optional (Sentry no-ops if absent) |
| `NEXT_PUBLIC_API_BASE_URL` | Vercel | `<railway-url>/api/v1` |
| `NEXT_PUBLIC_SENTRY_DSN` | Vercel | optional |

The API refuses to boot in production without `DATABASE_URL` + both JWT secrets
(Gate 1 fail-fast) — a misconfigured deploy fails loudly, not silently.

## 6. Seed a pilot login + smoke 👤

1. Register the pilot store's owner via the live web app (creates store + OWNER).
2. GitHub → repo **Settings → Secrets and variables → Actions**:
   `E2E_BASE_URL` = Vercel URL, `E2E_EMAIL` / `E2E_PASSWORD` = a **dedicated test**
   user (register one; do not use the real owner).
3. Actions → **Smoke (post-deploy)** → Run workflow. Green = live app serves
   login → dashboard → sales and rejects tampered receipt tokens.

## 7. 30-minute UAT (human, on the live URL)

Walk the eight critical scenarios in `testing/0001-test-strategy.md`:
barcode add · sale reduces stock once · idempotent retry no double-bill · offline
sale syncs · historical prices frozen · discount/BOGO profit (simulator) · GST tax
breakup on the receipt · refund restores stock. Watch Sentry + the Railway logs.

## Rollback

- **Bad deploy**: Railway → Deployments → **Redeploy** the previous green build (instant).
- **Bad migration**: migrations are additive so far; if one is destructive later, restore
  the Neon branch to a PITR point *before* running `db:deploy` again. Never hand-edit prod.

## Known pilot-scope limits (from the checklist)

Devices/payments/audit-viewer endpoints, promotions CRUD, forecasting, and the WhatsApp
Cloud API are deferred (documented). Image is not size-optimized (ships full
`node_modules`) — fine for a pilot; `pnpm deploy --prod` pruning is a later optimization.
