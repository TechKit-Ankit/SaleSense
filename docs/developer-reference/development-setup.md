# Development Setup

## Status

Initial scaffold created.

## Runtime

Use:

```text
Node.js 24 LTS
pnpm 11.8.0 through Corepack
```

In this environment, use:

```bash
corepack pnpm <command>
```

PowerShell may not expose a direct `pnpm` shim immediately after Corepack activation.

## Workspace Commands

```bash
corepack pnpm install
corepack pnpm dev
corepack pnpm dev:web
corepack pnpm dev:api
corepack pnpm check
corepack pnpm build
corepack pnpm db:validate
```

Current Windows/Corepack note:

- `corepack pnpm` works in this workspace.
- A plain global `pnpm` shim may not be available until Corepack can write to the Node installation directory.
- Root scripts intentionally call `corepack pnpm` so local commands do not depend on a global shim.
- Turborepo is installed for future CI/dev optimization, but local scripts currently use sequential pnpm workspace execution because Turbo could not discover the pnpm binary in this PowerShell session.

## App URLs

| App | URL |
| --- | --- |
| Web | `http://localhost:3000` |
| API | `http://localhost:4000/api/v1/health` |
| API docs | `http://localhost:4000/docs` |

## Current Scaffold

```text
apps/
  web/
  api/
packages/
  db/
  shared/
  config/
```

The current web app is a lightweight scaffold screen only. It is not the final SaleSense UI.

The current API app exposes only a health route and Swagger setup. Feature modules should be added after the API contracts are approved.
