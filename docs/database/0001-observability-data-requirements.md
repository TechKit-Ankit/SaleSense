# Observability Data Requirements

## Goal

The database model must support tracing important business actions without turning every table into a log store.

## Required Tables Or Fields

These requirements must be considered during database model design:

| Requirement | Why |
| --- | --- |
| `audit_logs` table | Track important user and system actions |
| `idempotency_keys` table | Prevent duplicate sale/invoice creation on retries |
| `sync_events` table | Track offline sync attempts, failures, and recovery |
| `createdRequestId` on high-risk records | Trace creation of sales, invoices, and stock movements |
| `createdByUserId` on high-risk records | Know which user triggered the action |
| `storeId` on tenant-owned records | Keep logs and records scoped to a store |

## Suggested Audit Log Fields

```text
id
requestId
actorUserId
storeId
action
entityType
entityId
metadata
ipAddress
userAgent
createdAt
```

## Suggested Idempotency Key Fields

```text
id
key
storeId
userId
requestHash
resourceType
resourceId
status
createdAt
expiresAt
```

## Suggested Sync Event Fields

```text
id
requestId
storeId
deviceId
userId
clientMutationId
entityType
entityId
status
attemptCount
lastErrorCode
lastErrorMessage
createdAt
syncedAt
```

## Rule

Logs explain what happened at runtime. Database audit records explain what happened to the business. We need both.

