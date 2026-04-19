// Shared audit log helper for all API routes.
// Fire-and-forget — never throws, never blocks the main response.

import { createClient } from "@supabase/supabase-js";

function getServiceClient() {
  return createClient(
    process.env.VITE_SUPABASE_URL ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
  );
}

export async function logAuditEvent({
  tenantId,
  userId,
  submissionId,
  eventType,
  eventDetail,
  request,
}: {
  tenantId: string;
  userId?: string | null;
  submissionId?: string | null;
  eventType: string;
  eventDetail?: Record<string, unknown>;
  request?: Request;
}): Promise<void> {
  try {
    const supabase = getServiceClient();

    // Extract IP and user agent from the request if available
    const ipAddress = request
      ? (request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
         request.headers.get("x-real-ip") ??
         null)
      : null;
    const userAgent = request ? request.headers.get("user-agent") : null;

    await supabase.from("audit_log").insert({
      tenant_id:    tenantId,
      user_id:      userId ?? null,
      submission_id: submissionId ?? null,
      event_type:   eventType,
      event_detail: eventDetail ?? null,
      ip_address:   ipAddress,
      user_agent:   userAgent,
    });
  } catch {
    // Never let audit logging break the main request
  }
}
