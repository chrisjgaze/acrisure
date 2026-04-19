import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, FileText, Loader2, Plus, Trash2, Upload,
  ChevronDown, ChevronUp, Sparkles, X, Download, Clock, History,
} from "lucide-react";
import { toast } from "sonner";
import TenantLogo from "@/components/TenantLogo";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

// ---------- Types ----------

interface InsurerFile {
  id: string;
  originalName: string;
  content: string;
  sizeKb: number;
}

interface InsurerQuote {
  id: string;
  label: string;
  files: InsurerFile[];
}

interface ComparisonRow {
  insurer: string;
  premium: string | null;
  excess: string | null;
  limit: string | null;
  policy_period: string | null;
  payment_terms: string | null;
  key_exclusions: string[] | null;
  special_conditions: string[] | null;
  maximum_extension: string | null;
  epi: string | null;
  first_loss: string | null;
  discretionary_limit: string | null;
  coverage_territory: string | null;
  claims_notification: string | null;
  notable_advantages: string[] | null;
  notable_disadvantages: string[] | null;
}

interface ComparisonResult {
  comparison: ComparisonRow[];
  narrative: string;
}

interface SavedComparison {
  id: string;
  insurer_labels: string[];
  result: ComparisonResult;
  created_at: string;
  class_of_business: string;
}

const CLASS_LABELS: Record<string, string> = {
  trade_credit: "Trade Credit Insurance",
  cyber: "Cyber Insurance",
  dno: "Directors & Officers",
  terrorism: "Terrorism Insurance",
};

// ---------- Helpers ----------

function uid() { return Math.random().toString(36).slice(2); }

async function readPdfAsText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => ("str" in item ? item.str : "")).join(" "));
  }
  return pages.join("\n\n");
}

async function readDocxAsText(file: File): Promise<string> {
  const mammoth = await import("mammoth");
  const arrayBuffer = await file.arrayBuffer();
  const { value } = await mammoth.extractRawText({ arrayBuffer });
  return value;
}

async function processFile(file: File): Promise<InsurerFile> {
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  const isDocx = file.name.toLowerCase().endsWith(".docx") ||
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (isPdf) {
    const text = await readPdfAsText(file);
    return { id: uid(), originalName: file.name, content: text, sizeKb: Math.round(file.size / 1024) };
  }
  if (isDocx) {
    const text = await readDocxAsText(file);
    return { id: uid(), originalName: file.name, content: text, sizeKb: Math.round(file.size / 1024) };
  }
  throw new Error(`Unsupported file type: ${file.name}. Please use PDF or DOCX.`);
}

// ---------- Download as HTML report ----------

