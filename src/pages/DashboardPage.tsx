import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import StatusBadge from "@/components/StatusBadge";
import ProgressBar from "@/components/ProgressBar";
import { Button } from "@/components/ui/button";
import { Search, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import TenantLogo from "@/components/TenantLogo";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { downloadPDF } from "@/lib/generatePDF";

type SortKey = "companyName" | "status" | "renewalDate" | "lastActivity";
type SortDir = "asc" | "desc";

interface ClassBadge {
  key: string;
  status: string;
}

interface ClientRow {
  id: string;
  companyName: string;
  contactEmail: string;
  assignedBrokerId: string | null;
  status: string;
  completionPct: number;
  renewalDate: string | null;
  lastActivity: string | null;
  submissionId: string | null;
  reference: string | null;
  classes: ClassBadge[];
}

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, signOut, tenantId, isAdmin, displayName, isLoading: authLoading, logoUrl } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [productFilter, setProductFilter] = useState<string>("all");
  const [myClientsOnly, setMyClientsOnly] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("lastActivity");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!tenantId) {
      // user is null = not logged in yet, silently wait; user is set = real profile error
      if (user) {
        console.error("Dashboard: tenantId is null after auth resolved — user may not have a record in the users table");
        toast.error("Could not resolve your account. Please contact support.");
        setLoading(false);
      }
      return;
    }
    const load = async () => {
      const { data, error } = await supabase
        .from("clients")
        .select(`
          id,
          display_name,
          contact_email,
          assigned_broker_id,
          submissions (
            id,
            status,
            completion_pct,
            reference,
            last_activity,
            renewal_date,
            class_of_business
          )
        `)
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Failed to load clients:", error);
        toast.error(`Failed to load clients: ${error.message}`);
        setLoading(false);
        return;
      }

      const rows: ClientRow[] = (data ?? []).map((c) => {
        const allSubs = c.submissions ?? [];
        // Primary = trade credit; drive status from that
        const sub = allSubs.find((s) => s.class_of_business === "trade_credit") ?? allSubs[0];
        // Next renewal = earliest upcoming renewal across all subs
        const nextRenewal = allSubs.reduce<string | null>((best, s) => {
          if (!s.renewal_date) return best;
          const start = new Date(s.renewal_date);
          const renewal = start.getTime() > Date.now() ? start : new Date(start.setFullYear(start.getFullYear() + 1));
          if (!best) return renewal.toISOString();
          return renewal.getTime() < new Date(best).getTime() ? renewal.toISOString() : best;
        }, null);
        return {
          id: c.id,
          companyName: c.display_name ?? "—",
          contactEmail: c.contact_email ?? "",
          assignedBrokerId: c.assigned_broker_id ?? null,
          status: sub?.status ?? "not_started",
          completionPct: sub?.completion_pct ?? 0,
          renewalDate: nextRenewal,
          lastActivity: allSubs.reduce<string | null>((latest, s) => {
            if (!s.last_activity) return latest;
            if (!latest) return s.last_activity;
            return new Date(s.last_activity) > new Date(latest) ? s.last_activity : latest;
          }, null),
          submissionId: sub?.id ?? null,
          reference: sub?.reference ?? null,
          classes: Object.values(
            allSubs.reduce<Record<string, ClassBadge>>((acc, s) => {
              const key = s.class_of_business ?? "trade_credit";
              const status = s.status ?? "not_started";
              // Keep the "most active" status per class (submitted > in_progress > not_started)
              const rank = (st: string) => st === "submitted" ? 3 : st === "in_progress" ? 2 : st === "referred" ? 2 : 1;
              if (!acc[key] || rank(status) > rank(acc[key].status)) acc[key] = { key, status };
              return acc;
            }, {})
          ),
        };
      });

      setClients(rows);
      setLoading(false);
    };

    load();
  }, [tenantId, authLoading]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const formatLastActivity = (dateStr: string | null): string => {
    if (!dateStr) return "—";
    const date = new Date(dateStr);
    const diffMs = Date.now() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays < 1) return "Today";
    if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
    if (diffDays < 14) return "A week ago";
    return date.toLocaleDateString("en-GB");
  };

  const formatRenewalDate = (policyStartDate: string | null): string => {
    if (!policyStartDate) return "—";
    const startDate = new Date(policyStartDate);
    // If policy start date is in the future, use it as-is; otherwise add 1 year
    const renewal = startDate.getTime() > Date.now()
      ? startDate
      : new Date(startDate.setFullYear(startDate.getFullYear() + 1));
    const diffMs = renewal.getTime() - Date.now();
    const twoMonthsMs = 61 * 24 * 60 * 60 * 1000;
    if (diffMs <= twoMonthsMs) {
      // Exact date: dd-mmm-yy
      const day = String(renewal.getDate()).padStart(2, "0");
      const month = renewal.toLocaleDateString("en-GB", { month: "short" });
      const year = renewal.getFullYear().toString().slice(-2);
      return `${day}-${month}-${year}`;
    }
    return renewal.toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
  };

  const filtered = useMemo(() => {
    const base = clients.filter((c) => {
      const matchSearch = c.companyName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchStatus =
        statusFilter === "all" ? true
        : statusFilter === "active" ? c.status !== "lapsed"
        : c.status === statusFilter;
      const matchBroker = isAdmin
        ? (myClientsOnly ? c.assignedBrokerId === user?.id : true)
        : c.assignedBrokerId === user?.id;
      const matchProduct = productFilter === "all" || c.classes.some((cl) => cl.key === productFilter);
      return matchSearch && matchStatus && matchBroker && matchProduct;
    });

    return [...base].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "companyName":
          cmp = a.companyName.localeCompare(b.companyName);
          break;
        case "status":
          cmp = a.status.localeCompare(b.status);
          break;
        case "renewalDate":
          cmp = (a.renewalDate ?? "").localeCompare(b.renewalDate ?? "");
          break;
        case "lastActivity":
          cmp = (a.lastActivity ?? "").localeCompare(b.lastActivity ?? "");
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [clients, searchQuery, statusFilter, sortKey, sortDir]);

  const activeCount = clients.filter((c) => c.status !== "lapsed").length;
  const inProgressCount = clients.filter((c) => c.status === "in_progress").length;
  const submittedCount = clients.filter((c) => c.status === "submitted").length;
  const renewalCount = clients.filter((c) => {
    if (!c.renewalDate) return false;
    const startDate = new Date(c.renewalDate);
    const renewal = startDate.getTime() > Date.now()
      ? startDate
      : new Date(startDate.setFullYear(startDate.getFullYear() + 1));
    const diff = renewal.getTime() - Date.now();
    return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000;
  }).length;

  const StatCard: React.FC<{ value: number; label: string; highlight?: boolean }> = ({ value, label, highlight }) => (
    <div className="bg-card rounded-lg shadow-card p-6">
      <div className={`text-[32px] font-bold ${highlight ? "text-accent-blue" : "text-navy"}`}>{value}</div>
      <div className="text-helper text-helper">{label}</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-silver/30">
      <header className="sticky top-0 z-40 h-16 bg-card border-b border-silver flex items-center justify-between px-6">
        <div className="flex items-center gap-8">
          <TenantLogo src={logoUrl} className="h-8 w-auto" />
          <nav className="hidden md:flex items-center gap-6">
            <span className="text-body font-medium text-navy border-b-2 border-navy pb-1">Dashboard</span>
            <button onClick={() => navigate("/analytics")} className="text-body text-helper hover:text-navy transition-colors">Analytics</button>
            {isAdmin && (
              <button onClick={() => navigate("/admin")} className="text-body text-helper hover:text-navy transition-colors">Admin</button>
            )}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-body text-text-primary hidden md:block">{displayName ?? user?.email}</span>
          <Button variant="ghost" size="sm" onClick={signOut}>Log out</Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard value={activeCount} label="Active clients" />
          <StatCard value={inProgressCount} label="In progress" />
          <StatCard value={submittedCount} label="Submitted this month" />
          <StatCard value={renewalCount} label="Renewals due within 30 days" highlight />
        </div>

        <div className="bg-card rounded-lg shadow-card">
          <div className="flex flex-col md:flex-row md:items-center justify-between p-6 pb-4 gap-4">
            <h2>Clients</h2>
            <Button onClick={() => navigate("/clients/new")}>+ New client</Button>
          </div>

          <div className="flex flex-col md:flex-row gap-3 px-6 pb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-helper" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by company name…"
                className="w-full h-10 pl-10 pr-3 text-body border border-silver rounded-md focus:outline-none focus:ring-2 focus:ring-accent-blue"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-10 px-3 text-body border border-silver rounded-md focus:outline-none focus:ring-2 focus:ring-accent-blue bg-card"
            >
              <option value="active">Active</option>
              <option value="all">All statuses</option>
              <option value="not_started">Not started</option>
              <option value="in_progress">In progress</option>
              <option value="submitted">Submitted</option>
              <option value="referred">Referred</option>
              <option value="lapsed">Lapsed</option>
            </select>
            <select
              value={productFilter}
              onChange={(e) => setProductFilter(e.target.value)}
              className="h-10 px-3 text-body border border-silver rounded-md focus:outline-none focus:ring-2 focus:ring-accent-blue bg-card"
            >
              <option value="all">All products</option>
              <option value="trade_credit">Trade Credit</option>
              <option value="cyber">Cyber</option>
              <option value="dno">D&O</option>
              <option value="terrorism">Terrorism</option>
            </select>
            {isAdmin && (
              <div className="flex h-10 rounded-md border border-silver overflow-hidden">
                <button
                  onClick={() => setMyClientsOnly(true)}
                  className={`px-4 text-body transition-colors ${
                    myClientsOnly
                      ? "bg-navy text-white"
                      : "bg-card text-navy hover:bg-silver/30"
                  }`}
                >
                  My clients
                </button>
                <button
                  onClick={() => setMyClientsOnly(false)}
                  className={`px-4 text-body border-l border-silver transition-colors ${
                    !myClientsOnly
                      ? "bg-navy text-white"
                      : "bg-card text-navy hover:bg-silver/30"
                  }`}
                >
                  All clients
                </button>
              </div>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 text-accent-blue animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-helper text-helper">
              {searchQuery || statusFilter !== "all" ? "No clients match your filters." : "No clients yet — add your first client above."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-body">
                <thead>
                  <tr className="border-b border-silver border-t">
                    <th className="text-left text-label text-helper px-6 py-3 font-medium cursor-pointer select-none hover:text-navy transition-colors" onClick={() => handleSort("companyName")}>
                      <span className="inline-flex items-center gap-1">
                        Company name
                        {sortKey === "companyName" && (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                      </span>
                    </th>
                    <th className="text-left text-label text-helper px-3 py-3 font-medium cursor-pointer select-none hover:text-navy transition-colors" onClick={() => handleSort("status")}>
                      <span className="inline-flex items-center gap-1">
                        Status
                        {sortKey === "status" && (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                      </span>
                    </th>
                    <th className="text-left text-label text-helper px-3 py-3 font-medium hidden md:table-cell">Progress</th>
                    <th className="text-left text-label text-helper px-3 py-3 font-medium hidden lg:table-cell cursor-pointer select-none hover:text-navy transition-colors" onClick={() => handleSort("lastActivity")}>
                      <span className="inline-flex items-center gap-1">
                        Last activity
                        {sortKey === "lastActivity" && (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                      </span>
                    </th>
                    <th className="text-left text-label text-helper px-3 py-3 font-medium hidden lg:table-cell cursor-pointer select-none hover:text-navy transition-colors" onClick={() => handleSort("renewalDate")}>
                      <span className="inline-flex items-center gap-1">
                        Renewal date
                        {sortKey === "renewalDate" && (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((client) => (
                    <tr key={client.id} className="border-b border-silver/50 hover:bg-ice-blue/20 transition-colors">
                      <td className="px-6 py-3">
                        <button onClick={() => navigate(`/clients/${client.id}`)} className="font-medium text-navy hover:underline text-left">{client.companyName}</button>
                        {client.classes.length > 1 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {client.classes.map((cls) => {
                              const label = cls.key === "trade_credit" ? "TC" : cls.key === "dno" ? "D&O" : cls.key.charAt(0).toUpperCase() + cls.key.slice(1);
                              const colour =
                                cls.key === "trade_credit" ? "bg-navy/10 text-navy" :
                                cls.key === "cyber"        ? "bg-accent-blue/10 text-accent-blue" :
                                cls.key === "dno"          ? "bg-purple-100 text-purple-700" :
                                                             "bg-amber-100 text-amber-700";
                              return (
                                <span key={cls.key} className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${colour}`}>
                                  {label}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <StatusBadge status={client.status as any} />
                      </td>
                      <td className="px-3 py-3 hidden md:table-cell">
                        <div className="w-20">
                          <ProgressBar value={client.completionPct} />
                        </div>
                      </td>
                      <td className="px-3 py-3 text-helper hidden lg:table-cell">
                        {formatLastActivity(client.lastActivity)}
                      </td>
                      <td className="px-3 py-3 text-helper hidden lg:table-cell">
                        {formatRenewalDate(client.renewalDate)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex items-center justify-between px-6 py-4 border-t border-silver">
            <span className="text-helper text-helper">Showing 1–{filtered.length} of {filtered.length}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled>
                <ChevronLeft className="h-4 w-4" /> Previous
              </Button>
              <Button variant="outline" size="sm" disabled>
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default DashboardPage;