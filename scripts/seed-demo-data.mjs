/**
 * Demo data seed script.
 * Wipes all existing client/submission data for tenant 7c98f7be-9f03-486b-b98a-a050321b1c6d
 * then creates 15 realistic-looking clients with varied products and statuses.
 *
 * Run with: node scripts/seed-demo-data.mjs
 */

const SUPABASE_URL = "https://crhvikwgzojndcezuhpn.supabase.co";
const SERVICE_KEY  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNyaHZpa3dnem9qbmRjZXp1aHBuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTQwMjIxNCwiZXhwIjoyMDkwOTc4MjE0fQ.kIYj2lHCM4xfzLWJ-XhpLgKHMmojh3Ah1pBPYh18EMw";
const TENANT_ID    = "7c98f7be-9f03-486b-b98a-a050321b1c6d";

// Broker user IDs
const BROKERS = [
  "1d3cedda-98ee-4349-b59a-7a1fa35d04af", // edward.gaze+tcbroker
  "c0f673cb-e593-4980-8288-bd85bb7c9d1b", // test3
];

const headers = {
  "apikey": SERVICE_KEY,
  "Authorization": `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
  "Prefer": "return=representation",
};

async function q(method, path, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: { ...headers, ...(body ? {} : { "Content-Length": "0" }) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function uuid() {
  return crypto.randomUUID();
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

function dateStr(y, m, d) {
  return `${y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function ref(tenantId) {
  const year = new Date().getFullYear();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  const prefix = tenantId.substring(0, 4).toUpperCase();
  return `${prefix}-${year}-${rand}`;
}

// ── Fake company data ────────────────────────────────────────────────────────

const CLIENTS = [
  {
    name: "Hartwell & Sons Engineering Ltd",
    contact: { name: "James Hartwell", pos: "Finance Director", tel: "01234 567890", email: "j.hartwell@hartwellengineeering.co.uk" },
    reg: "UK14523", sic: "25110", nature: "Manufacture and supply of structural steel components",
    addr: { line1: "Unit 12 Hartwell Industrial Estate", city: "Sheffield", postcode: "S9 2AB", country: "GB" },
    turnover: 18_500_000, employees: 142,
    classes: [
      { class: "trade_credit", status: "submitted", policyYear: 2025, renewalDate: "2025-10-15" },
      { class: "trade_credit", status: "submitted", policyYear: 2024, renewalDate: "2024-10-15" },
    ],
  },
  {
    name: "Meridian Foods Group PLC",
    contact: { name: "Sarah Chen", pos: "CFO", tel: "0207 123 4567", email: "s.chen@meridianfoods.co.uk" },
    reg: "UK98234", sic: "10891", nature: "Food manufacturing and distribution",
    addr: { line1: "Meridian House, 45 Commerce Way", city: "Bristol", postcode: "BS2 0TB", country: "GB" },
    turnover: 64_200_000, employees: 410,
    classes: [
      { class: "trade_credit", status: "submitted", policyYear: 2025, renewalDate: "2025-06-30" },
      { class: "cyber",        status: "submitted", policyYear: 2025, renewalDate: "2025-06-30" },
    ],
  },
  {
    name: "Ashbury Recruitment Partners",
    contact: { name: "Tom Ashbury", pos: "Managing Director", tel: "0113 456 7890", email: "tom@ashburyrecruitment.co.uk" },
    reg: "UK55789", sic: "78200", nature: "Temporary and permanent staffing services",
    addr: { line1: "2nd Floor, Ashbury House", city: "Leeds", postcode: "LS1 4AP", country: "GB" },
    turnover: 9_800_000, employees: 38,
    classes: [
      { class: "trade_credit", status: "submitted",   policyYear: 2025, renewalDate: "2025-09-01" },
      { class: "dno",          status: "in_progress", policyYear: 2025, renewalDate: null },
    ],
  },
  {
    name: "Quantum Pharma Distribution Ltd",
    contact: { name: "Dr Amanda Willis", pos: "Operations Director", tel: "01865 234567", email: "a.willis@quantumpharma.co.uk" },
    reg: "UK32156", sic: "46460", nature: "Wholesale distribution of pharmaceutical and medical products",
    addr: { line1: "Quantum Business Park, Cowley Road", city: "Oxford", postcode: "OX4 2HG", country: "GB" },
    turnover: 42_700_000, employees: 89,
    classes: [
      { class: "trade_credit", status: "submitted",   policyYear: 2025, renewalDate: "2025-11-30" },
      { class: "cyber",        status: "submitted",   policyYear: 2025, renewalDate: "2025-11-30" },
      { class: "dno",          status: "submitted",   policyYear: 2025, renewalDate: "2025-11-30" },
    ],
  },
  {
    name: "Northgate Building Materials Ltd",
    contact: { name: "Gary Nolan", pos: "Group Finance Manager", tel: "01302 678901", email: "g.nolan@northgatebuilding.co.uk" },
    reg: "UK77412", sic: "46730", nature: "Wholesale trade in timber, building materials and sanitary equipment",
    addr: { line1: "Northgate Depot, Wheatley Road", city: "Doncaster", postcode: "DN2 4PE", country: "GB" },
    turnover: 27_300_000, employees: 215,
    classes: [
      { class: "trade_credit", status: "submitted", policyYear: 2025, renewalDate: "2025-08-15" },
    ],
  },
  {
    name: "Vantage Logistics Solutions Ltd",
    contact: { name: "Helen Brook", pos: "Financial Controller", tel: "0121 345 6789", email: "h.brook@vantagelogistics.co.uk" },
    reg: "UK61034", sic: "52100", nature: "Road haulage and warehousing",
    addr: { line1: "Vantage Logistics Centre, Birch Street", city: "Birmingham", postcode: "B7 4RX", country: "GB" },
    turnover: 31_600_000, employees: 187,
    classes: [
      { class: "trade_credit",  status: "submitted",   policyYear: 2025, renewalDate: "2025-07-31" },
      { class: "trade_credit",  status: "submitted",   policyYear: 2024, renewalDate: "2024-07-31" },
      { class: "terrorism",     status: "submitted",   policyYear: 2025, renewalDate: "2025-07-31" },
    ],
  },
  {
    name: "Pinnacle Tech Services Ltd",
    contact: { name: "Raj Patel", pos: "CEO", tel: "020 7654 3210", email: "raj.patel@pinnacletech.co.uk" },
    reg: "UK45678", sic: "62020", nature: "IT consultancy and managed services",
    addr: { line1: "Level 8, One Canada Square", city: "London", postcode: "E14 5AB", country: "GB" },
    turnover: 14_900_000, employees: 73,
    classes: [
      { class: "cyber",  status: "submitted",   policyYear: 2025, renewalDate: "2025-03-31" },
      { class: "dno",    status: "submitted",   policyYear: 2025, renewalDate: "2025-03-31" },
    ],
  },
  {
    name: "Clearwater Textiles Ltd",
    contact: { name: "Patricia Moore", pos: "Finance Manager", tel: "01274 890123", email: "p.moore@clearwatertextiles.co.uk" },
    reg: "UK23890", sic: "13200", nature: "Weaving and finishing of textiles",
    addr: { line1: "Clearwater Mill, Valley Road", city: "Bradford", postcode: "BD1 4TG", country: "GB" },
    turnover: 8_400_000, employees: 124,
    classes: [
      { class: "trade_credit", status: "in_progress", policyYear: 2026, renewalDate: "2026-01-31" },
    ],
  },
  {
    name: "Sterling Precision Components Ltd",
    contact: { name: "Andrew Briggs", pos: "Company Secretary", tel: "01332 456789", email: "a.briggs@sterlingprecision.co.uk" },
    reg: "UK88123", sic: "28410", nature: "Manufacture of metal-cutting machine tools and precision parts",
    addr: { line1: "Sterling Works, Pride Park", city: "Derby", postcode: "DE24 8EH", country: "GB" },
    turnover: 22_100_000, employees: 163,
    classes: [
      { class: "trade_credit", status: "submitted",   policyYear: 2025, renewalDate: "2025-05-31" },
      { class: "trade_credit", status: "submitted",   policyYear: 2024, renewalDate: "2024-05-31" },
    ],
  },
  {
    name: "Bluewave Media Group Ltd",
    contact: { name: "Zoe Chambers", pos: "Finance Director", tel: "0207 987 6543", email: "z.chambers@bluewave.media" },
    reg: "UK19456", sic: "59110", nature: "Motion picture production and advertising media",
    addr: { line1: "Bluewave Studios, 100 Gray's Inn Road", city: "London", postcode: "WC1X 8AL", country: "GB" },
    turnover: 5_600_000, employees: 47,
    classes: [
      { class: "cyber", status: "submitted",   policyYear: 2025, renewalDate: "2025-12-31" },
      { class: "dno",   status: "in_progress", policyYear: 2025, renewalDate: null },
    ],
  },
  {
    name: "Haddon Agricultural Supplies Ltd",
    contact: { name: "Robert Haddon", pos: "Managing Director", tel: "01780 567890", email: "r.haddon@haddonag.co.uk" },
    reg: "UK56234", sic: "46610", nature: "Wholesale of grain, seeds, animal feeds and fertilisers",
    addr: { line1: "Haddon Barn, Tinwell Road", city: "Stamford", postcode: "PE9 2SA", country: "GB" },
    turnover: 37_200_000, employees: 58,
    classes: [
      { class: "trade_credit", status: "submitted", policyYear: 2025, renewalDate: "2025-04-30" },
    ],
  },
  {
    name: "TrustLayer Financial Solutions Ltd",
    contact: { name: "Fiona Walsh", pos: "CFO", tel: "0113 567 8901", email: "f.walsh@trustlayer.co.uk" },
    reg: "UK73918", sic: "66190", nature: "Financial advisory and credit management services",
    addr: { line1: "Park Square West, Floor 3", city: "Leeds", postcode: "LS1 2PJ", country: "GB" },
    turnover: 11_300_000, employees: 61,
    classes: [
      { class: "trade_credit", status: "not_started", policyYear: 2025, renewalDate: null },
      { class: "cyber",        status: "not_started", policyYear: 2025, renewalDate: null },
      { class: "dno",          status: "submitted",   policyYear: 2025, renewalDate: "2025-02-28" },
    ],
  },
  {
    name: "Ironbridge Castings Ltd",
    contact: { name: "Michael Frost", pos: "Financial Director", tel: "01952 234567", email: "m.frost@ironbridgecastings.co.uk" },
    reg: "UK34567", sic: "24510", nature: "Casting of iron and steel components",
    addr: { line1: "Works Road, Telford Industrial Estate", city: "Telford", postcode: "TF3 4AJ", country: "GB" },
    turnover: 15_800_000, employees: 198,
    classes: [
      { class: "trade_credit", status: "submitted",   policyYear: 2025, renewalDate: "2025-09-30" },
      { class: "terrorism",    status: "submitted",   policyYear: 2025, renewalDate: "2025-09-30" },
    ],
  },
  {
    name: "Radnor Paper & Packaging Ltd",
    contact: { name: "Claire Summers", pos: "Credit Manager", tel: "01685 345678", email: "c.summers@radnorpaper.co.uk" },
    reg: "UK67890", sic: "17210", nature: "Manufacture of corrugated paper, cardboard and packaging",
    addr: { line1: "Radnor Paper Mill, Canal Road", city: "Merthyr Tydfil", postcode: "CF47 8RD", country: "GB" },
    turnover: 19_600_000, employees: 231,
    classes: [
      { class: "trade_credit", status: "submitted",   policyYear: 2025, renewalDate: "2025-06-15" },
      { class: "trade_credit", status: "submitted",   policyYear: 2024, renewalDate: "2024-06-15" },
    ],
  },
  {
    name: "Crestwood Property Services Ltd",
    contact: { name: "David Crestwood", pos: "Director", tel: "020 8765 4321", email: "d.crestwood@crestwoodproperty.co.uk" },
    reg: "UK92345", sic: "68320", nature: "Management and letting of commercial and residential property",
    addr: { line1: "Crestwood House, 34 Finchley Road", city: "London", postcode: "NW3 6LJ", country: "GB" },
    turnover: 3_200_000, employees: 22,
    classes: [
      { class: "dno",   status: "submitted",   policyYear: 2025, renewalDate: "2025-10-31" },
      { class: "cyber", status: "not_started", policyYear: 2025, renewalDate: null },
    ],
  },
];

// ── Country / buyer pools ─────────────────────────────────────────────────────

const BUYER_POOL = [
  { name: "Baxter & Co Ltd",              country: "GB", currency: "GBP", limit: 150000 },
  { name: "Müller Industriewerk GmbH",    country: "DE", currency: "EUR", limit: 200000 },
  { name: "Nordic Supply AB",             country: "SE", currency: "SEK", limit: 80000  },
  { name: "Santander Metalurgica SA",     country: "ES", currency: "EUR", limit: 120000 },
  { name: "Renault Distribution SAS",    country: "FR", currency: "EUR", limit: 350000 },
  { name: "Bradfield Wholesale Ltd",      country: "GB", currency: "GBP", limit: 95000  },
  { name: "Polaris Import B.V.",          country: "NL", currency: "EUR", limit: 175000 },
  { name: "Carpathia Trading s.r.o.",     country: "CZ", currency: "CZK", limit: 60000  },
  { name: "Greenfield Foods LLC",         country: "US", currency: "USD", limit: 400000 },
  { name: "Atlantic Shipping PTE",        country: "SG", currency: "USD", limit: 220000 },
  { name: "Marchetti SpA",               country: "IT", currency: "EUR", limit: 190000 },
  { name: "Praxis Solutions Ltd",         country: "GB", currency: "GBP", limit: 75000  },
  { name: "Dalgaard A/S",                country: "DK", currency: "DKK", limit: 110000 },
  { name: "Portman Retail Group Ltd",     country: "GB", currency: "GBP", limit: 260000 },
  { name: "Westfield Components Pty",     country: "AU", currency: "AUD", limit: 145000 },
  { name: "Okafor Trading Co",            country: "NG", currency: "USD", limit: 50000  },
  { name: "Beijing Yutong Trading Co",    country: "CN", currency: "USD", limit: 300000 },
  { name: "Fenix Distribuidora Ltda",     country: "BR", currency: "USD", limit: 85000  },
];

const DEBT_BANDS = ["0-5000","5001-10000","10001-25000","25001-50000","50001-100000","100001-250000","250001+"];

// ── Wipe existing data ────────────────────────────────────────────────────────

async function wipe() {
  console.log("Wiping existing data…");

  // Step 1: collect all submission IDs for this tenant
  const subData = await q("GET", `submissions?select=id&tenant_id=eq.${TENANT_ID}`, null);
  const subIds = (subData ?? []).map((r) => r.id);
  console.log(`  ${subIds.length} existing submissions to delete`);

  if (subIds.length > 0) {
    const inClause = subIds.join(",");
    // Step 2: delete all child tables by submission_id (these lack tenant_id)
    const childTables = [
      "submission_loss_history", "submission_debtor_distribution", "submission_debtor_balances",
      "submission_buyers", "submission_financial", "submission_company",
      "submission_cyber", "submission_dno", "submission_terrorism",
      "submission_turnover_by_country", "submission_overdue_accounts",
    ];
    for (const t of childTables) {
      await fetch(`${SUPABASE_URL}/rest/v1/${t}?submission_id=in.(${inClause})`, {
        method: "DELETE", headers,
      }).catch(() => {});
    }
    // Step 3: magic_links
    await fetch(`${SUPABASE_URL}/rest/v1/magic_links?submission_id=in.(${inClause})`, {
      method: "DELETE", headers,
    }).catch(() => {});
  }

  // Step 4: submissions + clients (have tenant_id)
  await fetch(`${SUPABASE_URL}/rest/v1/submissions?tenant_id=eq.${TENANT_ID}`, { method: "DELETE", headers }).catch(() => {});
  await fetch(`${SUPABASE_URL}/rest/v1/clients?tenant_id=eq.${TENANT_ID}`, { method: "DELETE", headers }).catch(() => {});

  console.log("  ✓ Wipe complete");
}

// ── Seed ──────────────────────────────────────────────────────────────────────

async function seed() {
  await wipe();

  for (const [idx, c] of CLIENTS.entries()) {
    console.log(`\nCreating client ${idx + 1}/15: ${c.name}`);

    // 1. Client record
    const [client] = await q("POST", "clients", [{
      tenant_id:           TENANT_ID,
      display_name:        c.name,
      contact_name:        c.contact.name,
      contact_email:       c.contact.email,
      assigned_broker_id:  pick(BROKERS),
    }]);
    console.log(`  ✓ client ${client.id}`);

    // Group by class to track which is the "primary" (most recent) per class
    // Dedupe: if same class appears multiple times, sort by policyYear desc
    const byClass = {};
    for (const cls of c.classes) {
      if (!byClass[cls.class]) byClass[cls.class] = [];
      byClass[cls.class].push(cls);
    }

    for (const [classKey, clsList] of Object.entries(byClass)) {
      clsList.sort((a, b) => b.policyYear - a.policyYear);

      for (const [ci, cls] of clsList.entries()) {
        const isPrimary = ci === 0; // most recent
        const subId = uuid();
        const submittedAt = cls.status === "submitted" ? daysAgo(randInt(3, 60)) : null;
        const lastActivity = daysAgo(randInt(1, cls.status === "submitted" ? 30 : 5));
        const completionPct =
          cls.status === "submitted"   ? 100 :
          cls.status === "in_progress" ? randInt(30, 70) :
          0;

        // Insert submission
        await fetch(`${SUPABASE_URL}/rest/v1/submissions`, {
          method: "POST",
          headers: { ...headers, "Prefer": "return=minimal" },
          body: JSON.stringify({
            id:                subId,
            tenant_id:         TENANT_ID,
            client_id:         client.id,
            class_of_business: classKey,
            status:            cls.status,
            completion_pct:    completionPct,
            reference:         ref(TENANT_ID),
            policy_year:       cls.policyYear,
            renewal_date:      cls.renewalDate ?? null,
            submitted_at:      submittedAt,
            last_activity:     lastActivity,
          }),
        });

        // submission_company (for primary TC or all submitted)
        if (isPrimary || cls.status === "submitted") {
          await fetch(`${SUPABASE_URL}/rest/v1/submission_company`, {
            method: "POST",
            headers: { ...headers, "Prefer": "return=minimal" },
            body: JSON.stringify({
              submission_id:      subId,
              company_name:        c.name,
              company_reg_number:  c.reg,
              nature_of_business:  c.nature,
              address_line1:       c.addr.line1,
              city:                c.addr.city,
              postcode:            c.addr.postcode,
              country:             c.addr.country,
              contact_name:        c.contact.name,
              contact_position:    c.contact.pos,
              contact_telephone:   c.contact.tel,
              contact_email:       c.contact.email,
              capacity:            pick(["Seller","Both"]),
            }),
          });
        }

        // submission_financial (TC classes only — or all if needed for analytics)
        if (classKey === "trade_credit" && (isPrimary || cls.status === "submitted")) {
          const debtorTotal = Math.round(c.turnover * 0.12);
          const overduePct  = randInt(2, 8) / 100;

          await fetch(`${SUPABASE_URL}/rest/v1/submission_financial`, {
            method: "POST",
            headers: { ...headers, "Prefer": "return=minimal" },
            body: JSON.stringify({
              submission_id:              subId,
              total_insurable_turnover:   c.turnover,
              domestic_turnover:          Math.round(c.turnover * 0.65),
              export_turnover:            Math.round(c.turnover * 0.35),
              total_debtor_book:          debtorTotal,
              overdue_debts:              Math.round(debtorTotal * overduePct),
              currently_insured:          true,
              insurer_name:               pick(["Atradius","Euler Hermes","Coface","QBE"]),
              invoicing_deadline:         pick(["30 days","45 days","60 days"]),
              has_seasonal_peaks:         pick([true, false]),
              has_consignment_stock:      pick([true, false]),
              has_long_term_contracts:    pick([true, false]),
              has_contra_payments:        false,
              has_paid_when_paid:         pick([true, false]),
              has_wip_pre_credit:         false,
              has_retention_of_title:     pick([true, false]),
              has_work_on_site:           false,
              has_invoice_discounting:    pick([true, false]),
            }),
          });

          // Buyers (5–10 buyers)
          const numBuyers = randInt(5, 10);
          const buyerSample = BUYER_POOL.slice().sort(() => Math.random() - 0.5).slice(0, numBuyers);
          const buyerRows = buyerSample.map((b, i) => ({
            submission_id: subId,
            buyer_name:    b.name,
            country:       b.country,
            currency:      b.currency,
            credit_limit:  b.limit + randInt(-20000, 40000),
            sort_order:    i,
          }));
          await fetch(`${SUPABASE_URL}/rest/v1/submission_buyers`, {
            method: "POST",
            headers: { ...headers, "Prefer": "return=minimal" },
            body: JSON.stringify(buyerRows),
          });

          // Turnover by country (GB domestic + 2-3 export markets)
          const exportPct = 0.35;
          const domesticTurnover = Math.round(c.turnover * (1 - exportPct));
          const exportCountries = [
            { country: "DE", pct: 0.12 }, { country: "FR", pct: 0.10 },
            { country: "US", pct: 0.08 }, { country: "NL", pct: 0.05 },
          ].slice(0, randInt(2, 3));
          const exportTotal = exportCountries.reduce((s, e) => s + e.pct, 0);
          const turnoverRows = [
            { submission_id: subId, country_of_trade: "GB", annual_turnover: domesticTurnover, number_of_accounts: randInt(80, 300), normal_payment_terms: "30 days", max_payment_terms: "60 days", sort_order: 0 },
            ...exportCountries.map((e, ei) => ({
              submission_id: subId,
              country_of_trade: e.country,
              annual_turnover: Math.round(c.turnover * e.pct),
              number_of_accounts: randInt(5, 40),
              normal_payment_terms: "45 days",
              max_payment_terms: "90 days",
              sort_order: ei + 1,
            })),
          ];
          await fetch(`${SUPABASE_URL}/rest/v1/submission_turnover_by_country`, {
            method: "POST",
            headers: { ...headers, "Prefer": "return=minimal" },
            body: JSON.stringify(turnoverRows),
          });

          // Debtor distribution
          const distRows = DEBT_BANDS.map((band, i) => ({
            submission_id:      subId,
            debt_band:          band,
            number_of_debtors:  [randInt(80,200), randInt(60,150), randInt(40,100), randInt(20,60), randInt(10,30), randInt(5,15), randInt(1,5)][i],
            debtor_balance_pct: [15, 20, 22, 18, 13, 8, 4][i],
          }));
          await fetch(`${SUPABASE_URL}/rest/v1/submission_debtor_distribution`, {
            method: "POST",
            headers: { ...headers, "Prefer": "return=minimal" },
            body: JSON.stringify(distRows),
          });

          // Loss history (4 years)
          const lossRows = [
            { year_label: "2024/25", turnover: c.turnover,               notified_claims: randInt(0,8),  paid_claims: randInt(0,5),  outstanding_claims: randInt(0,3),  sort_order: 0 },
            { year_label: "2023/24", turnover: Math.round(c.turnover*0.92), notified_claims: randInt(0,10), paid_claims: randInt(0,6),  outstanding_claims: randInt(0,2),  sort_order: 1 },
            { year_label: "2022/23", turnover: Math.round(c.turnover*0.85), notified_claims: randInt(0,12), paid_claims: randInt(0,7),  outstanding_claims: randInt(0,2),  sort_order: 2 },
            { year_label: "2021/22", turnover: Math.round(c.turnover*0.78), notified_claims: randInt(0,6),  paid_claims: randInt(0,4),  outstanding_claims: 0,             sort_order: 3 },
          ].map((r) => ({ ...r, submission_id: subId }));
          await fetch(`${SUPABASE_URL}/rest/v1/submission_loss_history`, {
            method: "POST",
            headers: { ...headers, "Prefer": "return=minimal" },
            body: JSON.stringify(lossRows),
          });
        }

        // Class-specific tables
        if (classKey === "cyber" && (isPrimary || cls.status === "submitted")) {
          await fetch(`${SUPABASE_URL}/rest/v1/submission_cyber`, {
            method: "POST",
            headers: { ...headers, "Prefer": "return=minimal" },
            body: JSON.stringify({
              submission_id:             subId,
              annual_revenue:            c.turnover,
              it_security_budget:        Math.round(c.turnover * 0.005),
              has_mfa:                   true,
              has_endpoint_protection:   true,
              has_backup_recovery:       pick([true, false]),
              has_incident_response:     pick([true, false]),
              cloud_provider:            pick(["AWS","Azure","Google Cloud","On-premise"]),
              num_employees_with_access: c.employees,
            }),
          }).catch(() => {});
        }

        if (classKey === "dno" && (isPrimary || cls.status === "submitted")) {
          await fetch(`${SUPABASE_URL}/rest/v1/submission_dno`, {
            method: "POST",
            headers: { ...headers, "Prefer": "return=minimal" },
            body: JSON.stringify({
              submission_id:      subId,
              annual_turnover:    c.turnover,
              num_directors:      randInt(3, 9),
              company_type:       pick(["Private Limited","PLC","LLP"]),
              listed_on_exchange: false,
              has_subsidiaries:   pick([true, false]),
              has_claims_history: pick([true, false]),
            }),
          }).catch(() => {});
        }

        if (classKey === "terrorism" && (isPrimary || cls.status === "submitted")) {
          await fetch(`${SUPABASE_URL}/rest/v1/submission_terrorism`, {
            method: "POST",
            headers: { ...headers, "Prefer": "return=minimal" },
            body: JSON.stringify({
              submission_id:              subId,
              annual_turnover_terrorism:  c.turnover,
              property_address:           c.addr.line1 + ", " + c.addr.city,
              sum_insured:                Math.round(c.turnover * 0.4),
            }),
          }).catch(() => {});
        }

        console.log(`    ✓ submission ${subId.slice(0,8)}… [${classKey} ${cls.policyYear} ${cls.status}]`);
      }
    }
  }

  console.log("\n✅ Seed complete — 15 clients created.\n");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