function downloadReport(saved: SavedComparison, clientName: string, productLabel: string) {
  const { result, insurer_labels, created_at } = saved;
  const date = new Date(created_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  const TABLE_FIELDS: { key: keyof ComparisonRow; label: string }[] = [
    { key: "premium",             label: "Premium" },
    { key: "excess",              label: "Excess / Retention" },
    { key: "limit",               label: "Limit of Indemnity" },
    { key: "epi",                 label: "EPI / Insured Turnover" },
    { key: "policy_period",       label: "Policy Period" },
    { key: "payment_terms",       label: "Payment Terms" },
    { key: "coverage_territory",  label: "Coverage Territory" },
    { key: "discretionary_limit", label: "Discretionary / Auto Limit" },
    { key: "maximum_extension",   label: "Maximum Extension" },
    { key: "first_loss",          label: "First Loss Limit" },
    { key: "claims_notification", label: "Claims Notification" },
    { key: "key_exclusions",      label: "Key Exclusions" },
    { key: "special_conditions",  label: "Special Conditions" },
    { key: "notable_advantages",  label: "✓ Advantages" },
    { key: "notable_disadvantages", label: "✗ Disadvantages" },
  ];

  const renderCell = (val: string | string[] | null) => {
    if (!val) return "<span style='color:#aaa'>—</span>";
    if (Array.isArray(val)) return "<ul style='margin:0;padding-left:16px'>" + val.map(v => `<li>${v}</li>`).join("") + "</ul>";
    return val;
  };

  const tableRows = TABLE_FIELDS.map(({ key, label }) => `
    <tr>
      <td style="padding:8px 12px;font-weight:600;color:#475569;white-space:nowrap;background:#f8fafc;border:1px solid #e2e8f0;vertical-align:top">${label}</td>
      ${result.comparison.map(row => `<td style="padding:8px 12px;border:1px solid #e2e8f0;vertical-align:top;font-size:13px">${renderCell(row[key] as string | string[] | null)}</td>`).join("")}
    </tr>`).join("");

  const narrative = (result.narrative ?? "")
    .split(/\n\n+/)
    .map(p => `<p style="margin:0 0 12px;line-height:1.6">${p.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")}</p>`)
    .join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Quote Comparison — ${productLabel} — ${date}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1e293b; margin: 0; padding: 32px; font-size: 13px; }
  h1 { font-size: 22px; color: #0f172a; margin: 0 0 4px; }
  .meta { color: #64748b; margin: 0 0 32px; font-size: 13px; }
  h2 { font-size: 16px; color: #0f172a; margin: 32px 0 12px; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; }
  table { border-collapse: collapse; width: 100%; margin-bottom: 32px; }
  th { background: #1e3a5f; color: white; padding: 10px 12px; text-align: left; font-size: 13px; border: 1px solid #1e3a5f; }
  td { font-size: 13px; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 11px; }
  @media print { body { padding: 16px; } }
</style>
</head>
<body>
  <h1>Quote Comparison Report</h1>
  <p class="meta">${productLabel} &nbsp;·&nbsp; ${clientName} &nbsp;·&nbsp; ${date}</p>
  <p class="meta" style="margin-top:-24px">Insurers compared: ${insurer_labels.join(", ")}</p>

  <h2>Comparison table</h2>
  <table>
    <thead>
      <tr>
        <th style="width:160px">Field</th>
        ${result.comparison.map(r => `<th>${r.insurer}</th>`).join("")}
      </tr>
    </thead>
    <tbody>${tableRows}</tbody>
  </table>

  <h2>Analysis</h2>
  <div style="max-width:800px">${narrative}</div>

  <div class="footer">Generated by Acrisure FormFlow &nbsp;·&nbsp; ${date} &nbsp;·&nbsp; AI-generated analysis — verify against original documents before making placement decisions</div>
</body>
</html>`;

  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Quote-Comparison-${productLabel.replace(/\s+/g, "-")}-${date.replace(/\s/g, "-")}.html`;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------- Sub-components ----------

const TABLE_FIELDS: { key: keyof ComparisonRow; label: string }[] = [
  { key: "premium",             label: "Premium" },
  { key: "excess",              label: "Excess / Retention" },
  { key: "limit",               label: "Limit of Indemnity" },
  { key: "epi",                 label: "EPI / Insured Turnover" },
  { key: "policy_period",       label: "Policy Period" },
  { key: "payment_terms",       label: "Payment Terms" },
  { key: "coverage_territory",  label: "Coverage Territory" },
  { key: "discretionary_limit", label: "Discretionary / Auto Limit" },
  { key: "maximum_extension",   label: "Maximum Extension" },
  { key: "first_loss",          label: "First Loss Limit" },
  { key: "claims_notification", label: "Claims Notification" },
];

function CellValue({ value }: { value: string | string[] | null }) {
  if (!value) return <span className="text-slate-300">—</span>;
  if (Array.isArray(value)) {
    return (
      <ul className="list-disc list-inside space-y-0.5">
        {value.map((v, i) => <li key={i} className="text-[12px]">{v}</li>)}
      </ul>
    );
  }
  return <span>{value}</span>;
}

function NarrativeSection({ text }: { text: string }) {
  const paragraphs = text.split(/\n\n+/);
  return (
    <div className="space-y-3">
      {paragraphs.map((p, i) => {
        const html = p
          .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
          .replace(/\*(.*?)\*/g, "<em>$1</em>")
          .replace(/^#{1,3}\s+(.*)$/gm, "<strong>$1</strong>");
        return <p key={i} className="text-[13px] leading-relaxed text-text-primary" dangerouslySetInnerHTML={{ __html: html }} />;
      })}
    </div>
  );
}

function ResultView({
  result,
  onDownload,
  onNewComparison,
}: {
  result: ComparisonResult;
  onDownload: () => void;
  onNewComparison: () => void;
}) {
  return (
    <div id="comparator-results" className="space-y-6">
      {/* Comparison table */}
      <div className="bg-card rounded-lg border border-silver overflow-hidden">
        <div className="px-5 py-4 border-b border-silver flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-navy">Comparison table</h2>
            <p className="text-helper text-slate-400 mt-0.5">Extracted from the uploaded documents</p>
          </div>
          <Button variant="secondary" size="sm" onClick={onDownload} className="gap-2">
            <Download className="h-4 w-4" /> Download report
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-silver/30">
                <th className="text-left px-4 py-3 font-medium text-text-primary border-r border-silver w-44 shrink-0">Field</th>
                {result.comparison.map((row) => (
                  <th key={row.insurer} className="text-left px-4 py-3 font-medium text-navy border-r border-silver last:border-r-0 min-w-[200px]">
                    {row.insurer}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TABLE_FIELDS.map(({ key, label }, i) => (
                <tr key={key} className={i % 2 === 0 ? "bg-white" : "bg-silver/10"}>
                  <td className="px-4 py-3 text-helper font-medium text-slate-500 border-r border-silver align-top whitespace-nowrap">{label}</td>
                  {result.comparison.map((row) => (
                    <td key={row.insurer} className="px-4 py-3 text-text-primary border-r border-silver last:border-r-0 align-top">
                      <CellValue value={row[key] as string | string[] | null} />
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="bg-white">
                <td className="px-4 py-3 text-helper font-medium text-slate-500 border-r border-silver align-top">Key Exclusions</td>
                {result.comparison.map((row) => (
                  <td key={row.insurer} className="px-4 py-3 text-text-primary border-r border-silver last:border-r-0 align-top">
                    <CellValue value={row.key_exclusions} />
                  </td>
                ))}
              </tr>
              <tr className="bg-silver/10">
                <td className="px-4 py-3 text-helper font-medium text-slate-500 border-r border-silver align-top">Special Conditions</td>
                {result.comparison.map((row) => (
                  <td key={row.insurer} className="px-4 py-3 text-text-primary border-r border-silver last:border-r-0 align-top">
                    <CellValue value={row.special_conditions} />
                  </td>
                ))}
              </tr>
              <tr className="bg-white">
                <td className="px-4 py-3 text-helper font-medium text-sage border-r border-silver align-top">✓ Advantages</td>
                {result.comparison.map((row) => (
                  <td key={row.insurer} className="px-4 py-3 text-text-primary border-r border-silver last:border-r-0 align-top">
                    <CellValue value={row.notable_advantages} />
                  </td>
                ))}
              </tr>
              <tr className="bg-silver/10">
                <td className="px-4 py-3 text-helper font-medium text-error-red border-r border-silver align-top">✗ Disadvantages</td>
                {result.comparison.map((row) => (
                  <td key={row.insurer} className="px-4 py-3 text-text-primary border-r border-silver last:border-r-0 align-top">
                    <CellValue value={row.notable_disadvantages} />
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Narrative */}
      {result.narrative && (
        <div className="bg-card rounded-lg border border-silver p-5">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="h-4 w-4 text-accent-blue" />
            <h2 className="text-lg font-semibold text-navy">AI analysis</h2>
          </div>
          <NarrativeSection text={result.narrative} />
          <p className="text-helper text-slate-300 mt-4 pt-3 border-t border-silver">
            Generated by Claude AI · Always verify against original documents before making placement decisions
          </p>
        </div>
      )}

      <div className="text-center pb-4">
        <Button variant="secondary" onClick={onNewComparison} className="gap-2">
          <Plus className="h-4 w-4" /> New comparison
        </Button>
      </div>
    </div>
  );
}

// ---------- Main page ----------

const ComparatorPage: React.FC = () => {
  const navigate = useNavigate();
  const { id: clientId } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const product = searchParams.get("product") ?? "trade_credit";
  const { logoUrl, tenantId } = useAuth();

  const [insurers, setInsurers] = useState<InsurerQuote[]>([
    { id: uid(), label: "Insurer 1", files: [] },
    { id: uid(), label: "Insurer 2", files: [] },
  ]);
  const [processing, setProcessing] = useState<Record<string, boolean>>({});
  const [comparing, setComparing] = useState(false);
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [expandedInsurers, setExpandedInsurers] = useState<Record<string, boolean>>({});
  const [history, setHistory] = useState<SavedComparison[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [viewingHistory, setViewingHistory] = useState<SavedComparison | null>(null);
  const [clientName, setClientName] = useState("Client");

  // Load client name + history on mount
  useEffect(() => {
    if (!clientId) return;
    const load = async () => {
      const [{ data: clientData }, { data: hist }] = await Promise.all([
        supabase.from("clients").select("display_name").eq("id", clientId).single(),
        supabase
          .from("quote_comparisons")
          .select("id, insurer_labels, result, created_at, class_of_business")
          .eq("client_id", clientId)
          .eq("class_of_business", product)
          .order("created_at", { ascending: false }),
      ]);
      if (clientData?.display_name) setClientName(clientData.display_name);
      setHistory((hist as SavedComparison[]) ?? []);
      setHistoryLoading(false);
    };
    load();
  }, [clientId, product]);

  // ---------- Insurer management ----------

  const addInsurer = () => setInsurers((p) => [...p, { id: uid(), label: `Insurer ${p.length + 1}`, files: [] }]);
  const removeInsurer = (id: string) => setInsurers((p) => p.filter((ins) => ins.id !== id));
  const updateLabel = (id: string, label: string) => setInsurers((p) => p.map((ins) => ins.id === id ? { ...ins, label } : ins));
  const removeFile = (insurerId: string, fileId: string) => setInsurers((p) => p.map((ins) => ins.id === insurerId ? { ...ins, files: ins.files.filter((f) => f.id !== fileId) } : ins));

  // ---------- File handling ----------

  const handleFiles = useCallback(async (insurerId: string, files: FileList | File[]) => {
    const arr = Array.from(files);
    if (arr.length === 0) return;
    setProcessing((p) => ({ ...p, [insurerId]: true }));
    try {
      const processed = await Promise.all(arr.map(processFile));
      setInsurers((prev) => prev.map((ins) => ins.id === insurerId ? { ...ins, files: [...ins.files, ...processed] } : ins));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to read file");
    } finally {
      setProcessing((p) => ({ ...p, [insurerId]: false }));
    }
  }, []);

  const onDrop = useCallback((e: React.DragEvent, insurerId: string) => {
    e.preventDefault();
    handleFiles(insurerId, e.dataTransfer.files);
  }, [handleFiles]);

  // ---------- Run comparison ----------

  const totalFiles = insurers.reduce((acc, ins) => acc + ins.files.length, 0);
  const canCompare = insurers.filter((ins) => ins.files.length > 0).length >= 1;

  const runComparison = async () => {
    const quotesWithFiles = insurers.filter((ins) => ins.files.length > 0);
    if (quotesWithFiles.length === 0) { toast.error("Please add at least one insurer with documents"); return; }
    setComparing(true);
    setResult(null);
    setSavedId(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/compare-quotes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          quotes: quotesWithFiles.map((ins) => ({
            label: ins.label,
            files: ins.files.map((f) => ({ name: f.originalName, content: f.content })),
          })),
          classOfBusiness: CLASS_LABELS[product] ?? product,
          tenantId: tenantId ?? undefined,
          clientId: clientId ?? undefined,
        }),
      });

      const data = await res.json() as ComparisonResult & { error?: string; raw?: string };
      if (!res.ok || data.error) { toast.error(data.error ?? "Comparison failed"); return; }
      if (data.raw) { toast.error("Could not parse AI response — please try again"); return; }

      setResult(data);

      // Save to DB
      const insurerLabels = quotesWithFiles.map((ins) => ins.label);

      // tenantId from context may be null on first render — fall back to DB lookup
      let resolvedTenantId = tenantId;
      if (!resolvedTenantId && session?.user?.id) {
        const { data: userRow } = await supabase
          .from("users")
          .select("tenant_id")
          .eq("id", session.user.id)
          .single();
        resolvedTenantId = userRow?.tenant_id ?? null;
      }

      if (!resolvedTenantId) {
        toast.error("Could not save comparison — tenant not found. Please reload and try again.");
      } else {
        const { data: saved, error: saveErr } = await supabase
          .from("quote_comparisons")
          .insert({
            tenant_id: resolvedTenantId,
            client_id: clientId,
            class_of_business: product,
            insurer_labels: insurerLabels,
            result: data,
            created_by: session?.user?.id ?? null,
          })
          .select("id")
          .single();

        if (saveErr) {
          console.error("Failed to save comparison:", saveErr.message, saveErr.details, saveErr.hint);
          toast.error(`Could not save to history: ${saveErr.message}`);
        } else {
          setSavedId(saved?.id ?? null);
          const newEntry: SavedComparison = {
            id: saved!.id,
            insurer_labels: insurerLabels,
            result: data,
            created_at: new Date().toISOString(),
            class_of_business: product,
          };
          setHistory((h) => [newEntry, ...h]);
          toast.success("Comparison saved");
        }
      }

      setTimeout(() => document.getElementById("comparator-results")?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (err) {
      console.error(err);
      toast.error("Comparison failed — please try again");
    } finally {
      setComparing(false);
    }
  };

  const handleDownload = (saved: SavedComparison) => {
    downloadReport(saved, clientName, CLASS_LABELS[product] ?? product);
  };

  const handleDownloadCurrent = () => {
    if (!result || !savedId) return;
    const saved = history.find((h) => h.id === savedId);
    if (saved) handleDownload(saved);
  };

  // ---------- Render ----------

  // Show historical comparison
  if (viewingHistory) {
    return (
      <div className="min-h-screen bg-silver/30">
        <header className="sticky top-0 z-40 h-16 bg-card border-b border-silver flex items-center justify-between px-6">
          <div className="flex items-center gap-8">
            <TenantLogo src={logoUrl} className="h-8 w-auto" />
            <span className="text-body font-medium text-navy">Quote Comparator — Historical</span>
          </div>
          <button onClick={() => setViewingHistory(null)} className="flex items-center gap-2 text-body text-helper hover:text-navy transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
        </header>
        <main className="max-w-5xl mx-auto px-4 md:px-6 py-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="mb-1">Comparison — {new Date(viewingHistory.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</h1>
              <p className="text-helper text-helper">{viewingHistory.insurer_labels.join(" · ")}</p>
            </div>
            <Button variant="secondary" onClick={() => handleDownload(viewingHistory)} className="gap-2">
              <Download className="h-4 w-4" /> Download report
            </Button>
          </div>
          <ResultView
            result={viewingHistory.result}
            onDownload={() => handleDownload(viewingHistory)}
            onNewComparison={() => setViewingHistory(null)}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-silver/30">
      {/* Header */}
      <header className="sticky top-0 z-40 h-16 bg-card border-b border-silver flex items-center justify-between px-6">
        <div className="flex items-center gap-8">
          <TenantLogo src={logoUrl} className="h-8 w-auto" />
          <nav className="hidden md:flex items-center gap-6">
            <button onClick={() => navigate("/dashboard")} className="text-body text-helper hover:text-navy transition-colors">Dashboard</button>
            <button onClick={() => navigate(`/clients/${clientId}`)} className="text-body text-helper hover:text-navy transition-colors">Client</button>
            <span className="text-body font-medium text-navy border-b-2 border-navy pb-1">Quote Comparator</span>
          </nav>
        </div>
        <button onClick={() => navigate(`/clients/${clientId}`)} className="flex items-center gap-2 text-body text-helper hover:text-navy transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to client
        </button>
      </header>

      <main className="max-w-5xl mx-auto px-4 md:px-6 py-8">
        <div className="mb-6">
          <h1 className="mb-1">Quote Comparator</h1>
          <p className="text-helper text-helper">
            {CLASS_LABELS[product] ?? product} · {clientName} · Upload insurer quote documents to generate an AI-powered comparison
          </p>
        </div>

        {/* Past comparisons */}
        {!historyLoading && history.length > 0 && !result && (
          <div className="bg-card rounded-lg border border-silver mb-6">
            <div className="px-5 py-3 border-b border-silver flex items-center gap-2">
              <History className="h-4 w-4 text-slate-400" />
              <h3 className="text-body font-medium text-text-primary">Previous comparisons</h3>
            </div>
            <div className="divide-y divide-silver">
              {history.map((h) => (
                <div key={h.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-[13px] font-medium text-text-primary">{h.insurer_labels.join(" · ")}</p>
                    <p className="text-helper text-slate-400 flex items-center gap-1 mt-0.5">
                      <Clock className="h-3 w-3" />
                      {new Date(h.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setViewingHistory(h)} className="text-navy text-[12px]">
                      View
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDownload(h)} className="gap-1.5 text-[12px]">
                      <Download className="h-3.5 w-3.5" /> Download
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* If we have a fresh result, show it */}
        {result && !comparing ? (
          <>
            <div className="bg-sage/10 border border-sage/30 rounded-lg px-5 py-3 mb-6 flex items-center justify-between">
              <p className="text-[13px] font-medium text-sage">Comparison saved to history</p>
              <Button variant="ghost" size="sm" onClick={() => { setResult(null); }} className="text-helper text-[12px]">
                ← Run another
              </Button>
            </div>
            <ResultView
              result={result}
              onDownload={handleDownloadCurrent}
              onNewComparison={() => setResult(null)}
            />
          </>
        ) : (
          <>
            {/* Instructions */}
            {!comparing && (
              <div className="bg-accent-blue/5 border border-accent-blue/20 rounded-lg p-4 mb-6 text-[13px] text-slate-600">
                <strong className="text-navy">How to use:</strong> Add one section per insurer, upload all their documents (schedule + wording), rename each insurer, then click <em>Run AI comparison</em>.
              </div>
            )}

            {/* Insurer cards */}
            {!comparing && (
              <div className="space-y-4 mb-6">
                {insurers.map((insurer, idx) => {
                  const isProcessing = processing[insurer.id];
                  const isExpanded = expandedInsurers[insurer.id] !== false;
                  return (
                    <div key={insurer.id} className="bg-card rounded-lg border border-silver overflow-hidden">
                      <div className="flex items-center gap-3 px-4 py-3 border-b border-silver/60 bg-silver/10">
                        <div className="w-7 h-7 rounded-full bg-navy/10 flex items-center justify-center shrink-0">
                          <span className="text-[11px] font-bold text-navy">{idx + 1}</span>
                        </div>
                        <input
                          type="text"
                          value={insurer.label}
                          onChange={(e) => updateLabel(insurer.id, e.target.value)}
                          className="flex-1 bg-transparent text-body font-medium text-text-primary border-0 outline-none focus:bg-white focus:px-2 focus:rounded transition-all"
                          placeholder="Insurer name"
                        />
                        <span className="text-helper text-slate-400 shrink-0">{insurer.files.length} file{insurer.files.length !== 1 ? "s" : ""}</span>
                        <button type="button" onClick={() => setExpandedInsurers((p) => ({ ...p, [insurer.id]: !isExpanded }))} className="text-slate-400 hover:text-navy">
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                        {insurers.length > 1 && (
                          <button type="button" onClick={() => removeInsurer(insurer.id)} className="text-slate-300 hover:text-error-red transition-colors">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>

                      {isExpanded && (
                        <div className="p-4">
                          <div
                            className="border-2 border-dashed border-silver rounded-lg p-6 text-center cursor-pointer hover:border-navy/40 hover:bg-navy/5 transition-all"
                            onDrop={(e) => onDrop(e, insurer.id)}
                            onDragOver={(e) => e.preventDefault()}
                            onClick={() => document.getElementById(`file-input-${insurer.id}`)?.click()}
                          >
                            {isProcessing ? (
                              <div className="flex items-center justify-center gap-2 text-helper text-slate-500">
                                <Loader2 className="h-4 w-4 animate-spin" /><span>Reading documents…</span>
                              </div>
                            ) : (
                              <>
                                <Upload className="h-5 w-5 text-slate-300 mx-auto mb-2" />
                                <p className="text-[13px] text-slate-500"><span className="font-medium text-navy">Click to upload</span> or drag & drop</p>
                                <p className="text-helper text-slate-400 mt-1">PDF or Word documents (.pdf, .docx)</p>
                              </>
                            )}
                            <input id={`file-input-${insurer.id}`} type="file" multiple accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="hidden" onChange={(e) => e.target.files && handleFiles(insurer.id, e.target.files)} />
                          </div>

                          {insurer.files.length > 0 && (
                            <div className="mt-3 space-y-2">
                              {insurer.files.map((file) => (
                                <div key={file.id} className="flex items-center gap-3 bg-silver/20 rounded-md px-3 py-2">
                                  <FileText className="h-4 w-4 text-navy/60 shrink-0" />
                                  <span className="flex-1 text-[13px] text-text-primary truncate">{file.originalName}</span>
                                  <span className="text-helper text-slate-400 shrink-0">{file.sizeKb} KB</span>
                                  <button type="button" onClick={() => removeFile(insurer.id, file.id)} className="text-slate-300 hover:text-error-red transition-colors shrink-0">
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add insurer + Run */}
            {!comparing && (
              <div className="flex items-center gap-3 mb-10">
                {insurers.length < 8 && (
                  <Button variant="secondary" onClick={addInsurer} className="gap-2">
                    <Plus className="h-4 w-4" /> Add insurer
                  </Button>
                )}
                <Button onClick={runComparison} disabled={!canCompare || comparing} className="gap-2 ml-auto">
                  <Sparkles className="h-4 w-4" />Run AI comparison
                </Button>
              </div>
            )}

            {/* Loading state */}
            {comparing && (
              <div className="bg-card rounded-lg border border-silver p-8 text-center">
                <Loader2 className="h-8 w-8 text-accent-blue animate-spin mx-auto mb-3" />
                <p className="text-body font-medium text-navy">Reading and analysing {totalFiles} document{totalFiles !== 1 ? "s" : ""}…</p>
                <p className="text-helper text-slate-400 mt-1">This usually takes 20–60 seconds</p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default ComparatorPage;
