import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

// ─── Palette ────────────────────────────────────────────────────────────────
const C = {
  navy:   "#041240",
  blue:   "#4A90E2",
  sage:   "#B8C99E",
  silver: "#E2E8F0",
  muted:  "#6B7280",
  text:   "#111827",
  light:  "#F8FAFC",
  white:  "#FFFFFF",
};

// ─── Styles ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9,
    color: C.text,
    paddingTop: 52,
    paddingBottom: 56,
    paddingHorizontal: 48,
    backgroundColor: C.white,
  },
  headerBand: {
    backgroundColor: C.navy,
    marginHorizontal: -48,
    marginTop: -52,
    paddingHorizontal: 48,
    paddingVertical: 18,
    marginBottom: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  headerLogo:  { color: C.white, fontSize: 11, fontFamily: "Helvetica-Bold", letterSpacing: 2, marginBottom: 6 },
  headerTitle: { color: C.white, fontSize: 14, fontFamily: "Helvetica-Bold" },
  headerSub:   { color: "#9FB3D4", fontSize: 8.5, marginTop: 3 },
  headerMeta:  { color: "#9FB3D4", fontSize: 8, textAlign: "right", marginBottom: 2 },
  headerValue: { color: C.white,   fontSize: 8.5, textAlign: "right" },

  sectionHeading: {
    fontSize: 9.5,
    fontFamily: "Helvetica-Bold",
    color: C.navy,
    borderBottomWidth: 1.5,
    borderBottomColor: C.blue,
    paddingBottom: 4,
    marginBottom: 8,
    marginTop: 16,
  },
  subsectionHeading: {
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    color: C.muted,
    marginBottom: 4,
    marginTop: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: C.silver,
    paddingVertical: 3.5,
  },
  label: { width: "40%", color: C.muted, fontSize: 8.5 },
  value: { flex: 1, fontSize: 8.5, color: C.text },
  twoCol: { flexDirection: "row", gap: 20 },
  col:    { flex: 1 },

  // Tables
  tableHeader: {
    flexDirection: "row",
    backgroundColor: C.navy,
    paddingVertical: 5,
    paddingHorizontal: 6,
    marginTop: 4,
  },
  th:   { color: C.white, fontSize: 8, fontFamily: "Helvetica-Bold" },
  tr:   { flexDirection: "row", paddingVertical: 3.5, paddingHorizontal: 6, borderBottomWidth: 0.5, borderBottomColor: C.silver },
  trAlt:{ backgroundColor: C.light },
  td:   { fontSize: 8, color: C.text },

  // Trading Q&A
  qaRow: { flexDirection: "row", paddingVertical: 4, borderBottomWidth: 0.5, borderBottomColor: C.silver },
  qaLabel: { flex: 1, fontSize: 8.5, color: C.text },
  qaAnswer: { width: 28, fontSize: 8.5, fontFamily: "Helvetica-Bold" },
  qaDetail: { fontSize: 8, color: C.muted, marginTop: 1 },

  // Declaration
  declarationBox: {
    border: 1,
    borderColor: C.silver,
    borderRadius: 3,
    padding: 10,
    backgroundColor: "#F9FAFB",
    marginBottom: 10,
  },
  declarationText: { fontSize: 8.5, color: C.text, lineHeight: 1.5, marginBottom: 6 },
  sigBlock: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: C.silver,
    paddingTop: 10,
    flexDirection: "row",
    gap: 20,
  },
  sigField: { flex: 1 },
  sigLabel: { fontSize: 8, color: C.muted, marginBottom: 2 },
  sigValue: { fontSize: 9, fontFamily: "Helvetica-Bold", color: C.navy },

  footer: {
    position: "absolute",
    bottom: 20,
    left: 48,
    right: 48,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 0.5,
    borderTopColor: C.silver,
    paddingTop: 5,
  },
  footerText: { fontSize: 7.5, color: C.muted },
});

