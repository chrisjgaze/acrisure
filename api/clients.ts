export const config = { runtime: 'edge' };

import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { captureApiError } from "./_sentry";
import { logAuditEvent } from "./_audit";
import { getTenantBranding, emailStyles } from "./_branding";

interface CreateClientBody {
  display_name: string;
  contact_name: string;
  contact_email: string;
  class_of_business?: string;
}

function json(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const APP_URL = (process.env.APP_URL ?? "${APP_URL}").replace(/\/$/, "");

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

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return json({ error: "Method Not Allowed" }, 405);
  }

  try {
    const body = (await req.json()) as CreateClientBody;

    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace(/^Bearer\s+/i, "").trim();

    if (!token) {
      return json({ error: "Unauthorised: no token provided" }, 401);
    }

    // Verify the caller's Supabase session
    const anonClient = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.VITE_SUPABASE_ANON_KEY!,
    );

    const {
      data: { user },
      error: authError,
    } = await anonClient.auth.getUser(token);

    if (authError || !user) {
      return json({ error: "Unauthorised: invalid session" }, 401);
    }

    const supabase = getServiceClient();

    const policyYear = new Date().getFullYear();

    // Resolve the authenticated broker's tenant_id
    const { data: userRecord, error: userError } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (userError || !userRecord?.tenant_id) {
      console.error("[api/clients] tenant lookup:", userError);
      return json({ error: "Could not resolve tenant" }, 403);
    }

    const tenantId = userRecord.tenant_id as string;

    const classOfBusiness = body.class_of_business ?? "trade_credit";

    // Insert the client record — assigned_broker_id is always the authenticated user
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .insert({
        display_name: body.display_name,
        contact_name: body.contact_name,
        contact_email: body.contact_email,
        assigned_broker_id: user.id,
        tenant_id: tenantId,
      })
      .select("id")
      .single();

    if (clientError || !client) {
      console.error("[api/clients] client insert:", clientError);
      return json({ error: "Failed to create client" }, 500);
    }

    // Generate reference number via SQL function, with fallback
    const { data: refData, error: refError } = await supabase.rpc(
      "generate_reference",
      { year: policyYear },
    );

    if (refError) {
      console.warn("[api/clients] generate_reference fallback:", refError.message);
    }

    const reference =
      !refError && refData
        ? (refData as string)
        : `CR-${policyYear}-${String(Math.floor(Math.random() * 99999)).padStart(5, "0")}`;

    // Insert the submission record
    const { data: submission, error: submissionError } = await supabase
      .from("submissions")
      .insert({
        client_id: client.id,
        tenant_id: tenantId,
        status: "not_started",
        policy_year: policyYear,
        reference,
        class_of_business: classOfBusiness,
      })
      .select("id")
      .single();

    if (submissionError || !submission) {
      console.error("[api/clients] submission insert:", submissionError);
      return json({ error: "Failed to create submission" }, 500);
    }

    // Pre-populate submission_company with the known details so the form
    // loads with company name, contact name and email already filled in.
    await supabase.from("submission_company").insert({
      submission_id: submission.id,
      contact_name: body.contact_name,
      contact_email: body.contact_email,
    });

    // Generate 32-byte token via Web Crypto; store only the SHA-256 hash
    const { plain: plainToken, hash: tokenHash } = await generateToken();
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();

    const { error: magicError } = await supabase.from("magic_links").insert({
      client_id: client.id,
      submission_id: submission.id,
      email: body.contact_email,
      token_hash: tokenHash,
      expires_at: expiresAt,
    });

    if (magicError) {
      console.error("[api/clients] magic_link insert:", magicError);
      return json({ error: "Failed to create magic link" }, 500);
    }

    // Send invitation email via Resend
    const resendKey = process.env.RESEND_API_KEY;

    if (resendKey) {
      const resend = new Resend(resendKey);
      const magicUrl    = `${APP_URL}/invite/${plainToken}`;
      const brokerName  = user.email ?? "Your broker";
      const brokerEmail = user.email ?? "";

      const { logoUrl, primaryColour, tenantName } = await getTenantBranding(tenantId);
      const { headerStyle, bodyStyle, btnStyle }   = emailStyles(primaryColour);
      const footerStyle = `font-size:12px;color:#6B7280;margin-top:24px;padding-top:16px;border-top:1px solid #E2E8F0`;

      const CLASS_LABELS: Record<string, string> = {
        trade_credit: "Trade Credit Insurance",
        cyber:        "Cyber Insurance",
        dno:          "Directors & Officers",
        terrorism:    "Terrorism Insurance",
      };
      const CLASS_TIME: Record<string, string> = {
        trade_credit: "15–20 minutes",
        cyber:        "2–3 minutes",
        dno:          "3–4 minutes",
        terrorism:    "1–2 minutes",
      };
      const classLabel = CLASS_LABELS[classOfBusiness] ?? classOfBusiness.replace(/_/g, " ");
      const classTime  = CLASS_TIME[classOfBusiness] ?? "a few minutes";

      const { error: emailError } = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev",
        to: body.contact_email,
        subject: `Your ${classLabel} proposal — ${body.display_name}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#111827">
            <div style="${headerStyle}">
              <img src="${logoUrl}" alt="${tenantName}" style="height:32px;width:auto;display:block;" />
            </div>
            <div style="${bodyStyle}">
              <h2 style="color:${primaryColour};margin-top:0">Complete your ${classLabel} proposal online</h2>
              <p>Hi ${body.contact_name},</p>
              <p>
                I've set you up on our online proposal system for your <strong>${classLabel}</strong>
                for <strong>${body.display_name}</strong>.
                It should only take around <strong>${classTime}</strong> to complete, and you can save your
                progress and return at any time.
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
      });

      if (emailError) {
        console.error("[api/clients] email send:", emailError);
      }
    } else {
      console.warn("[api/clients] RESEND_API_KEY not set — email not sent");
    }

    const magicUrl = `${APP_URL}/invite/${plainToken}`;

    await logAuditEvent({ tenantId, userId: user.id, submissionId: submission.id, eventType: "client.created", eventDetail: { client_id: client.id, display_name: body.display_name, class_of_business: body.class_of_business ?? "trade_credit" }, request: req });
    await logAuditEvent({ tenantId, userId: user.id, submissionId: submission.id, eventType: "magic_link.sent", eventDetail: { client_id: client.id, email: body.contact_email }, request: req });

    return json({ clientId: client.id, submissionId: submission.id, magicUrl }, 201);
  } catch (err) {
    console.error("[api/clients] unhandled:", err);
    captureApiError(err, { route: "api/clients" });
    return json({ error: "Internal server error" }, 500);
  }
}
