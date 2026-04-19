export const config = { runtime: "edge" };

import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { captureApiError } from "./_sentry";
import { logAuditEvent } from "./_audit";
import { getTenantBranding, emailStyles } from "./_branding";

interface InitiateRenewalBody {
  client_id: string;
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

function generateReference(tenantId: string): string {
  const year = new Date().getFullYear();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  const prefix = tenantId.substring(0, 4).toUpperCase();
  return `${prefix}-${year}-${rand}`;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return json({ error: "Method Not Allowed" }, 405);
  }

  try {
    const body = (await req.json()) as InitiateRenewalBody;
    const classOfBusiness = body.class_of_business ?? "trade_credit";

    const CLASS_LABELS: Record<string, string> = {
      trade_credit: "Trade Credit Insurance",
      cyber:        "Cyber Insurance",
      dno:          "Directors & Officers",
      terrorism:    "Terrorism Insurance",
    };
    const classLabel = CLASS_LABELS[classOfBusiness] ?? classOfBusiness.replace(/_/g, " ");

    // Authenticate broker
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

    const brokerName  = user.email ?? "Your broker";
    const brokerEmail = user.email ?? "";

    // Fetch client
    const { data: clientRecord, error: clientError } = await supabase
      .from("clients")
      .select("id, display_name, contact_name, contact_email, tenant_id")
      .eq("id", body.client_id)
      .eq("tenant_id", userRecord.tenant_id)
      .single();

    if (clientError || !clientRecord) return json({ error: "Client not found" }, 404);

    // Create new submission for the upcoming policy year
    const policyYear = new Date().getFullYear() + 1;
    const reference  = generateReference(userRecord.tenant_id);

    const { data: newSub, error: subError } = await supabase
      .from("submissions")
      .insert({
        client_id:          body.client_id,
        tenant_id:          userRecord.tenant_id,
        class_of_business:  classOfBusiness,
        status:             "not_started",
        completion_pct:     0,
        reference,
        policy_year:        policyYear,
      })
      .select("id")
      .single();

    if (subError || !newSub) {
      console.error("[api/initiate-renewal] submission insert:", subError);
      return json({ error: "Failed to create renewal submission" }, 500);
    }

    // Find the most recent submitted submission for this client + class to copy from
    const { data: prevSub } = await supabase
      .from("submissions")
      .select("id, renewal_date")
      .eq("client_id", body.client_id)
      .eq("class_of_business", classOfBusiness)
      .eq("status", "submitted")
      .neq("id", newSub.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Pre-set renewal_date on the new submission to prev renewal_date + 1 year
    if (prevSub?.renewal_date) {
      const d = new Date(prevSub.renewal_date);
      d.setFullYear(d.getFullYear() + 1);
      const prefillDate = d.toISOString().split("T")[0];
      await supabase.from("submissions").update({ renewal_date: prefillDate }).eq("id", newSub.id);
    }

    if (prevSub) {
      // ── submission_company: copy everything except contact fields ──
      const { data: prevCompany } = await supabase
        .from("submission_company").select("*").eq("submission_id", prevSub.id).maybeSingle();
      if (prevCompany) {
        const { id: _id, submission_id: _sid, created_at: _ca, updated_at: _ua,
          contact_name: _cn, contact_email: _ce,
          ...companyFields } = prevCompany;
        await supabase.from("submission_company").insert({
          ...companyFields,
          submission_id:     newSub.id,
          contact_name:      clientRecord.contact_name ?? prevCompany.contact_name,
          contact_email:     clientRecord.contact_email ?? prevCompany.contact_email,
          // contact_position and contact_telephone carried over from previous submission
        });
      }

      // ── submission_financial: copy trading structure (not financial figures) ──
      const { data: prevFinancial } = await supabase
        .from("submission_financial").select("*").eq("submission_id", prevSub.id).maybeSingle();
      if (prevFinancial) {
        const { id: _id, submission_id: _sid, created_at: _ca, updated_at: _ua, ...financialFields } = prevFinancial;
        await supabase.from("submission_financial").insert({ ...financialFields, submission_id: newSub.id });
      }

      // ── submission_buyers: copy buyer list with credit limits as starting point ──
      const { data: prevBuyers } = await supabase
        .from("submission_buyers").select("*").eq("submission_id", prevSub.id).order("sort_order");
      if (prevBuyers?.length) {
        const buyerRows = prevBuyers.map(({ id: _id, submission_id: _sid, created_at: _ca, updated_at: _ua, import_batch_id: _ib, ...b }) => ({
          ...b, submission_id: newSub.id,
        }));
        await supabase.from("submission_buyers").insert(buyerRows);
      }

      // ── submission_loss_history: shift years forward by 1 ──
      // The top row (sort_order 0) is the current-year estimate — leave it empty for the client.
      // Rows 1–4 carry over the prior year's rows 0–3 (true historical data is unchanged).
      const { data: prevLoss } = await supabase
        .from("submission_loss_history").select("*").eq("submission_id", prevSub.id).order("sort_order");
      if (prevLoss?.length) {
        const lossRows = prevLoss
          .filter((r) => (r.sort_order ?? 0) < 4)   // take 4 most-recent years only
          .map(({ id: _id, submission_id: _sid, created_at: _ca, ...l }) => ({
            ...l,
            submission_id: newSub.id,
            sort_order: (l.sort_order ?? 0) + 1,    // shift down one slot; slot 0 stays empty
          }));
        if (lossRows.length) await supabase.from("submission_loss_history").insert(lossRows);
      }

      // ── Class-specific tables ──
      if (classOfBusiness === "cyber") {
        const { data: prev } = await supabase.from("submission_cyber").select("*").eq("submission_id", prevSub.id).maybeSingle();
        if (prev) {
          const { id: _id, submission_id: _sid, created_at: _ca, updated_at: _ua, ...fields } = prev;
          await supabase.from("submission_cyber").insert({ ...fields, submission_id: newSub.id });
        }
      } else if (classOfBusiness === "dno") {
        const { data: prev } = await supabase.from("submission_dno").select("*").eq("submission_id", prevSub.id).maybeSingle();
        if (prev) {
          const { id: _id, submission_id: _sid, created_at: _ca, updated_at: _ua, ...fields } = prev;
          await supabase.from("submission_dno").insert({ ...fields, submission_id: newSub.id });
        }
      } else if (classOfBusiness === "terrorism") {
        const { data: prev } = await supabase.from("submission_terrorism").select("*").eq("submission_id", prevSub.id).maybeSingle();
        if (prev) {
          const { id: _id, submission_id: _sid, created_at: _ca, updated_at: _ua, ...fields } = prev;
          await supabase.from("submission_terrorism").insert({ ...fields, submission_id: newSub.id });
        }
      }
    } else {
      // No prior submission — just pre-fill contact details
      await supabase.from("submission_company").insert({
        submission_id: newSub.id,
        contact_name:  clientRecord.contact_name,
        contact_email: clientRecord.contact_email,
      });
    }

    // Expire any existing unused magic links for this client
    await supabase
      .from("magic_links")
      .update({ expires_at: new Date().toISOString() })
      .eq("client_id", body.client_id)
      .is("used_at", null);

    // Generate a fresh 72-hour magic link
    const { plain: plainToken, hash: tokenHash } = await generateToken();
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();

    const { error: magicError } = await supabase.from("magic_links").insert({
      client_id:     body.client_id,
      submission_id: newSub.id,
      email:         clientRecord.contact_email,
      token_hash:    tokenHash,
      expires_at:    expiresAt,
    });

    if (magicError) {
      console.error("[api/initiate-renewal] magic_link insert:", magicError);
      return json({ error: "Failed to create magic link" }, 500);
    }

    // Send renewal invite email
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      const resend   = new Resend(resendKey);
      const magicUrl = `${APP_URL}/invite/${plainToken}`;

      const { logoUrl, primaryColour, tenantName } = await getTenantBranding(userRecord.tenant_id);
      const { headerStyle, bodyStyle, btnStyle }   = emailStyles(primaryColour);
      const footerStyle = `font-size:12px;color:#6B7280;margin-top:24px;padding-top:16px;border-top:1px solid #E2E8F0`;

      const subject = `Your ${policyYear} ${classLabel} renewal — ${clientRecord.display_name}`;
      const html = `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#111827">
          <div style="${headerStyle}">
            <img src="${logoUrl}" alt="${tenantName}" style="height:32px;width:auto;display:block;" />
          </div>
          <div style="${bodyStyle}">
            <h2 style="color:${primaryColour};margin-top:0">Time to renew your ${classLabel}</h2>
            <p>Hi ${clientRecord.contact_name},</p>
            <p>
              It's time to renew your <strong>${classLabel}</strong> for <strong>${policyYear}</strong>.
              I've set up your renewal form — it should only take a few minutes as we've kept
              your previous details where possible.
            </p>
            <p>Click the button below to review and complete your renewal:</p>
            <a href="${magicUrl}" style="${btnStyle}">Start your renewal →</a>
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
      `;

      const { error: emailError } = await resend.emails.send({
        from:    process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev",
        to:      clientRecord.contact_email,
        subject,
        html,
      });

      if (emailError) console.error("[api/initiate-renewal] email send:", emailError);
    }

    await logAuditEvent({ tenantId: userRecord.tenant_id, userId: user.id, submissionId: newSub.id, eventType: "submission.renewal_initiated", eventDetail: { client_id: body.client_id, class_of_business: classOfBusiness }, request: req });
    await logAuditEvent({ tenantId: userRecord.tenant_id, userId: user.id, submissionId: newSub.id, eventType: "magic_link.sent", eventDetail: { client_id: body.client_id, email: clientRecord.contact_email }, request: req });

    return json({ ok: true, submission_id: newSub.id }, 200);
  } catch (err) {
    console.error("[api/initiate-renewal] unhandled:", err);
    captureApiError(err, { route: "api/initiate-renewal" });
    return json({ error: "Internal server error" }, 500);
  }
}
