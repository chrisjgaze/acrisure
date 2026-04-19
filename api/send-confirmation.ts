export const config = { runtime: "edge" };

import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { logAuditEvent } from "./_audit";
import { getTenantBranding, emailStyles } from "./_branding";

interface ConfirmationBody {
  submission_id: string;
  pdf_base64?: string;
  pdf_filename?: string;
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

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") return json({ error: "Method Not Allowed" }, 405);

  try {
    const body = (await req.json()) as ConfirmationBody;
    const { submission_id, pdf_base64, pdf_filename } = body;

    if (!submission_id) {
      return json({ error: "Missing required fields" }, 400);
    }

    const supabase = getServiceClient();

    const CLASS_LABELS: Record<string, string> = {
      trade_credit: "trade credit insurance",
      cyber:        "cyber insurance",
      dno:          "Directors & Officers insurance",
      terrorism:    "terrorism insurance",
    };

    // Fetch submission + company details
    const [{ data: sub }, { data: company }] = await Promise.all([
      supabase
        .from("submissions")
        .select("reference, submitted_at, status, class_of_business, tenant_id")
        .eq("id", submission_id)
        .single(),
      supabase
        .from("submission_company")
        .select("contact_name, contact_email, company_name, contact_position")
        .eq("submission_id", submission_id)
        .maybeSingle(),
    ]);

    if (!sub || sub.status !== "submitted") {
      return json({ error: "Submission not found or not yet submitted" }, 404);
    }

    const contactEmail = company?.contact_email;
    if (!contactEmail) {
      return json({ error: "No contact email on record" }, 400);
    }

    const contactName  = company?.contact_name  ?? "there";
    const companyName  = company?.company_name  ?? "";
    const reference    = sub.reference ?? submission_id;
    const classLabel   = CLASS_LABELS[sub.class_of_business ?? ""] ?? (sub.class_of_business ?? "insurance");
    const submittedAt  = sub.submitted_at
      ? new Date(sub.submitted_at).toLocaleDateString("en-GB", {
          day: "numeric", month: "long", year: "numeric",
        }) +
        " at " +
        new Date(sub.submitted_at).toLocaleTimeString("en-GB", {
          hour: "2-digit", minute: "2-digit",
        })
      : "";

    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) {
      console.warn("[api/send-confirmation] RESEND_API_KEY not set — skipping email");
      return json({ ok: true, skipped: true }, 200);
    }

    const resend = new Resend(resendKey);

    const { logoUrl, primaryColour, tenantName } = await getTenantBranding(sub.tenant_id ?? "");
    const { headerStyle, bodyStyle }             = emailStyles(primaryColour);

    const { error: emailError } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev",
      to: contactEmail,
      subject: `Proposal submitted — reference ${reference}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #111827;">
          <div style="${headerStyle}">
            <img src="${logoUrl}" alt="${tenantName}" style="height:32px;width:auto;display:block;" />
          </div>
          <div style="${bodyStyle}">
            <h2 style="color: ${primaryColour}; margin-top: 0;">Your proposal has been submitted</h2>
            <p>Hi ${contactName},</p>
            <p>Thank you — your ${classLabel} proposal${companyName ? ` for <strong>${companyName}</strong>` : ""} has been successfully submitted.</p>
            <div style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 6px; padding: 16px 20px; margin: 24px 0;">
              <p style="margin: 0 0 4px 0; font-size: 12px; color: #6B7280; text-transform: uppercase; letter-spacing: 0.05em;">Reference</p>
              <p style="margin: 0; font-size: 22px; font-weight: bold; color: ${primaryColour}; font-family: monospace; letter-spacing: 0.1em;">${reference}</p>
              ${submittedAt ? `<p style="margin: 8px 0 0 0; font-size: 12px; color: #6B7280;">Submitted ${submittedAt}</p>` : ""}
            </div>
            ${pdf_base64 ? `<p>A copy of your completed proposal is attached to this email for your records.</p>` : ""}
            <h3 style="color: ${primaryColour};">What happens next</h3>
            <p>Your broker will review your proposal and be in touch shortly to discuss next steps for your cover.</p>
            <hr style="border: none; border-top: 1px solid #E2E8F0; margin: 24px 0;" />
            <p style="font-size: 12px; color: #6B7280; margin: 0;">
              This email was sent by Acrisure UK on behalf of your broker.
              If you have any questions, please contact your broker directly.
            </p>
          </div>
        </div>
      `,
      ...(pdf_base64
        ? {
            attachments: [
              {
                filename: pdf_filename || `${reference}.pdf`,
                content: pdf_base64,
              },
            ],
          }
        : {}),
    });

    if (emailError) {
      console.error("[api/send-confirmation] email send error:", emailError);
      return json({ error: "Failed to send email", detail: emailError }, 500);
    }

    if (sub.tenant_id) {
      await logAuditEvent({ tenantId: sub.tenant_id, submissionId: submission_id, eventType: "submission.submitted", eventDetail: { reference, class_of_business: sub.class_of_business, company_name: companyName }, request: req });
    }

    return json({ ok: true }, 200);
  } catch (err) {
    console.error("[api/send-confirmation] unhandled:", err);
    return json({ error: "Internal server error" }, 500);
  }
}
