import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

// ─── Palette (matches ProposalPDF) ───────────────────────────────────────────
const C = {
  navy:   "#041240",
  blue:   "#4A90E2",
  silver: "#E2E8F0",
  muted:  "#6B7280",
  text:   "#111827",
  light:  "#F8FAFC",
  white:  "#FFFFFF",
};

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
  row: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: C.silver,
    paddingVertical: 3.5,
  },
  label:  { width: "45%", color: C.muted, fontSize: 8.5 },
  value:  { flex: 1, fontSize: 8.5, color: C.text },
  twoCol: { flexDirection: "row", gap: 20 },
  col:    { flex: 1 },
  qaRow: {
    flexDirection: "row",
    paddingVertical: 5,
    borderBottomWidth: 0.5,
    borderBottomColor: C.silver,
  },
  qaLabel:  { flex: 1, fontSize: 8.5, color: C.text },
  qaAnswer: { width: 28, fontSize: 8.5, fontFamily: "Helvetica-Bold" },
  qaDetail: { fontSize: 8, color: C.muted, marginTop: 2 },
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

// ─── Helpers ─────────────────────────────────────────────────────────────────
const dash  = (v: string | null | undefined) => v?.trim() || "—";
const bool  = (v: boolean | null) => v === true ? "Yes" : v === false ? "No" : "—";
const num   = (v: number | null | undefined) => v != null ? v.toLocaleString("en-GB") : "—";
const money = (v: number | null | undefined) =>
  v != null ? `£${v.toLocaleString("en-GB")}` : "—";

// ─── Shared types ─────────────────────────────────────────────────────────────
export interface SharedData {
  reference: string;
  policyYear: number;
  submittedAt: string;
  declarationAcceptedAt: string;
  companyName: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  postcode: string;
  country: string;
  companyRegNumber: string;
  website: string;
  contactName: string;
  contactPosition: string;
  contactTelephone: string;
  contactEmail: string;
}

// ─── Cyber ───────────────────────────────────────────────────────────────────
export interface CyberPDFData extends SharedData {
  annualRevenue: number | null;
  cyberEssentialsCertified: boolean | null;
  cyberEssentialsPlus: boolean | null;
  mfaAllRemoteAccess: boolean | null;
  patchingPolicy: boolean | null;
  offsiteBackups: boolean | null;
  edrSoftware: boolean | null;
  incidentResponsePlan: boolean | null;
  sufferedBreach: boolean | null;
  breachDetails: string;
  personalDataRecords: string;
  processesPaymentCards: boolean | null;
}

const DATA_RECORDS_LABELS: Record<string, string> = {
  under_1k:   "Under 1,000",
  "1k_10k":   "1,000–10,000",
  "10k_100k": "10,000–100,000",
  over_100k:  "Over 100,000",
};

// ─── D&O ─────────────────────────────────────────────────────────────────────
export interface DNOPDFData extends SharedData {
  annualTurnover: number | null;
  numberOfDirectors: number | null;
  companyListed: boolean | null;
  directorDisqualified: boolean | null;
  directorDisqualifiedDetails: string;
  pendingClaims: boolean | null;
  pendingClaimsDetails: string;
  hasAuditCommittee: boolean | null;
  recentAcquisitions: boolean | null;
  recentAcquisitionsDetails: string;
  netAssets: number | null;
}

// ─── Terrorism ───────────────────────────────────────────────────────────────
export interface TerrorismPDFData extends SharedData {
  propertyAddress: string;
  constructionType: string;
  yearOfConstruction: number | null;
  sumInsured: number | null;
  nearLandmark: boolean | null;
  occupancyType: string;
  existingTerrorismCover: boolean | null;
  existingCoverDetails: string;
}

const CONSTRUCTION_LABELS: Record<string, string> = {
  brick:    "Brick",
  concrete: "Concrete",
  steel:    "Steel frame",
  timber:   "Timber frame",
  mixed:    "Mixed",
};

const OCCUPANCY_LABELS: Record<string, string> = {
  office:       "Office",
  retail:       "Retail",
  industrial:   "Industrial / Warehouse",
  hospitality:  "Hospitality",
  mixed:        "Mixed use",
};

// ─── Shared sub-components ───────────────────────────────────────────────────
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

function QA({ label, answer, detail }: { label: string; answer: boolean | null; detail?: string }) {
  return (
    <View style={s.qaRow} wrap={false}>
      <View style={s.qaLabel}>
        <Text>{label}</Text>
        {answer === true && detail ? <Text style={s.qaDetail}>Details: {detail}</Text> : null}
      </View>
      <Text style={s.qaAnswer}>{bool(answer)}</Text>
    </View>
  );
}

