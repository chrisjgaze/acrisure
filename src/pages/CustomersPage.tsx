import React, { useState, useRef, useEffect, useCallback } from "react";
import FormShell from "@/components/FormShell";
import FormCard from "@/components/FormCard";
import FormInput from "@/components/FormInput";
import DateInput from "@/components/DateInput";
import SearchableSelect from "@/components/SearchableSelect";
import ToggleGroup from "@/components/ToggleGroup";
import SlideReveal from "@/components/SlideReveal";
import { Button } from "@/components/ui/button";
import { countryOptions, currencyOptions, idTypeOptions, debtBands } from "@/data/staticData";
import { Trash2, Plus, Upload, AlertTriangle, Check, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import Modal from "@/components/Modal";
import { useNavigate } from "react-router-dom";
import { filterNumericValue } from "@/lib/numericInput";
import { supabase } from "@/lib/supabase";
import { useStepCompletion } from "@/lib/formProgress";
import {
  parseFileToRows,
  parsePasteToRows,
  detectBuyerColumns,
  parseDebtorDistribution,
  normaliseCountryCode,
  normaliseCurrencyCode,
  parseNumericValue,
  type BuyerColumnMap,
  type ParsedSheet,
} from "@/lib/parseSpreadsheet";


interface BuyerRow {
  id: string;
  name: string;
  country: string;
  idType: string;
  idValue: string;
  currency: string;
  creditLimit: string;
  imported?: boolean;
}

interface OverdueRow {
  id: string;
  customerName: string;
  amount: string;
  dueDate: { day: string; month: string; year: string };
  actionTaken: string;
}

const CustomersPage: React.FC = () => {
  const navigate = useNavigate();
  const submissionId = sessionStorage.getItem("ff_submission_id");

  useEffect(() => {
    if (!submissionId) navigate("/", { replace: true });
  }, [submissionId, navigate]);

  const [pageLoading, setPageLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isRenewal = parseInt(sessionStorage.getItem("ff_policy_year") ?? "0") > new Date().getFullYear();
  const { completedSteps, refresh: refreshSteps } = useStepCompletion(submissionId, isRenewal);

  const [showMappingModal, setShowMappingModal] = useState(false);
  const [showBuyerPaste, setShowBuyerPaste] = useState(false);

  const [buyers, setBuyers] = useState<BuyerRow[]>([
    { id: "1", name: "", country: "", idType: "", idValue: "", currency: "GBP", creditLimit: "" },
  ]);

  const [debtorCounts, setDebtorCounts] = useState<string[]>(Array(debtBands.length).fill(""));
  const [debtorPcts, setDebtorPcts] = useState<string[]>(Array(debtBands.length).fill(""));

  const totalCount = debtorCounts.reduce((s, v) => s + (parseInt(v) || 0), 0);
  const totalPct = debtorPcts.reduce((s, v) => s + (parseFloat(v) || 0), 0);

  const [q1, setQ1] = useState("");
  const [q2, setQ2] = useState("");
  const [q3, setQ3] = useState("");
  const [q4, setQ4] = useState("");
  const [currentBalance, setCurrentBalance] = useState("");

  const [debtorFile, setDebtorFile] = useState<string | null>(null);
  const [debtorUploadProgress, setDebtorUploadProgress] = useState<number | null>(null);
  const [debtorProcessing, setDebtorProcessing] = useState(false);
  const debtorFileRef = useRef<HTMLInputElement>(null);
  const [debtorPasteData, setDebtorPasteData] = useState("");
  const [showDebtorPaste, setShowDebtorPaste] = useState(false);

  const [hasOverdue, setHasOverdue] = useState<boolean | null>(null);
  const [overdueRows, setOverdueRows] = useState<OverdueRow[]>([
    { id: "1", customerName: "", amount: "", dueDate: { day: "", month: "", year: "" }, actionTaken: "" },
  ]);

  const [pasteData, setPasteData] = useState("");
  const importFileRef = useRef<HTMLInputElement>(null);
  const [parsedSheet, setParsedSheet] = useState<ParsedSheet>({ headers: [], rows: [] });
  const [columnMap, setColumnMap] = useState<BuyerColumnMap>({ name: -1, country: -1, currency: -1, creditLimit: -1, idType: -1, idValue: -1 });
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importLoading, setImportLoading] = useState(false);

  // Load existing data
  useEffect(() => {
    if (!submissionId) return;
    const load = async () => {
      const [{ data: buyers_data }, { data: distribution }, { data: balances }, { data: overdue }] = await Promise.all([
        supabase.from("submission_buyers").select("*").eq("submission_id", submissionId).order("sort_order"),
        supabase.from("submission_debtor_distribution").select("*").eq("submission_id", submissionId).order("debt_band"),
        supabase.from("submission_debtor_balances").select("*").eq("submission_id", submissionId).maybeSingle(),
        supabase.from("submission_overdue_accounts").select("*").eq("submission_id", submissionId),
      ]);

      if (buyers_data && buyers_data.length > 0) {
        setBuyers(buyers_data.map((b) => ({
          id: b.id,
          name: b.buyer_name ?? "",
          country: b.country_code ?? "",
          idType: b.id_type ?? "",
          idValue: b.id_value ?? "",
          currency: b.currency ?? "GBP",
          creditLimit: b.credit_limit_requested?.toString() ?? "",
          imported: b.imported_via_ai ?? false,
        })));
      }

      if (distribution && distribution.length > 0) {
        const counts = Array(debtBands.length).fill("");
        const pcts = Array(debtBands.length).fill("");
        distribution.forEach((d) => {
          const i = debtBands.indexOf(d.debt_band);
          if (i >= 0) {
            counts[i] = d.number_of_debtors?.toString() ?? "";
            pcts[i] = d.debtor_balance_pct?.toString() ?? "";
          }
        });
        setDebtorCounts(counts);
        setDebtorPcts(pcts);
      }

      if (balances) {
        setQ1(balances.balance_31_march?.toString() ?? "");
        setQ2(balances.balance_30_june?.toString() ?? "");
        setQ3(balances.balance_30_september?.toString() ?? "");
        setQ4(balances.balance_31_december?.toString() ?? "");
        setCurrentBalance(balances.current_total?.toString() ?? "");
      }

      if (overdue && overdue.length > 0) {
        setHasOverdue(true);
        setOverdueRows(overdue.map((r) => {
          const d = r.due_date ? r.due_date.split("-") : ["", "", ""];
          return {
            id: r.id,
            customerName: r.customer_name ?? "",
            amount: r.amount_outstanding?.toString() ?? "",
            dueDate: { year: d[0], month: d[1], day: d[2] },
            actionTaken: r.action_taken ?? "",
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
      // Buyers — delete and reinsert
      await supabase.from("submission_buyers").delete().eq("submission_id", submissionId);
      const buyerPayload = buyers.filter((b) => b.name).map((b, i) => ({
        submission_id: submissionId,
        buyer_name: b.name,
        country_code: b.country || null,
        id_type: b.idType || null,
        id_value: b.idValue || null,
        currency: b.currency || null,
        credit_limit_requested: b.creditLimit ? parseFloat(b.creditLimit) : null,
        imported_via_ai: b.imported ?? false,
        sort_order: i,
      }));
      if (buyerPayload.length > 0) {
        await supabase.from("submission_buyers").insert(buyerPayload);
      }

      // Debtor distribution — delete and reinsert
      await supabase.from("submission_debtor_distribution").delete().eq("submission_id", submissionId);
      const distPayload = debtBands
        .map((band, i) => ({
          submission_id: submissionId,
          debt_band: band,
          number_of_debtors: debtorCounts[i] ? parseInt(debtorCounts[i]) : null,
          debtor_balance_pct: debtorPcts[i] ? parseFloat(debtorPcts[i]) : null,
        }))
        .filter((r) => r.number_of_debtors !== null || r.debtor_balance_pct !== null);
      if (distPayload.length > 0) {
        await supabase.from("submission_debtor_distribution").insert(distPayload);
      }

      // Debtor balances — upsert
      await supabase.from("submission_debtor_balances").upsert({
        submission_id: submissionId,
        balance_31_march: q1 ? parseFloat(q1) : null,
        balance_30_june: q2 ? parseFloat(q2) : null,
        balance_30_september: q3 ? parseFloat(q3) : null,
        balance_31_december: q4 ? parseFloat(q4) : null,
        current_total: currentBalance ? parseFloat(currentBalance) : null,
      }, { onConflict: "submission_id" });

      // Overdue accounts — delete and reinsert
      await supabase.from("submission_overdue_accounts").delete().eq("submission_id", submissionId);
      if (hasOverdue === true) {
        const overduePayload = overdueRows
          .filter((r) => r.customerName)
          .map((r) => ({
            submission_id: submissionId,
            customer_name: r.customerName,
            amount_outstanding: r.amount ? parseFloat(r.amount) : null,
            due_date: r.dueDate.year && r.dueDate.month && r.dueDate.day
              ? `${r.dueDate.year}-${r.dueDate.month.padStart(2, "0")}-${r.dueDate.day.padStart(2, "0")}` : null,
            action_taken: r.actionTaken || null,
          }));
        if (overduePayload.length > 0) {
          await supabase.from("submission_overdue_accounts").insert(overduePayload);
        }
      }

      await Promise.all([
        supabase.from("submissions").update({ completion_pct: 75, last_activity: new Date().toISOString() }).eq("id", submissionId).lt("completion_pct", 75),
        supabase.from("submissions").update({ status: "in_progress" }).eq("id", submissionId).eq("status", "not_started"),
      ]);
      refreshSteps();
    } catch {
      toast.error("Failed to save");
    }

    setSaving(false);
  }, [submissionId, buyers, debtorCounts, debtorPcts, q1, q2, q3, q4, currentBalance, hasOverdue, overdueRows]);

  useEffect(() => {
    if (pageLoading) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(save, 1000);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [save, pageLoading]);

  const addBuyer = () => {
    setBuyers([...buyers, { id: Date.now().toString(), name: "", country: "", idType: "", idValue: "", currency: "GBP", creditLimit: "" }]);
  };

  const removeBuyer = (id: string) => {
    if (buyers.length <= 1) return;
    setBuyers(buyers.filter((b) => b.id !== id));
  };

  const updateBuyer = (id: string, field: keyof BuyerRow, value: string) => {
    setBuyers(buyers.map((b) => (b.id === id ? { ...b, [field]: value } : b)));
  };

  const handleDebtorPasteImport = useCallback(() => {
    if (!debtorPasteData.trim()) return;
    try {
      const { headers, rows } = parsePasteToRows(debtorPasteData);
      if (headers.length === 0) { toast.error("No data detected — check your pasted content."); return; }
      const { counts, pcts } = parseDebtorDistribution(headers, rows);
      setDebtorCounts(counts);
      setDebtorPcts(pcts);
      setDebtorPasteData("");
      setShowDebtorPaste(false);
      setDebtorFile("Pasted data");
      toast.success("Debtor distribution updated — please review and confirm the figures.");
    } catch {
      toast.error("Could not detect distribution columns. Please check your data or enter figures manually.");
    }
  }, [debtorPasteData]);

  const handleDebtorUpload = useCallback(async (file: File) => {
    setDebtorUploadProgress(0);
    // Show a quick animated progress while the file is being read
    const progressTimer = setInterval(() => {
      setDebtorUploadProgress((p) => (p !== null ? Math.min(p + 12, 85) : 85));
    }, 120);

    try {
      const { headers, rows } = await parseFileToRows(file);
      clearInterval(progressTimer);
      setDebtorUploadProgress(100);
      setDebtorFile(file.name);

      setTimeout(async () => {
        setDebtorUploadProgress(null);
        setDebtorProcessing(true);
        try {
          const { counts, pcts } = parseDebtorDistribution(headers, rows);
          setDebtorCounts(counts);
          setDebtorPcts(pcts);
          toast.success("Debtor distribution updated from your file — please review and confirm the figures.");
        } catch {
          toast.error("Could not detect a balance column. Please enter the figures manually or check your file format.");
        }
        setDebtorProcessing(false);
      }, 400);
    } catch {
      clearInterval(progressTimer);
      setDebtorUploadProgress(null);
      toast.error("Couldn't read the file. Please try a .xlsx or .csv format.");
    }
  }, []);

  const handleImport = useCallback(async (file?: File) => {
    setImportLoading(true);
    try {
      let sheet: ParsedSheet;
      if (file) {
        sheet = await parseFileToRows(file);
        setImportFile(file);
      } else {
        sheet = parsePasteToRows(pasteData);
        setImportFile(null);
      }
      if (sheet.headers.length === 0) {
        toast.error("No data detected — check your file or paste content.");
        setImportLoading(false);
        return;
      }
      setParsedSheet(sheet);
      setColumnMap(detectBuyerColumns(sheet.headers));
      setShowMappingModal(true);
    } catch {
      toast.error("Couldn't parse the file. Please try a .xlsx or .csv format.");
    }
    setImportLoading(false);
  }, [pasteData]);

  const confirmImport = () => {
    const { headers, rows } = parsedSheet;
    if (rows.length === 0) { setShowMappingModal(false); return; }

    const imported: BuyerRow[] = rows
      .filter((r) => r.some((c) => c.trim()))
      .map((row, i) => {
        const get = (col: number) => (col >= 0 ? row[col] ?? "" : "");
        const rawCreditLimit = get(columnMap.creditLimit);
        const parsedLimit = parseNumericValue(rawCreditLimit);
        return {
          id: `imp_${Date.now()}_${i}`,
          name: get(columnMap.name),
          country: normaliseCountryCode(get(columnMap.country)),
          idType: get(columnMap.idType),
          idValue: get(columnMap.idValue),
          currency: normaliseCurrencyCode(get(columnMap.currency)) || "GBP",
          creditLimit: parsedLimit !== null ? String(Math.round(parsedLimit)) : rawCreditLimit,
          imported: true,
        };
      });

    setBuyers((prev) => [...prev.filter((b) => b.name), ...imported]);
    setShowMappingModal(false);
    setShowBuyerPaste(false);
    setPasteData("");
    setImportFile(null);
    toast.success(`Imported ${imported.length} buyer${imported.length !== 1 ? "s" : ""} — please review and edit as needed.`);
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
      currentStep={2}
      completedSteps={completedSteps}
      saving={saving}
      onBack={() => navigate("/form/trading")}
      onNext={() => navigate("/form/review")}
      maxWidth="1100px"
    >
      <h1 className="mb-1">Your customers</h1>
      <p className="text-helper text-helper mb-6">Tell us about your main buyers and debtor portfolio</p>

      <FormCard title="Main customers / buyer portfolio">
        <input ref={importFileRef} type="file" accept=".xlsx,.csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImport(f); e.target.value = ""; }} />

        {/* Import actions — same style as debtor distribution */}
        {importLoading ? (
          <div className="flex items-center gap-3 mb-3 p-3 border border-silver rounded-md bg-silver/10">
            <Loader2 className="h-4 w-4 text-accent-blue animate-spin shrink-0" />
            <span className="text-body text-text-primary">Analysing your data…</span>
          </div>
        ) : buyers.some((b) => b.imported) ? (
          <div className="flex items-center gap-3 mb-3 p-3 rounded-md bg-sage/20 border border-sage">
            <Check className="h-4 w-4 text-sage shrink-0" />
            <span className="text-body text-text-primary flex-1">
              {buyers.filter((b) => b.imported).length} buyer{buyers.filter((b) => b.imported).length !== 1 ? "s" : ""} imported — review and edit below
            </span>
            <button onClick={() => setBuyers([{ id: "1", name: "", country: "", idType: "", idValue: "", currency: "GBP", creditLimit: "" }])} className="text-helper text-helper hover:text-error-red hover:underline transition-colors">
              Clear
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap justify-end gap-2 mb-3">
            <Button variant="secondary" size="sm" onClick={() => setShowBuyerPaste((v) => !v)}>
              📋 Paste from Excel
            </Button>
            <Button variant="secondary" size="sm" onClick={() => importFileRef.current?.click()}>
              📎 Upload spreadsheet
            </Button>
          </div>
        )}

        {showBuyerPaste && !buyers.some((b) => b.imported) && (
          <div className="mb-4">
            <p className="text-helper text-helper mb-2">Copy your buyer list from Excel (with column headers) and paste below:</p>
            <textarea
              value={pasteData}
              onChange={(e) => setPasteData(e.target.value)}
              className="w-full min-h-[120px] p-3 text-body font-mono border border-silver rounded-md focus:outline-none focus:ring-2 focus:ring-accent-blue resize-y mb-2"
              placeholder="Paste your data here…"
            />
            <div className="flex gap-2">
              <Button onClick={() => { handleImport(); setShowBuyerPaste(false); }} disabled={!pasteData.trim()}>
                Analyse data →
              </Button>
              <Button variant="secondary" onClick={() => { setShowBuyerPaste(false); setPasteData(""); }}>Cancel</Button>
            </div>
          </div>
        )}

        {/* Buyer table — always visible */}
        <div className="hidden md:block -mx-6 px-6" style={{ overflowX: 'auto' }}>
          <table className="w-full text-body table-fixed" style={{ minWidth: 900 }}>
            <colgroup>
              <col style={{ width: '28%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '13%' }} />
              <col style={{ width: '13%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '13%' }} />
              <col style={{ width: '5%' }} />
            </colgroup>
            <thead>
              <tr className="border-b border-silver">
                <th className="text-left text-label text-helper pb-3 px-2 font-medium bg-silver/20">Buyer name *</th>
                <th className="text-left text-label text-helper pb-3 px-2 font-medium bg-silver/20">Country</th>
                <th className="text-left text-label text-helper pb-3 px-2 font-medium bg-silver/20">ID type</th>
                <th className="text-left text-label text-helper pb-3 px-2 font-medium bg-silver/20">ID value</th>
                <th className="text-left text-label text-helper pb-3 px-2 font-medium bg-silver/20">Currency</th>
                <th className="text-left text-label text-helper pb-3 px-2 font-medium bg-silver/20">Credit limit</th>
                <th className="bg-silver/20"></th>
              </tr>
            </thead>
            <tbody>
              {buyers.map((b) => (
                <tr key={b.id} className="row-enter border-b border-silver/50 h-12">
                  <td className="py-2 px-2 overflow-hidden">
                    <div className="flex items-center gap-2 min-w-0">
                      <input value={b.name} onChange={(e) => updateBuyer(b.id, "name", e.target.value)} className="w-full h-8 px-2 text-body border border-silver rounded-md focus:outline-none focus:ring-2 focus:ring-accent-blue truncate" />
                      {b.imported && <span className="shrink-0 text-[11px] px-1.5 py-0.5 bg-ice-blue text-navy rounded-sm font-medium">Imported</span>}
                    </div>
                  </td>
                  <td className="py-2 px-2 overflow-hidden">
                    <SearchableSelect options={countryOptions} value={b.country} onChange={(v) => updateBuyer(b.id, "country", v)} placeholder="—" className="mb-0" />
                  </td>
                  <td className="py-2 px-2 overflow-hidden">
                    <SearchableSelect options={idTypeOptions} value={b.idType} onChange={(v) => updateBuyer(b.id, "idType", v)} placeholder="—" className="mb-0" />
                  </td>
                  <td className="py-2 px-2 overflow-hidden">
                    <input value={b.idValue} onChange={(e) => updateBuyer(b.id, "idValue", e.target.value)} className="w-full h-8 px-2 text-body border border-silver rounded-md focus:outline-none focus:ring-2 focus:ring-accent-blue" />
                  </td>
                  <td className="py-2 px-2 overflow-hidden">
                    <SearchableSelect options={currencyOptions} value={b.currency} onChange={(v) => updateBuyer(b.id, "currency", v)} placeholder="—" className="mb-0" displayValue={(o) => o.value} />
                  </td>
                  <td className="py-2 px-2 overflow-hidden">
                    <input value={b.creditLimit} onChange={(e) => updateBuyer(b.id, "creditLimit", filterNumericValue(e.target.value))} className="w-full h-8 px-2 text-body text-right border border-silver rounded-md focus:outline-none focus:ring-2 focus:ring-accent-blue" />
                  </td>
                  <td className="py-2 px-2 text-center">
                    <button onClick={() => removeBuyer(b.id)} className="p-1.5 text-helper hover:text-error-red transition-colors">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="md:hidden space-y-3">
          {buyers.map((b) => (
            <div key={b.id} className="border border-silver rounded-md p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-navy">{b.name || "New buyer"}</span>
                {b.imported && <span className="text-[11px] px-1.5 py-0.5 bg-ice-blue text-navy rounded-sm font-medium">Imported</span>}
              </div>
              <p className="text-helper text-helper">
                {countryOptions.find((c) => c.value === b.country)?.label || "—"} · {b.currency} · {b.creditLimit || "—"}
              </p>
            </div>
          ))}
        </div>

        <Button variant="ghost" onClick={addBuyer} className="mt-3">
          <Plus className="h-4 w-4 mr-1" /> Add buyer
        </Button>
      </FormCard>

      <Modal
        isOpen={showMappingModal}
        onClose={() => setShowMappingModal(false)}
        title="Review your data mapping"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowMappingModal(false)}>Cancel</Button>
            <Button onClick={confirmImport} disabled={columnMap.name === -1}>Confirm and import →</Button>
          </>
        }
      >
        {(() => {
          const { headers, rows } = parsedSheet;
          const fieldLabels: { key: keyof BuyerColumnMap; label: string }[] = [
            { key: "name",        label: "Buyer name *" },
            { key: "country",     label: "Country" },
            { key: "currency",    label: "Currency" },
            { key: "creditLimit", label: "Credit limit" },
            { key: "idType",      label: "ID type" },
            { key: "idValue",     label: "ID value" },
          ];
          const mappedCount   = Object.values(columnMap).filter((v) => v !== -1).length;
          const unmappedReqd  = columnMap.name === -1;

          return (
            <>
              <p className="text-helper text-helper mb-1">
                {rows.length} row{rows.length !== 1 ? "s" : ""} found · {headers.length} column{headers.length !== 1 ? "s" : ""} detected
                {importFile ? ` — ${importFile.name}` : ""}
              </p>
              <p className="text-helper text-helper mb-4">
                We've matched your columns to our fields. Change any mapping using the dropdowns, then confirm to import.
              </p>

              <table className="w-full text-body mb-4">
                <thead>
                  <tr className="bg-silver/30">
                    <th className="text-left text-label text-helper p-2 font-medium">OUR FIELD</th>
                    <th className="text-left text-label text-helper p-2 font-medium">MAPPED TO YOUR COLUMN</th>
                  </tr>
                </thead>
                <tbody>
                  {fieldLabels.map(({ key, label }) => (
                    <tr key={key} className="border-b border-silver/50">
                      <td className="p-2 font-medium">{label}</td>
                      <td className="p-2">
                        <select
                          value={columnMap[key]}
                          onChange={(e) => setColumnMap((m) => ({ ...m, [key]: parseInt(e.target.value) }))}
                          className="w-full h-8 px-2 text-body border border-silver rounded-md focus:outline-none focus:ring-2 focus:ring-accent-blue bg-card"
                        >
                          <option value={-1}>— not mapped —</option>
                          {headers.map((h, i) => (
                            <option key={i} value={i}>{h || `Column ${i + 1}`}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="space-y-1 mb-4">
                {mappedCount > 0 && (
                  <div className="flex items-center gap-2 text-helper">
                    <Check className="h-3.5 w-3.5 text-accent-foreground" />
                    <span>{mappedCount} column{mappedCount !== 1 ? "s" : ""} mapped</span>
                  </div>
                )}
                {unmappedReqd && (
                  <div className="flex items-center gap-2 text-helper text-warning-amber-text">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    <span>Buyer name column is required — please map it above</span>
                  </div>
                )}
              </div>

              {rows.length > 0 && columnMap.name !== -1 && (
                <>
                  <h3 className="mb-2">Preview (first 3 rows)</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-helper">
                      <thead>
                        <tr className="bg-silver/30">
                          {fieldLabels
                            .filter(({ key }) => columnMap[key] !== -1)
                            .map(({ label }) => (
                              <th key={label} className="text-left p-1.5 font-medium">{label}</th>
                            ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.slice(0, 3).map((row, ri) => (
                          <tr key={ri} className="border-b border-silver/50">
                            {fieldLabels
                              .filter(({ key }) => columnMap[key] !== -1)
                              .map(({ key }) => (
                                <td key={key} className="p-1.5">{row[columnMap[key]] ?? ""}</td>
                              ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          );
        })()}
      </Modal>

      <FormCard title="Debtor distribution" description="How are your debtors distributed by outstanding balance?">
        <input ref={debtorFileRef} type="file" accept=".xlsx,.csv,.pdf" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleDebtorUpload(file); e.target.value = ""; }} />

        {debtorUploadProgress !== null ? (
          <div className="flex items-center gap-3 mb-3 p-3 border border-silver rounded-md bg-silver/10">
            <Loader2 className="h-4 w-4 text-accent-blue animate-spin shrink-0" />
            <div className="flex-1">
              <div className="text-body text-text-primary mb-1">Uploading…</div>
              <div className="w-full h-1.5 bg-silver rounded-full overflow-hidden">
                <div className="h-1.5 bg-accent-blue rounded-full transition-all duration-100" style={{ width: `${debtorUploadProgress}%` }} />
              </div>
            </div>
            <span className="text-helper text-helper shrink-0">{debtorUploadProgress}%</span>
          </div>
        ) : debtorFile ? (
          <div className="flex items-center gap-3 mb-3 p-3 rounded-md bg-sage/20 border border-sage">
            <Check className="h-4 w-4 text-sage shrink-0" />
            <FileText className="h-4 w-4 text-text-primary shrink-0" />
            <span className="text-body text-text-primary flex-1">{debtorFile}</span>
            <button onClick={() => { setDebtorFile(null); setDebtorCounts(Array(debtBands.length).fill("")); setDebtorPcts(Array(debtBands.length).fill("")); }} className="text-helper text-helper hover:text-error-red hover:underline transition-colors">
              Remove
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap justify-end gap-2 mb-3">
            <Button variant="secondary" size="sm" onClick={() => { setShowDebtorPaste((v) => !v); }}>
              📋 Paste from Excel
            </Button>
            <Button variant="secondary" size="sm" onClick={() => debtorFileRef.current?.click()}>
              📎 Upload aged debtor schedule
            </Button>
          </div>
        )}

        {showDebtorPaste && !debtorFile && (
          <div className="mb-3">
            <p className="text-helper text-helper mb-2">Copy two columns from Excel (band, count, % — or a full aged-debtor list) and paste below:</p>
            <textarea
              value={debtorPasteData}
              onChange={(e) => setDebtorPasteData(e.target.value)}
              className="w-full min-h-[100px] p-3 text-body font-mono border border-silver rounded-md focus:outline-none focus:ring-2 focus:ring-accent-blue resize-y mb-2"
              placeholder="Paste your data here…"
            />
            <div className="flex gap-2">
              <Button onClick={handleDebtorPasteImport} disabled={!debtorPasteData.trim()}>Import</Button>
              <Button variant="secondary" onClick={() => { setShowDebtorPaste(false); setDebtorPasteData(""); }}>Cancel</Button>
            </div>
          </div>
        )}

        {debtorProcessing && (
          <div className="flex items-center gap-3 mb-3 p-3 border border-silver rounded-md bg-silver/10">
            <Loader2 className="h-4 w-4 text-accent-blue animate-spin shrink-0" />
            <span className="text-body text-text-primary">Reading your file…</span>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-body">
            <thead>
              <tr className="border-b border-silver">
                <th className="text-left text-label text-helper pb-2 font-medium bg-silver/20 px-2">Debt band (£)</th>
                <th className="text-left text-label text-helper pb-2 font-medium px-2">Number of debtors</th>
                <th className="text-left text-label text-helper pb-2 font-medium px-2">Debtor balance %</th>
              </tr>
            </thead>
            <tbody>
              {debtBands.map((band, i) => (
                <tr key={i} className="border-b border-silver/50">
                  <td className="py-1.5 px-2 bg-silver/20 text-helper font-medium">{band}</td>
                  <td className="py-1.5 px-2">
                    <input value={debtorCounts[i]} onChange={(e) => { const n = [...debtorCounts]; n[i] = filterNumericValue(e.target.value); setDebtorCounts(n); }} inputMode="numeric" className="w-full h-8 px-2 text-body text-right border border-silver rounded-md focus:outline-none focus:ring-2 focus:ring-accent-blue" />
                  </td>
                  <td className="py-1.5 px-2">
                    <input value={debtorPcts[i]} onChange={(e) => { const n = [...debtorPcts]; n[i] = filterNumericValue(e.target.value); setDebtorPcts(n); }} inputMode="decimal" className="w-full h-8 px-2 text-body text-right border border-silver rounded-md focus:outline-none focus:ring-2 focus:ring-accent-blue" />
                  </td>
                </tr>
              ))}
              <tr className="bg-silver/20 font-bold">
                <td className="py-2 px-2">Total</td>
                <td className="py-2 px-2 text-right">{totalCount}</td>
                <td className="py-2 px-2 text-right">{totalPct.toFixed(2)}%</td>
              </tr>
            </tbody>
          </table>
        </div>
        {totalPct > 0 && Math.abs(totalPct - 100) > 0.01 && (
          <div className="flex items-center gap-2 mt-2 text-warning-amber-text text-helper">
            <AlertTriangle className="h-3.5 w-3.5" />
            Your balance percentages total {totalPct.toFixed(2)}% — these should add up to 100%
          </div>
        )}
      </FormCard>

      <FormCard title="Quarterly debtor balances">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
          <FormInput label="31 March" value={q1} onChange={setQ1} rightAlign numeric />
          <FormInput label="30 June" value={q2} onChange={setQ2} rightAlign numeric />
          <FormInput label="30 September" value={q3} onChange={setQ3} rightAlign numeric />
          <FormInput label="31 December" value={q4} onChange={setQ4} rightAlign numeric />
        </div>
        <FormInput label="Current total debtor balance" value={currentBalance} onChange={setCurrentBalance} rightAlign numeric />
      </FormCard>

      <FormCard title="Seriously overdue accounts">
        <div className="flex items-center justify-between mb-2">
          <span className="text-body text-text-primary">Do you have any seriously overdue accounts?</span>
          <ToggleGroup value={hasOverdue} onChange={setHasOverdue} />
        </div>
        <SlideReveal isOpen={hasOverdue === true}>
          <div className="overflow-x-auto">
            <table className="w-full text-body">
              <thead>
                <tr className="border-b border-silver">
                  <th className="text-left text-label text-helper pb-2 font-medium">Customer name</th>
                  <th className="text-left text-label text-helper pb-2 font-medium">Amount outstanding</th>
                  <th className="text-left text-label text-helper pb-2 font-medium">Due date</th>
                  <th className="text-left text-label text-helper pb-2 font-medium">Action taken</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {overdueRows.map((row) => (
                  <tr key={row.id} className="row-enter border-b border-silver/50">
                    <td className="py-2 pr-2">
                      <input value={row.customerName} onChange={(e) => setOverdueRows(overdueRows.map((r) => r.id === row.id ? { ...r, customerName: e.target.value } : r))} className="w-full h-10 px-3 text-body border border-silver rounded-md focus:outline-none focus:ring-2 focus:ring-accent-blue" />
                    </td>
                    <td className="py-2 pr-2">
                      <input value={row.amount} onChange={(e) => setOverdueRows(overdueRows.map((r) => r.id === row.id ? { ...r, amount: filterNumericValue(e.target.value) } : r))} inputMode="decimal" className="w-full h-10 px-3 text-body text-right border border-silver rounded-md focus:outline-none focus:ring-2 focus:ring-accent-blue" />
                    </td>
                    <td className="py-2 pr-2">
                      <DateInput value={row.dueDate} onChange={(v) => setOverdueRows(overdueRows.map((r) => r.id === row.id ? { ...r, dueDate: v } : r))} className="mb-0" />
                    </td>
                    <td className="py-2 pr-2">
                      <input value={row.actionTaken} onChange={(e) => setOverdueRows(overdueRows.map((r) => r.id === row.id ? { ...r, actionTaken: e.target.value } : r))} className="w-full h-10 px-3 text-body border border-silver rounded-md focus:outline-none focus:ring-2 focus:ring-accent-blue" />
                    </td>
                    <td className="py-2">
                      <button onClick={() => { if (overdueRows.length > 1) setOverdueRows(overdueRows.filter((r) => r.id !== row.id)); }} className="p-2 text-helper hover:text-error-red transition-colors">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button variant="ghost" onClick={() => setOverdueRows([...overdueRows, { id: Date.now().toString(), customerName: "", amount: "", dueDate: { day: "", month: "", year: "" }, actionTaken: "" }])} className="mt-3">
            <Plus className="h-4 w-4 mr-1" /> Add account
          </Button>
        </SlideReveal>
      </FormCard>
    </FormShell>
  );
};

export default CustomersPage;