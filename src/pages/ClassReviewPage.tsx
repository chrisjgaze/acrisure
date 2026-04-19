import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import FormShell from "@/components/FormShell";
import FormCard from "@/components/FormCard";
import FormInput from "@/components/FormInput";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

type ClassKey = "cyber" | "dno" | "terrorism";

const CLASS_META: Record<ClassKey, {
  label: string;
  steps: string[];
  stepRoutes: string[];
  backRoute: string;
}> = {
  cyber: {
    label: "Cyber Insurance",
    steps: ["Company", "Cyber Details", "Declaration"],
    stepRoutes: ["/form/company-contact", "/form/cyber", "/form/class-review/cyber"],
    backRoute: "/form/cyber",
  },
  dno: {
    label: "Directors & Officers",
    steps: ["Company", "D&O Details", "Declaration"],
    stepRoutes: ["/form/company-contact", "/form/dno", "/form/class-review/dno"],
    backRoute: "/form/dno",
  },
  terrorism: {
    label: "Terrorism Insurance",
    steps: ["Company", "Property Details", "Declaration"],
    stepRoutes: ["/form/company-contact", "/form/terrorism", "/form/class-review/terrorism"],
    backRoute: "/form/terrorism",
  },
};

const ClassReviewPage: React.FC = () => {
  const { classKey } = useParams<{ classKey: string }>();
  const navigate = useNavigate();
  const submissionId = sessionStorage.getItem("ff_submission_id");

  const meta = CLASS_META[classKey as ClassKey];

  useEffect(() => {
    if (!submissionId || !meta) navigate("/form/classes", { replace: true });
  }, [submissionId, meta, navigate]);

  const [agreed, setAgreed] = useState(false);
  const [sigName, setSigName] = useState("");
  const [sigPosition, setSigPosition] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [additionalClasses, setAdditionalClasses] = useState<string[]>([]);
  const [suggestedClasses, setSuggestedClasses] = useState<{ key: string; label: string; time: string }[]>([]);

  const clientId = sessionStorage.getItem("ff_client_id");

  useEffect(() => {
    const cached = sessionStorage.getItem("ff_submissions");
    const existing = new Set<string>();
    if (cached) {
      try {
        (JSON.parse(cached) as { class_of_business: string }[]).forEach((s) => existing.add(s.class_of_business));
      } catch { /* ignore */ }
    }
    const ALL: Array<{ key: string; label: string; time: string }> = [
      { key: "trade_credit", label: "Trade Credit Insurance",   time: "2–3 minutes" },
      { key: "cyber",        label: "Cyber Insurance",          time: "2–3 minutes" },
      { key: "dno",          label: "Directors & Officers",     time: "3–4 minutes" },
      { key: "terrorism",    label: "Terrorism Insurance",      time: "1–2 minutes" },
    ];
    setSuggestedClasses(ALL.filter((c) => !existing.has(c.key)));
  }, []);

  const today = new Date().toLocaleDateString("en-GB", {
    day: "numeric", month: "long", year: "numeric",
  });

  const canSubmit = agreed && sigName.trim() !== "" && sigPosition.trim() !== "";

  useEffect(() => {
    if (!submissionId) return;
    const load = async () => {
      const { data } = await supabase
        .from("submission_company")
        .select("company_name, contact_name, contact_position")
        .eq("submission_id", submissionId)
        .maybeSingle();
      // Pre-fill signatory from existing company data if available
      // For supplementary classes, fetch company from trade credit submission
      if (!data) {
        // Try to get from another submission for same client
        const clientId = sessionStorage.getItem("ff_client_id");
        if (clientId) {
          const { data: anyCompany } = await supabase
            .from("submission_company")
            .select("company_name, contact_name, contact_position")
            .in("submission_id", (
              await supabase
                .from("submissions")
                .select("id")
                .eq("client_id", clientId)
            ).data?.map((s) => s.id) ?? [])
            .not("company_name", "is", null)
            .limit(1)
            .maybeSingle();
          if (anyCompany) {
            setCompanyName(anyCompany.company_name ?? "");
            setSigName(anyCompany.contact_name ?? "");
            setSigPosition(anyCompany.contact_position ?? "");
          }
        }
      } else {
        setCompanyName(data.company_name ?? "");
        setSigName(data.contact_name ?? "");
        setSigPosition(data.contact_position ?? "");
      }
    };
    load();
  }, [submissionId]);

  const handleSubmit = async () => {
    if (!canSubmit || !submissionId) return;
    setSubmitting(true);
    try {
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

      toast.success(`${meta?.label} proposal submitted`);

      // If additional classes were selected, add them via the API
      if (additionalClasses.length > 0) {
        await Promise.all(
          additionalClasses.map((cls) =>
            fetch("/api/client-add-class", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ client_id: clientId, submission_id: submissionId, class_of_business: cls }),
            })
          )
        );
        // Refresh submissions list
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

      // No additional classes — update submissions list and go back to class picker
      const cached = sessionStorage.getItem("ff_submissions");
      if (cached) {
        const subs = JSON.parse(cached) as { id: string; status: string; completion_pct: number }[];
        const updated = subs.map((s) =>
          s.id === submissionId
            ? { ...s, status: "submitted", completion_pct: 100 }
            : s
        );
        sessionStorage.setItem("ff_submissions", JSON.stringify(updated));
      }

      navigate("/form/classes", { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit — please try again");
    } finally {
      setSubmitting(false);
    }
  };

  if (!meta) return null;

  return (
    <FormShell
      currentStep={2}
      completedSteps={[0, 1]}
      steps={meta.steps}
      stepRoutes={meta.stepRoutes}
      onBack={() => navigate(meta.backRoute)}
      showFooter={false}
    >
      <h1 className="mb-1">Review &amp; submit</h1>
      <p className="text-helper text-helper mb-6">
        You're almost done with your <strong>{meta.label}</strong> proposal
        {companyName ? ` for ${companyName}` : ""}.
      </p>

      <FormCard>
        {suggestedClasses.length > 0 && (
          <>
            <h3 className="mb-1">While you're here…</h3>
            <p className="text-helper text-helper mb-4">
              Would you like a quote for any of the following? We'll open the forms for you after you submit.
            </p>
            <div className="space-y-3 mb-6">
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
          </>
        )}
        <h3 className="mb-4">Declaration</h3>
        <div className="border border-silver rounded-lg p-4 bg-[#F9FAFB] mb-6 text-body leading-relaxed">
          <p className="mb-3">
            I/We declare that to the best of my/our knowledge and belief the answers given in
            this proposal form are true and complete. I/We understand that this proposal shall
            be the basis of the contract between me/us and the Insurer and that the policy will
            be voidable if I/we have made any misrepresentation or non-disclosure.
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
            I confirm that the information provided in this {meta.label} proposal is accurate
            to the best of my knowledge and I authorise my broker to approach the insurance
            market on my behalf.
          </span>
        </label>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
          <FormInput label="Full name" value={sigName} onChange={setSigName} required />
          <FormInput label="Position" value={sigPosition} onChange={setSigPosition} required />
        </div>

        <FormInput label="Date" value={today} readOnly className="max-w-[240px]" />

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
            `Submit ${meta.label} proposal`
          )}
        </Button>
      </FormCard>
    </FormShell>
  );
};

export default ClassReviewPage;
