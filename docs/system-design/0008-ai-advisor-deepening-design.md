# AI Advisor Deepening Design (P4.4)

## Status

Approved and implemented (2026-07-11). All four open decisions confirmed as
recommended: forecast deferred, multi-turn history (8 turns), rate limiting deferred to
the production checklist, advisor failures degrade gracefully. Tests:
`ai.service.spec.ts` (7 cases). **This completes Phase 4** (ADR-0005).

## Plan vs Implementation (delta record)

| | |
| --- | --- |
| **Prepared earlier (the plan)** | This document as reviewed: grounded context (5 blocks), prompt behaviour rules, bounded multi-turn history, `buildContext`/`buildSystemInstruction` extraction for testability, forecast deferral. |
| **Implemented now** | `ai.service.ts` rewritten (AdvisorService injected, testable assembly methods, `startChat` with mapped history), `ChatTurnDto` + optional `history` in `ChatDto` (DTO bounds 20, service keeps last 8), `AnalyticsModule` imports `AdvisorModule`, new `ai.service.spec.ts`; web client + analytics page send the last 8 turns. |
| **Changes vs the plan** | **(a)** The `AI_NOT_CONFIGURED` check now runs *before* context assembly (previously the context was built and then discarded when no key was set — wasted queries). **(b)** Gemini is now always called via `startChat`/`sendMessage` (empty history behaves like the old `generateContent`), one code path instead of two. Everything else implemented exactly as specified. |

## Goal

Close Phase 4 by grounding the Gemini chat in the **same deterministic findings the
dashboard shows**. Today the chat sees only raw analytics (summary, top products, dead
stock). After P4.4 it also receives the rule-based advisor's recommendations and the
inventory-health counters — so when the owner asks *"how do I improve profit?"*, the
LLM answers from the exact findings of P4.1–P4.3 instead of improvising, and points the
owner to the in-app tool that fixes each issue.

No new endpoints. No schema changes. `POST /advisor/forecast` from `api/0001` is
**deferred** (see Open Decisions).

## Flow

```mermaid
sequenceDiagram
    actor Owner
    participant UI as Analytics Chat UI
    participant Ai as AiService
    participant An as AnalyticsService
    participant Ad as AdvisorService (P4.3)
    participant G as Gemini

    Owner->>UI: "Why is my profit low?" (+ prior turns)
    UI->>Ai: POST /analytics/chat { message, history }
    Ai->>An: summary, topProducts, deadStock, inventoryHealth
    Ai->>Ad: getRecommendations(storeId)
    An-->>Ai: KPIs
    Ad-->>Ai: severity-ranked findings (max 20)
    Note over Ai: Build grounded system prompt<br/>(data + behaviour rules)
    Ai->>G: generateContent(history + message)
    G-->>Ai: Answer citing the findings
    Ai-->>UI: "Your NEGATIVE_MARGIN item Oil 1L loses ₹10/unit — reprice it.<br/>Also ₹2,400 locked in dead stock; try a BOGO via the Promotions page."
```

## Context payload (what the LLM sees)

Assembled server-side per request; the user's text is never used to fetch data:

| Block | Source | Notes |
| --- | --- | --- |
| `summary` | `AnalyticsService.getSummary` | revenue/profit/orders, last 30d |
| `topProducts` | `getTopProducts` | top 10 |
| `deadStock` | `getDeadStock` | top 10, cost-basis locked value |
| `inventoryHealth` | `getInventoryHealth` | low-stock/expired/expiring/reconciliation counters (new) |
| `recommendations` | `AdvisorService.getRecommendations` | severity-ranked, already capped at 20 (new) |

Excluded on purpose: customer data, payment references, user identities — same
data-segregation stance as design-0004. The context stays a bounded, fixed-shape JSON
(~2–4k tokens), so cost per chat is predictable.

## Prompt behaviour rules (system instruction)

1. Answer **only** from the injected context; say "I don't know" beyond it.
2. When a question touches a finding, **cite it** by its plain meaning (e.g. "your
   below-cost item Oil 1L") and give the concrete number from `metrics`.
3. When advising a discount or BOGO, **direct the owner to the Promotions page** to
   simulate it — the LLM must not invent its own profitability math when a
   deterministic simulator exists.
4. Reconciliation, reordering, and write-offs likewise point at their in-app pages.
5. Keep the persona: concise, friendly, actionable; amounts in rupees.

## Multi-turn history

The frontend already keeps a visual chat history but sends only the last message —
every turn is amnesiac ("what about the second one?" fails). Change:

- `ChatDto` gains optional `history: ChatTurnDto[]` — `role: 'user' | 'model'`,
  `content` (≤2000 chars each), **max 8 turns** (server truncates older).
- `AiService` maps it to Gemini's chat-history format; the system instruction with
  fresh data is rebuilt every request (so stale numbers from earlier turns never win).
- Web sends the last 8 turns from existing state — no UI change visible.

## Module wiring & testability

- `AnalyticsModule` imports `AdvisorModule` (`AdvisorService` was exported for exactly
  this — design-0007). `AiService` injects `AdvisorService`.
- Refactor for tests: extract `buildContext(storeId)` and `buildSystemInstruction(ctx)`
  as methods on `AiService` so prompt assembly is unit-testable **without** calling
  Gemini (there is currently **no** `ai.service.spec.ts` — this closes that gap).

## Blast radius

| Layer | Files | Risk |
| --- | --- | --- |
| API | `ai.service.ts` (context + history), `analytics.module.ts` (+import), `dto/chat.dto.ts` (+history), new `ai.service.spec.ts` | No endpoint added/renamed; `/analytics/chat` request stays backward-compatible (history optional) |
| Web | `api-client/analytics.ts` (`chatWithAi` gains optional history), analytics page (pass last 8 turns) | Additive signature change; single consumer (verified) |
| Untouched | advisor, simulators, inventory, sales, sync | AiService is read-only over their outputs |

## Tests (release-rule gate)

- `buildContext`: includes all five blocks; advisor errors degrade gracefully (context
  still built, recommendations `[]` — chat must not die because one source failed).
- `buildSystemInstruction`: contains grounding rules + serialized context.
- History: truncation to 8 turns, role mapping, empty/absent history accepted.
- Not-configured path still throws `AI_NOT_CONFIGURED` (501).
- Controller: history validated (array shape, per-turn caps).

## Open decisions for review

1. **Forecast endpoint** (`POST /advisor/forecast` from `api/0001`) — **defer**
   (recommended): a 30-day window over a small store's sparse sales is statistically
   too thin for honest demand forecasting; shipping a naive moving average dressed as a
   "forecast" would undermine the trust the deterministic advisor just built. Revisit
   when stores accumulate 6+ months of history. Alternative: naive moving-average now.
2. **Multi-turn history** — add it (recommended, bounded at 8 turns) vs keep
   single-turn amnesia.
3. **Rate limiting on `/analytics/chat`** — defer to the production-hardening checklist
   (recommended; `@nestjs/throttler` is a new dependency and the DTO length cap already
   bounds per-request cost) vs add now.
4. **Advisor failure mode** — degrade gracefully with empty recommendations
   (recommended) vs fail the chat request.
