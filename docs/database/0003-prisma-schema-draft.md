# Prisma Schema Draft

## Status

Draft validated with Prisma CLI 7.8.0 on 2026-06-18.

## Files

| File | Purpose |
| --- | --- |
| `packages/db/prisma/schema.prisma` | Prisma data model draft |
| `prisma.config.ts` | Prisma 7 CLI config for schema, migrations, and datasource URL |

## Validation

Validated with:

```bash
npx prisma@7.8.0 validate --schema packages/db/prisma/schema.prisma
npx prisma@7.8.0 format --schema packages/db/prisma/schema.prisma
```

Result:

```text
The schema at packages\db\prisma\schema.prisma is valid
```

## Prisma 7 Note

Prisma 7 no longer supports `url = env("DATABASE_URL")` inside the `datasource` block in `schema.prisma`. The datasource URL now belongs in `prisma.config.ts`.

Current draft:

```ts
export default {
  schema: "packages/db/prisma/schema.prisma",
  migrations: {
    path: "packages/db/prisma/migrations",
  },
  datasource: {
    url:
      process.env.DATABASE_URL ??
      "postgresql://salesense:salesense@localhost:5432/salesense?schema=public",
  },
};
```

When the workspace is scaffolded and `prisma` is installed locally, we can switch this file to use Prisma's `defineConfig` helper.

## Intentional Design Choices

| Choice | Reason |
| --- | --- |
| `BigInt` for money fields | Prevent integer overflow and avoid floating point rounding bugs |
| UUID primary keys | Safer for offline/client-generated future flows and distributed systems |
| Store-scoped uniqueness | Supports multi-store data isolation |
| `globalProductId` and `globalBarcodeId` nullable fields | Future global catalog compatibility without building it now |
| `requiresReconciliation` fields | Support offline sale sync when stock becomes uncertain or negative |
| Request ID fields on high-risk records | Support debugging and auditability |
| Refund approval fields | Enforce manager/owner approval in MVP |

## Caveats Before Migration

Prisma does not fully express every PostgreSQL constraint we may want. Before creating production migrations, review:

1. Nullable unique constraints:
   - `@@unique([storeId, sku])`
   - `@@unique([storeId, phone])`
   - `@@unique([storeId, clientSaleId])`
   - `@@unique([storeId, deviceId, clientMutationId])`

   PostgreSQL allows multiple `NULL` values in unique constraints. This is acceptable for some fields, but `sync_events` may need a stricter partial index or a required `deviceId`.

2. Cross-store foreign key safety:
   - Prisma relations ensure referenced IDs exist.
   - Application services must still ensure related records belong to the same `storeId`.

3. Quantity precision:
   - Current draft uses integer quantities.
   - Weighted products like rice, dal, vegetables, or loose items may need `quantityMilliUnits` or decimal quantity fields later.

4. Invoice sequence locking:
   - `invoice_sequences.nextNumber` must be updated transactionally.
   - API implementation must prevent duplicate invoice numbers under concurrent billing.

5. Audit metadata:
   - `audit_logs.metadata` must not store secrets, tokens, full payment payloads, or sensitive customer data.

## Next Step

After API design, use this schema to create:

1. Initial migration
2. Seed script
3. Database client package
4. Repository/service patterns in the NestJS API

