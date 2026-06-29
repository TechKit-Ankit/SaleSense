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

**Current Phase: Phase 1 Completed ✅**

### What is Done (Phase 0 & 1):
- **Phase 0 - Project Foundation**: Monorepo setup (Turborepo), Prisma database schema initialization, global configurations (ESLint, Prettier, TypeScript).
- **Phase 0 - Authentication & Authorization**: Core JWT-based Auth API, Login/Registration Next.js Frontend.
- **Phase 1 - Core Store Management**: `Store` CRUD operations, Store Context UI switcher.
- **Phase 1 - Store User Roles & Deletion Workflow**: Complete 30-day "cooldown" deletion process (Soft delete -> Hard delete).
- **Phase 1 - Team Invitations**: Complete Team Invitation workflow (Inviting, accepting, rejecting). Next.js Settings & Team UI.

### What Remains (Next Phases):
- **Phase 2 - Product Catalog & Inventory**:
  - `Product` and `Category` CRUD.
  - Inventory tracking (Stock levels, low-stock alerts, variants).
  - Next.js UI for Products listing, creating, and editing.
- **Phase 3 - Sales & Transactions (POS)**:
  - `Sale` and `SaleItem` transaction logging.
  - Receipt generation, tax calculations, and discount mechanics.
  - Core Point-of-Sale (POS) interface on the frontend.
  - **Companion Scanner Mode**: 1-Click QR pairing to use mobile phone as a wireless barcode scanner via WebSockets relay.
- **Phase 4 - Analytics & AI Insights**:
  - Aggregation logic for top-selling items and revenue charts.
  - Antigravity AI integration for forecasting and anomaly detection.
