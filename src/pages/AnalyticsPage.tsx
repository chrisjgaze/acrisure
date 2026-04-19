import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import FormCard from "@/components/FormCard";
import { Loader2, ArrowLeft, Users, FileCheck, RefreshCw, TrendingUp } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import TenantLogo from "@/components/TenantLogo";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

const CLASS_LABELS: Record<string, string> = {
  trade_credit: "Trade Credit",
  cyber: "Cyber",
  dno: "D&O",
  terrorism: "Terrorism",
};

const CLASS_COLOURS: Record<string, string> = {
  trade_credit: "bg-navy",
  cyber: "bg-accent-blue",
  dno: "bg-purple-500",
  terrorism: "bg-amber-500",
};

interface AnalyticsData {
  totalClients: number;
  totalSubmissions: number;
  submittedCount: number;
  inProgressCount: number;
  renewalCount: number;
  byClass: { key: string; label: string; count: number; submitted: number }[];
  byIndustry: { label: string; count: number }[];
  byTurnoverBand: { band: string; count: number }[];
  renewalsThisYear: number;
  renewalsNextYear: number;
}

const TURNOVER_BANDS = [
  { label: "Under £1m",    min: 0,          max: 1_000_000 },
  { label: "£1m – £5m",   min: 1_000_000,  max: 5_000_000 },
  { label: "£5m – £25m",  min: 5_000_000,  max: 25_000_000 },
  { label: "£25m – £100m",min: 25_000_000, max: 100_000_000 },
  { label: "£100m+",      min: 100_000_000,max: Infinity },
];

function getBand(val: number | null): string {
  if (val === null || val <= 0) return "Unknown";
  const b = TURNOVER_BANDS.find((b) => val >= b.min && val < b.max);
  return b?.label ?? "Unknown";
}

