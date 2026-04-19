// Shared Sentry initialisation for all API routes.
// Import and call initSentry() at the top of any handler that needs error tracking.
// Uses @sentry/react's core which works in edge runtime — no Node-specific imports.

export function captureApiError(err: unknown, context?: Record<string, string>) {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return; // Silently skip if not configured

  const message = err instanceof Error ? err.message : String(err);
  const stack   = err instanceof Error ? err.stack : undefined;
  const env     = process.env.VERCEL_ENV ?? "development";

  // Fire-and-forget: send to Sentry's envelope endpoint
  const payload = JSON.stringify({
    dsn,
    exception: {
      values: [{
        type: err instanceof Error ? err.name : "Error",
        value: message,
        stacktrace: stack ? {
          frames: stack.split("\n").slice(1).map(line => ({ filename: line.trim() }))
        } : undefined,
      }],
    },
    environment: env,
    contexts: context ? { api: context } : undefined,
    timestamp: Date.now() / 1000,
  });

  // Extract host from DSN: https://<key>@<host>/<project>
  try {
    const url = new URL(dsn);
    const projectId = url.pathname.replace("/", "");
    const sentryUrl = `${url.protocol}//${url.host}/api/${projectId}/envelope/`;
    fetch(sentryUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Sentry-Auth": `Sentry sentry_key=${url.username}, sentry_version=7` },
      body: payload,
    }).catch(() => {}); // Never let Sentry reporting break the handler
  } catch {
    // Malformed DSN — ignore
  }
}
