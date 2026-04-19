import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, ShieldCheck, Clock, ChevronRight, Loader2, Download } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import TenantLogo from "@/components/TenantLogo";
import { downloadClassPDF } from "@/lib/generatePDF";

type ClassOfBusiness = "trade_credit" | "cyber" | "dno" | "terrorism";

interface SubmissionSummary {
  id: string;
  class_of_business: ClassOfBusiness;
  status: string;
  completion_pct: number;
  policy_year: number | null;
  renewal_date: string | null;
  created_at: string;
  reference: string | null;
}

const CLASS_META: Record<ClassOfBusiness, { label: string; description: string; route: string }> = {
  trade_credit: {
    label: "Trade Credit Insurance",
    description: "Protect your business against non-payment by customers",
    route: "/form/company",
  },
  cyber: {
    label: "Cyber Insurance",
    description: "Cover for cyber attacks, data breaches and business interruption",
    route: "/form/cyber",
  },
  dno: {
    label: "Directors & Officers",
    description: "Personal liability protection for your directors and officers",
    route: "/form/dno",
  },
  terrorism: {
    label: "Terrorism Insurance",
    description: "Property and business interruption cover for terrorism events",
    route: "/form/terrorism",
  },
};

const statusLabel = (status: string, pct: number) => {
  if (status === "submitted") return { text: "Submitted", colour: "text-sage" };
  if (status === "in_progress") return { text: `In progress (${pct}%)`, colour: "text-accent-blue" };
  return { text: "Not started", colour: "text-slate-400" };
};

