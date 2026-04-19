import PDFDocument from "pdfkit";
import { createWriteStream, mkdirSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "../dummy-quotes");
mkdirSync(outDir, { recursive: true });

function makePDF(filename, content) {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ margin: 60, size: "A4" });
    const stream = createWriteStream(join(outDir, filename));
    doc.pipe(stream);

    const lines = content.split("\n");
    let y = doc.y;

    for (const line of lines) {
      if (line.startsWith("### ")) {
        doc.moveDown(0.5).fontSize(13).font("Helvetica-Bold").fillColor("#1a1a2e").text(line.slice(4));
      } else if (line.startsWith("## ")) {
        doc.moveDown(0.8).fontSize(16).font("Helvetica-Bold").fillColor("#1a1a2e").text(line.slice(3));
      } else if (line.startsWith("# ")) {
        doc.moveDown(0.3).fontSize(20).font("Helvetica-Bold").fillColor("#1a1a2e").text(line.slice(2));
      } else if (line.startsWith("---")) {
        doc.moveDown(0.3).moveTo(60, doc.y).lineTo(535, doc.y).strokeColor("#cccccc").stroke().moveDown(0.3);
      } else if (line.trim() === "") {
        doc.moveDown(0.4);
      } else if (line.startsWith("  - ") || line.startsWith("- ")) {
        const text = line.replace(/^  - /, "").replace(/^- /, "");
        doc.fontSize(10).font("Helvetica").fillColor("#333333").text(`• ${text}`, { indent: 16 });
      } else if (line.includes(":") && !line.startsWith(" ")) {
        const [key, ...rest] = line.split(":");
        const val = rest.join(":").trim();
        doc.fontSize(10).font("Helvetica-Bold").fillColor("#333333")
          .text(key + ": ", { continued: !!val })
          .font("Helvetica").text(val || "");
      } else {
        doc.fontSize(10).font("Helvetica").fillColor("#333333").text(line);
      }
    }

    doc.end();
    stream.on("finish", resolve);
  });
}

// ─── QUOTE 1: CFC Underwriting ────────────────────────────────────────────────

const cfc = `# CFC Underwriting — Cyber Insurance Quotation

## POLICY SCHEDULE

Reference: CFC-CYB-2025-00847
Insured: Hartwell Manufacturing Ltd
Broker: Acrisure UK
Date of Quotation: 10 April 2025
Policy Period: 1 May 2025 to 30 April 2026

---

## PREMIUM

Annual Premium: £18,450 (net of IPT)
Insurance Premium Tax (IPT): £2,214.00 (12%)
Total Premium Payable: £20,664.00
Payment Terms: 30 days net. Quarterly instalment available on request (+1.5% loading).

---

## COVERAGE SUMMARY

### Limit of Liability
Aggregate Limit: £5,000,000 per policy period
Sub-limit — Ransomware Response: £5,000,000 (shared aggregate)
Sub-limit — Business Interruption: £5,000,000 (shared aggregate)
Sub-limit — Social Engineering / Funds Transfer Fraud: £250,000
Sub-limit — Reputational Harm: £500,000
Sub-limit — Cyber Crime (telephone hacking): £100,000

### Retention (Excess)
Each and every loss: £10,000
Ransomware events: £25,000
Social Engineering: £25,000
System Failure (non-malicious): £15,000

### Coverage Territory
Worldwide (excluding USA/Canada domiciled claims)

---

## KEY COVERAGES

- First-party cyber incident response (forensics, legal, PR)
- Ransomware negotiation and payment support
- Business interruption and extra expense (72-hour deductible period)
- Data restoration costs
- Third-party privacy and network security liability
- Multimedia liability
- PCI-DSS fines and assessments (sub-limit £250,000)
- Regulatory defence and penalties (GDPR — sub-limit £1,000,000)
- Cyber extortion threat response
- Dependent business interruption (cloud provider outage)

---

## KEY EXCLUSIONS

- Prior known circumstances (as declared)
- War and state-sponsored cyber attacks (manuscript endorsement for "NotPetya-type" partial coverage available — see below)
- Infrastructure failure (power grid, internet backbone)
- Bodily injury and property damage
- Intellectual property infringement (coverage for defence costs only)
- Criminal, dishonest or fraudulent acts by senior management
- Unencrypted portable devices (data breach arising from)

---

## SPECIAL CONDITIONS & ENDORSEMENTS

### Endorsement 1 — Nation State Partial Cover
Coverage is extended to include cyber attacks by nation state actors up to £1,000,000 sub-limit, provided attribution is not confirmed by a UK government agency within 180 days of the event.

### Endorsement 2 — Retroactive Date
Retroactive date: 1 May 2020. Claims arising from circumstances known prior to inception are excluded.

### Subjectivity 1 — MFA Confirmation
Coverage is conditional upon confirmation that multi-factor authentication (MFA) is enforced on all remote access, email, and privileged accounts. Confirmation required within 30 days of inception.

### Subjectivity 2 — Patch Management
Insured to confirm no critical CVE-rated vulnerabilities (CVSS score ≥9.0) remain unpatched for more than 30 days at time of inception.

---

## CLAIMS NOTIFICATION

Claims must be reported to CFC's 24/7 incident response hotline within 72 hours of discovery. Late notification may prejudice coverage. Hotline: +44 20 7220 8500.

---

## INSURER DETAILS

Insurer: CFC Underwriting Ltd (Lloyd's Syndicate 1882)
Lloyd's Stamp: 100%
Rated: A (Excellent) — AM Best
Governing Law: England & Wales
`;

