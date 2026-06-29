# Packages, Dependencies, and Tooling Reference

This document tracks every third-party package used in the SaleSense monorepo, its specific purpose, whether it is a runtime dependency or development dependency, and the commands used to install and execute related scripts.

---

## 1. Backend (`apps/api`) - NestJS Server

| Package Name | Type | Purpose | Why We Chose It | Installation Command |
|--------------|------|---------|-----------------|----------------------|
| `@nestjs/common`, `@nestjs/core`, etc. | Dependency | Core API framework | Standard robust backend framework (ADR-0001). | `pnpm add @nestjs/common ...` |
| `nestjs-pino`, `pino-http` | Dependency | Structured JSON logging | High-performance logging that includes `requestId` automatically (ADR-0003). | `pnpm --filter @salesense/api add nestjs-pino pino-http pino` |
| `pino-pretty` | DevDependency | Console log formatter | Makes JSON logs readable in the local terminal during development. | `pnpm --filter @salesense/api add -D pino-pretty` |
| `@nestjs/passport`, `passport`, `passport-jwt` | Dependency | Authentication | Industry-standard auth strategies integrated smoothly into NestJS. | `pnpm --filter @salesense/api add @nestjs/passport passport passport-jwt` |
| `@nestjs/jwt` | Dependency | JWT token generation | Native NestJS wrapper for signing access and refresh tokens. | `pnpm --filter @salesense/api add @nestjs/jwt` |
| `bcrypt` | Dependency | Password hashing | Industry standard, native compilation ensures speed and security. | `pnpm --filter @salesense/api add bcrypt` |
| `@types/bcrypt`, `@types/passport-jwt` | DevDependency | TypeScript types | Type safety for external libraries. | `pnpm --filter @salesense/api add -D @types/bcrypt @types/passport-jwt` |
| `uuid` | Dependency | Unique identifiers | Used to generate `x-request-id` for distributed tracing and error tracking. | `pnpm --filter @salesense/api add uuid` |
| `@types/uuid` | DevDependency | TypeScript types | Type safety for the UUID library. | `pnpm --filter @salesense/api add -D @types/uuid` |

**Execution Commands:**
- Start in dev mode: `pnpm --filter @salesense/api dev`
- Build for production: `pnpm --filter @salesense/api build`

---

## 2. Frontend (`apps/web`) - Next.js Application

| Package Name | Type | Purpose | Why We Chose It | Installation Command |
|--------------|------|---------|-----------------|----------------------|
| `next`, `react`, `react-dom` | Dependency | Core UI framework | React 19 + Next.js App Router for optimal rendering and routing. | Installed by default |
| `tailwindcss` | Dependency | Styling system | Tailwind v4 enables zero-config utility-first styling. | Installed by default |
| `lucide-react` | Dependency | Icon library | Clean, modern, consistent icons that integrate well with Tailwind. | `pnpm --filter @salesense/web add lucide-react` |
| `react-hook-form` | Dependency | Form state management | Highly performant form management with minimal re-renders. | `pnpm --filter @salesense/web add react-hook-form` |
| `zod`, `@hookform/resolvers` | Dependency | Form validation | Schema-based validation that shares types with TypeScript effortlessly. | `pnpm --filter @salesense/web add zod @hookform/resolvers` |
| `sonner` | Dependency | Toast notifications | Lightweight, accessible, and beautiful success/error alerts. | `pnpm --filter @salesense/web add sonner` |
| `class-variance-authority`, `clsx`, `tailwind-merge` | Dependency | Class utility merging | Essential tools to merge Tailwind classes cleanly without conflicts (used by shadcn/ui). | `pnpm --filter @salesense/web add class-variance-authority clsx tailwind-merge` |

**Execution Commands:**
- Start in dev mode: `pnpm --filter @salesense/web dev`
- Build for production: `pnpm --filter @salesense/web build`
- Add new shadcn UI component: `npx shadcn@latest add <component-name>`

---

## 3. Database Package (`packages/db`) - Prisma ORM

| Package Name | Type | Purpose | Why We Chose It | Installation Command |
|--------------|------|---------|-----------------|----------------------|
| `@prisma/client` | Dependency | Database client | Auto-generated, highly type-safe query builder pointing to Neon Postgres. | `pnpm --filter @salesense/db add @prisma/client` |
| `pg`, `@prisma/adapter-pg` | Dependency | Database Drivers | Required by Prisma v7 to connect and query PostgreSQL properly. | `pnpm --filter @salesense/db add pg @prisma/adapter-pg` |
| `@types/pg` | DevDependency | TypeScript types | Type safety for the pg driver. | `pnpm --filter @salesense/db add -D @types/pg` |
| `prisma` | DevDependency | Prisma CLI | Used for schema migrations, formatting, and DB synchronization. | `pnpm --filter @salesense/db add -D prisma` |
| `ts-node` | DevDependency | TypeScript execution | Allows us to run `seed.ts` directly without compiling it to JS first. | `pnpm --filter @salesense/db add -D ts-node` |
| `bcrypt`, `@types/bcrypt` | Dependency / Dev | Password hashing | Required in the seed script to securely hash the admin user's password. | `pnpm --filter @salesense/db add bcrypt` |

**Execution Commands:**
- Generate Prisma Client: `pnpm --filter @salesense/db prisma:generate` (Runs `prisma generate`)
- Push schema to DB: `pnpm --filter @salesense/db db:push` (Runs `prisma db push`)
- Seed DB: `pnpm --filter @salesense/db db:seed` (Runs `ts-node prisma/seed.ts`)

---

## 4. Root Workspace Tooling

| Package Name | Type | Purpose | Why We Chose It | Installation Command |
|--------------|------|---------|-----------------|----------------------|
| `turbo` | DevDependency | Monorepo build system | Turborepo caches builds and runs scripts across packages simultaneously. | `pnpm add -w -D turbo` |
| `eslint`, `prettier` | DevDependency | Linting and formatting | Maintains consistent code style across the entire monorepo. | Installed by default |
| `typescript` | DevDependency | Type checking | Core language feature ensuring type safety across boundaries. | Installed by default |

**Execution Commands:**
- Start all apps: `pnpm dev`
- Build all apps: `pnpm build`
- Install all dependencies cleanly: `pnpm install`

---

## Package Manager Philosophy

We utilize **pnpm** strictly via **Corepack**.
Why? Monorepos have large dependency trees. `pnpm` uses a global store and hard links to ensure fast installations and minimal disk usage.

- **Enable Corepack**: `corepack enable`
- **Global Install fallback**: `corepack install -g pnpm@9` 