function CompanyContact({ d }: { d: SharedData }) {
  const address = [d.addressLine1, d.addressLine2, d.city, d.postcode, d.country]
    .filter(Boolean).join(", ");
  return (
    <>
      <SectionHeading>1. Company Information</SectionHeading>
      <View style={s.twoCol}>
        <View style={s.col}>
          <KV label="Legal company name"  value={dash(d.companyName)} />
          <KV label="Registered address"  value={dash(address)} />
          <KV label="Company reg. number" value={dash(d.companyRegNumber)} />
          <KV label="Website"             value={dash(d.website)} />
        </View>
        <View style={s.col}>
          <KV label="Contact name"      value={dash(d.contactName)} />
          <KV label="Position"          value={dash(d.contactPosition)} />
          <KV label="Telephone"         value={dash(d.contactTelephone)} />
          <KV label="Email"             value={dash(d.contactEmail)} />
        </View>
      </View>
    </>
  );
}

function Declaration({ d, sectionNum }: { d: SharedData; sectionNum: number }) {
  return (
    <>
      <SectionHeading>{sectionNum}. Declaration</SectionHeading>
      <View style={s.declarationBox}>
        <Text style={s.declarationText}>
          I/We declare that to the best of my/our knowledge and belief the answers given in this proposal form are true and complete. I/We understand that this proposal shall be the basis of the contract between me/us and the Insurer and that the policy will be voidable if I/we have made any misrepresentation or non-disclosure.
        </Text>
        <Text style={[s.declarationText, { marginBottom: 0 }]}>
          I/We understand that cover will not be effective until the Insurer has accepted this proposal and issued a policy, and that any claim arising before such acceptance shall not be covered.
        </Text>
      </View>
      <Text style={[s.declarationText, { marginBottom: 8 }]}>
        By submitting this proposal, the signatory confirms that the information provided is accurate to the best of their knowledge and authorises the broker to approach the insurance market on their behalf.
      </Text>
      <View style={s.sigBlock} wrap={false}>
        <View style={s.sigField}>
          <Text style={s.sigLabel}>Signed by</Text>
          <Text style={s.sigValue}>{dash(d.contactName)}</Text>
        </View>
        <View style={s.sigField}>
          <Text style={s.sigLabel}>Position</Text>
          <Text style={s.sigValue}>{dash(d.contactPosition)}</Text>
        </View>
        <View style={s.sigField}>
          <Text style={s.sigLabel}>Date accepted</Text>
          <Text style={s.sigValue}>{d.declarationAcceptedAt || d.submittedAt || "—"}</Text>
        </View>
        <View style={s.sigField}>
          <Text style={s.sigLabel}>Reference</Text>
          <Text style={s.sigValue}>{d.reference}</Text>
        </View>
      </View>
    </>
  );
}

function PDFFooter({ label, reference }: { label: string; reference: string }) {
  return (
    <View style={s.footer} fixed>
      <Text style={s.footerText}>{label} Proposal · {reference} · Confidential</Text>
      <Text
        style={s.footerText}
        render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
      />
    </View>
  );
}

function PDFHeader({ title, d }: { title: string; d: SharedData }) {
  return (
    <View style={s.headerBand} fixed>
      <View>
        <Text style={s.headerLogo}>ACRISURE</Text>
        <Text style={s.headerTitle}>{title}</Text>
        <Text style={s.headerSub}>{d.companyName} · Policy year {d.policyYear}</Text>
      </View>
      <View>
        <Text style={s.headerMeta}>Reference</Text>
        <Text style={s.headerValue}>{d.reference}</Text>
        <Text style={[s.headerMeta, { marginTop: 4 }]}>Submitted</Text>
        <Text style={s.headerValue}>{d.submittedAt || "—"}</Text>
      </View>
    </View>
  );
}

