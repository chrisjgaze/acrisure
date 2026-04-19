import React, { useState, useEffect, useRef, useCallback } from "react";
import FormShell from "@/components/FormShell";
import FormCard from "@/components/FormCard";
import { Button } from "@/components/ui/button";
import ButtonGroup from "@/components/ButtonGroup";
import FormInput from "@/components/FormInput";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { PrefilledBanner } from "@/components/PrefilledBanner";

const CYBER_STEPS = ["Company", "Cyber Details", "Declaration"];
const CYBER_ROUTES = ["/form/company-contact", "/form/cyber", "/form/class-review/cyber"];

const CyberPage: React.FC = () => {
  const navigate = useNavigate();
  const submissionId = sessionStorage.getItem("ff_submission_id");
  const clientId     = sessionStorage.getItem("ff_client_id");

  useEffect(() => {
    if (!submissionId) navigate("/form/classes", { replace: true });
  }, [submissionId, navigate]);

  const [pageLoading, setPageLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Questions
  const [cyberEssentials, setCyberEssentials] = useState<string>("");
  const [cyberEssentialsPlus, setCyberEssentialsPlus] = useState<string>("");
  const [mfaAllRemote, setMfaAllRemote] = useState<string>("");
  const [patchingPolicy, setPatchingPolicy] = useState<string>("");
  const [offsiteBackups, setOffsiteBackups] = useState<string>("");
  const [edrSoftware, setEdrSoftware] = useState<string>("");
  const [incidentResponsePlan, setIncidentResponsePlan] = useState<string>("");
  const [sufferedBreach, setSufferedBreach] = useState<string>("");
  const [breachDetails, setBreachDetails] = useState("");
  const [annualRevenue, setAnnualRevenue] = useState("");
  const [annualRevenueSource, setAnnualRevenueSource] = useState<string | null>(null);
  const [annualRevenueConfirmed, setAnnualRevenueConfirmed] = useState(false);
  const [personalDataRecords, setPersonalDataRecords] = useState("");
  const [processesPaymentCards, setProcessesPaymentCards] = useState<string>("");

  useEffect(() => {
    if (!submissionId) return;
    const load = async () => {
      const { data } = await supabase
        .from("submission_cyber")
        .select("*")
        .eq("submission_id", submissionId)
        .maybeSingle();
      if (data) {
        setCyberEssentials(data.cyber_essentials_certified === null ? "" : data.cyber_essentials_certified ? "yes" : "no");
        setCyberEssentialsPlus(data.cyber_essentials_plus === null ? "" : data.cyber_essentials_plus ? "yes" : "no");
        setMfaAllRemote(data.mfa_all_remote_access === null ? "" : data.mfa_all_remote_access ? "yes" : "no");
        setPatchingPolicy(data.patching_policy === null ? "" : data.patching_policy ? "yes" : "no");
        setOffsiteBackups(data.offsite_backups === null ? "" : data.offsite_backups ? "yes" : "no");
        setEdrSoftware(data.edr_software === null ? "" : data.edr_software ? "yes" : "no");
        setIncidentResponsePlan(data.incident_response_plan === null ? "" : data.incident_response_plan ? "yes" : "no");
        setSufferedBreach(data.suffered_breach === null ? "" : data.suffered_breach ? "yes" : "no");
        setBreachDetails(data.breach_details ?? "");
        setPersonalDataRecords(data.personal_data_records ?? "");
        setProcessesPaymentCards(data.processes_payment_cards === null ? "" : data.processes_payment_cards ? "yes" : "no");
        if (data.annual_revenue_cyber != null) setAnnualRevenue(String(data.annual_revenue_cyber));
      }

      // Cross-form pre-fill: if no annual revenue yet, look for it in D&O or TC submissions
      if (!data?.annual_revenue_cyber) {
        const clientId = sessionStorage.getItem("ff_client_id");
        if (clientId) {
          const { data: otherSubs } = await supabase
            .from("submissions")
            .select("id, class_of_business")
            .eq("client_id", clientId)
            .neq("id", submissionId);

          for (const s of otherSubs ?? []) {
            if (s.class_of_business === "dno") {
              const { data: dno } = await supabase.from("submission_dno").select("annual_turnover_dno").eq("submission_id", s.id).maybeSingle();
              if (dno?.annual_turnover_dno != null) { setAnnualRevenue(String(dno.annual_turnover_dno)); setAnnualRevenueSource("your D&O form"); break; }
            }
            if (s.class_of_business === "trade_credit") {
              const { data: lh } = await supabase.from("submission_loss_history").select("turnover").eq("submission_id", s.id).order("sort_order", { ascending: false }).limit(1);
              if (lh?.[0]?.turnover != null) { setAnnualRevenue(String(lh[0].turnover)); setAnnualRevenueSource("your Trade Credit form"); break; }
            }
          }
        }
      }

      setPageLoading(false);
    };
    load();
  }, [submissionId]);

  const toBool = (v: string) => v === "" ? null : v === "yes";

  const save = useCallback(async () => {
    if (!submissionId) return;
    setSaving(true);
    const payload = {
      submission_id: submissionId,
      cyber_essentials_certified: toBool(cyberEssentials),
      cyber_essentials_plus: toBool(cyberEssentialsPlus),
      mfa_all_remote_access: toBool(mfaAllRemote),
      patching_policy: toBool(patchingPolicy),
      offsite_backups: toBool(offsiteBackups),
      edr_software: toBool(edrSoftware),
      incident_response_plan: toBool(incidentResponsePlan),
      suffered_breach: toBool(sufferedBreach),
      breach_details: breachDetails || null,
      annual_revenue_cyber: annualRevenue ? parseFloat(annualRevenue) : null,
      personal_data_records: personalDataRecords || null,
      processes_payment_cards: toBool(processesPaymentCards),
    };
    const res = await fetch("/api/save-form-data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ table: "submission_cyber", client_id: clientId, ...payload }),
    });
    if (!res.ok) toast.error("Failed to save");
    else {
      await Promise.all([
        supabase.from("submissions").update({ completion_pct: 50, last_activity: new Date().toISOString() }).eq("id", submissionId).lt("completion_pct", 50),
        supabase.from("submissions").update({ status: "in_progress" }).eq("id", submissionId).eq("status", "not_started"),
      ]);
    }
    setSaving(false);
  }, [submissionId, cyberEssentials, cyberEssentialsPlus, mfaAllRemote, patchingPolicy,
      offsiteBackups, edrSoftware, incidentResponsePlan, sufferedBreach, breachDetails,
      annualRevenue, personalDataRecords, processesPaymentCards]);

  useEffect(() => {
    if (pageLoading) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(save, 1000);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [save, pageLoading]);

  const yesNo = [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }];

  const dataRecordOptions = [
    { value: "under_1k", label: "Under 1,000" },
    { value: "1k_10k", label: "1,000–10,000" },
    { value: "10k_100k", label: "10,000–100,000" },
    { value: "over_100k", label: "Over 100,000" },
  ];

  if (pageLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 text-accent-blue animate-spin" /></div>;
  }

  return (
    <FormShell
      currentStep={1}
      completedSteps={[0]}
      steps={CYBER_STEPS}
      stepRoutes={CYBER_ROUTES}
      onBack={() => navigate("/form/classes")}
      saving={saving}
    >
      <h1 className="mb-1">Cyber Insurance</h1>
      <p className="text-helper text-helper mb-6">
        Please answer the following questions about your organisation's cyber security posture.
        This typically takes 2–3 minutes.
      </p>

      <FormCard>
        <h3 className="mb-5">Certifications & Controls</h3>

        <div className="space-y-5">
          <div>
            <p className="text-body text-text-primary mb-2">
              Have you achieved <strong>Cyber Essentials</strong> certification?
            </p>
            <ButtonGroup value={cyberEssentials} onChange={setCyberEssentials} options={yesNo} />
          </div>

          <div>
            <p className="text-body text-text-primary mb-2">
              Have you achieved <strong>Cyber Essentials Plus</strong> certification?
            </p>
            <ButtonGroup value={cyberEssentialsPlus} onChange={setCyberEssentialsPlus} options={yesNo} />
          </div>

          <div>
            <p className="text-body text-text-primary mb-2">
              Is <strong>multi-factor authentication (MFA)</strong> enforced for all remote access
              (e.g. VPN, email, cloud services)?
            </p>
            <ButtonGroup value={mfaAllRemote} onChange={setMfaAllRemote} options={yesNo} />
          </div>

          <div>
            <p className="text-body text-text-primary mb-2">
              Do you have a documented, regularly applied <strong>software patching policy</strong>?
            </p>
            <ButtonGroup value={patchingPolicy} onChange={setPatchingPolicy} options={yesNo} />
          </div>

          <div>
            <p className="text-body text-text-primary mb-2">
              Do you take <strong>regular, tested backups</strong> stored offline or off-site?
            </p>
            <ButtonGroup value={offsiteBackups} onChange={setOffsiteBackups} options={yesNo} />
          </div>

          <div>
            <p className="text-body text-text-primary mb-2">
              Do you have <strong>endpoint detection and response (EDR)</strong> software deployed
              across all endpoints?
            </p>
            <ButtonGroup value={edrSoftware} onChange={setEdrSoftware} options={yesNo} />
          </div>

          <div>
            <p className="text-body text-text-primary mb-2">
              Do you have a written <strong>incident response plan</strong>?
            </p>
            <ButtonGroup value={incidentResponsePlan} onChange={setIncidentResponsePlan} options={yesNo} />
          </div>
        </div>
      </FormCard>

      <FormCard>
        <h3 className="mb-5">Data & Incidents</h3>

        <div className="space-y-5">
          <div>
            <p className="text-body text-text-primary mb-2">
              Have you suffered a <strong>cyber incident or data breach</strong> in the last 3 years?
            </p>
            <ButtonGroup value={sufferedBreach} onChange={setSufferedBreach} options={yesNo} />
          </div>

          {sufferedBreach === "yes" && (
            <FormInput
              label="Please provide brief details of the incident"
              value={breachDetails}
              onChange={setBreachDetails}
              multiline
            />
          )}

          <div className={annualRevenueSource && !annualRevenueConfirmed ? "border-l-2 border-amber-400 pl-3 -ml-1" : ""}>
            <FormInput
              label="Annual revenue (£)"
              value={annualRevenue}
              onChange={(v) => { setAnnualRevenue(v); if (annualRevenueSource) setAnnualRevenueConfirmed(true); }}
              type="number"
              placeholder="e.g. 5000000"
              helpText="Your organisation's total annual revenue for the most recent financial year"
            />
          </div>
          {annualRevenueSource && !annualRevenueConfirmed && (
            <PrefilledBanner source={annualRevenueSource} onConfirm={() => setAnnualRevenueConfirmed(true)} />
          )}

          <div>
            <p className="text-body text-text-primary mb-2">
              Approximately how many <strong>personal data records</strong> does your organisation hold?
            </p>
            <ButtonGroup value={personalDataRecords} onChange={setPersonalDataRecords} options={dataRecordOptions} />
          </div>

          <div>
            <p className="text-body text-text-primary mb-2">
              Do you <strong>process payment card data</strong> (e.g. credit/debit card payments)?
            </p>
            <ButtonGroup value={processesPaymentCards} onChange={setProcessesPaymentCards} options={yesNo} />
          </div>
        </div>
      </FormCard>

      <div className="flex justify-end mt-2">
        <Button onClick={() => navigate("/form/class-review/cyber")}>
          Review &amp; submit →
        </Button>
      </div>
    </FormShell>
  );
};

export default CyberPage;
