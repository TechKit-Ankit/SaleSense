import * as Sentry from "@sentry/nextjs";

/**
 * Next.js server/edge instrumentation hook. Sentry is optional at runtime:
 * without SENTRY_DSN nothing initializes (graceful degradation, same pattern
 * as the API). See docs/developer-reference/error-handling-and-logging.md
 * for the Pino-vs-Sentry division of responsibility.
 */
export async function register() {
  if (!process.env.SENTRY_DSN) return;

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV ?? "development",
    tracesSampleRate: 0,
    sendDefaultPii: false,
  });
}

export const onRequestError = Sentry.captureRequestError;