// ─── Cyber PDF ───────────────────────────────────────────────────────────────
export function CyberProposalPDF({ data: d }: { data: CyberPDFData }) {
  return (
    <Document title={`Cyber Insurance Proposal — ${d.reference}`} author="Acrisure">
      <Page size="A4" style={s.page}>
        <PDFHeader title="Cyber Insurance Proposal" d={d} />

        <CompanyContact d={d} />

        <SectionHeading>2. Financial</SectionHeading>
        <KV label="Annual revenue" value={money(d.annualRevenue)} />

        <SectionHeading>3. Certifications &amp; Controls</SectionHeading>
        <QA label="Cyber Essentials certification achieved?" answer={d.cyberEssentialsCertified} />
        <QA label="Cyber Essentials Plus certification achieved?" answer={d.cyberEssentialsPlus} />
        <QA label="MFA enforced for all remote access (VPN, email, cloud)?" answer={d.mfaAllRemoteAccess} />
        <QA label="Documented, regularly applied software patching policy in place?" answer={d.patchingPolicy} />
        <QA label="Regular, tested backups stored offline or off-site?" answer={d.offsiteBackups} />
        <QA label="Endpoint detection and response (EDR) software deployed across all endpoints?" answer={d.edrSoftware} />
        <QA label="Written incident response plan in place?" answer={d.incidentResponsePlan} />

        <SectionHeading>4. Data &amp; Incidents</SectionHeading>
        <QA label="Suffered a cyber incident or data breach in the last 3 years?" answer={d.sufferedBreach} detail={d.breachDetails} />
        <KV label="Personal data records held" value={DATA_RECORDS_LABELS[d.personalDataRecords] ?? dash(d.personalDataRecords)} />
        <QA label="Processes payment card data (credit/debit card payments)?" answer={d.processesPaymentCards} />

        <Declaration d={d} sectionNum={5} />
        <PDFFooter label="Cyber Insurance" reference={d.reference} />
      </Page>
    </Document>
  );
}

// ─── D&O PDF ─────────────────────────────────────────────────────────────────
export function DNOProposalPDF({ data: d }: { data: DNOPDFData }) {
  return (
    <Document title={`Directors & Officers Proposal — ${d.reference}`} author="Acrisure">
      <Page size="A4" style={s.page}>
        <PDFHeader title="Directors &amp; Officers Insurance Proposal" d={d} />

        <CompanyContact d={d} />

        <SectionHeading>2. Financial</SectionHeading>
        <KV label="Annual turnover" value={money(d.annualTurnover)} />
        <KV label="Net assets (most recent accounts)" value={money(d.netAssets)} />

        <SectionHeading>3. Board &amp; Governance</SectionHeading>
        <KV label="Number of directors and officers" value={d.numberOfDirectors != null ? String(d.numberOfDirectors) : "—"} />
        <QA label="Company listed on a stock exchange?" answer={d.companyListed} />
        <QA label="Audit committee in place?" answer={d.hasAuditCommittee} />

        <SectionHeading>4. Claims &amp; Regulatory History</SectionHeading>
        <QA
          label="Has any director or officer been disqualified, sanctioned, or subject to regulatory action in the last 5 years?"
          answer={d.directorDisqualified}
          detail={d.directorDisqualifiedDetails}
        />
        <QA
          label="Any pending or anticipated claims against any director or officer?"
          answer={d.pendingClaims}
          detail={d.pendingClaimsDetails}
        />
        <QA
          label="Any acquisitions or disposals in the last 2 years, or planned?"
          answer={d.recentAcquisitions}
          detail={d.recentAcquisitionsDetails}
        />

        <Declaration d={d} sectionNum={5} />
        <PDFFooter label="Directors & Officers" reference={d.reference} />
      </Page>
    </Document>
  );
}

// ─── Terrorism PDF ───────────────────────────────────────────────────────────
export function TerrorismProposalPDF({ data: d }: { data: TerrorismPDFData }) {
  return (
    <Document title={`Terrorism Insurance Proposal — ${d.reference}`} author="Acrisure">
      <Page size="A4" style={s.page}>
        <PDFHeader title="Terrorism Insurance Proposal" d={d} />

        <CompanyContact d={d} />

        <SectionHeading>2. Property Details</SectionHeading>
        <KV label="Property address" value={dash(d.propertyAddress)} />
        <KV label="Construction type" value={CONSTRUCTION_LABELS[d.constructionType] ?? dash(d.constructionType)} />
        <KV label="Year of construction" value={d.yearOfConstruction != null ? String(d.yearOfConstruction) : "—"} />
        <KV label="Total sum insured" value={money(d.sumInsured)} />
        <KV label="Primary occupancy" value={OCCUPANCY_LABELS[d.occupancyType] ?? dash(d.occupancyType)} />

        <SectionHeading>3. Risk Profile</SectionHeading>
        <QA
          label="Property within 250m of a government building, major transport hub, landmark, or symbolic target?"
          answer={d.nearLandmark}
        />
        <QA
          label="Existing terrorism cover in place?"
          answer={d.existingTerrorismCover}
          detail={d.existingCoverDetails}
        />

        <Declaration d={d} sectionNum={4} />
        <PDFFooter label="Terrorism Insurance" reference={d.reference} />
      </Page>
    </Document>
  );
}
