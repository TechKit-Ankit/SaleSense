# SaleSense

AI-Powered Retail Intelligence Platform.

## Quick Start

### 1. Environment Setup
Copy the example environment files:
```bash
cp .env.example .env
```
Update `.env` with your Neon PostgreSQL URL and JWT secrets.

### 2. Install Dependencies
```bash
corepack enable
pnpm install
```

### 3. Database Setup
```bash
# Generate Prisma client
pnpm --filter @salesense/db prisma:generate

# Push schema to database
pnpm --filter @salesense/db db:push

# Seed database
pnpm --filter @salesense/db db:seed
```

### 4. Run Development Server
```bash
pnpm dev
```

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:4000/api/v1
- **API Docs (Swagger)**: http://localhost:4000/docs

## Project Status

**Current Phase: Phase 3 Completed ✅**

### What is Done (Phase 0, 1 & 2):
- **Phase 0 - Project Foundation**: Monorepo setup, Prisma initialization, global configs.
- **Phase 0 - Authentication & Authorization**: Core JWT-based Auth API, Next.js Frontend.
- **Phase 1 - Core Store Management**: `Store` CRUD operations, Store Context UI switcher.
- **Phase 1 - Store User Roles & Deletion Workflow**: Complete 30-day "cooldown" deletion process.
- **Phase 1 - Team Invitations**: Complete Team Invitation workflow.
- **Phase 2 - Product Catalog**: `Product`, `Category`, `Brand` CRUD with nested barcode management.
- **Phase 2 - Inventory Control**: Immutable `StockMovement` ledger, `InventoryBatch` management, transactional manual stock adjustments.
- **Phase 2 - Purchases & Suppliers**: `PurchaseOrder` and `Supplier` management, auto-injecting received purchases directly into inventory via transactions.

- **Phase 3 - Sales & Transactions (POS)**:
  - `Sale` and `SaleItem` transaction logging.
  - POS interface on the frontend.
  - **Companion Scanner Mode**: 1-Click QR pairing to use mobile phone as a wireless barcode scanner via WebSockets relay.
  - **Offline Sync**: Local IndexedDB queue for resilient POS operations without internet.

- **Phase 4 (partial) - Analytics & AI Insights**:
  - Analytics aggregation: summary KPIs, revenue/profit trends, top products, dead stock, inventory health.
  - AI Advisor chat (Google Gemini) with store-scoped context injection and graceful degradation when `GEMINI_API_KEY` is absent.
  - Sales-flow hardening: online stock guard, offline reconciliation flags, Indian-FY invoicing, sale audit logs (`docs/adr/0004`).

- **P4.1 - Reconciliation loop**: `/inventory/reconciliation` list + ADJUST/DISMISS resolve endpoints, expiry/reconciliation counters in inventory health, reconciliation UI (`docs/system-design/0005`).

- **P4.2 - Promotion simulators**: discount and BOGO profitability calculators with break-even uplift and scenario tables, Promotions page (`docs/system-design/0006`).

- **P4.3 - Rule-based advisor**: 6 deterministic rules (stock-outs on bestsellers, below-cost pricing, expired/expiring stock, dead stock, reconciliation) surfaced as a dashboard Advisor card with action links (`docs/system-design/0007`).

### What Remains (per `docs/adr/0005-phase4-sequencing.md`):
- **P4.4 — Deeper AI**: feed simulator and recommendation data into the LLM advisor; forecasting.

> **Note for AI agents:** the status above is a summary, not the spec. Follow the
> mandatory pre-flight in [`AGENTS.md`](AGENTS.md) before building anything.
