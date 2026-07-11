# Analytics & AI System Design

This document outlines the architecture and data flows for the **Phase 4: Analytics and AI Advisor** module in SaleSense.

## 1. Analytics Aggregation Flow

The Analytics service aggregates high-level KPIs and time-series data securely using Prisma queries filtered by `storeId`.

```mermaid
sequenceDiagram
    actor Client
    participant Controller as AnalyticsController
    participant Auth as StoreAccessGuard
    participant Service as AnalyticsService
    participant DB as Database (Prisma)

    Client->>Controller: GET /analytics/summary (with x-store-id header)
    Controller->>Auth: Validate JWT & Store Access
    Auth-->>Controller: Access Granted
    Controller->>Service: getSummary(storeId, startDate, endDate)
    Service->>DB: Query Sales (Sum totalPaise, profitPaise)
    Service->>DB: Query Sales (Count distinct ids)
    DB-->>Service: Aggregated Data
    Service-->>Controller: Return formatted KPIs (Rs)
    Controller-->>Client: { success: true, data: { revenue, profit, orders } }
```

## 2. Secure AI Context-Injection Flow

To prevent data leakage and hallucination, the SaleSense AI Advisor operates as a closed-loop context generator. Instead of allowing the AI unrestricted access to the database or passing the raw user prompt directly to the LLM, the backend intercepts the request and injects isolated store data directly into the system prompt.

```mermaid
sequenceDiagram
    actor User
    participant Frontend as Chatbox UI
    participant Backend as AiService (NestJS)
    participant Analytics as AnalyticsService
    participant Gemini as Google Gemini API

    User->>Frontend: "Why is my profit so low this week?"
    Frontend->>Backend: POST /analytics/chat { message }
    
    activate Backend
    Backend->>Analytics: Fetch Current Store KPIs
    Backend->>Analytics: Fetch Dead Stock Items
    Backend->>Analytics: Fetch Top Selling Products
    Analytics-->>Backend: Isolated Store Context Object
    
    Note over Backend: Inject Context into System Prompt
    Backend->>Gemini: generateContent(systemPrompt + userMessage)
    Gemini-->>Backend: Generated Insight
    Backend-->>Frontend: Text Response
    deactivate Backend
    
    Frontend-->>User: "Based on your data, your dead stock of 'Winter Coats' is locking up capital..."
```

## 3. Fallback & Graceful Degradation

If the `GEMINI_API_KEY` is missing in the production environment, the backend gracefully degrades to prevent catastrophic failures.

```mermaid
stateDiagram-v2
    [*] --> CheckEnv: Server Boot
    CheckEnv --> Configured: GEMINI_API_KEY is present
    CheckEnv --> Unconfigured: Key is missing

    state Configured {
        Init --> Ready: Instantiate GoogleGenerativeAI
        Ready --> ProcessChat: Accept POST /analytics/chat
    }

    state Unconfigured {
        LogWarning --> Intercept: "AI Advisor disabled"
        Intercept --> RejectChat: Throw 501 Not Implemented
    }

    Unconfigured --> Configured: Key added & Server Restart
```

## Data Correctness Rules (per ADR-0005)

These rules were added when hardening the original implementation; the tests in
`analytics.service.spec.ts` enforce each one.

```mermaid
flowchart TD
    A[Sale createdAt UTC] --> B[Resolve Store.timezone<br/>default Asia/Kolkata]
    B --> C[Bucket by ISO day key yyyy-mm-dd<br/>via Intl.DateTimeFormat en-CA]
    C --> D[Sort keys lexicographically<br/>= chronological for ISO]
    D --> E[API returns ISO date keys]
    E --> F[Frontend formats for display<br/>formatIsoDateLabel → '11 Jul']
    E --> G[CSV export keeps raw ISO<br/>spreadsheet-friendly]
```

1. **Business-day grouping uses the store timezone**, never server-local time. A sale
   at 11:30 PM IST belongs to that IST date even when the API runs on a UTC host.
2. **Chart date keys are ISO `yyyy-mm-dd`** — unambiguous across years and naturally
   sortable. Display formatting is a frontend concern only.
3. **Dead-stock `lockedValue` is computed at purchase cost** (sum of
   `currentQuantity × purchasePricePaise` per batch), because locked capital is what
   was paid, not the hoped-for retail value.
4. **AI chat input is validated** (`ChatDto`: required string, max 2000 chars) to bound
   Gemini token cost and reject malformed payloads before they reach the LLM.
5. Money conversions divide integer paise by 100 at the API boundary only; internal
   arithmetic stays in `BigInt` paise.

## Security Considerations
1. **RBAC**: All Analytics endpoints are protected by `StoreAccessGuard`. Only `OWNER` and `MANAGER` roles can access the dashboard.
2. **Data Segregation**: The AI service strictly filters data by `storeId`. Even if a prompt injection attack occurs, the LLM is only aware of the specific store's data explicitly fetched and injected by `AnalyticsService`.
3. **Input validation**: `POST /analytics/chat` accepts only a validated `ChatDto`; the global `ValidationPipe` (whitelist mode) strips unknown fields.
