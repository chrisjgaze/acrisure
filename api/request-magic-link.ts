export const config = { runtime: "edge" };

import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { getTenantBranding, emailStyles } from "./_branding";
import { logAuditEvent } from "./_audit";

const APP_URL = (process.env.APP_URL ?? "${APP_URL}").replace(/\/$/, "");

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Always return the same message — never confirm or deny whether
// the email is on record (prevents email enumeration).
const NEUTRAL_OK = json({ ok: true }, 200);

function getServiceClient() {
  return createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function generateToken(): Promise<{ plain: string; hash: string }> {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const plain = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const hashBuffer = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(plain)
  );
  const hash = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return { plain, hash };
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") return json({ error: "Method Not Allowed" }, 405);

  try {
    const { email } = (await req.json()) as { email?: string };
    if (!email?.trim()) return NEUTRAL_OK;

    const supabase = getServiceClient();

    // Find the most recent non-submitted submission for this email
    const { data: clientRows } = await supabase
      .from("clients")
      .select(`
        id,
        tenant_id,
        display_name,
        contact_name,
        contact_email,
        submissions (
          id,
          status
        )
      `)
      .eq("contact_email", email.trim().toLowerCase())
      .order("created_at", { ascending: false })
      .limit(5);

    if (!clientRows?.length) return NEUTRAL_OK;

    // Find first client that has an in-progress or not-started submission
    let targetClientId: string | null = null;
    let targetSubmissionId: string | null = null;
    let targetContactName = "there";
    let targetCompanyName = "";
    let targetTenantId = "";

    for (const client of clientRows) {
      const activeSub = (client.submissions as { id: string; status: string }[])
        ?.find((s) => s.status !== "submitted" && s.status !== "referred");
      if (activeSub) {
        targetClientId = client.id;
        targetSubmissionId = activeSub.id;
        targetContactName = client.contact_name ?? "there";
        targetCompanyName = client.display_name ?? "";
        targetTenantId = (client as { tenant_id?: string }).tenant_id ?? "";
        break;
      }
    }

    if (!targetClientId || !targetSubmissionId) return NEUTRAL_OK;

    // Expire any existing unused tokens for this submission
    await supabase
      .from("magic_links")
      .update({ expires_at: new Date().toISOString() })
      .eq("submission_id", targetSubmissionId)
      .eq("used", false);

    // Generate fresh token (valid 72 hours)
    const { plain: plainToken, hash: tokenHash } = await generateToken();
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();

    const { error: insertError } = await supabase.from("magic_links").insert({
      client_id: targetClientId,
      submission_id: targetSubmissionId,
      email: email.trim().toLowerCase(),
      token_hash: tokenHash,
      expires_at: expiresAt,
    });

    if (insertError) {
      console.error("[api/request-magic-link] insert:", insertError);
      return NEUTRAL_OK; // still return neutral — don't leak internal errors
    }

    // Send email
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      const resend = new Resend(resendKey);
      const magicUrl = `${APP_URL}/invite/${plainToken}`;

      const { logoUrl, primaryColour, tenantName } = await getTenantBranding(targetTenantId);
      const { headerStyle, bodyStyle, btnStyle }   = emailStyles(primaryColour);

      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev",
        to: email.trim().toLowerCase(),
        subject: `Your link to complete ${targetCompanyName ? `the ${targetCompanyName} proposal` : "your proposal"}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#111827;">
            <div style="${headerStyle}">
              <img src="${logoUrl}" alt="${tenantName}" style="height:32px;width:auto;display:block;" />
            </div>
            <div style="${bodyStyle}">
              <p>Hi ${targetContactName},</p>
              <p>You requested a new link to access your insurance proposal form.</p>
              <p>Click below to continue where you left off. This link is valid for 72 hours.</p>
              <p><a href="${magicUrl}" style="${btnStyle}">Continue my proposal</a></p>
              <p>If you did not request this, you can safely ignore this email.</p>
              <hr style="border:none;border-top:1px solid #E2E8F0;margin:24px 0;" />
              <p style="font-size:12px;color:#6B7280;margin:0;">This email was sent by ${tenantName} on behalf of your broker.</p>
            </div>
          </div>
        `,
      });
    }

    if (targetTenantId) {
      await logAuditEvent({
        tenantId: targetTenantId,
        submissionId: targetSubmissionId,
        eventType: "magic_link.requested",
        eventDetail: { email: email.trim().toLowerCase() },
        request: req,
      });
    }

    return NEUTRAL_OK;
  } catch (err) {
    console.error("[api/request-magic-link] unhandled:", err);
    return NEUTRAL_OK; // always neutral to client
  }
}
