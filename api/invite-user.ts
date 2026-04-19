export const config = { runtime: "edge" };

import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { logAuditEvent } from "./_audit";
import { getTenantBranding, emailStyles } from "./_branding";

interface InviteUserBody {
  email: string;
  first_name?: string;
  last_name?: string;
  role?: string;
  is_admin?: boolean;
  licensed_classes?: string[];
}

function json(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const APP_URL = (process.env.APP_URL ?? "${APP_URL}").replace(/\/$/, "");

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

  const body = (await req.json()) as InviteUserBody;
  if (!body.email?.trim()) return json({ error: "Email is required" }, 400);

  const email = body.email.trim().toLowerCase();

  // Duplicate check — don't re-invite an existing active team member
  const { data: existing } = await supabase
    .from("users")
    .select("id, is_active, deleted_at")
    .eq("email", email)
    .eq("tenant_id", caller.tenant_id)
    .maybeSingle();

  if (existing && !existing.deleted_at) {
    return json({ error: "A team member with this email already exists" }, 409);
  }

  // Create Supabase auth user (sends Supabase's own password-set email)
  const { data: inviteData, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${APP_URL}/auth/callback`,
  });

  if (inviteError || !inviteData?.user) {
    console.error("[api/invite-user] inviteUserByEmail:", inviteError);
    return json({ error: "Failed to create user account" }, 500);
  }

  const newUserId = inviteData.user.id;

  // Upsert the users profile row (may exist from a prior invite on the same email)
  const { error: upsertError } = await supabase.from("users").upsert({
    id: newUserId,
    tenant_id: caller.tenant_id,
    email,
    first_name: body.first_name?.trim() || null,
    last_name: body.last_name?.trim() || null,
    role: body.role ?? "broker",
    is_admin: body.is_admin ?? false,
    licensed_classes: body.licensed_classes?.length ? body.licensed_classes : ["trade_credit"],
    is_active: true,
    deleted_at: null,
  }, { onConflict: "id" });

  if (upsertError) {
    console.error("[api/invite-user] users upsert:", upsertError);
    return json({ error: "User account created but profile setup failed" }, 500);
  }

  // Send a branded welcome email (Supabase also sends its own password-set email)
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    const resend = new Resend(resendKey);
    const { logoUrl, primaryColour, tenantName } = await getTenantBranding(caller.tenant_id);
    const { headerStyle, bodyStyle, btnStyle } = emailStyles(primaryColour);
    const inviterName = user.email ?? "Your administrator";

    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev",
      to: email,
      subject: `You've been invited to join ${tenantName} on FormFlow`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#111827">
          <div style="${headerStyle}">
            <img src="${logoUrl}" alt="${tenantName}" style="height:32px;width:auto;display:block;" />
          </div>
          <div style="${bodyStyle}">
            <h2 style="color:${primaryColour};margin-top:0">Welcome to ${tenantName}</h2>
            <p>Hi ${body.first_name ? body.first_name : "there"},</p>
            <p>
              ${inviterName} has invited you to join the ${tenantName} team on the FormFlow broker platform.
              You'll receive a separate email shortly to set your password.
            </p>
            <p>Once you've set your password, click below to get started:</p>
            <a href="${APP_URL}/login" style="${btnStyle}">Go to login →</a>
            <p style="font-size:12px;color:#6B7280;margin-top:24px;padding-top:16px;border-top:1px solid #E2E8F0">
              If you weren't expecting this invitation, you can safely ignore this email.
            </p>
          </div>
        </div>
      `,
    }).catch((err) => console.error("[api/invite-user] welcome email:", err));
  }

  await logAuditEvent({
    tenantId: caller.tenant_id,
    userId: user.id,
    eventType: "team.member_invited",
    eventDetail: {
      invited_email: email,
      role: body.role ?? "broker",
      is_admin: body.is_admin ?? false,
      licensed_classes: body.licensed_classes ?? ["trade_credit"],
    },
    request: req,
  });

  return json({ ok: true, user_id: newUserId }, 201);
}