// ─── Types ───────────────────────────────────────────────────────────────────
export interface PDFBuyer {
  buyer_name: string;
  country_code: string | null;
  currency: string | null;
  credit_limit_requested: number | null;
}
export interface PDFTurnoverRow {
  country_of_trade: string;
  annual_turnover: number | null;
  number_of_accounts: number | null;
  normal_payment_terms: string | null;
  max_payment_terms: string | null;
}
export interface PDFLossRow {
  financial_year_ending: string | null;
  turnover: number | null;
  net_bad_debt_losses: number | null;
  number_of_losses: number | null;
  largest_individual_loss: number | null;
  largest_loss_name: string | null;
}
export interface PDFDebtorDist {
  debt_band: string;
  number_of_debtors: number | null;
  debtor_balance_pct: number | null;
}
export interface PDFOverdue {
  customer_name: string;
  amount_outstanding: number | null;
  due_date: string | null;
  action_taken: string | null;
}
export interface PDFDebtorBal {
  balance_31_march: number | null;
  balance_30_june: number | null;
  balance_30_september: number | null;
  balance_31_december: number | null;
  current_total: number | null;
}

export interface ProposalPDFData {
  reference: string;
  policyYear: number;
  submittedAt: string;
  declarationAcceptedAt: string;
  // Company
  companyName: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  postcode: string;
  country: string;
  companyRegNumber: string;
  formationDate: string;
  vatNumber: string;
  website: string;
  natureOfBusiness: string;
  capacity: string;
  tradeSectors: string[];
  debtCollectionProvider: string;
  currentBroker: string;
  // Contact
  contactName: string;
  contactPosition: string;
  contactTelephone: string;
  contactEmail: string;
  // Financial
  currency: string;
  invoicingDeadline: string;
  creditStatusProvider: string;
  creditStatusExpiry: string;
  currentlyInsured: boolean | null;
  insurerName: string;
  insurerRenewalDate: string;
  hasInvoiceDiscounting: boolean | null;
  factoringCompany: string;
  factoringNoticePeriod: string;
  // Trading questions
  hasSeasonalPeaks: boolean | null;
  seasonalPeaksDetail: string;
  hasConsignmentStock: boolean | null;
  consignmentStockDetail: string;
  hasLongTermContracts: boolean | null;
  longTermContractsDetail: string;
  hasContraPayments: boolean | null;
  contraPaymentsDetail: string;
  hasPaidWhenPaid: boolean | null;
  paidWhenPaidDetail: string;
  hasWipPreCredit: boolean | null;
  wipPreCreditDetail: string;
  hasRetentionOfTitle: boolean | null;
  retentionOfTitleDetail: string;
  hasWorkOnSite: boolean | null;
  workOnSiteDetail: string;
  // Tables
  turnoverRows: PDFTurnoverRow[];
  lossHistory: PDFLossRow[];
  buyers: PDFBuyer[];
  debtorDist: PDFDebtorDist[];
  debtorBal: PDFDebtorBal | null;
  overdueAccounts: PDFOverdue[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const dash  = (v: string | null | undefined) => v?.trim() || "—";
const bool  = (v: boolean | null) => v === true ? "Yes" : v === false ? "No" : "—";
const num   = (v: number | null | undefined) => v != null ? v.toLocaleString("en-GB") : "—";
const money = (v: number | null | undefined, ccy = "") =>
  v != null ? `${ccy} ${v.toLocaleString("en-GB")}`.trim() : "—";
const fmtDate = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleDateString("en-GB") : "—";

function KV({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.row}>
      <Text style={s.label}>{label}</Text>
      <Text style={s.value}>{value}</Text>
    </View>
  );
}

function SectionHeading({ children }: { children: string }) {
  return <Text style={s.sectionHeading}>{children}</Text>;
}

function Footer({ reference }: { reference: string }) {
  return (
    <View style={s.footer} fixed>
      <Text style={s.footerText}>Trade Credit Proposal · {reference} · Confidential</Text>
      <Text
        style={s.footerText}
        render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
      />
    </View>
  );
}

// ─── Document ────────────────────────────────────────────────────────────────
export function ProposalPDF({ data }: { data: ProposalPDFData }) {
  const address = [data.addressLine1, data.addressLine2, data.city, data.postcode, data.country]
    .filter(Boolean).join(", ");

  const tradingQuestions: { label: string; answer: boolean | null; detail: string }[] = [
    { label: "Are there any seasonal peaks in your business?",                      answer: data.hasSeasonalPeaks,       detail: data.seasonalPeaksDetail },
    { label: "Do you have consignment of stock?",                                   answer: data.hasConsignmentStock,    detail: data.consignmentStockDetail },
    { label: "Do you have any long term contracts (over 6 months)?",                answer: data.hasLongTermContracts,   detail: data.longTermContractsDetail },
    { label: "Do you contra or offset payments?",                                   answer: data.hasContraPayments,      detail: data.contraPaymentsDetail },
    { label: "Do you have paid when paid contracts?",                               answer: data.hasPaidWhenPaid,        detail: data.paidWhenPaidDetail },
    { label: "Do you work on a work-in-progress or pre-credit risk basis?",         answer: data.hasWipPreCredit,        detail: data.wipPreCreditDetail },
    { label: "Do you have an all monies retention of title clause?",                answer: data.hasRetentionOfTitle,    detail: data.retentionOfTitleDetail },
    { label: "Do you work on site?",                                                answer: data.hasWorkOnSite,          detail: data.workOnSiteDetail },
  ];

  return (
    <Document title={`Trade Credit Proposal — ${data.reference}`} author="Acrisure">
      <Page size="A4" style={s.page}>

        {/* ── Header ── */}
        <View style={s.headerBand} fixed>
          <View>
            <Text style={s.headerLogo}>ACRISURE</Text>
            <Text style={s.headerTitle}>Trade Credit Insurance Proposal</Text>
            <Text style={s.headerSub}>{data.companyName} · Policy year {data.policyYear}</Text>
          </View>
          <View>
            <Text style={s.headerMeta}>Reference</Text>
            <Text style={s.headerValue}>{data.reference}</Text>
            <Text style={[s.headerMeta, { marginTop: 4 }]}>Submitted</Text>
            <Text style={s.headerValue}>{data.submittedAt || "—"}</Text>
          </View>
        </View>

        {/* ── Section 1: Company Information ── */}
        <SectionHeading>1. Company Information</SectionHeading>
        <View style={s.twoCol}>
          <View style={s.col}>
            <KV label="Legal company name"       value={dash(data.companyName)} />
            <KV label="Registered address"        value={dash(address)} />
            <KV label="Company reg. number"       value={dash(data.companyRegNumber)} />
            <KV label="VAT number"                value={dash(data.vatNumber)} />
            <KV label="Formation date"            value={dash(data.formationDate)} />
            <KV label="Website"                   value={dash(data.website)} />
          </View>
          <View style={s.col}>
            <KV label="Nature of business"        value={dash(data.natureOfBusiness)} />
            <KV label="Capacity"                  value={dash(data.capacity)} />
            <KV label="Trade sectors"             value={data.tradeSectors?.length ? data.tradeSectors.join(", ") : "—"} />
            <KV label="Debt collection provider"  value={dash(data.debtCollectionProvider)} />
            <KV label="Current broker"            value={dash(data.currentBroker)} />
          </View>
        </View>

        {/* ── Section 2: Contact Details ── */}
        <SectionHeading>2. Contact Details</SectionHeading>
        <View style={s.twoCol}>
          <View style={s.col}>
            <KV label="Full name"   value={dash(data.contactName)} />
            <KV label="Position"    value={dash(data.contactPosition)} />
          </View>
          <View style={s.col}>
            <KV label="Telephone"   value={dash(data.contactTelephone)} />
            <KV label="Email"       value={dash(data.contactEmail)} />
          </View>
        </View>

        {/* ── Section 3: Financial Profile ── */}
        <SectionHeading>3. Financial Profile</SectionHeading>
        <View style={s.twoCol}>
          <View style={s.col}>
            <KV label="Reporting currency"          value={dash(data.currency)} />
            <KV label="Invoicing deadline"           value={dash(data.invoicingDeadline)} />
            <KV label="Credit status provider"       value={dash(data.creditStatusProvider)} />
            <KV label="Credit status expiry"         value={dash(data.creditStatusExpiry)} />
          </View>
          <View style={s.col}>
            <KV label="Currently insured"            value={bool(data.currentlyInsured)} />
            <KV label="Current insurer"              value={dash(data.insurerName)} />
            <KV label="Insurer renewal date"         value={dash(data.insurerRenewalDate)} />
            <KV label="Invoice discounting"          value={bool(data.hasInvoiceDiscounting)} />
            <KV label="Factoring company"            value={dash(data.factoringCompany)} />
            <KV label="Factoring notice period"      value={dash(data.factoringNoticePeriod)} />
          </View>
        </View>

        {/* ── Section 4: Turnover by Country ── */}
        <SectionHeading>4. Turnover by Country</SectionHeading>
        <View style={s.tableHeader}>
          <Text style={[s.th, { width: "30%" }]}>Country</Text>
          <Text style={[s.th, { width: "22%" }]}>Annual turnover</Text>
          <Text style={[s.th, { width: "18%" }]}>No. of accounts</Text>
          <Text style={[s.th, { width: "15%" }]}>Normal terms</Text>
          <Text style={[s.th, { flex: 1 }]}>Max terms</Text>
        </View>
        {data.turnoverRows.length === 0 ? (
          <Text style={[s.td, { padding: 6, color: C.muted, fontStyle: "italic" }]}>No turnover data entered</Text>
        ) : (
          data.turnoverRows.map((r, i) => (
            <View key={i} style={[s.tr, i % 2 === 1 ? s.trAlt : {}]}>
              <Text style={[s.td, { width: "30%" }]}>{r.country_of_trade}</Text>
              <Text style={[s.td, { width: "22%" }]}>{money(r.annual_turnover, data.currency)}</Text>
              <Text style={[s.td, { width: "18%" }]}>{num(r.number_of_accounts)}</Text>
              <Text style={[s.td, { width: "15%" }]}>{dash(r.normal_payment_terms)}</Text>
              <Text style={[s.td, { flex: 1 }]}>{dash(r.max_payment_terms)}</Text>
            </View>
          ))
        )}

        {/* ── Section 5: Trading History ── */}
        <SectionHeading>5. Trading History</SectionHeading>
        <View style={s.tableHeader}>
          <Text style={[s.th, { width: "18%" }]}>Year end</Text>
          <Text style={[s.th, { width: "20%" }]}>Turnover</Text>
          <Text style={[s.th, { width: "20%" }]}>Net bad debt</Text>
          <Text style={[s.th, { width: "14%" }]}>No. of losses</Text>
          <Text style={[s.th, { width: "20%" }]}>Largest loss</Text>
          <Text style={[s.th, { flex: 1 }]}>Debtor name</Text>
        </View>
        {data.lossHistory.length === 0 ? (
          <Text style={[s.td, { padding: 6, color: C.muted, fontStyle: "italic" }]}>No trading history entered</Text>
        ) : (
          data.lossHistory.map((r, i) => (
            <View key={i} style={[s.tr, i % 2 === 1 ? s.trAlt : {}]}>
              <Text style={[s.td, { width: "18%" }]}>{fmtDate(r.financial_year_ending)}</Text>
              <Text style={[s.td, { width: "20%" }]}>{money(r.turnover, data.currency)}</Text>
              <Text style={[s.td, { width: "20%" }]}>{money(r.net_bad_debt_losses, data.currency)}</Text>
              <Text style={[s.td, { width: "14%" }]}>{num(r.number_of_losses)}</Text>
              <Text style={[s.td, { width: "20%" }]}>{money(r.largest_individual_loss, data.currency)}</Text>
              <Text style={[s.td, { flex: 1 }]}>{dash(r.largest_loss_name)}</Text>
            </View>
          ))
        )}

        {/* ── Section 6: Trading Arrangements ── */}
        <SectionHeading>6. Trading Arrangements</SectionHeading>
        {tradingQuestions.map((q, i) => (
          <View key={i} style={s.qaRow} wrap={false}>
            <View style={s.qaLabel}>
              <Text>{q.label}</Text>
              {q.answer === true && q.detail && (
                <Text style={s.qaDetail}>Details: {q.detail}</Text>
              )}
            </View>
            <Text style={[s.qaAnswer, { color: q.answer === true ? C.blue : q.answer === false ? C.muted : C.muted }]}>
              {bool(q.answer)}
            </Text>
          </View>
        ))}

        {/* ── Section 7: Buyer Portfolio ── */}
        <SectionHeading>7. Buyer Portfolio</SectionHeading>
        <View style={s.tableHeader}>
          <Text style={[s.th, { flex: 2 }]}>Buyer name</Text>
          <Text style={[s.th, { width: "14%" }]}>Country</Text>
          <Text style={[s.th, { width: "14%" }]}>Currency</Text>
          <Text style={[s.th, { width: "22%" }]}>Credit limit requested</Text>
        </View>
        {data.buyers.length === 0 ? (
          <Text style={[s.td, { padding: 6, color: C.muted, fontStyle: "italic" }]}>No buyers entered</Text>
        ) : (
          data.buyers.map((b, i) => (
            <View key={i} style={[s.tr, i % 2 === 1 ? s.trAlt : {}]}>
              <Text style={[s.td, { flex: 2 }]}>{b.buyer_name}</Text>
              <Text style={[s.td, { width: "14%" }]}>{dash(b.country_code)}</Text>
              <Text style={[s.td, { width: "14%" }]}>{dash(b.currency)}</Text>
              <Text style={[s.td, { width: "22%" }]}>{money(b.credit_limit_requested, b.currency ?? "")}</Text>
            </View>
          ))
        )}

        {/* ── Section 8: Debtor Profile ── */}
        <SectionHeading>8. Debtor Profile</SectionHeading>

        <Text style={s.subsectionHeading}>Debtor Distribution</Text>
        {data.debtorDist.length === 0 ? (
          <Text style={[s.td, { color: C.muted, fontStyle: "italic", marginBottom: 6 }]}>No data entered</Text>
        ) : (
          <>
            <View style={s.tableHeader}>
              <Text style={[s.th, { flex: 1 }]}>Debt band</Text>
              <Text style={[s.th, { width: "25%" }]}>No. of debtors</Text>
              <Text style={[s.th, { width: "25%" }]}>% of balance</Text>
            </View>
            {data.debtorDist.map((d, i) => (
              <View key={i} style={[s.tr, i % 2 === 1 ? s.trAlt : {}]}>
                <Text style={[s.td, { flex: 1 }]}>{d.debt_band}</Text>
                <Text style={[s.td, { width: "25%" }]}>{num(d.number_of_debtors)}</Text>
                <Text style={[s.td, { width: "25%" }]}>{d.debtor_balance_pct != null ? `${d.debtor_balance_pct}%` : "—"}</Text>
              </View>
            ))}
          </>
        )}

        <Text style={s.subsectionHeading}>Quarterly Debtor Balances</Text>
        <View style={s.twoCol}>
          <View style={s.col}>
            <KV label="31 March"    value={money(data.debtorBal?.balance_31_march,     data.currency)} />
            <KV label="30 June"     value={money(data.debtorBal?.balance_30_june,      data.currency)} />
          </View>
          <View style={s.col}>
            <KV label="30 September" value={money(data.debtorBal?.balance_30_september, data.currency)} />
            <KV label="31 December"  value={money(data.debtorBal?.balance_31_december,  data.currency)} />
          </View>
        </View>
        <KV label="Current total debtor balance" value={money(data.debtorBal?.current_total, data.currency)} />

        <Text style={s.subsectionHeading}>Overdue Accounts</Text>
        {data.overdueAccounts.length === 0 ? (
          <Text style={[s.td, { color: C.muted, fontStyle: "italic" }]}>None reported</Text>
        ) : (
          <>
            <View style={s.tableHeader}>
              <Text style={[s.th, { flex: 2 }]}>Customer</Text>
              <Text style={[s.th, { width: "20%" }]}>Amount outstanding</Text>
              <Text style={[s.th, { width: "18%" }]}>Due date</Text>
              <Text style={[s.th, { flex: 1 }]}>Action taken</Text>
            </View>
            {data.overdueAccounts.map((o, i) => (
              <View key={i} style={[s.tr, i % 2 === 1 ? s.trAlt : {}]}>
                <Text style={[s.td, { flex: 2 }]}>{o.customer_name}</Text>
                <Text style={[s.td, { width: "20%" }]}>{money(o.amount_outstanding, data.currency)}</Text>
                <Text style={[s.td, { width: "18%" }]}>{fmtDate(o.due_date)}</Text>
                <Text style={[s.td, { flex: 1 }]}>{dash(o.action_taken)}</Text>
              </View>
            ))}
          </>
        )}

        {/* ── Section 9: Declaration ── */}
        <SectionHeading>9. Declaration</SectionHeading>
        <View style={s.declarationBox}>
          <Text style={s.declarationText}>
            I/We declare that to the best of my/our knowledge and belief the answers given in this proposal form are true and complete. I/We understand that this proposal shall be the basis of the contract between me/us and the Insurer and that the policy will be voidable if I/we have made any misrepresentation or non-disclosure.
          </Text>
          <Text style={s.declarationText}>
            I/We authorise the Insurer, or its agents, to make such enquiries as they may consider necessary in connection with this proposal, including but not limited to credit reference agencies, Companies House, and any other relevant third party sources.
          </Text>
          <Text style={[s.declarationText, { marginBottom: 0 }]}>
            I/We understand that cover will not be effective until the Insurer has accepted this proposal and issued a policy, and that any claim arising before such acceptance shall not be covered.
          </Text>
        </View>
        <Text style={[s.declarationText, { marginBottom: 8 }]}>
          By submitting this proposal, the signatory confirms that the information provided is accurate to the best of their knowledge and authorises Acrisure UK to approach the insurance market on their behalf.
        </Text>

        <View style={s.sigBlock} wrap={false}>
          <View style={s.sigField}>
            <Text style={s.sigLabel}>Signed by</Text>
            <Text style={s.sigValue}>{dash(data.contactName)}</Text>
          </View>
          <View style={s.sigField}>
            <Text style={s.sigLabel}>Position</Text>
            <Text style={s.sigValue}>{dash(data.contactPosition)}</Text>
          </View>
          <View style={s.sigField}>
            <Text style={s.sigLabel}>Date accepted</Text>
            <Text style={s.sigValue}>{data.declarationAcceptedAt || data.submittedAt || "—"}</Text>
          </View>
          <View style={s.sigField}>
            <Text style={s.sigLabel}>Reference</Text>
            <Text style={s.sigValue}>{data.reference}</Text>
          </View>
        </View>

        <Footer reference={data.reference} />
      </Page>
    </Document>
  );
}