function BarChart({ data, colourFn }: {
  data: { label: string; count: number }[];
  colourFn?: (label: string) => string;
}) {
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="space-y-2.5 mt-2">
      {data.map(({ label, count }) => (
        <div key={label} className="flex items-center gap-3">
          <span className="text-helper text-text-primary w-32 shrink-0 truncate" title={label}>{label}</span>
          <div className="flex-1 bg-silver/40 rounded-full h-3 overflow-hidden">
            <div
              className={`h-3 rounded-full transition-all duration-500 ${colourFn ? colourFn(label) : "bg-navy"}`}
              style={{ width: `${(count / max) * 100}%` }}
            />
          </div>
          <span className="text-helper font-medium text-text-primary w-6 text-right shrink-0">{count}</span>
        </div>
      ))}
    </div>
  );
}

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-card rounded-lg border border-silver p-5 flex items-start gap-4">
      <div className="p-2 bg-silver/30 rounded-md shrink-0">{icon}</div>
      <div>
        <p className="text-helper text-helper">{label}</p>
        <p className="text-2xl font-bold text-navy leading-tight">{value}</p>
        {sub && <p className="text-helper text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

const AnalyticsPage: React.FC = () => {
  const navigate = useNavigate();
  const { tenantId, authLoading, isAdmin, logoUrl } = useAuth();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading || !tenantId) return;

    const load = async () => {
      try {
        // Fetch clients + submissions (with related data) in parallel.
        // submission_company and submission_turnover_by_country are read via
        // embedded relationships through submissions — direct queries on those
        // tables are blocked by RLS for broker JWTs.
        const [{ data: clients, error: cErr }, { data: subs, error: sErr }] = await Promise.all([
          supabase.from("clients").select("id").eq("tenant_id", tenantId),
          supabase
            .from("submissions")
            .select(`
              id, status, class_of_business, policy_year,
              submission_company ( nature_of_business ),
              submission_turnover_by_country ( annual_turnover )
            `)
            .eq("tenant_id", tenantId),
        ]);

        if (cErr || sErr) {
          toast.error("Failed to load analytics");
          setLoading(false);
          return;
        }

        // Flatten related data back into flat arrays for processing
        const companyRows = (subs ?? [])
          .map((s) => ({ submission_id: s.id, nature_of_business: (s.submission_company as any)?.nature_of_business ?? null }))
          .filter((r) => r.nature_of_business);

        const turnoverRows = (subs ?? []).flatMap((s) =>
          ((s.submission_turnover_by_country as any[]) ?? []).map((t) => ({
            submission_id: s.id,
            annual_turnover: t.annual_turnover,
          }))
        );

        const allSubs = subs ?? [];
        const currentYear = new Date().getFullYear();

        // By class
        const classCounts: Record<string, { count: number; submitted: number }> = {};
        for (const s of allSubs) {
          const k = s.class_of_business ?? "trade_credit";
          if (!classCounts[k]) classCounts[k] = { count: 0, submitted: 0 };
          classCounts[k].count++;
          if (s.status === "submitted") classCounts[k].submitted++;
        }
        const byClass = Object.entries(classCounts).map(([key, v]) => ({
          key,
          label: CLASS_LABELS[key] ?? key,
          ...v,
        })).sort((a, b) => b.count - a.count);

        // By industry (nature_of_business from submission_company)
        // Dedupe: one entry per client by using the first company row per unique name
        const seenIndustry = new Set<string>();
        const industryCounts: Record<string, number> = {};
        for (const row of companyRows ?? []) {
          const k = (row.nature_of_business ?? "").trim();
          if (!k || seenIndustry.has(row.submission_id)) continue;
          seenIndustry.add(row.submission_id);
          industryCounts[k] = (industryCounts[k] ?? 0) + 1;
        }
        const byIndustry = Object.entries(industryCounts)
          .map(([label, count]) => ({ label, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 8);

        // By turnover band — sum annual_turnover across all countries per submission
        const turnoverBySubmission: Record<string, number> = {};
        for (const r of turnoverRows ?? []) {
          const val = typeof r.annual_turnover === "number" ? r.annual_turnover : parseFloat(r.annual_turnover ?? "0") || 0;
          turnoverBySubmission[r.submission_id] = (turnoverBySubmission[r.submission_id] ?? 0) + val;
        }
        const turnoverMap: Record<string, number> = {};
        for (const [, total] of Object.entries(turnoverBySubmission)) {
          const band = getBand(total > 0 ? total : null);
          turnoverMap[band] = (turnoverMap[band] ?? 0) + 1;
        }
        const bandOrder = [...TURNOVER_BANDS.map((b) => b.label), "Unknown"];
        const byTurnoverBand = bandOrder
          .filter((b) => turnoverMap[b])
          .map((band) => ({ band, count: turnoverMap[band] }));

        // Renewals
        const renewalsThisYear = allSubs.filter((s) => s.policy_year === currentYear).length;
        const renewalsNextYear = allSubs.filter((s) => s.policy_year === currentYear + 1).length;

        setData({
          totalClients: (clients ?? []).length,
          totalSubmissions: allSubs.length,
          submittedCount: allSubs.filter((s) => s.status === "submitted").length,
          inProgressCount: allSubs.filter((s) => s.status === "in_progress").length,
          renewalCount: renewalsNextYear,
          byClass,
          byIndustry,
          byTurnoverBand,
          renewalsThisYear,
          renewalsNextYear,
        });
      } catch (err) {
        console.error(err);
        toast.error("Failed to load analytics");
      }
      setLoading(false);
    };

    load();
  }, [tenantId, authLoading]);

  return (
    <div className="min-h-screen bg-silver/30">
      <header className="sticky top-0 z-40 h-16 bg-card border-b border-silver flex items-center justify-between px-6">
        <div className="flex items-center gap-8">
          <TenantLogo src={logoUrl} className="h-8 w-auto" />
          <nav className="hidden md:flex items-center gap-6">
            <button onClick={() => navigate("/dashboard")} className="text-body text-helper hover:text-navy transition-colors">Dashboard</button>
            <span className="text-body font-medium text-navy border-b-2 border-navy pb-1">Analytics</span>
            {isAdmin && (
              <button onClick={() => navigate("/admin")} className="text-body text-helper hover:text-navy transition-colors">Admin</button>
            )}
          </nav>
        </div>
        <button onClick={() => navigate("/dashboard")} className="flex items-center gap-2 text-body text-helper hover:text-navy transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
      </header>

      <main className="max-w-5xl mx-auto px-4 md:px-6 py-8">
        <h1 className="mb-1">Portfolio analytics</h1>
        <p className="text-helper text-helper mb-8">Overview of your client portfolio and submission activity</p>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-6 w-6 text-accent-blue animate-spin" />
          </div>
        ) : data ? (
          <>
            {/* Stat cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <StatCard
                icon={<Users className="h-5 w-5 text-navy" />}
                label="Total clients"
                value={data.totalClients}
              />
              <StatCard
                icon={<FileCheck className="h-5 w-5 text-sage" />}
                label="Submissions"
                value={data.submittedCount}
                sub={`${data.inProgressCount} in progress`}
              />
              <StatCard
                icon={<RefreshCw className="h-5 w-5 text-accent-blue" />}
                label="Renewals due"
                value={data.renewalsNextYear}
                sub={`${data.renewalsThisYear} this policy year`}
              />
              <StatCard
                icon={<TrendingUp className="h-5 w-5 text-purple-500" />}
                label="Total submissions"
                value={data.totalSubmissions}
                sub={`across ${data.byClass.length} product${data.byClass.length !== 1 ? "s" : ""}`}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* Products quoted */}
              <FormCard title="Products quoted">
                {data.byClass.length === 0 ? (
                  <p className="text-helper text-helper">No submissions yet</p>
                ) : (
                  <BarChart
                    data={data.byClass.map((c) => ({ label: c.label, count: c.count }))}
                    colourFn={(label) => {
                      const entry = data.byClass.find((c) => c.label === label);
                      return entry ? (CLASS_COLOURS[entry.key] ?? "bg-navy") : "bg-navy";
                    }}
                  />
                )}
                {data.byClass.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-silver grid grid-cols-2 gap-2">
                    {data.byClass.map((c) => (
                      <div key={c.key} className="flex items-center justify-between text-helper">
                        <span className="text-text-primary">{c.label}</span>
                        <span className="text-helper">{c.submitted} submitted</span>
                      </div>
                    ))}
                  </div>
                )}
              </FormCard>

              {/* Turnover size */}
              <FormCard title="Client size by turnover">
                {data.byTurnoverBand.length === 0 ? (
                  <p className="text-helper text-helper">No turnover data yet</p>
                ) : (
                  <BarChart data={data.byTurnoverBand.map((b) => ({ label: b.band, count: b.count }))} />
                )}
              </FormCard>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Industry breakdown */}
              <FormCard title="Industry breakdown">
                {data.byIndustry.length === 0 ? (
                  <p className="text-helper text-helper">No industry data yet</p>
                ) : (
                  <BarChart data={data.byIndustry} />
                )}
              </FormCard>

              {/* Renewal pipeline */}
              <FormCard title="Renewal pipeline">
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-silver/20 rounded-lg">
                    <div>
                      <p className="text-body font-medium text-text-primary">{new Date().getFullYear()} policy year</p>
                      <p className="text-helper text-helper">Current submissions</p>
                    </div>
                    <span className="text-2xl font-bold text-navy">{data.renewalsThisYear}</span>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <div>
                      <p className="text-body font-medium text-text-primary">{new Date().getFullYear() + 1} policy year</p>
                      <p className="text-helper text-helper">Renewals initiated</p>
                    </div>
                    <span className="text-2xl font-bold text-amber-600">{data.renewalsNextYear}</span>
                  </div>
                  {data.totalSubmissions > 0 && (
                    <div className="pt-2">
                      <div className="flex justify-between text-helper mb-1">
                        <span className="text-text-primary">Submission rate</span>
                        <span className="font-medium">{Math.round((data.submittedCount / data.totalSubmissions) * 100)}%</span>
                      </div>
                      <div className="w-full h-2 bg-silver/40 rounded-full overflow-hidden">
                        <div
                          className="h-2 bg-sage rounded-full"
                          style={{ width: `${(data.submittedCount / data.totalSubmissions) * 100}%` }}
                        />
                      </div>
                      <p className="text-helper text-slate-400 mt-1">{data.submittedCount} of {data.totalSubmissions} submissions completed</p>
                    </div>
                  )}
                </div>
              </FormCard>
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
};

export default AnalyticsPage;
