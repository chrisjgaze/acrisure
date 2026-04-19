export const config = { runtime: "edge" };

import { createClient } from "@supabase/supabase-js";
import { logAuditEvent } from "./_audit";

interface AnonymiseBody {
  client_id: string;
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

  // Admin-only endpoint
  const { data: caller } = await supabase
    .from("users")
    .select("tenant_id, is_admin, role")
    .eq("id", user.id)
    .single();

  if (!caller?.tenant_id) return json({ error: "Could not resolve tenant" }, 403);
  if (!caller.is_admin && caller.role !== "platform_admin") return json({ error: "Admin access required — only admins can anonymise client data" }, 403);

  const body = (await req.json()) as AnonymiseBody;
  if (!body.client_id) return json({ error: "client_id is required" }, 400);

  // Verify client belongs to this tenant
  const { data: clientRecord } = await supabase
    .from("clients")
    .select("id, display_name, deleted_at")
    .eq("id", body.client_id)
    .eq("tenant_id", caller.tenant_id)
    .single();

  if (!clientRecord) return json({ error: "Client not found" }, 404);
  if (clientRecord.deleted_at) return json({ error: "Client data has already been anonymised" }, 409);

  // Fetch all submission IDs for this client
  const { data: submissions } = await supabase
    .from("submissions")
    .select("id")
    .eq("client_id", body.client_id);

  const submissionIds = (submissions ?? []).map((s) => s.id);

  // Run all anonymisation steps in parallel
  await Promise.all([
    // Anonymise the clients record
    supabase
      .from("clients")
      .update({
        contact_name: "Anonymised",
        contact_email: "anonymised@deleted.invalid",
        display_name: "Anonymised",
        deleted_at: new Date().toISOString(),
      })
      .eq("id", body.client_id),

    // Anonymise submission_company rows (personal + address fields)
    submissionIds.length > 0
      ? supabase
          .from("submission_company")
          .update({
            contact_name: "Anonymised",
            contact_email: "anonymised@deleted.invalid",
            company_name: "Anonymised",
            address_line1: null,
            address_line2: null,
            city: null,
            postcode: null,
            trading_address_line1: null,
            trading_address_line2: null,
            trading_city: null,
            trading_postcode: null,
            website: null,
            company_reg_number: null,
            vat_number: null,
          })
          .in("submission_id", submissionIds)
      : Promise.resolve(),

    // Expire any outstanding magic links for this client
    supabase
      .from("magic_links")
      .update({ expires_at: new Date().toISOString() })
      .eq("client_id", body.client_id)
      .eq("used", false),
  ]);

  await logAuditEvent({
    tenantId: caller.tenant_id,
    userId: user.id,
    eventType: "gdpr.anonymised",
    eventDetail: {
      client_id: body.client_id,
      company_name: clientRecord.display_name,
      submission_count: submissionIds.length,
    },
    request: req,
  });

  return json({ ok: true }, 200);
}
