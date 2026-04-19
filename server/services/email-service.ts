import { Resend } from "resend";
import { getTenantBranding, emailStyles } from "../../api/_branding";
import { writeBusinessAuditEvent } from "../audit/audit-log";
import { getServiceSupabase } from "../integrations/supabase";

export async function sendSubmissionConfirmationEmail(input: {
  submissionId: string;
  request?: Request;
}) {
  const supabase = getServiceSupabase();
  const [{ data: sub }, { data: company }] = await Promise.all([
    supabase
      .from("submissions")
      .select("reference, submitted_at, status, class_of_business, tenant_id")
      .eq("id", input.submissionId)
      .single(),
    supabase
      .from("submission_company")
      .select("contact_name, contact_email, company_name")
      .eq("submission_id", input.submissionId)
      .maybeSingle(),
  ]);

  if (!sub || sub.status !== "submitted" || !company?.contact_email) {
    return { ok: false as const };
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return { ok: true as const, skipped: true };
  }

  const CLASS_LABELS: Record<string, string> = {
    trade_credit: "trade credit insurance",
    cyber: "cyber insurance",
    dno: "Directors & Officers insurance",
    terrorism: "terrorism insurance",
  };

  const resend = new Resend(resendKey);
  const { logoUrl, primaryColour, tenantName } = await getTenantBranding(sub.tenant_id ?? "");
  const { headerStyle, bodyStyle } = emailStyles(primaryColour);

  const submittedAt = sub.submitted_at
    ? new Date(sub.submitted_at).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }) +
      " at " +
      new Date(sub.submitted_at).toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  const contactName = company.contact_name ?? "there";
  const reference = sub.reference ?? input.submissionId;
  const companyName = company.company_name ?? "";
  const classLabel =
    CLASS_LABELS[sub.class_of_business ?? ""] ?? (sub.class_of_business ?? "insurance");

  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev",
    to: company.contact_email,
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
          <h3 style="color: ${primaryColour};">What happens next</h3>
          <p>Your broker will review your proposal and be in touch shortly to discuss next steps for your cover.</p>
        </div>
      </div>
    `,
  });

  if (error) {
    if (sub.tenant_id) {
      await writeBusinessAuditEvent({
        tenantId: sub.tenant_id,
        submissionId: input.submissionId,
        eventType: "confirmation_email.failed",
        eventDetail: { detail: error },
        request: input.request,
      });
    }
    return { ok: false as const, error };
  }

  if (sub.tenant_id) {
    await writeBusinessAuditEvent({
      tenantId: sub.tenant_id,
      submissionId: input.submissionId,
      eventType: "confirmation_email.sent",
      eventDetail: { reference, class_of_business: sub.class_of_business },
      request: input.request,
    });
  }

  return { ok: true as const };
}
