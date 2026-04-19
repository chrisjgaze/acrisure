import * as XLSX from "xlsx";
import { debtBands } from "@/data/staticData";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ParsedSheet {
  headers: string[];
  rows: string[][];
}

export interface BuyerColumnMap {
  name: number;       // index into headers, -1 = not found
  country: number;
  currency: number;
  creditLimit: number;
  idType: number;
  idValue: number;
}

export interface DebtorDistributionResult {
  counts: string[];
  pcts: string[];
}

// ─── Parsers ──────────────────────────────────────────────────────────────────

export async function parseFileToRows(file: File): Promise<ParsedSheet> {
  const ab = await file.arrayBuffer();
  const wb = XLSX.read(ab, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw: unknown[][] = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: "",
    raw: false, // format numbers as strings
  });

  if (raw.length === 0) return { headers: [], rows: [] };
  const headers = (raw[0] as unknown[]).map((h) => String(h ?? "").trim());
  const rows = raw
    .slice(1)
    .filter((r) => (r as unknown[]).some((c) => String(c ?? "").trim()))
    .map((r) => (r as unknown[]).map((c) => String(c ?? "").trim()));

  return { headers, rows };
}

export function parsePasteToRows(paste: string): ParsedSheet {
  const lines = paste.trim().split("\n").filter((l) => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };

  // Detect delimiter: tabs (from Excel copy) or commas (CSV)
  const delim = lines[0].includes("\t") ? "\t" : ",";
  const splitLine = (line: string): string[] => {
    if (delim === "\t") return line.split("\t").map((s) => s.trim());
    // Simple CSV: handle quoted fields
    const result: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQuotes = !inQuotes; }
      else if (ch === "," && !inQuotes) { result.push(cur.trim()); cur = ""; }
      else { cur += ch; }
    }
    result.push(cur.trim());
    return result;
  };

  const headers = splitLine(lines[0]);
  const rows = lines.slice(1).map(splitLine);
  return { headers, rows };
}

// ─── Column Detection ─────────────────────────────────────────────────────────

export function detectBuyerColumns(headers: string[]): BuyerColumnMap {
  const find = (patterns: RegExp[]): number => {
    for (const pat of patterns) {
      const idx = headers.findIndex((h) => pat.test(h.toLowerCase()));
      if (idx !== -1) return idx;
    }
    return -1;
  };

  return {
    name:        find([/buyer.*name|customer.*name|company.*name|client.*name|^name$|^buyer$|^customer$|^company$/]),
    country:     find([/^country$|^location$|^nation$|country.*code/]),
    currency:    find([/^currency$|^ccy$|^cur$|currency.*code/]),
    creditLimit: find([/credit.*limit|limit.*credit|^limit$|credit.*req/]),
    idValue:     find([/reg.*no|reg.*num|company.*no|registration|^vat.*no|^duns|id.*value|^id.*no$|^crn$/]),
    idType:      find([/id.*type|^type$/]),
  };
}

// ─── Normalisation helpers ────────────────────────────────────────────────────

export function normaliseCountryCode(value: string): string {
  const v = value.trim().toUpperCase();
  const map: Record<string, string> = {
    UK: "GB", "UNITED KINGDOM": "GB", "GREAT BRITAIN": "GB", ENGLAND: "GB",
    WALES: "GB", SCOTLAND: "GB",
    US: "US", USA: "US", "UNITED STATES": "US", "UNITED STATES OF AMERICA": "US",
    DE: "DE", GERMANY: "DE", DEUTSCHLAND: "DE",
    FR: "FR", FRANCE: "FR",
    ES: "ES", SPAIN: "ES",
    IT: "IT", ITALY: "IT",
    NL: "NL", NETHERLANDS: "NL", HOLLAND: "NL",
    BE: "BE", BELGIUM: "BE",
    SE: "SE", SWEDEN: "SE",
    NO: "NO", NORWAY: "NO",
    DK: "DK", DENMARK: "DK",
    FI: "FI", FINLAND: "FI",
    CH: "CH", SWITZERLAND: "CH",
    AT: "AT", AUSTRIA: "AT",
    PL: "PL", POLAND: "PL",
    IE: "IE", IRELAND: "IE", "REPUBLIC OF IRELAND": "IE",
    PT: "PT", PORTUGAL: "PT",
    GR: "GR", GREECE: "GR",
    CZ: "CZ", "CZECH REPUBLIC": "CZ", CZECHIA: "CZ",
    HU: "HU", HUNGARY: "HU",
    RO: "RO", ROMANIA: "RO",
    CN: "CN", CHINA: "CN",
    JP: "JP", JAPAN: "JP",
    IN: "IN", INDIA: "IN",
    AU: "AU", AUSTRALIA: "AU",
    CA: "CA", CANADA: "CA",
    ZA: "ZA", "SOUTH AFRICA": "ZA",
    BR: "BR", BRAZIL: "BR",
    MX: "MX", MEXICO: "MX",
    SG: "SG", SINGAPORE: "SG",
    HK: "HK", "HONG KONG": "HK",
    AE: "AE", UAE: "AE", "UNITED ARAB EMIRATES": "AE",
    SA: "SA", "SAUDI ARABIA": "SA",
    TR: "TR", TURKEY: "TR",
    RU: "RU", RUSSIA: "RU",
  };
  return map[v] || v;
}

