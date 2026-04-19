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

const DNO_STEPS = ["Company", "D&O Details", "Declaration"];
const DNO_ROUTES = ["/form/company-contact", "/form/dno", "/form/class-review/dno"];

const DNOPage: React.FC = () => {
  const navigate = useNavigate();
  const submissionId = sessionStorage.getItem("ff_submission_id");
  const clientId     = sessionStorage.getItem("ff_client_id");

  useEffect(() => {
    if (!submissionId) navigate("/form/classes", { replace: true });
  }, [submissionId, navigate]);

  const [pageLoading, setPageLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [numberOfDirectors, setNumberOfDirectors] = useState("");
  const [companyListed, setCompanyListed] = useState("");
  const [directorDisqualified, setDirectorDisqualified] = useState("");
  const [disqualifiedDetails, setDisqualifiedDetails] = useState("");
  const [pendingClaims, setPendingClaims] = useState("");
  const [pendingClaimsDetails, setPendingClaimsDetails] = useState("");
  const [hasAuditCommittee, setHasAuditCommittee] = useState("");
  const [recentAcquisitions, setRecentAcquisitions] = useState("");
  const [acquisitionsDetails, setAcquisitionsDetails] = useState("");
  const [annualTurnover, setAnnualTurnover] = useState("");
  const [annualTurnoverSource, setAnnualTurnoverSource] = useState<string | null>(null);
  const [annualTurnoverConfirmed, setAnnualTurnoverConfirmed] = useState(false);
  const [netAssets, setNetAssets] = useState("");

  useEffect(() => {
    if (!submissionId) return;
    const load = async () => {
      const { data } = await supabase
        .from("submission_dno")
        .select("*")
        .eq("submission_id", submissionId)
        .maybeSingle();
      if (data) {
        setNumberOfDirectors(data.number_of_directors !== null ? String(data.number_of_directors) : "");
        setCompanyListed(data.company_listed === null ? "" : data.company_listed ? "yes" : "no");
        setDirectorDisqualified(data.director_disqualified === null ? "" : data.director_disqualified ? "yes" : "no");
        setDisqualifiedDetails(data.director_disqualified_details ?? "");
        setPendingClaims(data.pending_claims === null ? "" : data.pending_claims ? "yes" : "no");
        setPendingClaimsDetails(data.pending_claims_details ?? "");
        setHasAuditCommittee(data.has_audit_committee === null ? "" : data.has_audit_committee ? "yes" : "no");
        setRecentAcquisitions(data.recent_acquisitions === null ? "" : data.recent_acquisitions ? "yes" : "no");
        setAcquisitionsDetails(data.recent_acquisitions_details ?? "");
        setNetAssets(data.net_assets !== null ? String(data.net_assets) : "");
        if (data.annual_turnover_dno != null) setAnnualTurnover(String(data.annual_turnover_dno));
      }

      // Cross-form pre-fill: if no annual turnover yet, look in Cyber or TC submissions
      if (!data?.annual_turnover_dno) {
        const clientId = sessionStorage.getItem("ff_client_id");
        if (clientId) {
          const { data: otherSubs } = await supabase
            .from("submissions")
            .select("id, class_of_business")
            .eq("client_id", clientId)
            .neq("id", submissionId);

          for (const s of otherSubs ?? []) {
            if (s.class_of_business === "cyber") {
              const { data: cyber } = await supabase.from("submission_cyber").select("annual_revenue_cyber").eq("submission_id", s.id).maybeSingle();
              if (cyber?.annual_revenue_cyber != null) { setAnnualTurnover(String(cyber.annual_revenue_cyber)); setAnnualTurnoverSource("your Cyber Insurance form"); break; }
            }
            if (s.class_of_business === "trade_credit") {
              const { data: lh } = await supabase.from("submission_loss_history").select("turnover").eq("submission_id", s.id).order("sort_order", { ascending: false }).limit(1);
              if (lh?.[0]?.turnover != null) { setAnnualTurnover(String(lh[0].turnover)); setAnnualTurnoverSource("your Trade Credit form"); break; }
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
      number_of_directors: numberOfDirectors ? parseInt(numberOfDirectors) : null,
      company_listed: toBool(companyListed),
      director_disqualified: toBool(directorDisqualified),
      director_disqualified_details: disqualifiedDetails || null,
      pending_claims: toBool(pendingClaims),
      pending_claims_details: pendingClaimsDetails || null,
      has_audit_committee: toBool(hasAuditCommittee),
      recent_acquisitions: toBool(recentAcquisitions),
      recent_acquisitions_details: acquisitionsDetails || null,
      annual_turnover_dno: annualTurnover ? parseFloat(annualTurnover) : null,
      net_assets: netAssets ? parseFloat(netAssets) : null,
    };
    const res = await fetch("/api/save-form-data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ table: "submission_dno", client_id: clientId, ...payload }),
    });
    if (!res.ok) toast.error("Failed to save");
    else {
      await Promise.all([
        supabase.from("submissions").update({ completion_pct: 50, last_activity: new Date().toISOString() }).eq("id", submissionId).lt("completion_pct", 50),
        supabase.from("submissions").update({ status: "in_progress" }).eq("id", submissionId).eq("status", "not_started"),
      ]);
    }
    setSaving(false);
  }, [submissionId, numberOfDirectors, companyListed, directorDisqualified, disqualifiedDetails,
      pendingClaims, pendingClaimsDetails, hasAuditCommittee, recentAcquisitions,
      acquisitionsDetails, annualTurnover, netAssets]);

  useEffect(() => {
    if (pageLoading) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(save, 1000);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [save, pageLoading]);

  const yesNo = [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }];

  if (pageLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 text-accent-blue animate-spin" /></div>;
  }

  return (
    <FormShell
      currentStep={1}
      completedSteps={[0]}
      steps={DNO_STEPS}
      stepRoutes={DNO_ROUTES}
      onBack={() => navigate("/form/classes")}
      saving={saving}
    >
      <h1 className="mb-1">Directors &amp; Officers Insurance</h1>
      <p className="text-helper text-helper mb-6">
        Please answer the following questions about your company's board and governance.
        This typically takes 3–4 minutes.
      </p>

      <FormCard>
        <h3 className="mb-5">Board &amp; Governance</h3>

        <div className="space-y-5">
          <FormInput
            label="How many directors and officers does the company have?"
            value={numberOfDirectors}
            onChange={setNumberOfDirectors}
            type="number"
            placeholder="e.g. 4"
          />

          <div>
            <p className="text-body text-text-primary mb-2">
              Is the company <strong>listed on a stock exchange</strong>?
            </p>
            <ButtonGroup value={companyListed} onChange={setCompanyListed} options={yesNo} />
          </div>

          <div>
            <p className="text-body text-text-primary mb-2">
              Do you have an <strong>audit committee</strong>?
            </p>
            <ButtonGroup value={hasAuditCommittee} onChange={setHasAuditCommittee} options={yesNo} />
          </div>

          <div className={annualTurnoverSource && !annualTurnoverConfirmed ? "border-l-2 border-amber-400 pl-3 -ml-1" : ""}>
            <FormInput
              label="Annual turnover (£)"
              value={annualTurnover}
              onChange={(v) => { setAnnualTurnover(v); if (annualTurnoverSource) setAnnualTurnoverConfirmed(true); }}
              type="number"
              placeholder="e.g. 5000000"
              helpText="Total annual revenue for the most recent financial year"
            />
          </div>
          {annualTurnoverSource && !annualTurnoverConfirmed && (
            <PrefilledBanner source={annualTurnoverSource} onConfirm={() => setAnnualTurnoverConfirmed(true)} />
          )}

          <FormInput
            label="Net assets (£)"
            value={netAssets}
            onChange={setNetAssets}
            type="number"
            placeholder="e.g. 5000000"
            helpText="As per your most recent set of accounts"
          />
        </div>
      </FormCard>

      <FormCard>
        <h3 className="mb-5">Claims &amp; Regulatory History</h3>

        <div className="space-y-5">
          <div>
            <p className="text-body text-text-primary mb-2">
              Has any director or officer been <strong>disqualified, sanctioned, or subject to
              regulatory action</strong> in the last 5 years?
            </p>
            <ButtonGroup value={directorDisqualified} onChange={setDirectorDisqualified} options={yesNo} />
          </div>

          {directorDisqualified === "yes" && (
            <FormInput
              label="Please provide brief details"
              value={disqualifiedDetails}
              onChange={setDisqualifiedDetails}
              multiline
            />
          )}

          <div>
            <p className="text-body text-text-primary mb-2">
              Are there any <strong>pending or anticipated claims</strong> against any director
              or officer?
            </p>
            <ButtonGroup value={pendingClaims} onChange={setPendingClaims} options={yesNo} />
          </div>

          {pendingClaims === "yes" && (
            <FormInput
              label="Please provide brief details"
              value={pendingClaimsDetails}
              onChange={setPendingClaimsDetails}
              multiline
            />
          )}

          <div>
            <p className="text-body text-text-primary mb-2">
              Has the company made any <strong>acquisitions or disposals</strong> in the last 2 years,
              or are any planned?
            </p>
            <ButtonGroup value={recentAcquisitions} onChange={setRecentAcquisitions} options={yesNo} />
          </div>

          {recentAcquisitions === "yes" && (
            <FormInput
              label="Please provide brief details"
              value={acquisitionsDetails}
              onChange={setAcquisitionsDetails}
              multiline
            />
          )}
        </div>
      </FormCard>

      <div className="flex justify-end mt-2">
        <Button onClick={() => navigate("/form/class-review/dno")}>
          Review &amp; submit →
        </Button>
      </div>
    </FormShell>
  );
};

export default DNOPage;
