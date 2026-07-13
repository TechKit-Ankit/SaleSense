import * as Sentry from "@sentry/nestjs";

/**
 * Sentry bootstrap — must be imported FIRST in main.ts so instrumentation
 * wraps everything. Optional at runtime: without SENTRY_DSN this is a no-op
 * (same graceful-degradation pattern as the Gemini key).
 *
 * Division of responsibility vs Pino: see
 * docs/developer-reference/error-handling-and-logging.md — Pino logs
 * everything for forensics; Sentry only receives unexpected 5xx for alerting.
 */
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV ?? "development",
    // Errors only for the pilot; performance tracing is ADR-0003 Phase 3.
    tracesSampleRate: 0,
    // Never send PII or request bodies.
    sendDefaultPii: false,
  });
}

export function isSentryEnabled(): boolean {
  return !!process.env.SENTRY_DSN;
}

export { Sentry };
