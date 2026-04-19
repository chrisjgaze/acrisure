import React, { useState, useEffect, useRef, useCallback } from "react";
import FormShell from "@/components/FormShell";
import FormCard from "@/components/FormCard";
import FormInput from "@/components/FormInput";
import DateInput from "@/components/DateInput";
import ToggleGroup from "@/components/ToggleGroup";
import SlideReveal from "@/components/SlideReveal";
import { Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { useStepCompletion } from "@/lib/formProgress";

const tradingQuestions = [
  { key: "has_seasonal_peaks", detailKey: "seasonal_peaks_detail", label: "Are there any seasonal peaks in your business?" },
  { key: "has_consignment_stock", detailKey: "consignment_stock_detail", label: "Do you have consignment of stock?" },
  { key: "has_long_term_contracts", detailKey: "long_term_contracts_detail", label: "Do you have any long term contracts (over 6 months)?" },
  { key: "has_contra_payments", detailKey: "contra_payments_detail", label: "Do you contra or offset payments?" },
  { key: "has_paid_when_paid", detailKey: "paid_when_paid_detail", label: "Do you have paid when paid contracts?" },
  { key: "has_wip_pre_credit", detailKey: "wip_pre_credit_detail", label: "Do you work on a work-in-progress or pre-credit risk basis?" },
  { key: "has_retention_of_title", detailKey: "retention_of_title_detail", label: "Do you have an all monies retention of title clause?" },
  { key: "has_work_on_site", detailKey: "work_on_site_detail", label: "Do you work on site?" },
];

const TradingArrangementsPage: React.FC = () => {
  const navigate = useNavigate();
  const submissionId = sessionStorage.getItem("ff_submission_id");

  useEffect(() => {
    if (!submissionId) navigate("/", { replace: true });
  }, [submissionId, navigate]);

  const [pageLoading, setPageLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isRenewalSync = parseInt(sessionStorage.getItem("ff_policy_year") ?? "0") > new Date().getFullYear();
  const { completedSteps, refresh: refreshSteps } = useStepCompletion(submissionId, isRenewalSync);

  const [invoicingDeadline, setInvoicingDeadline] = useState("");
  const [creditProvider, setCreditProvider] = useState("");
  const [creditExpiry, setCreditExpiry] = useState({ day: "", month: "", year: "" });
  const [hasInsurance, setHasInsurance] = useState<boolean | null>(null);
  const [insuranceCompany, setInsuranceCompany] = useState("");
  const [renewalDate, setRenewalDate] = useState({ day: "", month: "", year: "" });
  const [hasFactoring, setHasFactoring] = useState<boolean | null>(null);
  const [factoringCompany, setFactoringCompany] = useState("");
  const [factoringNotice, setFactoringNotice] = useState("");
  const [tradingAnswers, setTradingAnswers] = useState<(boolean | null)[]>(
    Array(tradingQuestions.length).fill(null)
  );
  const [tradingDetails, setTradingDetails] = useState<string[]>(
    Array(tradingQuestions.length).fill("")
  );

  useEffect(() => {
    if (!submissionId) return;
    const load = async () => {
      const [{ data, error }] = await Promise.all([
        supabase.from("submission_financial").select("*").eq("submission_id", submissionId!).maybeSingle(),
      ]);
      if (error) {
        toast.error("Failed to load saved data");
      } else if (data) {
        setInvoicingDeadline(data.invoicing_deadline ?? "");
        setCreditProvider(data.credit_status_provider ?? "");
        if (data.credit_status_expiry) {
          const [y, m, d] = data.credit_status_expiry.split("-");
          setCreditExpiry({ year: y, month: m, day: d });
        }
        setHasInsurance(data.currently_insured ?? null);
        setInsuranceCompany(data.insurer_name ?? "");
        if (data.insurer_renewal_date) {
          const [y, m, d] = data.insurer_renewal_date.split("-");
          setRenewalDate({ year: y, month: m, day: d });
        }
        setHasFactoring(data.has_invoice_discounting ?? null);
        setFactoringCompany(data.factoring_company ?? "");
        setFactoringNotice(data.factoring_notice_period ?? "");

        const answers = tradingQuestions.map((q) => data[q.key] ?? null);
        const details = tradingQuestions.map((q) => data[q.detailKey] ?? "");
        setTradingAnswers(answers);
        setTradingDetails(details);
      }
      setPageLoading(false);
    };
    load();
  }, [submissionId]);

  const save = useCallback(async () => {
    if (!submissionId) return;
    setSaving(true);

    const creditExpiryIso = creditExpiry.year && creditExpiry.month && creditExpiry.day
      ? `${creditExpiry.year}-${creditExpiry.month.padStart(2, "0")}-${creditExpiry.day.padStart(2, "0")}` : null;
    const renewalDateIso = renewalDate.year && renewalDate.month && renewalDate.day
      ? `${renewalDate.year}-${renewalDate.month.padStart(2, "0")}-${renewalDate.day.padStart(2, "0")}` : null;

    const payload: Record<string, unknown> = {
      submission_id: submissionId,
      invoicing_deadline: invoicingDeadline || null,
      credit_status_provider: creditProvider || null,
      credit_status_expiry: creditExpiryIso,
      currently_insured: hasInsurance,
      insurer_name: insuranceCompany || null,
      insurer_renewal_date: renewalDateIso,
      has_invoice_discounting: hasFactoring,
      factoring_company: factoringCompany || null,
      factoring_notice_period: factoringNotice || null,
    };

    tradingQuestions.forEach((q, i) => {
      payload[q.key] = tradingAnswers[i];
      payload[q.detailKey] = tradingDetails[i] || null;
    });

    const { error } = await supabase
      .from("submission_financial")
      .upsert(payload, { onConflict: "submission_id" });

    if (error) toast.error("Failed to save");
    else {
      await Promise.all([
        supabase.from("submissions").update({ completion_pct: 50, last_activity: new Date().toISOString() }).eq("id", submissionId).lt("completion_pct", 50),
        supabase.from("submissions").update({ status: "in_progress" }).eq("id", submissionId).eq("status", "not_started"),
      ]);
      refreshSteps();
    }
    setSaving(false);
  }, [
    submissionId, invoicingDeadline, creditProvider, creditExpiry,
    hasInsurance, insuranceCompany, renewalDate, hasFactoring,
    factoringCompany, factoringNotice, tradingAnswers, tradingDetails,
  ]);

  useEffect(() => {
    if (pageLoading) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(save, 1000);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [save, pageLoading]);

  if (pageLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 text-accent-blue animate-spin" />
      </div>
    );
  }

  return (
    <FormShell
      currentStep={1}
      completedSteps={completedSteps}
      saving={saving}
      onBack={() => navigate("/form/financial")}
      onNext={() => navigate("/form/customers")}
    >
      <h1 className="mb-1">Financial profile</h1>
      <p className="text-helper text-helper mb-6">Part 2 of 2 — Trading arrangements</p>

      <FormCard title="Invoicing">
        <FormInput label="Invoicing deadline" value={invoicingDeadline} onChange={setInvoicingDeadline} helperText="The normal and maximum period between dispatch of goods or services and the date of your invoice" />
        <FormInput label="Credit status information provider" value={creditProvider} onChange={setCreditProvider} />
        <DateInput label="Credit status subscription expiry" value={creditExpiry} onChange={setCreditExpiry} />
      </FormCard>

      <FormCard title="Existing credit insurance">
        <div className="flex items-center justify-between mb-2">
          <span className="text-body text-text-primary">Are you currently insured for credit risks?</span>
          <ToggleGroup value={hasInsurance} onChange={setHasInsurance} />
        </div>
        <SlideReveal isOpen={hasInsurance === true}>
          <FormInput label="Insurance company name" value={insuranceCompany} onChange={setInsuranceCompany} />
          <DateInput label="Renewal date" value={renewalDate} onChange={setRenewalDate} />
        </SlideReveal>
      </FormCard>

      <FormCard title="Invoice discounting or factoring">
        <div className="flex items-center justify-between mb-2">
          <span className="text-body text-text-primary">Do you have an invoice discounting or factoring arrangement?</span>
          <ToggleGroup value={hasFactoring} onChange={setHasFactoring} />
        </div>
        <SlideReveal isOpen={hasFactoring === true}>
          <FormInput label="Company name" value={factoringCompany} onChange={setFactoringCompany} />
          <FormInput label="Anniversary date / notice period" value={factoringNotice} onChange={setFactoringNotice} />
        </SlideReveal>
      </FormCard>

      <FormCard title="Trading arrangements" description="Please indicate which of the following apply to your business">
        {tradingQuestions.map((q, i) => (
          <div key={i} className={i < tradingQuestions.length - 1 ? "border-b border-silver pb-4 mb-4" : ""}>
            <div className="flex items-center justify-between gap-4">
              <span className="text-body text-text-primary flex-1">{q.label}</span>
              <ToggleGroup
                value={tradingAnswers[i]}
                onChange={(v) => {
                  const next = [...tradingAnswers];
                  next[i] = v;
                  setTradingAnswers(next);
                }}
              />
            </div>
            <SlideReveal isOpen={tradingAnswers[i] === true}>
              <textarea
                value={tradingDetails[i]}
                onChange={(e) => {
                  const next = [...tradingDetails];
                  next[i] = e.target.value;
                  setTradingDetails(next);
                }}
                placeholder="Please give details"
                className="w-full min-h-[80px] p-3 text-body border border-silver rounded-md focus:outline-none focus:ring-2 focus:ring-accent-blue resize-y"
              />
            </SlideReveal>
          </div>
        ))}
      </FormCard>
    </FormShell>
  );
};

export default TradingArrangementsPage;