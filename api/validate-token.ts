export const config = { runtime: 'edge' };

import { createClient } from "@supabase/supabase-js";
import { logAuditEvent } from "./_audit";

function json(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") return json({ error: "Method Not Allowed" }, 405);

  const { token } = await req.json() as { token: string };
  if (!token) return json({ error: "Missing token" }, 400);

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Hash the token the same way we did on creation
  const hashBuffer = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token)
  );
  const tokenHash = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const { data: link, error } = await supabase
    .from("magic_links")
    .select("id, client_id, submission_id, email, expires_at, used_at")
    .eq("token_hash", tokenHash)
    .single();

  if (error || !link) return json({ error: "Invalid link" }, 404);
  if (link.used_at) return json({ error: "Link already used" }, 410);
  if (new Date(link.expires_at) < new Date()) return json({ error: "Link expired" }, 410);

  // Mark as used
  await supabase
    .from("magic_links")
    .update({ used_at: new Date().toISOString() })
    .eq("id", link.id);

  // Fetch all submissions for this client so the class picker can show them
  const [{ data: allSubmissions }, { data: clientRow }] = await Promise.all([
    supabase
      .from("submissions")
      .select("id, class_of_business, status, completion_pct, policy_year")
      .eq("client_id", link.client_id)
      .order("created_at", { ascending: true }),
    supabase
      .from("clients")
      .select("tenant_id")
      .eq("id", link.client_id)
      .single(),
  ]);

  // Determine the policy year for the linked submission
  const linkedSub = (allSubmissions ?? []).find((s) => s.id === link.submission_id);
  const policyYear: number | null = linkedSub?.policy_year ?? null;

  // Fetch tenant logo for client-facing branding
  let tenantLogoUrl: string | null = null;
  if (clientRow?.tenant_id) {
    const { data: tenant } = await supabase
      .from("tenants")
      .select("logo_url")
      .eq("id", clientRow.tenant_id)
      .single();
    tenantLogoUrl = tenant?.logo_url ?? null;
  }

  if (clientRow?.tenant_id) {
    await logAuditEvent({
      tenantId: clientRow.tenant_id,
      submissionId: link.submission_id,
      eventType: "magic_link.used",
      eventDetail: { client_id: link.client_id, email: link.email },
      request: req,
    });
  }

  return json({
    clientId: link.client_id,
    submissionId: link.submission_id,
    email: link.email,
    policyYear,
    tenantLogoUrl,
    submissions: allSubmissions ?? [],
  }, 200);
}