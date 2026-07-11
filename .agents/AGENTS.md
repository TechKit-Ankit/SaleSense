> **Canonical cross-tool guidance is in [`/AGENTS.md`](../AGENTS.md)** (project invariants,
> sales-flow rules, working agreement). This file holds the framework-specific gotchas
> below. Architectural decisions and their rationale live in [`/docs/adr/`](../docs/adr).

# Prisma v7 Learnings & Best Practices

1. **Prisma v7 Connection Setup**: Do NOT use the `url` property inside the `datasource db` block in `schema.prisma`. Prisma v7 removes support for this.
2. **PrismaConfig**: Connection URLs must be placed in `prisma.config.ts` located in the root workspace.
3. **Driver Adapters**: When initializing `PrismaClient` in code (e.g., inside NestJS services or seed scripts), you CANNOT call `new PrismaClient()` with no arguments. You MUST pass an explicit `adapter`, such as `@prisma/adapter-pg` along with the `pg` Pool.
   *Example:*
   ```typescript
   import { Pool } from 'pg';
   import { PrismaPg } from '@prisma/adapter-pg';
   const pool = new Pool({ connectionString: process.env.DATABASE_URL });
   const adapter = new PrismaPg(pool);
   const prisma = new PrismaClient({ adapter });
   ```
4. **Seed IDs**: Always use valid UUID strings (e.g. `00000000-0000-0000-0000-000000000001`) instead of arbitrary strings for `id` fields mapped to UUIDs in the database schema.
5. **Environment Context in Monorepos**: When running `prisma db push` or `db:seed` using a monorepo workspace from a nested package (like `@salesense/db`), `dotenv-cli` must be used from the root workspace so the `.env` variables are correctly injected into `prisma.config.ts` and the seed script. Example: `npx dotenv-cli -e .env -- pnpm --filter @salesense/db db:push`.

# NestJS & Prisma Monorepo Rules

1. **Prisma Enum Exports**: When exporting Prisma enums from a shared database package (like `@salesense/db`) for use in NestJS DTOs (e.g., inside `@IsEnum()`), you MUST export them as values, not just types.
   - **Incorrect**: `export type { StoreStatus } from '@prisma/client';`
   - **Correct**: `export { StoreStatus } from '@prisma/client';`
2. **NestJS DTO Definite Assignment**: When creating class-validator DTOs with TypeScript strict mode enabled, you MUST use the definite assignment assertion operator (`!`) for required properties to avoid TS2564 errors.
   - **Incorrect**: `userId: string;`
   - **Correct**: `userId!: string;`
3. **Custom Decorator Data Access**: When defining custom parameter decorators (like `@CurrentUser(data?: string)`), ensure the implementation actually accesses and returns the specified property using the `data` parameter instead of blindly returning the entire object.
4. **Backend Testing Strategy**: Prefer writing robust Unit Tests with a mocked Prisma service over real-database End-to-End (E2E) tests. Real-DB E2E tests in this environment are prone to connection leaks and improper teardown (`A worker process has failed to exit gracefully`).

# SaleSense Architecture & API Rules

1. **API Response Wrappers**: All NestJS controllers utilize a global interceptor. When interacting with or testing the API, always expect responses to be wrapped in a standard object: `{ success: boolean, data: any }`. Actual entity data will be inside the `data` property.
2. **Store Guard Header (`x-store-id`)**: Any API routes handling store-specific operations (e.g., `/api/v1/stores/:storeId/*`) strictly require an `x-store-id` header matching the targeted store ID to pass the `StoreGuard` RBAC checks.
3. **NestJS Monorepo Build Output**: Due to the monorepo `tsconfig.json` setup, `nest build` compiles the API application into `dist/src/main.js` (not `dist/main.js`). Always configure `start` scripts and Dockerfiles accordingly.

# Documentation Standards

1. **Mermaid Flow Diagrams**: Whenever updating or creating architectural documentation (System Design, Database ERDs, or API Request Flows), you MUST include a `mermaid` block diagram (state diagram, sequence diagram, or ERD) alongside the text explanation. This is a strict user preference for visual clarity.

# SaleSense Analytics & AI Best Practices

1. **Gemini AI Model Selection**: When instantiating @google/generative-ai, always use generic aliases like gemini-flash-latest rather than hardcoding specific versions like gemini-1.5-flash. Some API keys (especially newer ones) do not have legacy access mapped and will return a 404 Model not found error on the 1beta endpoint for hardcoded versions.
2. **Graceful Degradation for Third-Party APIs**: Always build a status-check mechanism for external API keys (e.g., isAiConfigured()). Expose this via a status endpoint (GET /ai-status) so the frontend can intercept the lack of configuration and render a dedicated visually appealing "Configuration Required" state, rather than attempting to return mock text strings or unhandled 500 errors.
3. **TypeScript Strict Null Checks**: When running pnpm check, dynamic object access (e.g., dailyData[date].revenue) will fail with TS2532: Object is possibly 'undefined'. Always use the definite assignment assertion operator (dailyData[date]!.revenue) when you are algorithmically certain the key exists.
4. **Recharts Tooltip Formatter Typings**: When building custom tooltips in echarts for Next.js, do not type the formatter's alue parameter as 
umber because the internal library typings (ValueType) allow undefined or string values. Use ny and explicitly coerce it to a Number inside the formatter function to avoid TS2322 type mismatches.

5. **NestJS Test Module Mocks**: When creating or modifying NestJS controllers/services (e.g., via `nest g`), you MUST immediately update the generated `.spec.ts` files to provide mock implementations for all constructor dependencies (especially `PrismaService` imported from `@salesense/db`). The NestJS `RootTestModule` will fail to compile during `pnpm test` with dependency resolution errors if external services are not explicitly provided (e.g., `{ provide: PrismaService, useValue: {} }`).
