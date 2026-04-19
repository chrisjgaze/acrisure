import React, { useState, useEffect } from "react";
import FormShell from "@/components/FormShell";
import FormCard from "@/components/FormCard";
import FormInput from "@/components/FormInput";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useStepCompletion } from "@/lib/formProgress";

interface ReviewData {
  companyName: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  postcode: string;
  country: string;
  companyRegNumber: string;
  formationDate: string | null;
  natureOfBusiness: string;
  contactName: string;
  contactPosition: string;
  contactEmail: string;
  currency: string;
  currentlyInsured: boolean | null;
  insurerName: string;
  hasInvoiceDiscounting: boolean | null;
  factoringCompany: string;
  buyerCount: number;
  hasOverdue: boolean;
}

const ReviewPage: React.FC = () => {
  const navigate = useNavigate();
  const submissionId = sessionStorage.getItem("ff_submission_id");

  useEffect(() => {
    if (!submissionId) navigate("/", { replace: true });
  }, [submissionId, navigate]);

  const isRenewalSync = parseInt(sessionStorage.getItem("ff_policy_year") ?? "0") > new Date().getFullYear();
  const { completedSteps } = useStepCompletion(submissionId, isRenewalSync);
  const [pageLoading, setPageLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [data, setData] = useState<ReviewData | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [sigName, setSigName] = useState("");
  const [sigPosition, setSigPosition] = useState("");
  const [additionalClasses, setAdditionalClasses] = useState<string[]>([]);
  const [suggestedClasses, setSuggestedClasses] = useState<{ key: string; label: string; time: string }[]>([]);

  const today = new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const canSubmit = agreed && sigName.trim() !== "" && sigPosition.trim() !== "";

  useEffect(() => {
    if (!submissionId) return;
    const load = async () => {
      const [
        { data: company },
        { data: financial },
        { data: buyers },
        { data: overdue },
      ] = await Promise.all([
        supabase.from("submission_company").select("*").eq("submission_id", submissionId).maybeSingle(),
        supabase.from("submission_financial").select("*").eq("submission_id", submissionId).maybeSingle(),
        supabase.from("submission_buyers").select("id").eq("submission_id", submissionId),
        supabase.from("submission_overdue_accounts").select("id").eq("submission_id", submissionId),
      ]);

      const formationDate = company?.formation_date
        ? new Date(company.formation_date).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })
        : null;

      setData({
        companyName: company?.company_name ?? "",
        addressLine1: company?.address_line1 ?? "",
        addressLine2: company?.address_line2 ?? "",
        city: company?.city ?? "",
        postcode: company?.postcode ?? "",
        country: company?.country ?? "",
        companyRegNumber: company?.company_reg_number ?? "",
        formationDate,
        natureOfBusiness: company?.nature_of_business ?? "",
        contactName: company?.contact_name ?? "",
        contactPosition: company?.contact_position ?? "",
        contactEmail: company?.contact_email ?? "",
        currency: financial?.currency ?? "",
        currentlyInsured: financial?.currently_insured ?? null,
        insurerName: financial?.insurer_name ?? "",
        hasInvoiceDiscounting: financial?.has_invoice_discounting ?? null,
        factoringCompany: financial?.factoring_company ?? "",
        buyerCount: buyers?.length ?? 0,
        hasOverdue: (overdue?.length ?? 0) > 0,
      });

      setPageLoading(false);
    };

    load();
  }, [submissionId]);

  useEffect(() => {
    const cached = sessionStorage.getItem("ff_submissions");
    const existing = new Set<string>();
    if (cached) {
      try {
        (JSON.parse(cached) as { class_of_business: string }[]).forEach((s) => existing.add(s.class_of_business));
      } catch { /* ignore */ }
    }
    const ALL = [
      { key: "cyber",     label: "Cyber Insurance",         time: "2–3 minutes" },
      { key: "dno",       label: "Directors & Officers",     time: "3–4 minutes" },
      { key: "terrorism", label: "Terrorism Insurance",      time: "1–2 minutes" },
    ];
    setSuggestedClasses(ALL.filter((c) => !existing.has(c.key)));
  }, []);

  const handleSubmit = async () => {
    if (!canSubmit || !submissionId) return;
    setSubmitting(true);

    try {
      const clientId = sessionStorage.getItem("ff_client_id") ?? "";
      const res = await fetch("/api/submissions/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId,
          clientId,
          signatureName: sigName,
          signaturePosition: sigPosition,
        }),
      });

      const result = await res.json() as {
        error?: { message?: string; details?: { missingSteps?: string[] } };
      };

      if (!res.ok) {
        const missing = result.error?.details?.missingSteps;
        if (missing?.length) {
          throw new Error(`Please complete: ${missing.join(", ")}`);
        }
        throw new Error(result.error?.message ?? "Failed to submit");
      }

      // Capture values BEFORE clearing sessionStorage
      const email = sessionStorage.getItem("ff_email") ?? "";
      const sid = submissionId;

      // If the client selected additional classes, add them via the API (copies company data)
      if (additionalClasses.length > 0) {
        await Promise.all(
          additionalClasses.map((cls) =>
            fetch("/api/client-add-class", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ client_id: clientId, submission_id: sid, class_of_business: cls }),
            })
          )
        );
        // Refresh sessionStorage with latest submissions
        const { data: refreshed } = await supabase
          .from("submissions")
          .select("id, class_of_business, status, completion_pct, policy_year, renewal_date, created_at, reference")
          .eq("client_id", clientId)
          .order("created_at", { ascending: false });
        if (refreshed) sessionStorage.setItem("ff_submissions", JSON.stringify(refreshed));
        sessionStorage.removeItem("ff_completed_steps");
        navigate("/form/classes", { replace: true });
        return;
      }

      sessionStorage.removeItem("ff_submission_id");
      sessionStorage.removeItem("ff_client_id");
      sessionStorage.removeItem("ff_email");
      sessionStorage.removeItem("ff_token");
      sessionStorage.removeItem("ff_completed_steps");
      sessionStorage.removeItem("ff_submissions");

      // Replace the review page in history so pressing back doesn't land on it
      // with a cleared session (which would immediately redirect to dashboard).
      navigate("/form/submitted", { replace: true, state: { submissionId: sid, email } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit — please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const SummarySection: React.FC<{
    title: string;
    step: string;
    children: React.ReactNode;
  }> = ({ title, step, children }) => (
    <FormCard className="relative">
      <div className="flex items-center justify-between mb-4">
        <h3>{title}</h3>
        <button
          onClick={() => navigate(step)}
          className="text-accent-blue text-helper hover:underline font-medium"
        >
          Edit →
        </button>
      </div>
      {children}
    </FormCard>
  );

  const SummaryRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] py-1.5 border-b border-silver/30 last:border-b-0">
      <span className="text-helper text-helper">{label}</span>
      <span className="text-body text-text-primary">{value || "—"}</span>
    </div>
  );

  if (pageLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 text-accent-blue animate-spin" />
      </div>
    );
  }

  const address = [
    data?.addressLine1,
    data?.addressLine2,
    data?.city,
    data?.postcode,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <FormShell
      currentStep={3}
      completedSteps={completedSteps}
      onBack={() => navigate("/form/customers")}
    >
      <h1 className="mb-1">Review your proposal</h1>
      <p className="text-helper text-helper mb-6">
        Please check everything below before submitting
      </p>

      <SummarySection title="Company details" step="/form/company">
        <SummaryRow label="Company name" value={data?.companyName ?? ""} />
        <SummaryRow label="Registered address" value={address} />
        <SummaryRow label="Registration number" value={data?.companyRegNumber ?? ""} />
        <SummaryRow label="Formation date" value={data?.formationDate ?? ""} />
        <SummaryRow label="Nature of business" value={data?.natureOfBusiness ?? ""} />
        <SummaryRow
          label="Contact"
          value={[data?.contactName, data?.contactPosition].filter(Boolean).join(", ")}
        />
        <SummaryRow label="Email" value={data?.contactEmail ?? ""} />
      </SummarySection>

      <SummarySection title="Financial profile" step="/form/financial">
        <SummaryRow label="Currency" value={data?.currency ?? ""} />
        <SummaryRow
          label="Insured for credit risks"
          value={
            data?.currentlyInsured === null
              ? "—"
              : data.currentlyInsured
              ? "Yes"
              : "No"
          }
        />
        {data?.currentlyInsured && (
          <SummaryRow label="Current insurer" value={data.insurerName} />
        )}
        <SummaryRow
          label="Invoice discounting"
          value={
            data?.hasInvoiceDiscounting === null
              ? "—"
              : data.hasInvoiceDiscounting
              ? "Yes"
              : "No"
          }
        />
        {data?.hasInvoiceDiscounting && (
          <SummaryRow label="Factoring company" value={data.factoringCompany} />
        )}
      </SummarySection>

      <SummarySection title="Your customers" step="/form/customers">
        <SummaryRow label="Total buyers" value={String(data?.buyerCount ?? 0)} />
        <SummaryRow label="Overdue accounts" value={data?.hasOverdue ? "Yes" : "No"} />
      </SummarySection>

      {/* Additional classes of business */}
      {suggestedClasses.length > 0 && (
        <FormCard>
          <h3 className="mb-1">While you're here…</h3>
          <p className="text-helper text-helper mb-4">
            Would you like a quote for any of the following? We'll open the forms for you after you submit.
          </p>
          <div className="space-y-3">
            {suggestedClasses.map(({ key, label, time }) => (
              <label key={key} className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={additionalClasses.includes(key)}
                  onChange={(e) => {
                    setAdditionalClasses((prev) =>
                      e.target.checked ? [...prev, key] : prev.filter((c) => c !== key)
                    );
                  }}
                  className="w-4 h-4 rounded border-silver text-navy focus:ring-accent-blue shrink-0"
                />
                <span className="text-body text-text-primary group-hover:text-navy">
                  {label}
                  <span className="text-helper text-slate-400 ml-2">+{time}</span>
                </span>
              </label>
            ))}
          </div>
        </FormCard>
      )}

      <FormCard>
        <h3 className="mb-4">Declaration</h3>
        <div className="border border-silver rounded-lg p-4 bg-[#F9FAFB] mb-6 text-body leading-relaxed">
          <p className="mb-3">
            I/We declare that to the best of my/our knowledge and belief the answers given in
            this proposal form are true and complete. I/We understand that this proposal shall
            be the basis of the contract between me/us and the Insurer and that the policy will
            be voidable if I/we have made any misrepresentation or non-disclosure.
          </p>
          <p className="mb-3">
            I/We authorise the Insurer, or its agents, to make such enquiries as they may
            consider necessary in connection with this proposal, including but not limited to
            credit reference agencies, Companies House, and any other relevant third party sources.
          </p>
          <p>
            I/We understand that cover will not be effective until the Insurer has accepted this
            proposal and issued a policy, and that any claim arising before such acceptance shall
            not be covered.
          </p>
        </div>

        <label className="flex items-start gap-3 mb-6 cursor-pointer">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="w-5 h-5 rounded border-silver text-navy focus:ring-accent-blue mt-0.5 shrink-0"
          />
          <span className="text-body text-text-primary">
            I confirm that the information provided in this proposal is accurate to the best of
            my knowledge and I authorise <strong>Acrisure UK</strong> to approach the insurance
            market on my behalf.
          </span>
        </label>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
          <FormInput label="Full name" value={sigName} onChange={setSigName} required />
          <FormInput label="Position" value={sigPosition} onChange={setSigPosition} required />
        </div>

        <FormInput
          label="Date"
          value={today}
          readOnly
          className="max-w-[240px]"
        />

        <Button
          size="full"
          disabled={!canSubmit || submitting}
          onClick={handleSubmit}
          className="mt-4"
        >
          {submitting ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Submitting…
            </span>
          ) : (
            "Submit proposal"
          )}
        </Button>

        <p className="text-helper text-helper text-center mt-2">
          By submitting you confirm you have read and agree to the declaration above.
        </p>
      </FormCard>
    </FormShell>
  );
};

export default ReviewPage;
