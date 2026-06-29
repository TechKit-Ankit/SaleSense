# ADR 0001: Initial Tech Stack

## Status

Proposed

## Date

2026-06-18

## Context

SaleSense needs to work as a desktop counter app, mobile owner app, and installable PWA. It must support barcode billing, offline sale capture, sync, idempotent invoice creation, inventory batches, GST invoices, analytics, and later AI recommendations.

The system should be documented, testable, and able to grow without rewriting core business logic.

## Decision

Use a TypeScript-first monorepo with:

| Layer | Choice | Version Policy |
| --- | --- | --- |
| Runtime | Node.js 24 LTS | Use Active LTS for production |
| Frontend | Next.js + React + TypeScript | Use latest stable Next and React compatible with LTS Node |
| Backend | NestJS + TypeScript | Use latest stable Nest major |
| Database | PostgreSQL | Use managed Postgres or local Docker for development |
| ORM | Prisma | Use latest stable Prisma and `@prisma/client` together |
| Browser offline store | IndexedDB | Use for pending sales and sync queue |
| API docs | OpenAPI/Swagger | Generated from NestJS |
| System docs | Markdown + Mermaid | Upgrade to Docusaurus/MkDocs when docs grow |
| Testing | Vitest/Jest, Supertest, Playwright | Unit, API, and end-to-end coverage |

Verified package baselines on 2026-06-18:

| Package | Latest observed stable |
| --- | --- |
| `next` | `16.2.9` |
| `react` | `19.2.7` |
| `@nestjs/core` | `11.1.27` |
| `prisma` | `7.8.0` |
| `@prisma/client` | `7.8.0` |
| `typescript` | `6.0.3` |

Node.js version policy:

- Use Node.js 24 LTS for production and development.
- Do not use Node.js 26 for production yet, because it is Current rather than LTS.

## Why Next.js Instead Of Plain React

Next.js gives us routing, layouts, SSR/server components where useful, build conventions, PWA support, and a stronger product-app structure. Plain React with Vite is simpler and still valid, but SaleSense is expected to become a full SaaS platform, not just a single dashboard.

Use Next.js for:

- desktop/mobile PWA shell
- protected app routes
- dashboard layouts
- future SaaS pages
- frontend performance and routing conventions

Counterpoint:

- If the app becomes a purely offline-first POS client with no SEO/public pages and no server-rendered screens, Vite + React may be simpler. Revisit this before implementation if we want the leanest possible frontend.

## Why NestJS Instead Of Express

Express is excellent for small APIs, but SaleSense has many domain areas: products, inventory, purchases, sales, invoices, refunds, sync, analytics, auth, roles, and AI. NestJS gives structure through modules, controllers, services, guards, pipes, validation, testing patterns, and generated OpenAPI docs.

Use NestJS for:

- domain API
- validation and role guards
- stable OpenAPI contracts
- testable business services
- future queues, jobs, events, and integrations

Counterpoint:

- Express would be faster to start but easier to make messy. It is not rejected because it is weak; it is rejected because this system has enough domain complexity to benefit from stronger structure.

## Why Not Use Only Next.js Backend

Next.js route handlers are useful, but SaleSense backend logic should be independent from the frontend. The backend must handle inventory accounting, idempotent billing, sync conflicts, invoice numbering, audit logs, and future integrations.

Use Next.js backend only for:

- frontend-specific backend-for-frontend helpers
- auth callbacks if the chosen auth tool requires it
- health or lightweight web-only endpoints

Use NestJS for:

- core business APIs
- mobile/external API compatibility
- long-term domain boundaries

## Initial Repository Shape

```text
apps/
  web/
  api/
packages/
  db/
  shared/
docs/
```

## Consequences

Benefits:

- Strong TypeScript across frontend and backend
- Clean separation between UI and business logic
- Better API documentation and testing story
- Easier future mobile app or integrations

Costs:

- More setup than a single Next.js app
- Two apps to run locally
- Shared types and environment config need discipline

## Revisit When

- MVP scope becomes much smaller than expected
- Deployment cost or complexity becomes a blocker
- Backend remains only CRUD after Phase 2
- Team skillset strongly favors a simpler stack

