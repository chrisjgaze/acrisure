export const config = { runtime: "edge" };

/**
 * Generic client-side audit event logger.
 * Called from the frontend for events that happen in the browser
 * (broker logins, page views, etc.) rather than in other API routes.
 *
 * Verifies the caller's session before writing — never trusts the
 * tenantId supplied by the client; always resolves it server-side.
 */

import { createClient } from "@supabase/supabase-js";
import { logAuditEvent } from "./_audit";

interface LogEventBody {
  eventType: string;
  eventDetail?: Record<string, unknown>;
  submissionId?: string;
}

function json(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") return json({ error: "Method Not Allowed" }, 405);

  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "Unauthorised" }, 401);

  const anonClient = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!,
  );

  const { data: { user }, error: authError } = await anonClient.auth.getUser(token);
  if (authError || !user) return json({ error: "Unauthorised" }, 401);

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data: userRecord } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!userRecord?.tenant_id) return json({ error: "Could not resolve tenant" }, 403);

  let body: LogEventBody;
  try {
    body = (await req.json()) as LogEventBody;
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  if (!body.eventType) return json({ error: "Missing eventType" }, 400);

  // Fire-and-forget; response is instant
  await logAuditEvent({
    tenantId: userRecord.tenant_id,
    userId: user.id,
    submissionId: body.submissionId ?? null,
    eventType: body.eventType,
    eventDetail: body.eventDetail,
    request: req,
  });

  return json({ ok: true }, 200);
}
