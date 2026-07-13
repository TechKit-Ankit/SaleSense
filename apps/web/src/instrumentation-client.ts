import * as Sentry from "@sentry/nextjs";

/**
 * Browser-side Sentry init. Optional: without NEXT_PUBLIC_SENTRY_DSN this is
 * a no-op. Captures unhandled client errors (POS crashes at the counter are
 * exactly what we cannot see otherwise). No session replay, no tracing —
 * errors only for the pilot (ADR-0003 Phase 3 covers the rest).
 */
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NODE_ENV ?? "development",
    tracesSampleRate: 0,
    sendDefaultPii: false,
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
