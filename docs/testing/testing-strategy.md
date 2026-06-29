# Testing Strategy

This document outlines the testing strategy for the SaleSense monorepo.

## Automated Testing Tooling

We use **Jest** as our primary test runner across the backend applications. Jest provides a comprehensive assertion library, mocking capabilities, and integrates seamlessly with NestJS (`@nestjs/testing`).

### Core Commands
- **Run all tests:** `pnpm test` (Runs tests across all packages)
- **Watch mode:** `pnpm --filter @salesense/api test:watch` (Runs tests interactively)
- **Coverage report:** `pnpm --filter @salesense/api test:cov` (Generates coverage metrics)

## Backend (`apps/api`)

The backend follows the NestJS testing guidelines.
1. **Unit Tests**: Business logic within Services (e.g., `AuthService`) should be isolated and tested by mocking out the `PrismaService` and external providers (like `JwtService`). Files are suffixed with `.spec.ts` and reside next to the service they test.
2. **Integration / E2E Tests**: We use **Supertest** to simulate live HTTP traffic against the API without needing to bind to a real port. These tests live in the `apps/api/test` folder and end with `.e2e-spec.ts`. Supertest tests the entire request-response lifecycle, from hitting the routing decorators through the guards and interceptors, all the way to the JSON response formatting.
   - Run via: `pnpm --filter @salesense/api test:e2e`

### Module Path Resolution
Our backend `jest.config.js` leverages `moduleNameMapper` to resolve explicit `.js` extension imports (e.g., `import { X } from './file.js'`) by mapping them to their `.ts` counterparts seamlessly during execution.

## Continuous Integration
Tests are automatically mapped via **Turborepo** (`turbo.json`). Calling `pnpm test` from the root intelligently caches successful test runs. If code hasn't changed in a package, the test phase for that package resolves instantly from the turbo cache.
