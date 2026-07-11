# SaleSense Documentation

SaleSense is a retail intelligence platform for small and medium stores. The product combines POS billing, inventory, invoices, offline sync, analytics, promotion simulation, and AI-assisted business recommendations.

## Working Order

We will build the project in this order:

1. System design
2. Database model
3. API design
4. Development setup
5. Feature implementation
6. Testing and release checks

## Documentation Areas

| Area | Purpose |
| --- | --- |
| `prd/` | Product requirements and feature notes |
| `system-design/` | Architecture, flows, module boundaries, deployment shape |
| `database/` | ERD, table design, migration notes, data rules |
| `api/` | Endpoint design, OpenAPI notes, request/response contracts |
| `testing/` | Test strategy, acceptance criteria, release checklist |
| `user-manual/` | End-user help for shop owners, cashiers, managers |
| `developer-reference/` | Setup, architecture notes, coding conventions |
| `adr/` | Architecture Decision Records explaining important choices |

## Current Architecture Decisions

| ADR | Decision |
| --- | --- |
| `adr/0001-tech-stack.md` | Next.js PWA, NestJS API, PostgreSQL, Prisma, TypeScript monorepo |
| `adr/0002-ui-stack.md` | shadcn/ui, Tailwind CSS, Radix primitives through shadcn, lucide-react |
| `adr/0003-observability-error-handling.md` | Graceful errors, structured logs, Sentry, request correlation, OpenTelemetry upgrade path |
| `adr/0004-sales-transaction-rules.md` | Sales flow: online stock guard vs offline reconciliation, Indian-FY invoicing, idempotency, sale audit logs |

## Current Design Drafts

| Doc | Purpose |
| --- | --- |
| `system-design/0001-system-design-v1.md` | High-level product architecture and flows |
| `database/0001-observability-data-requirements.md` | Database requirements for audit, sync, and request traceability |
| `database/0002-database-model-v1.md` | Draft relational database model for review |
| `database/0003-prisma-schema-draft.md` | Prisma schema validation notes and migration caveats |
| `api/0001-api-design-v1.md` | First API resource design and endpoint map |
| `api/0002-api-contracts.md` | API-wide contracts for errors, idempotency, request IDs, and data rules |
| `developer-reference/development-setup.md` | Local workspace setup, commands, and scaffold URLs |

## Decision Rule

Every major technology choice must answer:

1. What problem does it solve?
2. What complexity does it add?
3. What simpler option did we reject?
4. When should we revisit the decision?
