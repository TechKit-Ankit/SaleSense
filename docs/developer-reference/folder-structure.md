# Folder Structure

## Goal

SaleSense should be organized so new features can be added without scattering code across unrelated folders. The structure should support a Next.js PWA, a NestJS API, shared database access, shared stable types, tests, and documentation.

## Recommended Root Structure

```text
SaleSense/
  apps/
    web/
    api/
  packages/
    db/
    shared/
    config/
  docs/
  scripts/
  docker/
  .env.example
  package.json
  pnpm-workspace.yaml
  turbo.json
```

## Root Folders

| Folder | Purpose |
| --- | --- |
| `apps/web` | Next.js PWA frontend for desktop and mobile |
| `apps/api` | NestJS backend API and business logic |
| `packages/db` | Prisma schema, migrations, seed scripts, database client |
| `packages/shared` | Stable shared enums, constants, and safe shared types |
| `packages/config` | Shared TypeScript, ESLint, Prettier, and test config |
| `docs` | Product, architecture, database, API, testing, and user docs |
| `scripts` | Local setup, maintenance, and release scripts |
| `docker` | Local infrastructure such as PostgreSQL and Redis later |

## Frontend Structure

```text
apps/web/
  src/
    app/
      (auth)/
      (dashboard)/
      pos/
      inventory/
      products/
      analytics/
      settings/
    features/
      auth/
      pos/
      products/
      inventory/
      purchases/
      invoices/
      offline-sync/
      analytics/
      promotions/
    components/
      ui/
      layout/
      data-display/
      forms/
    lib/
      api-client/
      auth/
      offline/
      utils/
    hooks/
    styles/
    tests/
```

## Frontend Rules

1. Put business-facing UI in `features/<feature-name>`.
2. Put reusable shadcn components in `components/ui`.
3. Put app shell pieces in `components/layout`.
4. Keep IndexedDB and sync helpers under `lib/offline` or `features/offline-sync`.
5. Do not put every component in one global `components` folder.
6. Use feature folders for POS, inventory, products, invoices, analytics, promotions, and sync.
7. Keep page routes thin. Route files should compose feature components, not contain large business logic.

## Backend Structure

```text
apps/api/
  src/
    main.ts
    app.module.ts
    modules/
      auth/
      users/
      stores/
      products/
      inventory/
      purchases/
      sales/
      invoices/
      customers/
      analytics/
      promotions/
      sync/
      ai-advisor/
    common/
      decorators/
      errors/
      filters/
      guards/
      interceptors/
      pipes/
    config/
    database/
    tests/
```

## Backend Module Pattern

Simple modules can use:

```text
products/
  products.module.ts
  products.controller.ts
  products.service.ts
  dto/
  tests/
```

Complex modules can split by responsibility:

```text
sales/
  sales.module.ts
  controllers/
  services/
  dto/
  policies/
  tests/
```

## Backend Rules

1. Organize by domain module, not by global `controllers/` and `services/` folders.
2. Keep controllers thin. Business rules belong in services or domain helpers.
3. Use DTOs for request validation.
4. Put reusable auth, validation, and error handling in `common`.
5. Keep inventory stock changes inside transactions.
6. Do not let invoice, stock movement, and sale creation drift into separate uncoordinated code paths.

## Database Package

```text
packages/db/
  prisma/
    schema.prisma
    migrations/
    seed.ts
  src/
    client.ts
```

## Shared Package

```text
packages/shared/
  src/
    constants/
    enums/
    types/
    validators/
```

Only share stable cross-app concepts:

- role names
- sale status
- invoice status
- payment methods
- sync status
- common IDs and typed helpers
- validation schemas when they are safe to share

Do not share backend internals with the frontend.

## What To Avoid

Avoid:

- microservices in MVP
- a single flat backend folder like `controllers/`, `services/`, `models/`
- putting the whole backend inside Next.js routes
- dumping all frontend code in `components/`
- sharing every backend DTO with the frontend by default

## First Implementation Order

1. Create monorepo workspace.
2. Create `apps/web`.
3. Create `apps/api`.
4. Create `packages/db`.
5. Create `packages/shared`.
6. Add lint, formatting, testing, and docs commands.
7. Add database schema after database model is approved.

