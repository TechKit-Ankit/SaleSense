# syntax=docker/dockerfile:1
# SaleSense API image. Build with the REPO ROOT as context (pnpm monorepo):
#   docker build -f apps/api/Dockerfile -t salesense-api .
# Railway/Render: set Dockerfile path = apps/api/Dockerfile (root context).

# ---------- builder ----------
FROM node:24-slim AS builder
WORKDIR /app

# openssl -> Prisma; python3/make/g++ -> native bcrypt build
RUN apt-get update -y && apt-get install -y --no-install-recommends \
      openssl python3 make g++ ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable

# Whole workspace (a .dockerignore trims it); needed for pnpm workspace links.
COPY . .

RUN corepack pnpm install --frozen-lockfile
RUN corepack pnpm --filter @salesense/db prisma:generate
RUN corepack pnpm --filter @salesense/shared build \
 && corepack pnpm --filter @salesense/db build \
 && corepack pnpm --filter @salesense/api build

# ---------- runtime ----------
FROM node:24-slim AS runtime
WORKDIR /app

RUN apt-get update -y && apt-get install -y --no-install-recommends \
      openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable

# Bring the built workspace: node_modules (with the generated Prisma client
# and the prisma CLI for `db:deploy`), dist outputs, and prisma migrations.
# Copying all of /app preserves pnpm's relative workspace symlinks.
COPY --from=builder /app /app

EXPOSE 4000

# Container healthcheck on the public /health route (Node 24 global fetch).
HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.API_PORT||4000)+'/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

WORKDIR /app/apps/api
CMD ["node", "dist/src/main.js"]
