export const config = { runtime: "edge" };

import { captureApiError } from "./_sentry";
import { AppError } from "../server/errors/app-error";
import { saveGenericSubmissionStep } from "../server/services/submission-service";

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function errorJson(error: unknown) {
  if (error instanceof AppError) {
    return json(
      {
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      },
      error.status
    );
  }

  return json(
    {
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Internal server error",
      },
    },
    500
  );
}

// Only allow writes to form-specific tables — never to auth/admin tables
const ALLOWED_TABLES = new Set([
  "submission_cyber",
  "submission_dno",
  "submission_terrorism",
  "submission_financial",
  "submission_trading",
  "submission_buyers",
  "submission_overdue_accounts",
  "submission_loss_history",
]);

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") return json({ error: "Method Not Allowed" }, 405);

  try {
    const { table, submission_id, client_id, ...fields } = await req.json() as Record<string, unknown>;

    if (!table || !submission_id || !client_id) {
      return json({ error: "Missing table, submission_id, or client_id" }, 400);
    }

    if (!ALLOWED_TABLES.has(table as string)) {
      return json({ error: "Table not permitted" }, 403);
    }

    const workflow = await saveGenericSubmissionStep({
      table: String(table),
      submissionId: String(submission_id),
      clientId: String(client_id),
      fields,
      request: req,
    });

    return json({ ok: true, workflow });
  } catch (err) {
    console.error("[api/save-form-data] unhandled:", err);
    captureApiError(err, { route: "api/save-form-data" });
    return errorJson(err);
  }
}
