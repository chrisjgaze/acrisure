export const config = { runtime: "edge" };

import { createClient } from "@supabase/supabase-js";

function json(body: Record<string, unknown> | unknown[], status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "GET") return json({ error: "Method Not Allowed" }, 405);

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

  // Resolve caller's tenant and verify they are an admin
  const { data: caller } = await supabase
    .from("users")
    .select("tenant_id, is_admin, role")
    .eq("id", user.id)
    .single();

  if (!caller?.tenant_id) return json({ error: "Could not resolve tenant" }, 403);
  if (!caller.is_admin && caller.role !== "platform_admin") return json({ error: "Admin access required" }, 403);

  const { data: team, error: teamError } = await supabase
    .from("users")
    .select("id, email, first_name, last_name, role, is_admin, is_active, licensed_classes, last_login, created_at")
    .eq("tenant_id", caller.tenant_id)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (teamError) {
    console.error("[api/list-team] query error:", teamError);
    return json({ error: "Failed to load team" }, 500);
  }

  return json(team ?? [], 200);
}
