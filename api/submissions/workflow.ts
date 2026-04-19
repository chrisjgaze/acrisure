export const config = { runtime: "edge" };

import { AppError } from "../../server/errors/app-error";
import { getSubmissionWorkflow } from "../../server/services/submission-service";

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
  if (req.method !== "GET") return json({ error: "Method Not Allowed" }, 405);

  try {
    const url = new URL(req.url);
    const submissionId = url.searchParams.get("submissionId");
    const clientId = url.searchParams.get("clientId");

    if (!submissionId) {
      return json(
        { error: { code: "VALIDATION_ERROR", message: "Missing submissionId" } },
        400
      );
    }

    const result = await getSubmissionWorkflow({ submissionId, clientId });
    return json(result);
  } catch (error) {
    return errorJson(error);
  }
}
