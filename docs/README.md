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
| `adr/0005-phase4-sequencing.md` | Phase 4 order re-affirmed (simulators before deeper LLM), LLM chat retained, analytics corrections (timezone, date keys, locked value, chat validation) |

## Current Design Drafts

| Doc | Purpose |
| --- | --- |
| `system-design/0001-system-design-v1.md` | High-level product architecture and flows |
| `system-design/0004-analytics-ai-design.md` | Phase 4 analytics aggregation, AI advisor flows, data correctness rules |
| `system-design/0005-inventory-reconciliation-design.md` | P4.1 reconciliation loop: list/resolve endpoints, inventory-health counters, UI — implemented |
| `system-design/0006-promotion-simulators-design.md` | P4.2 discount & BOGO profitability simulators: math, contracts, scenarios — implemented |
| `system-design/0007-rule-based-advisor-design.md` | P4.3 rule-based advisor: 6 deterministic rules, severities, dashboard card — implemented |
| `system-design/0008-ai-advisor-deepening-design.md` | P4.4 grounded AI chat: advisor findings in LLM context, multi-turn history, forecast deferral — implemented (Phase 4 complete) |
| `system-design/0009-invoice-receipt-design.md` | Gate 1 item 7: invoice read endpoint, thermal print view, WhatsApp share, POS toast — implemented |
| `system-design/0010-security-hardening-design.md` | Wave B: refresh-token rotation/family theft detection, real logout, scanner room hardening — implemented |
| `system-design/0011-refunds-design.md` | Wave C.1: refunds approval workflow with transactional restock + sales history endpoints/pages — implemented |
| `system-design/0012-customers-design.md` | Wave C.3: customer capture at POS, wa.me direct-chat bill (free tier), Cloud API deferral — implemented |
| `system-design/0013-deployment-design.md` | Pilot deployment: Dockerfile, Railway+Vercel+Neon topology, platform-native CD gated on CI, owner runbook — **draft for review** |
| `database/0001-observability-data-requirements.md` | Database requirements for audit, sync, and request traceability |
| `database/0002-database-model-v1.md` | Draft relational database model for review |
| `database/0003-prisma-schema-draft.md` | Prisma schema validation notes and migration caveats |
| `api/0001-api-design-v1.md` | First API resource design and endpoint map |
| `api/0002-api-contracts.md` | API-wide contracts for errors, idempotency, request IDs, and data rules |
| `developer-reference/development-setup.md` | Local workspace setup, commands, and scaffold URLs |
| `developer-reference/deployment-runbook.md` | Step-by-step pilot go-live: Neon prod branch, Railway, Vercel, secrets, smoke, UAT, rollback |
| `testing/0002-production-readiness-checklist.md` | Full-audit findings, Gate 1 (complete) / Gate 2 (before go-live), deployment shape |

## Decision Rule

Every major technology choice must answer:

1. What problem does it solve?
2. What complexity does it add?
3. What simpler option did we reject?
4. When should we revisit the decision?
