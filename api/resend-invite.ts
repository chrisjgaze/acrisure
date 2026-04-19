export const config = { runtime: "edge" };

import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { getTenantBranding, emailStyles } from "./_branding";

interface ResendInviteBody {
  client_id: string;
  submission_id: string;
  /** "invite" = first-time setup email; "reminder" = nudge to complete */
  mode?: "invite" | "reminder";
}

const APP_URL = (process.env.APP_URL ?? "${APP_URL}").replace(/\/$/, "");

function json(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function getServiceClient() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error("Missing env var: VITE_SUPABASE_URL");
  if (!key) throw new Error("Missing env var: SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function generateToken(): Promise<{ plain: string; hash: string }> {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const plain = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const hashBuffer = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(plain),
  );
  const hash = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return { plain, hash };
}

function buildEmailHtml(opts: {
  mode: "invite" | "reminder";
  contactName: string;
  companyName: string;
  brokerName: string;
  brokerEmail: string;
  magicUrl: string;
  logoUrl: string;
  primaryColour: string;
  tenantName: string;
  headerStyle: string;
  bodyStyle: string;
  btnStyle: string;
}): { subject: string; html: string } {
  const { mode, contactName, companyName, brokerName, brokerEmail, magicUrl,
          logoUrl, primaryColour, tenantName, headerStyle, bodyStyle, btnStyle } = opts;

  const footerStyle = `font-size:12px;color:#6B7280;margin-top:24px;padding-top:16px;border-top:1px solid #E2E8F0`;

  if (mode === "invite") {
    return {
      subject: `Your trade credit insurance proposal — ${companyName}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#111827">
          <div style="${headerStyle}">
            <img src="${logoUrl}" alt="${tenantName}" style="height:32px;width:auto;display:block;" />
          </div>
          <div style="${bodyStyle}">
            <h2 style="color:${primaryColour};margin-top:0">Complete your proposal online</h2>
            <p>Hi ${contactName},</p>
            <p>
              I've set you up on our online proposal system for your trade credit insurance.
              It should only take around 15–20 minutes to complete, and you can save your progress
              and return at any time.
            </p>
            <p>Click the button below to get started:</p>
            <a href="${magicUrl}" style="${btnStyle}">Start your proposal →</a>
            <p style="font-size:13px;color:#6B7280">
              This link is personal to you and valid for 72 hours.
              If it expires, you can request a new one from the login page.
            </p>
            <p style="${footerStyle}">
              Any questions? Feel free to reply to this email or contact me directly.<br/>
              <strong>${brokerName}</strong><br/>
              <a href="mailto:${brokerEmail}" style="color:${primaryColour}">${brokerEmail}</a>
            </p>
          </div>
        </div>
      `,
    };
  }

  // mode === "reminder"
  return {
    subject: `Reminder: your credit insurance proposal is waiting — ${companyName}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#111827">
        <div style="${headerStyle}">
          <img src="${logoUrl}" alt="${tenantName}" style="height:32px;width:auto;display:block;" />
        </div>
        <div style="${bodyStyle}">
          <h2 style="color:${primaryColour};margin-top:0">Just a quick reminder</h2>
          <p>Hi ${contactName},</p>
          <p>
            I wanted to follow up on the trade credit insurance proposal for
            <strong>${companyName}</strong>. It looks like there are still some
            sections to complete — I just wanted to make sure you hadn't got stuck
            or had any questions.
          </p>
          <p>You can pick up right where you left off using the link below:</p>
          <a href="${magicUrl}" style="${btnStyle}">Continue your proposal →</a>
          <p style="font-size:13px;color:#6B7280">
            This link is personal to you and valid for 72 hours.
            If it expires, you can request a new one from the login page.
          </p>
          <p style="${footerStyle}">
            If you have any questions or would like to discuss anything, please don't hesitate to get in touch.<br/>
            <strong>${brokerName}</strong><br/>
            <a href="mailto:${brokerEmail}" style="color:${primaryColour}">${brokerEmail}</a>
          </p>
        </div>
      </div>
    `,
  };
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return json({ error: "Method Not Allowed" }, 405);
  }

  try {
    const body = (await req.json()) as ResendInviteBody;
    const mode = body.mode ?? "invite";

    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace(/^Bearer\s+/i, "").trim();
    if (!token) return json({ error: "Unauthorised: no token provided" }, 401);

    const anonClient = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.VITE_SUPABASE_ANON_KEY!,
    );
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token);
    if (authError || !user) return json({ error: "Unauthorised: invalid session" }, 401);

    const supabase = getServiceClient();

    const { data: userRecord } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (!userRecord?.tenant_id) return json({ error: "Could not resolve tenant" }, 403);

    // Use the broker's login email as their display identity
    const brokerName  = user.email ?? "Your broker";
    const brokerEmail = user.email ?? "";

    const { data: clientRecord, error: clientError } = await supabase
      .from("clients")
      .select("id, display_name, contact_name, contact_email, tenant_id")
      .eq("id", body.client_id)
      .eq("tenant_id", userRecord.tenant_id)
      .single();

    if (clientError || !clientRecord) return json({ error: "Client not found" }, 404);

    // If the submission is lapsed, reactivate it before sending the link
    const { data: subData } = await supabase
      .from("submissions")
      .select("status, completion_pct")
      .eq("id", body.submission_id)
      .single();

    if (subData?.status === "lapsed") {
      const reviveStatus = (subData.completion_pct ?? 0) > 0 ? "in_progress" : "not_started";
      await supabase
        .from("submissions")
        .update({ status: reviveStatus })
        .eq("id", body.submission_id);
    }

    // Expire any existing unused tokens for this submission
    await supabase
      .from("magic_links")
      .update({ expires_at: new Date().toISOString() })
      .eq("submission_id", body.submission_id)
      .eq("used", false);

    // Generate a fresh 72-hour token
    const { plain: plainToken, hash: tokenHash } = await generateToken();
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();

    const { error: magicError } = await supabase.from("magic_links").insert({
      client_id: body.client_id,
      submission_id: body.submission_id,
      email: clientRecord.contact_email,
      token_hash: tokenHash,
      expires_at: expiresAt,
    });

    if (magicError) {
      console.error("[api/resend-invite] magic_link insert:", magicError);
      return json({ error: "Failed to create magic link" }, 500);
    }

    // Send email
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      const resend   = new Resend(resendKey);
      const magicUrl = `${APP_URL}/invite/${plainToken}`;

      const { logoUrl, primaryColour, tenantName } = await getTenantBranding(userRecord.tenant_id);
      const { headerStyle, bodyStyle, btnStyle }   = emailStyles(primaryColour);

      const { subject, html } = buildEmailHtml({
        mode,
        contactName:  clientRecord.contact_name,
        companyName:  clientRecord.display_name,
        brokerName,
        brokerEmail,
        magicUrl,
        logoUrl,
        primaryColour,
        tenantName,
        headerStyle,
        bodyStyle,
        btnStyle,
      });

      const { error: emailError } = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev",
        to: clientRecord.contact_email,
        subject,
        html,
      });

      if (emailError) console.error("[api/resend-invite] email send:", emailError);
    }

    return json({ ok: true }, 200);
  } catch (err) {
    console.error("[api/resend-invite] unhandled:", err);
    return json({ error: "Internal server error" }, 500);
  }
}
