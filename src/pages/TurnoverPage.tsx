import React, { useState, useEffect, useRef, useCallback } from "react";
import FormShell from "@/components/FormShell";
import FormCard from "@/components/FormCard";
import FormInput from "@/components/FormInput";
import DateInput from "@/components/DateInput";
import SearchableSelect from "@/components/SearchableSelect";
import { Button } from "@/components/ui/button";
import { currencyOptions, countryOptions } from "@/data/staticData";
import { parseFileToRows, parsePasteToRows, parseNumericValue } from "@/lib/parseSpreadsheet";
import { Trash2, Plus, ChevronDown, ChevronUp, Loader2, Upload, ClipboardList } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { filterNumericValue } from "@/lib/numericInput";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { useStepCompletion } from "@/lib/formProgress";
import { PrefilledBanner } from "@/components/PrefilledBanner";


interface TurnoverRow {
  id: string;
  country: string;
  turnover: string;
  accounts: string;
  normalTerms: string;
  maxTerms: string;
}

interface TradingHistoryRow {
  id: string;
  yearEnd: { day: string; month: string; year: string };
  turnover: string;
  badDebt: string;
  lossCount: string;
  showDetail: boolean;
  largestLoss: string;
  debtorName: string;
}

const TurnoverPage: React.FC = () => {
  const navigate = useNavigate();
  const submissionId = sessionStorage.getItem("ff_submission_id");

  useEffect(() => {
    if (!submissionId) navigate("/", { replace: true });
  }, [submissionId, navigate]);

  const [pageLoading, setPageLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [renewalTurnoverConfirmed, setRenewalTurnoverConfirmed] = useState(false);
  const [renewalHistoryConfirmed, setRenewalHistoryConfirmed] = useState(false);
  const [isRenewal, setIsRenewal] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isRenewalSync = parseInt(sessionStorage.getItem("ff_policy_year") ?? "0") > new Date().getFullYear();
  const { completedSteps, refresh: refreshSteps } = useStepCompletion(submissionId, isRenewalSync);

  const [currency, setCurrency] = useState("GBP");
  const [turnoverRows, setTurnoverRows] = useState<TurnoverRow[]>([
    { id: "1", country: "", turnover: "", accounts: "", normalTerms: "", maxTerms: "" },
  ]);
  const [expandedMobile, setExpandedMobile] = useState<string | null>(null);
  const [showHistoryPaste, setShowHistoryPaste] = useState(false);
  const [historyPasteData, setHistoryPasteData] = useState("");
  const [historyImported, setHistoryImported] = useState(false);
  const historyFileRef = React.useRef<HTMLInputElement>(null);

  const currentYear = new Date().getFullYear();
  const [historyRows, setHistoryRows] = useState<TradingHistoryRow[]>(
    Array.from({ length: 5 }, (_, i) => ({
      id: String(i + 1),
      yearEnd: { day: "31", month: "12", year: String(currentYear - i) },
      turnover: "",
      badDebt: "",
      lossCount: "",
      showDetail: false,
      largestLoss: "",
      debtorName: "",
    }))
  );

  // Load existing data
  useEffect(() => {
    if (!submissionId) return;
    const load = async () => {
      const [{ data: sub }, { data: financial }, { data: turnover }, { data: history }] = await Promise.all([
        supabase.from("submissions").select("policy_year").eq("id", submissionId).single(),
        supabase.from("submission_financial").select("currency").eq("submission_id", submissionId).maybeSingle(),
        supabase.from("submission_turnover_by_country").select("*").eq("submission_id", submissionId).order("sort_order"),
        supabase.from("submission_loss_history").select("*").eq("submission_id", submissionId).order("sort_order"),
      ]);

      const renewal = (sub?.policy_year ?? 0) > new Date().getFullYear();
      if (renewal) setIsRenewal(true);

      if (financial?.currency) setCurrency(financial.currency);

      if (turnover && turnover.length > 0) {
        setTurnoverRows(turnover.map((r) => ({
          id: r.id,
          country: r.country_of_trade ?? "",
          turnover: r.annual_turnover?.toString() ?? "",
          accounts: r.number_of_accounts?.toString() ?? "",
          normalTerms: r.normal_payment_terms ?? "",
          maxTerms: r.max_payment_terms ?? "",
        })));
      }

      if (history && history.length > 0) {
        setHistoryRows(history.map((r, i) => {
          const d = r.financial_year_ending ? r.financial_year_ending.split("-") : ["", "", ""];
          return {
            id: r.id,
            yearEnd: { year: d[0], month: d[1], day: d[2] },
            turnover: r.turnover?.toString() ?? "",
            badDebt: r.net_bad_debt_losses?.toString() ?? "",
            lossCount: r.number_of_losses?.toString() ?? "",
            showDetail: false,
            largestLoss: r.largest_individual_loss?.toString() ?? "",
            debtorName: r.largest_loss_name ?? "",
          };
        }));
      }

      setPageLoading(false);
    };
    load();
  }, [submissionId]);

  const save = useCallback(async () => {
    if (!submissionId) return;
    setSaving(true);

    try {
      // Save currency to submission_financial
      await supabase.from("submission_financial").upsert(
        { submission_id: submissionId, currency },
        { onConflict: "submission_id" }
      );

      // Save turnover rows — delete and reinsert
      await supabase.from("submission_turnover_by_country").delete().eq("submission_id", submissionId);
      const turnoverPayload = turnoverRows
        .filter((r) => r.country)
        .map((r, i) => ({
          submission_id: submissionId,
          country_of_trade: r.country,
          annual_turnover: r.turnover ? parseFloat(r.turnover) : null,
          number_of_accounts: r.accounts ? parseInt(r.accounts) : null,
          normal_payment_terms: r.normalTerms || null,
          max_payment_terms: r.maxTerms || null,
          sort_order: i,
        }));
      if (turnoverPayload.length > 0) {
        await supabase.from("submission_turnover_by_country").insert(turnoverPayload);
      }

      // Save loss history rows — delete and reinsert
      await supabase.from("submission_loss_history").delete().eq("submission_id", submissionId);
      const historyPayload = historyRows
        .filter((r) => r.yearEnd.year && r.yearEnd.month && r.yearEnd.day)
        .map((r, i) => ({
          submission_id: submissionId,
          financial_year_ending: `${r.yearEnd.year}-${r.yearEnd.month.padStart(2, "0")}-${r.yearEnd.day.padStart(2, "0")}`,
          turnover: r.turnover ? parseFloat(r.turnover) : null,
          net_bad_debt_losses: r.badDebt ? parseFloat(r.badDebt) : null,
          number_of_losses: r.lossCount ? parseInt(r.lossCount) : null,
          largest_individual_loss: r.largestLoss ? parseFloat(r.largestLoss) : null,
          largest_loss_name: r.debtorName || null,
          sort_order: i,
        }));
      if (historyPayload.length > 0) {
        await supabase.from("submission_loss_history").insert(historyPayload);
      }

      await Promise.all([
        supabase.from("submissions").update({ completion_pct: 50, last_activity: new Date().toISOString() }).eq("id", submissionId).lt("completion_pct", 50),
        supabase.from("submissions").update({ status: "in_progress" }).eq("id", submissionId).eq("status", "not_started"),
      ]);
      refreshSteps();
    } catch {
      toast.error("Failed to save");
    }

    setSaving(false);
  }, [submissionId, currency, turnoverRows, historyRows]);

  useEffect(() => {
    if (pageLoading) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(save, 1000);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [save, pageLoading]);

  const addTurnoverRow = () => {
    setTurnoverRows([...turnoverRows,
      { id: Date.now().toString(), country: "", turnover: "", accounts: "", normalTerms: "", maxTerms: "" }
    ]);
  };

  const removeTurnoverRow = (id: string) => {
    if (turnoverRows.length <= 1) return;
    setTurnoverRows(turnoverRows.filter((r) => r.id !== id));
  };

  const updateTurnoverRow = (id: string, field: keyof TurnoverRow, value: string) => {
    setTurnoverRows(turnoverRows.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const parseHistoryData = (headers: string[], rows: string[][]) => {
    const find = (patterns: RegExp[]) =>
      headers.findIndex((h) => patterns.some((p) => p.test(h.toLowerCase())));

    const yearCol    = find([/year.*end|financial.*year|year$/i, /^year$/i, /^fy$/i]);
    const turnCol    = find([/turnover|revenue|sales|income/i]);
    const badDebtCol = find([/bad.*debt|net.*loss|debt.*loss/i]);
    const lossNoCol  = find([/no.*loss|number.*loss|loss.*count|losses/i]);
    const lgstLoss   = find([/largest|biggest|major.*loss|max.*loss/i]);
    const debtorCol  = find([/debtor|customer|buyer|name/i]);

    const parsed: TradingHistoryRow[] = rows
      .filter((r) => r.some((c) => c.trim()))
      .slice(0, 5)
      .map((r, i) => {
        // Try to parse year end date — accept "31/12/2024", "2024-12-31", or just "2024"
        let yearEnd = { day: "31", month: "12", year: String(currentYear - i) };
        if (yearCol !== -1 && r[yearCol]) {
          const raw = r[yearCol].trim();
          const ddmmyyyy = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
          const yyyymmdd = raw.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
          const justYear = raw.match(/^(\d{4})$/);
          if (ddmmyyyy) yearEnd = { day: ddmmyyyy[1].padStart(2,"0"), month: ddmmyyyy[2].padStart(2,"0"), year: ddmmyyyy[3] };
          else if (yyyymmdd) yearEnd = { day: yyyymmdd[3].padStart(2,"0"), month: yyyymmdd[2].padStart(2,"0"), year: yyyymmdd[1] };
          else if (justYear) yearEnd = { day: "31", month: "12", year: justYear[1] };
        }
        const num = (col: number) => col !== -1 && r[col] ? String(parseNumericValue(r[col]) ?? "") : "";
        return {
          id: Date.now().toString() + i,
          yearEnd,
          turnover: num(turnCol),
          badDebt: num(badDebtCol),
          lossCount: num(lossNoCol),
          showDetail: !!(lgstLoss !== -1 && r[lgstLoss]) || !!(debtorCol !== -1 && r[debtorCol]),
          largestLoss: num(lgstLoss),
          debtorName: debtorCol !== -1 ? (r[debtorCol] ?? "") : "",
        };
      });

    if (parsed.length === 0) { toast.error("No rows detected — check your data."); return; }
    setHistoryRows(parsed);
    setHistoryImported(true);
    setShowHistoryPaste(false);
    setHistoryPasteData("");
    toast.success(`${parsed.length} year${parsed.length !== 1 ? "s" : ""} imported — please review and confirm.`);
  };

  const handleHistoryPasteImport = () => {
    if (!historyPasteData.trim()) return;
    const { headers, rows } = parsePasteToRows(historyPasteData);
    if (headers.length === 0) { toast.error("No data detected — check your pasted content."); return; }
    parseHistoryData(headers, rows);
  };

  const handleHistoryFileUpload = async (file: File) => {
    try {
      const { headers, rows } = await parseFileToRows(file);
      if (headers.length === 0) { toast.error("No data found in file."); return; }
      parseHistoryData(headers, rows);
    } catch {
      toast.error("Could not read file — please try pasting instead.");
    }
  };

  const toggleHistoryDetail = (id: string) => {
    setHistoryRows(historyRows.map((r) => (r.id === id ? { ...r, showDetail: !r.showDetail } : r)));
  };

  const updateHistoryRow = (id: string, field: string, value: any) => {
    setHistoryRows(historyRows.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };

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
      onBack={() => navigate("/form/company")}
      onNext={() => navigate("/form/trading")}
    >
      <h1 className="mb-1">Financial profile</h1>
      <p className="text-helper text-helper mb-6">Part 1 of 2 — Turnover and trading history</p>

      <FormCard title="Currency" description="All figures in this form should be entered in the same currency.">
        <SearchableSelect
          options={currencyOptions}
          value={currency}
          onChange={setCurrency}
          displayValue={(o) => o.value}
        />
      </FormCard>

      <FormCard title="Insurable turnover by country" description="Exclude inter-company sales, sales to the UK public sector, and cash sales.">
        {isRenewal && !renewalTurnoverConfirmed && (
          <PrefilledBanner source="your previous year's submission" onConfirm={() => setRenewalTurnoverConfirmed(true)} />
        )}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-body">
            <thead>
              <tr className="border-b border-silver">
                <th className="text-left text-label text-helper pb-2 font-medium">Country of trade</th>
                <th className="text-left text-label text-helper pb-2 font-medium">Annual turnover ex VAT</th>
                <th className="text-left text-label text-helper pb-2 font-medium">Approx accounts</th>
                <th className="text-left text-label text-helper pb-2 font-medium">Normal terms</th>
                <th className="text-left text-label text-helper pb-2 font-medium">Max terms</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {turnoverRows.map((row) => (
                <tr key={row.id} className="row-enter border-b border-silver/50">
                  <td className="py-2 pr-2">
                    <SearchableSelect options={countryOptions} value={row.country} onChange={(v) => updateTurnoverRow(row.id, "country", v)} placeholder="Select" className="mb-0" />
                  </td>
                  <td className="py-2 pr-2">
                    <input type="text" inputMode="decimal" value={row.turnover} onChange={(e) => updateTurnoverRow(row.id, "turnover", filterNumericValue(e.target.value))} className="w-full h-10 px-3 text-body text-right border border-silver rounded-md focus:outline-none focus:ring-2 focus:ring-accent-blue" />
                  </td>
                  <td className="py-2 pr-2">
                    <input type="text" inputMode="numeric" value={row.accounts} onChange={(e) => updateTurnoverRow(row.id, "accounts", filterNumericValue(e.target.value))} className="w-full h-10 px-3 text-body text-right border border-silver rounded-md focus:outline-none focus:ring-2 focus:ring-accent-blue" />
                  </td>
                  <td className="py-2 pr-2">
                    <input type="text" inputMode="numeric" value={row.normalTerms} onChange={(e) => updateTurnoverRow(row.id, "normalTerms", filterNumericValue(e.target.value))} className="w-full h-10 px-3 text-body border border-silver rounded-md focus:outline-none focus:ring-2 focus:ring-accent-blue" />
                  </td>
                  <td className="py-2 pr-2">
                    <input type="text" inputMode="numeric" value={row.maxTerms} onChange={(e) => updateTurnoverRow(row.id, "maxTerms", filterNumericValue(e.target.value))} className="w-full h-10 px-3 text-body border border-silver rounded-md focus:outline-none focus:ring-2 focus:ring-accent-blue" />
                  </td>
                  <td className="py-2">
                    <button onClick={() => removeTurnoverRow(row.id)} className="p-2 text-helper hover:text-error-red transition-colors">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="md:hidden space-y-3">
          {turnoverRows.map((row) => (
            <div key={row.id} className="border border-silver rounded-md p-3">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <SearchableSelect options={countryOptions} value={row.country} onChange={(v) => updateTurnoverRow(row.id, "country", v)} placeholder="Select country" className="mb-2" />
                  <input type="text" inputMode="decimal" value={row.turnover} onChange={(e) => updateTurnoverRow(row.id, "turnover", filterNumericValue(e.target.value))} placeholder="Annual turnover" className="w-full h-10 px-3 text-body text-right border border-silver rounded-md focus:outline-none focus:ring-2 focus:ring-accent-blue" />
                </div>
                <button onClick={() => setExpandedMobile(expandedMobile === row.id ? null : row.id)} className="ml-2 p-1 text-helper">
                  {expandedMobile === row.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
              </div>
              {expandedMobile === row.id && (
                <div className="mt-3 space-y-2">
                  <FormInput placeholder="Approx accounts" value={row.accounts} onChange={(v) => updateTurnoverRow(row.id, "accounts", v)} numeric />
                  <FormInput placeholder="Normal terms" value={row.normalTerms} onChange={(v) => updateTurnoverRow(row.id, "normalTerms", v)} numeric />
                  <FormInput placeholder="Max terms" value={row.maxTerms} onChange={(v) => updateTurnoverRow(row.id, "maxTerms", v)} numeric />
                  <button onClick={() => removeTurnoverRow(row.id)} className="text-helper text-error-red hover:underline">Remove</button>
                </div>
              )}
            </div>
          ))}
        </div>

        <Button variant="ghost" onClick={addTurnoverRow} className="mt-3">
          <Plus className="h-4 w-4 mr-1" /> Add country
        </Button>
      </FormCard>

      <FormCard title="Trading history — last 5 years" description="Include current year estimated. Exclude inter-company, public sector, and cash sales.">
        {isRenewal && !renewalHistoryConfirmed && (
          <PrefilledBanner source="your previous year's submission" onConfirm={() => setRenewalHistoryConfirmed(true)} />
        )}

        {/* Import banner */}
        {historyImported && (
          <div className="flex items-center gap-3 bg-sage/10 border border-sage/30 rounded-lg px-4 py-3 mb-4">
            <span className="text-[13px] font-medium text-sage flex-1">Data imported — review the figures below and correct anything that needs adjusting.</span>
            <button onClick={() => setHistoryImported(false)} className="text-sage/60 hover:text-sage text-[11px]">Dismiss</button>
          </div>
        )}

        {/* Upload / paste buttons */}
        {!showHistoryPaste && (
          <div className="flex flex-wrap gap-2 mb-4">
            <Button variant="secondary" size="sm" onClick={() => historyFileRef.current?.click()} className="gap-2">
              <Upload className="h-3.5 w-3.5" /> Upload spreadsheet
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setShowHistoryPaste(true)} className="gap-2">
              <ClipboardList className="h-3.5 w-3.5" /> Paste from Excel
            </Button>
            <input ref={historyFileRef} type="file" accept=".xlsx,.csv" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleHistoryFileUpload(f); e.target.value = ""; }} />
          </div>
        )}

        {/* Paste area */}
        {showHistoryPaste && (
          <div className="mb-4 p-4 border border-silver rounded-lg bg-silver/10">
            <p className="text-helper text-slate-500 mb-2">Copy your trading history from Excel and paste below. Expected columns: <em>Year ending, Turnover, Bad debt losses, No. of losses, Largest loss, Debtor name</em></p>
            <textarea
              value={historyPasteData}
              onChange={(e) => setHistoryPasteData(e.target.value)}
              placeholder="Paste data here…"
              className="w-full min-h-[100px] p-3 text-body border border-silver rounded-md focus:outline-none focus:ring-2 focus:ring-accent-blue resize-y font-mono text-[12px]"
              autoFocus
            />
            <div className="flex gap-2 mt-2">
              <Button size="sm" onClick={handleHistoryPasteImport} disabled={!historyPasteData.trim()}>Import</Button>
              <Button variant="ghost" size="sm" onClick={() => { setShowHistoryPaste(false); setHistoryPasteData(""); }}>Cancel</Button>
            </div>
          </div>
        )}

        {/* Editable table */}
        <div className="overflow-x-auto">
          <table className="w-full text-body">
            <thead>
              <tr className="border-b border-silver">
                <th className="text-left text-label text-helper pb-2 font-medium">Financial year ending</th>
                <th className="text-left text-label text-helper pb-2 font-medium">Turnover ex VAT</th>
                <th className="text-left text-label text-helper pb-2 font-medium">Net bad debt losses</th>
                <th className="text-left text-label text-helper pb-2 font-medium">No. of losses</th>
                <th className="w-24"></th>
              </tr>
            </thead>
            <tbody>
              {historyRows.map((row) => (
                <React.Fragment key={row.id}>
                  <tr className="border-b border-silver/50">
                    <td className="py-2 pr-2">
                      <DateInput value={row.yearEnd} onChange={(v) => updateHistoryRow(row.id, "yearEnd", v)} className="mb-0" />
                    </td>
                    <td className="py-2 pr-2">
                      <input type="text" inputMode="decimal" value={row.turnover} onChange={(e) => updateHistoryRow(row.id, "turnover", filterNumericValue(e.target.value))} className="w-full h-10 px-3 text-body text-right border border-silver rounded-md focus:outline-none focus:ring-2 focus:ring-accent-blue" />
                    </td>
                    <td className="py-2 pr-2">
                      <input type="text" inputMode="decimal" value={row.badDebt} onChange={(e) => updateHistoryRow(row.id, "badDebt", filterNumericValue(e.target.value))} className="w-full h-10 px-3 text-body text-right border border-silver rounded-md focus:outline-none focus:ring-2 focus:ring-accent-blue" />
                    </td>
                    <td className="py-2 pr-2">
                      <input type="text" inputMode="numeric" value={row.lossCount} onChange={(e) => updateHistoryRow(row.id, "lossCount", filterNumericValue(e.target.value))} className="w-full h-10 px-3 text-body text-right border border-silver rounded-md focus:outline-none focus:ring-2 focus:ring-accent-blue" />
                    </td>
                    <td className="py-2">
                      <button onClick={() => toggleHistoryDetail(row.id)} className="text-accent-blue text-helper hover:underline whitespace-nowrap">
                        {row.showDetail ? "− Hide detail" : "+ Loss detail"}
                      </button>
                    </td>
                  </tr>
                  {row.showDetail && (
                    <tr className="row-enter">
                      <td colSpan={5} className="py-2 pl-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 bg-ice-blue/20 p-3 rounded-md">
                          <FormInput label="Largest individual loss" value={row.largestLoss} onChange={(v) => updateHistoryRow(row.id, "largestLoss", v)} rightAlign numeric className="mb-2" />
                          <FormInput label="Name of debtor" value={row.debtorName} onChange={(v) => updateHistoryRow(row.id, "debtorName", v)} className="mb-2" />
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </FormCard>
    </FormShell>
  );
};

export default TurnoverPage;