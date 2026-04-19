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

const TERRORISM_STEPS = ["Company", "Property Details", "Declaration"];
const TERRORISM_ROUTES = ["/form/company-contact", "/form/terrorism", "/form/class-review/terrorism"];

const TerrorismPage: React.FC = () => {
  const navigate = useNavigate();
  const submissionId = sessionStorage.getItem("ff_submission_id");
  const clientId     = sessionStorage.getItem("ff_client_id");

  useEffect(() => {
    if (!submissionId) navigate("/form/classes", { replace: true });
  }, [submissionId, navigate]);

  const [pageLoading, setPageLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [propertyAddress, setPropertyAddress] = useState("");
  const [constructionType, setConstructionType] = useState("");
  const [yearOfConstruction, setYearOfConstruction] = useState("");
  const [sumInsured, setSumInsured] = useState("");
  const [nearLandmark, setNearLandmark] = useState("");
  const [occupancyType, setOccupancyType] = useState("");
  const [existingCover, setExistingCover] = useState("");
  const [existingCoverDetails, setExistingCoverDetails] = useState("");
  const [annualTurnover, setAnnualTurnover] = useState("");
  const [annualTurnoverSource, setAnnualTurnoverSource] = useState<string | null>(null);
  const [annualTurnoverConfirmed, setAnnualTurnoverConfirmed] = useState(false);

  useEffect(() => {
    if (!submissionId) return;
    const load = async () => {
      const { data } = await supabase
        .from("submission_terrorism")
        .select("*")
        .eq("submission_id", submissionId)
        .maybeSingle();
      if (data) {
        setPropertyAddress(data.property_address ?? "");
        setConstructionType(data.construction_type ?? "");
        setYearOfConstruction(data.year_of_construction !== null ? String(data.year_of_construction) : "");
        setSumInsured(data.sum_insured !== null ? String(data.sum_insured) : "");
        setNearLandmark(data.near_landmark === null ? "" : data.near_landmark ? "yes" : "no");
        setOccupancyType(data.occupancy_type ?? "");
        setExistingCover(data.existing_terrorism_cover === null ? "" : data.existing_terrorism_cover ? "yes" : "no");
        setExistingCoverDetails(data.existing_cover_details ?? "");
        if (data.annual_turnover_terrorism != null) setAnnualTurnover(String(data.annual_turnover_terrorism));
      }

      // Cross-form pre-fill: if no annual turnover saved, look in D&O, Cyber, or TC submissions
      if (!data?.annual_turnover_terrorism) {
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
              if (dno?.annual_turnover_dno != null) { setAnnualTurnover(String(dno.annual_turnover_dno)); setAnnualTurnoverSource("your D&O form"); break; }
            }
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
      property_address: propertyAddress || null,
      construction_type: constructionType || null,
      year_of_construction: yearOfConstruction ? parseInt(yearOfConstruction) : null,
      sum_insured: sumInsured ? parseFloat(sumInsured) : null,
      near_landmark: toBool(nearLandmark),
      occupancy_type: occupancyType || null,
      existing_terrorism_cover: toBool(existingCover),
      existing_cover_details: existingCoverDetails || null,
      annual_turnover_terrorism: annualTurnover ? parseFloat(annualTurnover) : null,
    };
    const res = await fetch("/api/save-form-data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ table: "submission_terrorism", client_id: clientId, ...payload }),
    });
    if (!res.ok) toast.error("Failed to save");
    else {
      await Promise.all([
        supabase.from("submissions").update({ completion_pct: 50, last_activity: new Date().toISOString() }).eq("id", submissionId).lt("completion_pct", 50),
        supabase.from("submissions").update({ status: "in_progress" }).eq("id", submissionId).eq("status", "not_started"),
      ]);
    }
    setSaving(false);
  }, [submissionId, propertyAddress, constructionType, yearOfConstruction, sumInsured,
      nearLandmark, occupancyType, existingCover, existingCoverDetails, annualTurnover]);

  useEffect(() => {
    if (pageLoading) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(save, 1000);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [save, pageLoading]);

  const yesNo = [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }];

  const constructionOptions = [
    { value: "brick", label: "Brick" },
    { value: "concrete", label: "Concrete" },
    { value: "steel", label: "Steel frame" },
    { value: "timber", label: "Timber frame" },
    { value: "mixed", label: "Mixed" },
  ];

  const occupancyOptions = [
    { value: "office", label: "Office" },
    { value: "retail", label: "Retail" },
    { value: "industrial", label: "Industrial / Warehouse" },
    { value: "hospitality", label: "Hospitality" },
    { value: "mixed", label: "Mixed use" },
  ];

  if (pageLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 text-accent-blue animate-spin" /></div>;
  }

  return (
    <FormShell
      currentStep={1}
      completedSteps={[0]}
      steps={TERRORISM_STEPS}
      stepRoutes={TERRORISM_ROUTES}
      onBack={() => navigate("/form/classes")}
      saving={saving}
    >
      <h1 className="mb-1">Terrorism Insurance</h1>
      <p className="text-helper text-helper mb-6">
        Please provide details of the property you wish to insure.
        This typically takes 1–2 minutes.
      </p>

      <FormCard>
        <h3 className="mb-5">Property Details</h3>

        <div className="space-y-5">
          <FormInput
            label="Property address to be insured"
            value={propertyAddress}
            onChange={setPropertyAddress}
            multiline
            placeholder="Full address including postcode"
          />

          <div>
            <p className="text-body text-text-primary mb-2">Construction type</p>
            <ButtonGroup value={constructionType} onChange={setConstructionType} options={constructionOptions} />
          </div>

          <FormInput
            label="Year of construction"
            value={yearOfConstruction}
            onChange={setYearOfConstruction}
            type="number"
            placeholder="e.g. 1995"
          />

          <FormInput
            label="Total sum insured (£)"
            value={sumInsured}
            onChange={setSumInsured}
            type="number"
            placeholder="e.g. 5000000"
            helpText="Rebuilding cost of the property, not market value"
          />

          <div>
            <p className="text-body text-text-primary mb-2">
              Primary occupancy type
            </p>
            <ButtonGroup value={occupancyType} onChange={setOccupancyType} options={occupancyOptions} />
          </div>

          <div className={annualTurnoverSource && !annualTurnoverConfirmed ? "border-l-2 border-amber-400 pl-3 -ml-1" : ""}>
            <FormInput
              label="Annual turnover (£)"
              value={annualTurnover}
              onChange={(v) => { setAnnualTurnover(v); if (annualTurnoverSource) setAnnualTurnoverConfirmed(true); }}
              type="number"
              placeholder="e.g. 5000000"
              helpText="Used for business interruption estimation"
            />
          </div>
          {annualTurnoverSource && !annualTurnoverConfirmed && (
            <PrefilledBanner source={annualTurnoverSource} onConfirm={() => setAnnualTurnoverConfirmed(true)} />
          )}
        </div>
      </FormCard>

      <FormCard>
        <h3 className="mb-5">Risk Profile</h3>

        <div className="space-y-5">
          <div>
            <p className="text-body text-text-primary mb-2">
              Is the property within <strong>250 metres</strong> of a government building,
              major transport hub, landmark, or symbolic target?
            </p>
            <ButtonGroup value={nearLandmark} onChange={setNearLandmark} options={yesNo} />
          </div>

          <div>
            <p className="text-body text-text-primary mb-2">
              Do you have any <strong>existing terrorism cover</strong> in place?
            </p>
            <ButtonGroup value={existingCover} onChange={setExistingCover} options={yesNo} />
          </div>

          {existingCover === "yes" && (
            <FormInput
              label="Please provide details of existing cover (insurer, limit, expiry)"
              value={existingCoverDetails}
              onChange={setExistingCoverDetails}
              multiline
            />
          )}
        </div>
      </FormCard>

      <div className="flex justify-end mt-2">
        <Button onClick={() => navigate("/form/class-review/terrorism")}>
          Review &amp; submit →
        </Button>
      </div>
    </FormShell>
  );
};

export default TerrorismPage;