export function normaliseCurrencyCode(value: string): string {
  const v = value.trim().toUpperCase().replace(/[£$€]/g, "");
  const map: Record<string, string> = {
    "£": "GBP", POUNDS: "GBP", STERLING: "GBP", GBP: "GBP",
    "$": "USD", DOLLARS: "USD", USD: "USD",
    "€": "EUR", EUROS: "EUR", EUR: "EUR",
    "¥": "JPY", YEN: "JPY", JPY: "JPY",
    CHF: "CHF",
    SEK: "SEK",
    NOK: "NOK",
    DKK: "DKK",
    AUD: "AUD",
    CAD: "CAD",
    NZD: "NZD",
    SGD: "SGD",
    HKD: "HKD",
    CNY: "CNY",
    INR: "INR",
  };
  return map[v] || v;
}

export function parseNumericValue(value: string): number | null {
  const cleaned = value.replace(/[£$€,\s]/g, "").replace(/[^0-9.-]/g, "");
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

// ─── Debtor Distribution Parser ───────────────────────────────────────────────

// The debt bands in ascending order, with numeric thresholds for bucketing
const BAND_THRESHOLDS = [
  { label: "0–500",             min: 0,       max: 500 },
  { label: "501–1,000",         min: 501,     max: 1000 },
  { label: "1,001–2,500",       min: 1001,    max: 2500 },
  { label: "2,501–5,000",       min: 2501,    max: 5000 },
  { label: "5,001–10,000",      min: 5001,    max: 10000 },
  { label: "10,001–25,000",     min: 10001,   max: 25000 },
  { label: "25,001–50,000",     min: 25001,   max: 50000 },
  { label: "50,001–100,000",    min: 50001,   max: 100000 },
  { label: "100,001–250,000",   min: 100001,  max: 250000 },
  { label: "250,001–500,000",   min: 250001,  max: 500000 },
  { label: "Over 500,000",      min: 500001,  max: Infinity },
];

function getBandIndex(amount: number): number {
  for (let i = 0; i < BAND_THRESHOLDS.length; i++) {
    if (amount >= BAND_THRESHOLDS[i].min && amount <= BAND_THRESHOLDS[i].max) return i;
  }
  return BAND_THRESHOLDS.length - 1;
}

export function parseDebtorDistribution(
  headers: string[],
  rows: string[][],
): DebtorDistributionResult {
  // Strategy 1: file IS already a distribution table — find band + count + pct columns
  const bandCol   = headers.findIndex((h) => /band|range|bracket|tier/i.test(h));
  const countCol  = headers.findIndex((h) => /^count$|^number$|^no\.?$|debtors|customers/i.test(h));
  const pctCol    = headers.findIndex((h) => /^%$|percent|pct|proportion|balance.*%/i.test(h));

  if (bandCol !== -1 && (countCol !== -1 || pctCol !== -1)) {
    const counts = Array(debtBands.length).fill("");
    const pcts   = Array(debtBands.length).fill("");

    for (const row of rows) {
      const bandLabel = row[bandCol]?.trim();
      const bandIdx   = debtBands.findIndex(
        (b) => b.replace(/\s/g, "") === bandLabel?.replace(/\s/g, ""),
      );
      if (bandIdx === -1) continue;
      if (countCol !== -1) counts[bandIdx] = row[countCol] ?? "";
      if (pctCol   !== -1) pcts[bandIdx]   = row[pctCol]   ?? "";
    }

    return { counts, pcts };
  }

  // Strategy 2: file is an aged-debtor schedule — find a "total" or "outstanding balance" column
  const totalCol = headers.findIndex((h) =>
    /total|outstanding|balance|amount|debt/i.test(h),
  );
  if (totalCol === -1) throw new Error("Could not find a balance or outstanding column");

  const bandCounts = Array(debtBands.length).fill(0);
  const bandSums   = Array(debtBands.length).fill(0);
  let grandTotal   = 0;

  for (const row of rows) {
    const val = parseNumericValue(row[totalCol] ?? "");
    if (val === null || val <= 0) continue;
    const idx = getBandIndex(val);
    bandCounts[idx]++;
    bandSums[idx] += val;
    grandTotal += val;
  }

  const counts = bandCounts.map((c) => (c > 0 ? String(c) : ""));
  const pcts   = grandTotal > 0
    ? bandSums.map((s) => (s > 0 ? ((s / grandTotal) * 100).toFixed(1) : ""))
    : Array(debtBands.length).fill("");

  return { counts, pcts };
}