// ─── QUOTE 2: Beazley ─────────────────────────────────────────────────────────

const beazley = `# Beazley Group — Cyber & Tech Liability Quotation

## POLICY SCHEDULE

Reference: BEA-CYBER-UK-2025-44721
Named Insured: Hartwell Manufacturing Ltd
Producing Broker: Acrisure UK Limited
Quotation Date: 11 April 2025
Policy Inception: 1 May 2025
Policy Expiry: 1 May 2026

---

## PREMIUM

Net Premium: £22,100
IPT (12%): £2,652
Gross Premium: £24,752
Payment: Annual in advance. 90-day premium warranty applies.
Instalment Option: 4 quarterly payments of £6,438 (total £25,752 — £1,000 finance charge).

---

## LIMITS OF LIABILITY

Primary Aggregate Limit: £5,000,000

Sub-limits:
- Cyber Extortion / Ransomware: £5,000,000 (within aggregate)
- Business Interruption (loss of income): £3,000,000 (within aggregate)
- Contingent Business Interruption: £1,000,000 (within aggregate)
- Data Breach Response Costs: £5,000,000 (within aggregate)
- Regulatory Fines & Penalties: £1,000,000 (within aggregate)
- Social Engineering / Fraud: £500,000 (within aggregate — enhanced)
- Reputational Damage: £1,000,000 (within aggregate)
- Bricking / Hardware Replacement: £500,000 (within aggregate)
- Telephone Hacking: £150,000 (within aggregate)

---

## RETENTIONS

Standard Retention: £15,000 each and every loss
Ransomware: £15,000 (no uplift)
Social Engineering: £15,000
System Failure (non-malicious): £25,000
Business Interruption Waiting Period: 12 hours

---

## COVERAGE TERRITORY

Worldwide including USA and Canada (third-party claims only — first party USA/Canada excluded unless Insured has less than 20% US revenue, confirmed in application).

---

## KEY COVERAGES

- Incident response panel: Beazley Breach Response (BBR) in-house team
- Ransomware — negotiation, payment and cryptocurrency support
- Full business interruption coverage including dependent systems
- Hardware replacement (bricking) — industry-leading sublimit
- Enhanced social engineering: £500,000 (vs market standard £250,000)
- Data recreation and restoration
- Network security liability and privacy liability
- Tech E&O (technology errors and omissions) — INCLUDED at no additional cost
- Multimedia/IP liability
- GDPR regulatory defence and ICO investigations
- Crisis communications / PR (Kroll included on panel)

---

## KEY EXCLUSIONS

- Intentional acts by the Insured
- War (including cyber war) — full war exclusion, no partial buy-back offered
- Prior knowledge / known circumstances
- Trade sanctions (OFAC, HMT)
- Contractual liability assumed in excess of what would apply at law
- Bodily injury, property damage and product liability
- Patent infringement
- Pollution and environmental liability

---

## SPECIAL CONDITIONS

### Condition 1 — Security Warranty
The Insured warrants at inception and throughout the policy period that:
(a) MFA is in place on all email, VPN and privileged access;
(b) EDR/XDR solution is deployed on all endpoints;
(c) Offsite/immutable backups are tested at least quarterly.
Breach of warranty may void coverage for related claims.

### Condition 2 — Incident Response Panel
The Insured must use Beazley's approved incident response panel for all claims. Use of non-panel vendors without prior written approval may result in costs being unrecoverable.

### Condition 3 — War Exclusion
Note: Beazley applies a full Lloyd's Market Association (LMA) cyber war exclusion. No buy-back endorsement is available on this quotation.

---

## CLAIMS NOTIFICATION

Immediate notification required — defined as within 48 hours of discovery or as soon as reasonably practicable. Beazley Breach Response team available 24/7: breach@beazley.com / +44 20 7667 0623.

---

## INSURER DETAILS

Insurer: Beazley Insurance DAC (Ireland) / Lloyd's Syndicates 2623 & 623
Capacity: 100% Beazley
AM Best Rating: A (Excellent)
Governing Law: England and Wales
`;

