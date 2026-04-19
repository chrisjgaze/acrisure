import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import FormCard from "@/components/FormCard";
import StatusBadge from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Loader2, Download, Copy, CheckCheck, BarChart2, ShieldAlert } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { downloadClassPDF } from "@/lib/generatePDF";

import type { Session } from "@supabase/supabase-js";

// ─── GDPR anonymise button ─────────────────────────────────────────────────────

function AnonymiseButton({
  clientId,
  session,
  onDone,
}: {
  clientId: string;
  session: Session | null;
  onDone: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleAnonymise = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/gdpr-anonymise", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ client_id: clientId }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) { toast.error(data.error ?? "Failed to anonymise client"); return; }
      toast.success("Client data has been anonymised");
      onDone();
    } catch {
      toast.error("Failed to anonymise client");
    } finally {
      setLoading(false);
      setConfirming(false);
    }
  };

  if (!confirming) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setConfirming(true)}
        className="border-red-300 text-red-600 hover:bg-red-100 hover:text-red-700"
      >
        Anonymise client data
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <p className="text-helper text-red-700 font-medium">Are you sure? This cannot be undone.</p>
      <Button
        size="sm"
        onClick={handleAnonymise}
        disabled={loading}
        className="bg-red-600 hover:bg-red-700 text-white border-0"
      >
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
        Yes, anonymise
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setConfirming(false)}
        disabled={loading}
      >
        Cancel
      </Button>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────

const ALL_PRODUCT_CLASSES = [
  { key: "trade_credit", label: "Trade Credit Insurance" },
  { key: "cyber",        label: "Cyber Insurance" },
  { key: "dno",          label: "Directors & Officers" },
  { key: "terrorism",    label: "Terrorism Insurance" },
];

function calcRenewalDate(renewalDateStr: string | null): Date | null {
  if (!renewalDateStr) return null;
  const start = new Date(renewalDateStr);
  if (start.getTime() > Date.now()) return start;
  const next = new Date(start);
  next.setFullYear(next.getFullYear() + 1);
  return next;
}

function formatRenewal(date: Date): string {
  const diffMs = date.getTime() - Date.now();
  const twoMonths = 61 * 24 * 60 * 60 * 1000;
  if (diffMs <= twoMonths) {
    const d = String(date.getDate()).padStart(2, "0");
    const m = date.toLocaleDateString("en-GB", { month: "short" });
    const y = date.getFullYear().toString().slice(-2);
    return `${d}-${m}-${y}`;
  }
  return date.toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
}

interface SubmissionDetail {
  id: string;
  reference: string;
  status: string;
  completionPct: number;
  renewalDate: string | null;
  lastActivity: string | null;
  policyYear: number;
  classOfBusiness: string;
  hasCompany: boolean;
  hasFinancial: boolean;
  hasCustomers: boolean;
  isSubmitted: boolean;
}

interface ClientDetail {
  id: string;
  companyName: string;
  contactName: string;
  contactEmail: string;
  anonymised: boolean;
  submission: SubmissionDetail | null;
  allSubmissions: SubmissionDetail[];
}

const ClientViewPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { tenantId, isAdmin, session } = useAuth();
  const [client, setClient] = useState<ClientDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [initiatingClass, setInitiatingClass] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [magicLinks, setMagicLinks] = useState<Record<string, string>>({});
  const [pendingMagicLink, setPendingMagicLink] = useState<{ url: string; label: string } | null>(null);
  const { licensedClasses } = useAuth();
  // Per-class action state keyed by class_of_business
  const [downloading, setDownloading] = useState<Record<string, boolean>>({});
  const [lapsing, setLapsing] = useState<Record<string, boolean>>({});
  const [reactivating, setReactivating] = useState<Record<string, boolean>>({});
  const [renewalFiring, setRenewalFiring] = useState<Record<string, boolean>>({});
  const [renewalCountdown, setRenewalCountdown] = useState<Record<string, number>>({});
  const renewalTimerRefs = useRef<Record<string, ReturnType<typeof setInterval>>>({});
  // Stable ref so interval callbacks can call executeRenewal without capturing a stale closure
  const executeRenewalRef = useRef<(classKey: string) => void>(() => {});

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      const { data: clientData, error } = await supabase
        .from("clients")
        .select(`
          id,
          display_name,
          contact_name,
          contact_email,
          deleted_at,
          submissions (
            id,
            reference,
            status,
            completion_pct,
            renewal_date,
            last_activity,
            policy_year,
            submitted_at,
            class_of_business
          )
        `)
        .eq("id", id)
        .single();

      if (error || !clientData) {
        setLoading(false);
        return;
      }

      const allSubs = clientData.submissions ?? [];
      // Primary = trade credit submission
      const sub = allSubs.find((s) => s.class_of_business === "trade_credit") ?? allSubs[0];

      // Check which sections have data for primary submission
      const [{ data: companyData }, { data: financialData }, { data: buyersData }] = await Promise.all([
        supabase.from("submission_company").select("id").eq("submission_id", sub?.id ?? "").maybeSingle(),
        supabase.from("submission_financial").select("id").eq("submission_id", sub?.id ?? "").maybeSingle(),
        supabase.from("submission_buyers").select("id").eq("submission_id", sub?.id ?? "").limit(1),
      ]);

      const toDetail = (s: typeof sub, hasCompany = false, hasFinancial = false, hasCustomers = false): SubmissionDetail => ({
        id: s!.id,
        reference: s!.reference,
        status: s!.status,
        completionPct: s!.completion_pct ?? 0,
        renewalDate: s!.renewal_date,
        lastActivity: s!.last_activity,
        policyYear: s!.policy_year,
        classOfBusiness: s!.class_of_business ?? "trade_credit",
        hasCompany,
        hasFinancial,
        hasCustomers,
        isSubmitted: !!s!.submitted_at,
      });

      setClient({
        id: clientData.id,
        companyName: clientData.display_name ?? "—",
        contactName: clientData.contact_name ?? "—",
        contactEmail: clientData.contact_email ?? "—",
        anonymised: !!clientData.deleted_at,
        submission: sub ? toDetail(sub, !!companyData, !!financialData, (buyersData?.length ?? 0) > 0) : null,
        allSubmissions: allSubs.map((s) =>
          s.id === sub?.id
            ? toDetail(s, !!companyData, !!financialData, (buyersData?.length ?? 0) > 0)
            : toDetail(s)
        ),
      });

      setLoading(false);
    };

    load();
  }, [id]);

  // Defined here (before early returns) so restore useEffect can reference it via ref
  const executeRenewal = async (classKey: string) => {
    if (!client) return;
    setRenewalFiring((prev) => ({ ...prev, [classKey]: true }));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/initiate-renewal", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token ?? ""}` },
        body: JSON.stringify({ client_id: client.id, class_of_business: classKey }),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? "Unknown error");
      }
      toast.success(`Renewal initiated — invite sent to ${client.contactEmail}`);
      window.location.reload();
    } catch (err) {
      console.error("Failed to initiate renewal:", err);
      toast.error("Failed to initiate renewal — please try again");
    } finally {
      setRenewalFiring((prev) => ({ ...prev, [classKey]: false }));
    }
  };
  // Assign ref directly in render — safe because refs are mutable and don't trigger re-renders
  executeRenewalRef.current = executeRenewal;

  // Restore any countdowns that were running before the broker navigated away
  useEffect(() => {
    if (!id) return;
    const prefix = `renewal_countdown_${id}_`;
    const restored: Record<string, number> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(prefix)) continue;
      const classKey = key.slice(prefix.length);
      const expiresAt = parseInt(localStorage.getItem(key) ?? "0", 10);
      const remaining = Math.min(5, Math.round((expiresAt - Date.now()) / 1000));
      if (remaining > 0) restored[classKey] = remaining;
      else localStorage.removeItem(key);
    }
    if (Object.keys(restored).length === 0) return;
    setRenewalCountdown(restored);
    Object.keys(restored).forEach((classKey) => {
      const pfx = `renewal_countdown_${id}_`;
      renewalTimerRefs.current[classKey] = setInterval(() => {
        setRenewalCountdown((prev) => {
          const current = prev[classKey] ?? 0;
          if (current <= 1) {
            clearInterval(renewalTimerRefs.current[classKey]);
            delete renewalTimerRefs.current[classKey];
            localStorage.removeItem(`${pfx}${classKey}`);
            executeRenewalRef.current(classKey);
            const next = { ...prev };
            delete next[classKey];
            return next;
          }
          return { ...prev, [classKey]: current - 1 };
        });
      }, 1000);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 text-accent-blue animate-spin" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-helper text-helper">Client not found.</p>
      </div>
    );
  }

  const handleDownloadPDF = async (submissionId: string, classKey: string, reference?: string | null) => {
    setDownloading((prev) => ({ ...prev, [submissionId]: true }));
    try {
      await downloadClassPDF(submissionId, classKey, reference ? `${reference}.pdf` : undefined);
    } catch (err) {
      console.error("PDF generation failed:", err);
      toast.error("Failed to generate PDF");
    } finally {
      setDownloading((prev) => ({ ...prev, [submissionId]: false }));
    }
  };

  const handleLapse = async (classKey: string) => {
    const submission = client.allSubmissions.find((s) => s.classOfBusiness === classKey);
    if (!submission) return;
    setLapsing((prev) => ({ ...prev, [classKey]: true }));
    try {
      const { error } = await supabase.from("submissions").update({ status: "lapsed" }).eq("id", submission.id);
      if (error) throw error;
      toast.success("Marked as lapsed");
      setClient((c) => c && {
        ...c,
        allSubmissions: c.allSubmissions.map((s) => s.id === submission.id ? { ...s, status: "lapsed" } : s),
      });
    } catch {
      toast.error("Failed to update status");
    } finally {
      setLapsing((prev) => ({ ...prev, [classKey]: false }));
    }
  };

  const handleReactivate = async (classKey: string) => {
    const submission = client.allSubmissions.find((s) => s.classOfBusiness === classKey);
    if (!submission) return;
    setReactivating((prev) => ({ ...prev, [classKey]: true }));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/resend-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token ?? ""}` },
        body: JSON.stringify({ client_id: client.id, submission_id: submission.id, mode: "invite" }),
      });
      if (res.ok) {
        toast.success(`Reactivated — invite sent to ${client.contactEmail}`);
        setClient((c) => c && {
          ...c,
          allSubmissions: c.allSubmissions.map((s) =>
            s.id === submission.id ? { ...s, status: (s.completionPct ?? 0) > 0 ? "in_progress" : "not_started" } : s
          ),
        });
      } else {
        const data = await res.json() as { error?: string };
        toast.error(data.error ?? "Failed to reactivate");
      }
    } catch {
      toast.error("Failed to reactivate");
    } finally {
      setReactivating((prev) => ({ ...prev, [classKey]: false }));
    }
  };

  const handleInitiateProduct = async (classKey: string) => {
    if (!client) return;
    setInitiatingClass(classKey);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/add-class", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token ?? ""}` },
        body: JSON.stringify({ client_id: client.id, class_of_business: classKey }),
      });
      const data = await res.json() as { error?: string; magicUrl?: string };
      if (!res.ok) throw new Error(data.error ?? "Unknown error");
      const label = ALL_PRODUCT_CLASSES.find((c) => c.key === classKey)?.label ?? classKey;
      if (data.magicUrl) {
        setPendingMagicLink({ url: data.magicUrl, label });
      } else {
        toast.success(`${label} form initiated — invite sent`);
        setTimeout(() => window.location.reload(), 1500);
      }
    } catch (err) {
      console.error("Failed to initiate product:", err);
      toast.error("Failed to initiate — please try again");
    } finally {
      setInitiatingClass(null);
    }
  };

  const handleCopyLink = async (classKey: string, url: string) => {
    await navigator.clipboard.writeText(url);
    setCopiedLink(classKey);
    setTimeout(() => setCopiedLink(null), 2000);
  };

  const handleInitiateRenewal = (classKey: string) => {
    const SECONDS = 5;
    localStorage.setItem(`renewal_countdown_${id}_${classKey}`, String(Date.now() + SECONDS * 1000));
    setRenewalCountdown((prev) => ({ ...prev, [classKey]: SECONDS }));
    renewalTimerRefs.current[classKey] = setInterval(() => {
      setRenewalCountdown((prev) => {
        const current = prev[classKey] ?? 0;
        if (current <= 1) {
          clearInterval(renewalTimerRefs.current[classKey]);
          delete renewalTimerRefs.current[classKey];
          localStorage.removeItem(`renewal_countdown_${id}_${classKey}`);
          executeRenewalRef.current(classKey);
          const next = { ...prev };
          delete next[classKey];
          return next;
        }
        return { ...prev, [classKey]: current - 1 };
      });
    }, 1000);
  };

  const handleUndoRenewal = (classKey: string) => {
    if (renewalTimerRefs.current[classKey]) {
      clearInterval(renewalTimerRefs.current[classKey]);
      delete renewalTimerRefs.current[classKey];
    }
    localStorage.removeItem(`renewal_countdown_${id}_${classKey}`);
    setRenewalCountdown((prev) => { const next = { ...prev }; delete next[classKey]; return next; });
    toast("Renewal cancelled");
  };

  return (
    <><div className="min-h-screen bg-silver/30">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <button onClick={() => navigate("/dashboard")} className="text-navy text-helper hover:underline mb-6 inline-block">
          ← Dashboard
        </button>

        {/* Client header */}
        <FormCard>
          <h1 className="mb-3">{client.companyName}</h1>
          <div className="flex flex-wrap gap-6 text-helper">
            <div>
              <span className="text-helper block">Contact</span>
              <span className="text-text-primary">{client.contactName}</span>
            </div>
            <div>
              <span className="text-helper block">Email</span>
              <span className="text-text-primary">{client.contactEmail}</span>
            </div>
          </div>
        </FormCard>

        {/* Products — all actions live here */}
        <FormCard>
          <h3 className="mb-4">Products</h3>
          <div className="space-y-3">
            {ALL_PRODUCT_CLASSES.filter((p) => licensedClasses.includes(p.key)).map((product) => {
              // All submissions for this class, newest first
              const classSubs = client.allSubmissions
                .filter((s) => s.classOfBusiness === product.key)
                .sort((a, b) => (b.policyYear ?? 0) - (a.policyYear ?? 0));
              const submission  = classSubs[0] ?? null; // most recent
              const historySubs = classSubs.slice(1);   // prior years

              const renewalDate = submission ? calcRenewalDate(submission.renewalDate) : null;
              const withinTwoMonths = renewalDate ? (renewalDate.getTime() - Date.now()) <= 61 * 24 * 60 * 60 * 1000 : false;
              const isInitiating = initiatingClass === product.key;
              const linkForClass = magicLinks[product.key];
              const countdown = renewalCountdown[product.key] ?? null;

              return (
                <div key={product.key} className="border border-silver rounded-lg p-4">
                  {/* Row: name + status + actions */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-body font-medium text-text-primary">{product.label}</p>
                      {submission ? (
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <StatusBadge status={submission.status as any} />
                          {submission.status !== "submitted" && submission.completionPct > 0 && (
                            <span className="text-helper text-helper">{submission.completionPct}%</span>
                          )}
                          {submission.lastActivity && (
                            <span className="text-helper text-slate-400">
                              Last activity {new Date(submission.lastActivity).toLocaleDateString("en-GB")}
                            </span>
                          )}
                          {submission.status === "submitted" && renewalDate && (
                            <span className="text-helper text-slate-400">· Renewal {formatRenewal(renewalDate)}</span>
                          )}
                          {submission.reference && (
                            <span className="text-helper text-slate-400">· {submission.reference}</span>
                          )}
                          {submission.policyYear && (
                            <span className="text-helper text-slate-400">· {submission.policyYear}</span>
                          )}
                        </div>
                      ) : (
                        <p className="text-helper text-slate-400 mt-0.5">Not initiated</p>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {/* Not yet initiated */}
                      {!submission && (
                        <Button variant="secondary" size="sm" onClick={() => handleInitiateProduct(product.key)} disabled={isInitiating}>
                          {isInitiating ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Sending…</> : "Send form"}
                        </Button>
                      )}

                      {/* In progress: resend link */}
                      {submission && submission.status !== "submitted" && submission.status !== "lapsed" && (
                        <Button variant="secondary" size="sm" onClick={async () => {
                          const { data: { session: s } } = await supabase.auth.getSession();
                          await fetch("/api/resend-invite", {
                            method: "POST",
                            headers: { "Content-Type": "application/json", Authorization: `Bearer ${s?.access_token ?? ""}` },
                            body: JSON.stringify({ client_id: client.id, submission_id: submission.id, mode: "reminder" }),
                          });
                          toast.success("Reminder sent");
                        }}>
                          Resend link
                        </Button>
                      )}

                      {/* Submitted: download PDF */}
                      {submission?.status === "submitted" && (
                        <Button variant="secondary" size="sm" onClick={() => handleDownloadPDF(submission.id, submission.classOfBusiness, submission.reference)} disabled={downloading[submission.id]}>
                          {downloading[submission.id]
                            ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Generating…</>
                            : <><Download className="h-3.5 w-3.5 mr-1.5" />PDF</>}
                        </Button>
                      )}

                      {/* Submitted: initiate renewal */}
                      {(submission?.status === "submitted" || submission?.status === "referred") && (
                        countdown !== null ? (
                          <Button variant="secondary" size="sm" onClick={() => handleUndoRenewal(product.key)}
                            className="text-amber-600 border-amber-300 hover:text-amber-700">
                            Undo ({countdown}s)
                          </Button>
                        ) : withinTwoMonths ? (
                          <Button variant="secondary" size="sm" onClick={() => handleInitiateRenewal(product.key)} disabled={renewalFiring[product.key]}>
                            {renewalFiring[product.key] ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Initiating…</> : "Initiate renewal"}
                          </Button>
                        ) : renewalDate ? (
                          <Button variant="secondary" size="sm" disabled title={`Renewal due ${formatRenewal(renewalDate)}`}>
                            Renewal {formatRenewal(renewalDate)}
                          </Button>
                        ) : null
                      )}

                      {/* Lapsed: reactivate */}
                      {submission?.status === "lapsed" && (
                        <Button variant="secondary" size="sm" onClick={() => handleReactivate(product.key)} disabled={reactivating[product.key]}>
                          {reactivating[product.key] ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Reactivating…</> : "Reactivate"}
                        </Button>
                      )}

                      {/* Not started / in progress: mark as lapsed */}
                      {submission && (submission.status === "not_started" || submission.status === "in_progress") && (
                        <Button variant="ghost" size="sm" onClick={() => handleLapse(product.key)} disabled={lapsing[product.key]}
                          className="text-helper hover:text-error-red">
                          {lapsing[product.key] ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Updating…</> : "Lapse"}
                        </Button>
                      )}

                      {/* Compare quotes — available whenever the product has been initiated */}
                      {submission && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/clients/${client.id}/comparator?product=${product.key}`)}
                          className="text-accent-blue hover:text-navy gap-1.5"
                        >
                          <BarChart2 className="h-3.5 w-3.5" />
                          Compare quotes
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Copy link fallback */}
                  {linkForClass && (
                    <div className="mt-3 flex items-center gap-2 bg-slate-50 rounded-md px-3 py-2 border border-silver">
                      <span className="text-xs text-slate-600 flex-1 truncate">{linkForClass}</span>
                      <button onClick={() => handleCopyLink(product.key, linkForClass)} className="shrink-0 text-navy hover:text-navy/70">
                        {copiedLink === product.key ? <CheckCheck className="h-4 w-4 text-sage" /> : <Copy className="h-4 w-4" />}
                      </button>
                    </div>
                  )}

                  {/* Prior year history */}
                  {historySubs.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-silver/60 space-y-1.5">
                      <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide mb-2">Previous submissions</p>
                      {historySubs.map((h) => (
                        <div key={h.id} className="flex items-center justify-between gap-3">
                          <span className="text-helper text-slate-500">
                            {h.policyYear ? `${h.policyYear} · ` : ""}{h.reference ?? h.id}
                            {" · "}<span className="capitalize">{h.status.replace(/_/g, " ")}</span>
                          </span>
                          {h.status === "submitted" && (
                            <button
                              type="button"
                              onClick={() => handleDownloadPDF(h.id, h.classOfBusiness, h.reference)}
                              disabled={downloading[h.id]}
                              className="flex items-center gap-1 text-[11px] font-medium text-navy hover:text-navy/70 transition-colors disabled:opacity-50 shrink-0"
                            >
                              {downloading[h.id]
                                ? <Loader2 className="h-3 w-3 animate-spin" />
                                : <Download className="h-3 w-3" />
                              }
                              Download
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </FormCard>

        {/* GDPR — admin only */}
        {isAdmin && !client.anonymised && (
          <div className="mt-6 border border-red-200 rounded-lg p-5 bg-red-50">
            <div className="flex items-start gap-3">
              <ShieldAlert className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-body font-medium text-red-700 mb-1">GDPR — Anonymise client data</p>
                <p className="text-helper text-red-600 mb-4">
                  This will permanently anonymise all personal data for this client — their name, email address, and all company/contact details across every submission. Financial and risk data is retained for reporting purposes. This action cannot be undone.
                </p>
                <AnonymiseButton clientId={client.id} session={session} onDone={() => window.location.reload()} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>

    {/* Magic link modal */}
    {pendingMagicLink && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
          <h3 className="text-lg font-semibold text-navy mb-1">Form link ready</h3>
          <p className="text-sm text-muted-foreground mb-4">
            The invitation email may take a moment to arrive. Copy this link to send manually if needed.
          </p>
          <div className="flex items-center gap-2 bg-slate-50 rounded-md px-3 py-2 border border-silver mb-5">
            <span className="text-xs text-slate-600 flex-1 truncate">{pendingMagicLink.url}</span>
            <button onClick={async () => { await navigator.clipboard.writeText(pendingMagicLink.url); toast.success("Link copied!"); }}
              className="shrink-0 text-navy hover:text-navy/70">
              <Copy className="h-4 w-4" />
            </button>
          </div>
          <Button className="w-full" onClick={() => { setPendingMagicLink(null); window.location.reload(); }}>Done</Button>
        </div>
      </div>
    )}
    </>
  );
};

export default ClientViewPage;