const ClassPickerPage: React.FC = () => {
  const navigate = useNavigate();
  const [submissions, setSubmissions] = useState<SubmissionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<Record<string, boolean>>({});
  const [addingClass, setAddingClass] = useState<string | null>(null);

  const clientId = sessionStorage.getItem("ff_client_id");

  useEffect(() => {
    if (!clientId) { navigate("/", { replace: true }); return; }

    // Try from sessionStorage first (fast), then refresh from DB
    const cached = sessionStorage.getItem("ff_submissions");
    if (cached) {
      try {
        setSubmissions(JSON.parse(cached) as SubmissionSummary[]);
        setLoading(false);
      } catch { /* ignore parse error, fall through to DB */ }
    }

    // Always refresh from DB to get latest statuses
    const refresh = async () => {
      const { data } = await supabase
        .from("submissions")
        .select("id, class_of_business, status, completion_pct, policy_year, renewal_date, created_at, reference")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      if (data) {
        setSubmissions(data as SubmissionSummary[]);
        sessionStorage.setItem("ff_submissions", JSON.stringify(data));
      }
      setLoading(false);
    };

    refresh();
  }, [clientId, navigate]);

  const handleSelect = (sub: SubmissionSummary) => {
    if (sub.status === "submitted") return;
    sessionStorage.setItem("ff_submission_id", sub.id);
    sessionStorage.removeItem("ff_completed_steps");
    if (sub.class_of_business !== "trade_credit" && sub.status === "not_started") {
      navigate("/form/company-contact", { replace: true });
      return;
    }
    const meta = CLASS_META[sub.class_of_business] ?? CLASS_META.trade_credit;
    navigate(meta.route, { replace: true });
  };

  const handleDownload = async (e: React.MouseEvent, sub: SubmissionSummary) => {
    e.stopPropagation();
    setDownloading((p) => ({ ...p, [sub.id]: true }));
    try {
      await downloadClassPDF(sub.id, sub.class_of_business, sub.reference ? `${sub.reference}.pdf` : undefined);
    } catch {
      // silently fail — PDF generation can fail if data is sparse
    } finally {
      setDownloading((p) => ({ ...p, [sub.id]: false }));
    }
  };

  const handleRequestClass = async (classKey: ClassOfBusiness) => {
    const submissionId = sessionStorage.getItem("ff_submission_id");
    if (!clientId || !submissionId) return;
    setAddingClass(classKey);
    try {
      const res = await fetch("/api/client-add-class", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: clientId, submission_id: submissionId, class_of_business: classKey }),
      });
      const data = await res.json() as { submission_id?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed");
      // Set the new submission as active and navigate
      sessionStorage.setItem("ff_submission_id", data.submission_id!);
      sessionStorage.removeItem("ff_completed_steps");
      // Refresh submissions list
      const { data: subs } = await supabase
        .from("submissions")
        .select("id, class_of_business, status, completion_pct, policy_year, renewal_date, created_at, reference")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      if (subs) {
        setSubmissions(subs as SubmissionSummary[]);
        sessionStorage.setItem("ff_submissions", JSON.stringify(subs));
      }
      // Navigate to the appropriate first page
      if (classKey === "trade_credit") {
        navigate("/form/company", { replace: true });
      } else {
        navigate("/form/company-contact", { replace: true });
      }
    } catch (err) {
      console.error(err);
      toast.error("Could not add product — please try again");
    } finally {
      setAddingClass(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-silver/30">
        <Loader2 className="h-6 w-6 text-accent-blue animate-spin" />
      </div>
    );
  }

  const activeSubs   = submissions.filter((s) => s.status !== "submitted");
  const allDone      = submissions.length > 0 && activeSubs.length === 0;

  const existingClasses = new Set(submissions.map((s) => s.class_of_business));
  const ALL_CLASSES: ClassOfBusiness[] = ["trade_credit", "cyber", "dno", "terrorism"];
  const suggestedClasses = ALL_CLASSES.filter((c) => !existingClasses.has(c));

  return (
    <div className="min-h-screen bg-silver/30 flex flex-col">
      {/* Header */}
      <header className="h-16 bg-white border-b border-silver flex items-center px-6">
        <TenantLogo src={sessionStorage.getItem("ff_tenant_logo")} className="h-8 w-auto" />
      </header>

      <main className="flex-1 flex flex-col items-center px-4 py-12 max-w-2xl mx-auto w-full">
        {allDone ? (
          <>
            <div className="w-14 h-14 rounded-full bg-sage/10 flex items-center justify-center mb-4">
              <ShieldCheck className="h-7 w-7 text-sage" />
            </div>
            <h1 className="text-center mb-2">All proposals submitted</h1>
            <p className="text-helper text-helper text-center mb-8">
              Your broker will be in touch once they have reviewed your proposals.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-center mb-2">Your insurance proposals</h1>
            <p className="text-helper text-helper text-center mb-8">
              Select a form below to start or continue your proposal.
            </p>
          </>
        )}

        <div className="w-full space-y-3">
          {submissions.map((sub) => {
            const meta = CLASS_META[sub.class_of_business] ?? CLASS_META.trade_credit;
            const { text: statusText, colour: statusColour } = statusLabel(sub.status, sub.completion_pct);
            const done = sub.status === "submitted";
            const canDownload = done;
            const yearLabel = sub.policy_year ? `${sub.policy_year} policy year` : null;

            return (
              <div
                key={sub.id}
                onClick={() => !done && handleSelect(sub)}
                className={`w-full bg-white rounded-xl border border-silver p-5 flex items-center gap-4 text-left transition-all ${
                  done
                    ? "opacity-70 cursor-default"
                    : "hover:border-navy hover:shadow-sm cursor-pointer"
                }`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${done ? "bg-sage/10" : "bg-navy/10"}`}>
                  {done
                    ? <ShieldCheck className="h-5 w-5 text-sage" />
                    : <Shield className="h-5 w-5 text-navy" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-body font-medium text-text-primary">{meta.label}</p>
                  {yearLabel && (
                    <p className="text-helper text-slate-400 text-[11px]">{yearLabel}</p>
                  )}
                  <p className="text-helper text-helper truncate">{meta.description}</p>
                  <p className={`text-[11px] font-medium mt-0.5 ${statusColour}`}>{statusText}</p>
                </div>
                {done && canDownload && (
                  <button
                    type="button"
                    onClick={(e) => handleDownload(e, sub)}
                    disabled={downloading[sub.id]}
                    className="shrink-0 flex items-center gap-1.5 text-[12px] font-medium text-navy hover:text-navy/70 transition-colors disabled:opacity-50"
                  >
                    {downloading[sub.id]
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <Download className="h-3.5 w-3.5" />
                    }
                    Download
                  </button>
                )}
                {!done && <ChevronRight className="h-5 w-5 text-slate-400 shrink-0" />}
              </div>
            );
          })}
        </div>

        {!allDone && (
          <div className="flex items-center gap-2 mt-6 text-helper text-helper">
            <Clock className="h-3.5 w-3.5" />
            <span>Your progress is saved automatically</span>
          </div>
        )}

        {suggestedClasses.length > 0 && submissions.length > 0 && (
          <div className="w-full mt-10">
            <div className="border-t border-silver/60 pt-8">
              <h2 className="text-center text-lg font-semibold text-navy mb-1">While you're here…</h2>
              <p className="text-helper text-center text-slate-500 mb-6">
                Would you like a quote for any of the following? We'll open the forms for you straight away.
              </p>
              <div className="space-y-3">
                {suggestedClasses.map((classKey) => {
                  const meta = CLASS_META[classKey];
                  const isAdding = addingClass === classKey;
                  return (
                    <div key={classKey} className="w-full bg-white rounded-xl border border-silver p-5 flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-navy/5 flex items-center justify-center shrink-0">
                        <Shield className="h-5 w-5 text-navy/40" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-body font-medium text-text-primary">{meta.label}</p>
                        <p className="text-helper text-helper truncate">{meta.description}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRequestClass(classKey)}
                        disabled={isAdding}
                        className="shrink-0 flex items-center gap-1.5 text-[13px] font-medium text-navy border border-navy/30 rounded-lg px-3 py-1.5 hover:bg-navy/5 transition-colors disabled:opacity-50"
                      >
                        {isAdding ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Adding…</> : "Get a quote →"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default ClassPickerPage;
