export const config = { runtime: "edge" };

import { createClient } from "@supabase/supabase-js";
import { logAuditEvent } from "./_audit";

interface UpdateMemberBody {
  target_user_id: string;
  first_name?: string | null;
  last_name?: string | null;
  role?: string;
  is_admin?: boolean;
  licensed_classes?: string[];
  is_active?: boolean;
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

  // Verify caller is admin
  const { data: caller } = await supabase
    .from("users")
    .select("tenant_id, is_admin, role")
    .eq("id", user.id)
    .single();

  if (!caller?.tenant_id) return json({ error: "Could not resolve tenant" }, 403);
  if (!caller.is_admin && caller.role !== "platform_admin") return json({ error: "Admin access required" }, 403);

  const body = (await req.json()) as UpdateMemberBody;
  if (!body.target_user_id) return json({ error: "target_user_id is required" }, 400);

  // Verify the target user belongs to the same tenant
  const { data: target } = await supabase
    .from("users")
    .select("id, tenant_id")
    .eq("id", body.target_user_id)
    .eq("tenant_id", caller.tenant_id)
    .single();

  if (!target) return json({ error: "User not found" }, 404);

  // Prevent an admin from removing their own admin flag
  if (body.is_admin === false && body.target_user_id === user.id) {
    return json({ error: "You cannot remove your own admin privileges" }, 403);
  }

  // Build update object from only the fields supplied
  const updates: Record<string, unknown> = {};
  if (body.first_name !== undefined)       updates.first_name = body.first_name;
  if (body.last_name !== undefined)        updates.last_name = body.last_name;
  if (body.role !== undefined)             updates.role = body.role;
  if (body.is_admin !== undefined)         updates.is_admin = body.is_admin;
  if (body.licensed_classes !== undefined) updates.licensed_classes = body.licensed_classes;
  if (body.is_active !== undefined)        updates.is_active = body.is_active;

  if (Object.keys(updates).length === 0) return json({ error: "No fields to update" }, 400);

  const { error: updateError } = await supabase
    .from("users")
    .update(updates)
    .eq("id", body.target_user_id);

  if (updateError) {
    console.error("[api/update-team-member] update:", updateError);
    return json({ error: "Failed to update user" }, 500);
  }

  await logAuditEvent({
    tenantId: caller.tenant_id,
    userId: user.id,
    eventType: "team.member_updated",
    eventDetail: { target_user_id: body.target_user_id, changes: updates },
    request: req,
  });

  return json({ ok: true }, 200);
}