// ─── QUOTE 3: Hiscox ──────────────────────────────────────────────────────────

const hiscox = `# Hiscox Insurance — CyberClear Policy Quotation

## SCHEDULE OF INSURANCE

Policy Number (Indicative): HIS-CC-2025-GB-039471
Policyholder: Hartwell Manufacturing Ltd
Broker: Acrisure UK Ltd
Quotation Valid Until: 30 April 2025
Policy Period: 1 May 2025 — 30 April 2026 (12 months)

---

## PREMIUM BREAKDOWN

Annual Net Premium: £14,900
Insurance Premium Tax @ 12%: £1,788
Total Annual Premium: £16,688

Payment Options:
- Annual: £16,688 (preferred)
- Monthly Direct Debit: £1,432/month (total £17,184 — £496 finance charge)
Payment Terms: Net 30 days from inception. Monthly DD requires direct debit mandate.

---

## POLICY LIMITS

Overall Annual Aggregate: £3,000,000

Section Limits (all within aggregate unless stated):
- Cyber Attack Response: £3,000,000
- Business Interruption: £2,000,000 (72-hour excess period)
- Ransomware / Extortion: £2,000,000
- Data Liability (third party): £3,000,000
- Regulatory Investigations & Fines: £500,000
- Social Engineering / CEO Fraud: £100,000
- Reputational Harm: £250,000
- System Failure (non-malicious outage): £500,000
- Contingent BI (cloud/outsourced IT): £500,000
- Hardware / Equipment Replacement: £250,000

---

## EXCESS / DEDUCTIBLE

Standard Excess: £5,000 each and every claim
Ransomware Excess: £5,000
Business Interruption: £5,000 + 72-hour waiting period
Social Engineering: £5,000
System Failure: £10,000
Note: Industry-leading low excess structure — designed for SME/mid-market.

---

## GEOGRAPHIC SCOPE

United Kingdom and European Union (primary)
Worldwide for third-party claims only
USA and Canada: EXCLUDED (both first and third party)

---

## WHAT IS COVERED

- 24/7 cyber helpline — immediate breach response support
- IT forensics to identify cause and contain incident
- Legal advice (DLA Piper on panel)
- Ransom negotiation and payment (cryptocurrency support via Chainalysis)
- Business income loss during recovery period
- Cost to restore, recreate or replace data
- Third-party claims for data breaches affecting customers/suppliers
- ICO regulatory investigations defence costs
- PR and crisis communications

---

## EXCLUSIONS

- USA and Canada (all first-party and third-party claims excluded)
- War, terrorism and state-sponsored attacks (full exclusion)
- Known or reported circumstances prior to inception
- Bodily injury, death or physical damage to tangible property
- Unencrypted data on lost/stolen portable devices (first £50,000)
- Infrastructure/utility failure outside Insured's control
- Reputational harm arising from product defects
- Fines other than GDPR/DPA regulatory fines (e.g. PCI fines excluded)

---

## CONDITIONS

### Condition A — Cyber Hygiene Warranty
As a condition of this policy the Insured confirms:
1. Multi-factor authentication is active on remote access systems;
2. Critical security patches are applied within 14 days of release;
3. Data backups are maintained and stored off-network.
This warranty is a condition precedent to liability.

### Condition B — Notification Period
Claims must be notified within 30 days of discovery (extended from market standard 72 hours — Hiscox competitive advantage for this account).

### Condition C — Sub-limit Note
Social Engineering sub-limit of £100,000 is below market average. Enhancement to £250,000 available for additional premium of £800 — please advise if required.

---

## CLAIMS & INCIDENT RESPONSE

Hiscox CyberClear 24/7 Hotline: 0800 085 0531
Email: cyberclaims@hiscox.com
30-day notification window (generous vs market standard).
Panel includes: DLA Piper (legal), Stroz Friedberg (forensics), Brunswick (PR).

---

## INSURER DETAILS

Insurer: Hiscox Insurance Company Ltd
Authorised by: Prudential Regulation Authority; regulated by FCA & PRA
Financial Strength: A (Excellent) — AM Best; A (Strong) — S&P
Governing Law: England and Wales
Jurisdiction: English Courts
`;

await makePDF("CFC-Underwriting-Cyber-Quote.pdf", cfc);
console.log("✓ CFC Underwriting quote generated");

await makePDF("Beazley-Cyber-Quote.pdf", beazley);
console.log("✓ Beazley quote generated");

await makePDF("Hiscox-CyberClear-Quote.pdf", hiscox);
console.log("✓ Hiscox quote generated");

console.log(`\nAll quotes saved to: dummy-quotes/`);
