export const config = { runtime: "edge" };

import { createClient } from "@supabase/supabase-js";

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function getServiceClient() {
  const url = process.env.VITE_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

function generateReference(tenantId: string): string {
  const year = new Date().getFullYear();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  const prefix = tenantId.substring(0, 4).toUpperCase();
  return `${prefix}-${year}-${rand}`;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") return json({ error: "Method Not Allowed" }, 405);

  try {
    const { client_id, submission_id, class_of_business } = await req.json() as {
      client_id: string;
      submission_id: string;
      class_of_business: string;
    };

    if (!client_id || !submission_id || !class_of_business) {
      return json({ error: "Missing required fields" }, 400);
    }

    const supabase = getServiceClient();

    // Verify the submission_id belongs to this client (proves client identity)
    const { data: proof } = await supabase
      .from("submissions")
      .select("id, tenant_id")
      .eq("id", submission_id)
      .eq("client_id", client_id)
      .single();

    if (!proof) return json({ error: "Unauthorized" }, 401);

    // Check this class doesn't already exist for the client
    const { data: existing } = await supabase
      .from("submissions")
      .select("id")
      .eq("client_id", client_id)
      .eq("class_of_business", class_of_business)
      .neq("status", "lapsed")
      .maybeSingle();

    if (existing) return json({ error: "Already exists" }, 409);

    // Create the new submission
    const policyYear = new Date().getFullYear() + 1;
    const reference = generateReference(proof.tenant_id);
    const { data: newSub, error: insertError } = await supabase
      .from("submissions")
      .insert({
        client_id,
        tenant_id: proof.tenant_id,
        class_of_business,
        status: "not_started",
        completion_pct: 0,
        policy_year: policyYear,
        reference,
      })
      .select("id")
      .single();

    if (insertError || !newSub) {
      return json({ error: insertError?.message ?? "Failed to create submission" }, 500);
    }

    // Note: we deliberately do NOT pre-copy submission_company here.
    // CompanyContactPage uses the anon key to upsert — if a row already exists
    // (created server-side), that upsert becomes an UPDATE which RLS blocks.
    // Instead, CompanyContactPage cross-fills from sibling submissions when
    // it finds no existing row, then does a fresh INSERT which RLS allows.

    return json({ submission_id: newSub.id });
  } catch (err) {
    console.error("[api/client-add-class]", err);
    return json({ error: "Internal server error" }, 500);
  }
}
