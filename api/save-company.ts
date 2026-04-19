export const config = { runtime: "edge" };

import { AppError } from "../server/errors/app-error";
import { saveCompanySubmissionStep } from "../server/services/submission-service";

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

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") return json({ error: "Method Not Allowed" }, 405);

  try {
    const { submission_id, client_id, ...fields } = await req.json() as Record<string, unknown>;

    if (!submission_id || !client_id) {
      return json({ error: "Missing submission_id or client_id" }, 400);
    }

    const workflow = await saveCompanySubmissionStep({
      submissionId: String(submission_id),
      clientId: String(client_id),
      fields,
      request: req,
    });

    return json({ ok: true, workflow });
  } catch (err) {
    console.error("[api/save-company] unhandled:", err);
    return errorJson(err);
  }
}
