export const config = { runtime: "edge" };

import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { logAuditEvent } from "./_audit";
import { getTenantBranding, emailStyles } from "./_branding";

interface AddClassBody {
  client_id: string;
  class_of_business: string;
}

function json(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const APP_URL = (process.env.APP_URL ?? "${APP_URL}").replace(/\/$/, "");

const CLASS_LABELS: Record<string, string> = {
  cyber: "Cyber Insurance",
  dno: "Directors & Officers",
  terrorism: "Terrorism Insurance",
};

const CLASS_TIME: Record<string, string> = {
  cyber: "2–3 minutes",
  dno: "3–4 minutes",
  terrorism: "1–2 minutes",
};

async function generateToken(): Promise<{ plain: string; hash: string }> {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const plain = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(plain));
  const hash = Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return { plain, hash };
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") return json({ error: "Method Not Allowed" }, 405);

  const body = (await req.json()) as AddClassBody;
  if (!body.client_id || !body.class_of_business) return json({ error: "Missing fields" }, 400);

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

  const { data: userRecord } = await supabase.from("users").select("tenant_id").eq("id", user.id).single();
  if (!userRecord?.tenant_id) return json({ error: "Could not resolve tenant" }, 403);

  // Verify client belongs to this tenant
  const { data: clientRecord } = await supabase
    .from("clients")
    .select("id, display_name, contact_name, contact_email")
    .eq("id", body.client_id)
    .eq("tenant_id", userRecord.tenant_id)
    .single();
  if (!clientRecord) return json({ error: "Client not found" }, 404);

  // Check class not already added
  const { data: existing } = await supabase
    .from("submissions")
    .select("id")
    .eq("client_id", body.client_id)
    .eq("class_of_business", body.class_of_business)
    .maybeSingle();
  if (existing) return json({ error: "Class already exists for this client" }, 409);

  // Create new submission
  const classPrefix = body.class_of_business.toUpperCase().slice(0, 3);
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  const reference = `${classPrefix}-${new Date().getFullYear()}-${rand}`;

  const { data: newSub, error: subError } = await supabase
    .from("submissions")
    .insert({
      client_id: body.client_id,
      tenant_id: userRecord.tenant_id,
      class_of_business: body.class_of_business,
      status: "not_started",
      completion_pct: 0,
      reference,
      policy_year: new Date().getFullYear(),
    })
    .select("id")
    .single();

  if (subError || !newSub) return json({ error: "Failed to create submission" }, 500);

  // Copy company data from any existing submission that has it (newest first)
  const { data: existingSubs } = await supabase
    .from("submissions")
    .select("id")
    .eq("client_id", body.client_id)
    .neq("id", newSub.id)
    .order("created_at", { ascending: false });

  let existingCompany = null;
  for (const s of existingSubs ?? []) {
    const { data } = await supabase
      .from("submission_company")
      .select("*")
      .eq("submission_id", s.id)
      .not("company_name", "is", null)
      .maybeSingle();
    if (data?.company_name) { existingCompany = data; break; }
  }
  const tcCompany = existingCompany;

  await supabase.from("submission_company").insert({
    submission_id: newSub.id,
    // Company fields — copied from TC if available
    company_name:              tcCompany?.company_name ?? null,
    address_line1:             tcCompany?.address_line1 ?? null,
    address_line2:             tcCompany?.address_line2 ?? null,
    city:                      tcCompany?.city ?? null,
    postcode:                  tcCompany?.postcode ?? null,
    country:                   tcCompany?.country ?? "GB",
    trading_address_different: tcCompany?.trading_address_different ?? false,
    trading_address_line1:     tcCompany?.trading_address_line1 ?? null,
    trading_address_line2:     tcCompany?.trading_address_line2 ?? null,
    trading_city:              tcCompany?.trading_city ?? null,
    trading_postcode:          tcCompany?.trading_postcode ?? null,
    website:                   tcCompany?.website ?? null,
    company_reg_number:        tcCompany?.company_reg_number ?? null,
    vat_number:                tcCompany?.vat_number ?? null,
    formation_date:            tcCompany?.formation_date ?? null,
    nature_of_business:        tcCompany?.nature_of_business ?? null,
    // Contact fields — pre-filled from client record (person may differ per class)
    contact_name:  clientRecord.contact_name,
    contact_email: clientRecord.contact_email,
  });

  // Generate magic link (reuses existing active link if possible — attach to new submission)
  const { plain: plainToken, hash: tokenHash } = await generateToken();
  const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();

  await supabase.from("magic_links").insert({
    client_id: body.client_id,
    submission_id: newSub.id,
    email: clientRecord.contact_email,
    token_hash: tokenHash,
    expires_at: expiresAt,
  });

  // Send invite email
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    const resend = new Resend(resendKey);
    const classLabel = CLASS_LABELS[body.class_of_business] ?? body.class_of_business;
    const classTime = CLASS_TIME[body.class_of_business] ?? "a few minutes";
    const magicUrl = `${APP_URL}/invite/${plainToken}`;
    const brokerEmail = user.email ?? "";

    const { logoUrl, primaryColour, tenantName } = await getTenantBranding(userRecord?.tenant_id ?? "");
    const { headerStyle, bodyStyle, btnStyle }   = emailStyles(primaryColour);

    const { error: emailError } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev",
      to: clientRecord.contact_email,
      subject: `Get a ${classLabel} quote — takes just ${classTime}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#111827">
          <div style="${headerStyle}"><img src="${logoUrl}" alt="${tenantName}" style="height:32px;width:auto;display:block;" /></div>
          <div style="${bodyStyle}">
            <h2 style="color:${primaryColour};margin-top:0">You've been invited to get a ${classLabel} quote</h2>
            <p>Hi ${clientRecord.contact_name},</p>
            <p>Your broker has set up a short proposal form for <strong>${classLabel}</strong>. It should take just <strong>${classTime}</strong> to complete.</p>
            <a href="${magicUrl}" style="${btnStyle}">Start the form →</a>
            <p style="font-size:13px;color:#6B7280">This link is personal to you and valid for 72 hours.</p>
            <p style="font-size:12px;color:#6B7280;margin-top:24px;padding-top:16px;border-top:1px solid #E2E8F0">
              Any questions? Reply to this email or contact me directly.<br/>
              <strong>${brokerEmail}</strong>
            </p>
          </div>
        </div>`,
    });
    if (emailError) {
      console.error("[add-class] Resend error:", clientRecord.contact_email, emailError);
    }
  } else {
    console.warn("[add-class] RESEND_API_KEY not set — skipping email");
  }

  const magicUrl = `${APP_URL}/invite/${plainToken}`;

  if (userRecord?.tenant_id) {
    await logAuditEvent({ tenantId: userRecord.tenant_id, userId: user.id, submissionId: newSub.id, eventType: "submission.created", eventDetail: { client_id: body.client_id, class_of_business: body.class_of_business }, request: req });
    await logAuditEvent({ tenantId: userRecord.tenant_id, userId: user.id, submissionId: newSub.id, eventType: "magic_link.sent", eventDetail: { client_id: body.client_id }, request: req });
  }

  return json({ ok: true, submission_id: newSub.id, magicUrl }, 200);
}
