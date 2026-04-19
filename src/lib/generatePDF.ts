import { pdf } from "@react-pdf/renderer";
import React from "react";
import { supabase } from "@/lib/supabase";
import { ProposalPDF } from "@/components/ProposalPDF";
import type { ProposalPDFData } from "@/components/ProposalPDF";
import {
  CyberProposalPDF, DNOProposalPDF, TerrorismProposalPDF,
} from "@/components/ClassProposalPDF";
import type { CyberPDFData, DNOPDFData, TerrorismPDFData } from "@/components/ClassProposalPDF";

export async function fetchPDFData(submissionId: string): Promise<ProposalPDFData> {
  const [
    { data: sub },
    { data: company },
    { data: financial },
    { data: turnover },
    { data: lossHistory },
    { data: buyers },
    { data: debtorDist },
    { data: debtorBal },
    { data: overdue },
  ] = await Promise.all([
    supabase
      .from("submissions")
      .select("reference, policy_year, submitted_at, declaration_accepted_at")
      .eq("id", submissionId)
      .single(),
    supabase.from("submission_company").select("*").eq("submission_id", submissionId).maybeSingle(),
    supabase.from("submission_financial").select("*").eq("submission_id", submissionId).maybeSingle(),
    supabase.from("submission_turnover_by_country").select("*").eq("submission_id", submissionId).order("sort_order"),
    supabase.from("submission_loss_history").select("*").eq("submission_id", submissionId).order("sort_order"),
    supabase.from("submission_buyers").select("*").eq("submission_id", submissionId).order("sort_order"),
    supabase.from("submission_debtor_distribution").select("*").eq("submission_id", submissionId).order("debt_band"),
    supabase.from("submission_debtor_balances").select("*").eq("submission_id", submissionId).maybeSingle(),
    supabase.from("submission_overdue_accounts").select("*").eq("submission_id", submissionId),
  ]);

  const fmtDate = (d: string | null | undefined) =>
    d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "";
  const fmtDateTime = (d: string | null | undefined) =>
    d
      ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) +
        " at " +
        new Date(d).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
      : "";

  return {
    // Submission meta
    reference:              sub?.reference ?? "—",
    policyYear:             sub?.policy_year ?? new Date().getFullYear(),
    submittedAt:            fmtDateTime(sub?.submitted_at),
    declarationAcceptedAt:  fmtDateTime(sub?.declaration_accepted_at),

    // Company
    companyName:            company?.company_name ?? "",
    addressLine1:           company?.address_line1 ?? "",
    addressLine2:           company?.address_line2 ?? "",
    city:                   company?.city ?? "",
    postcode:               company?.postcode ?? "",
    country:                company?.country ?? "",
    companyRegNumber:       company?.company_reg_number ?? "",
    formationDate:          fmtDate(company?.formation_date),
    vatNumber:              company?.vat_number ?? "",
    website:                company?.website ?? "",
    natureOfBusiness:       company?.nature_of_business ?? "",
    capacity:               company?.capacity ?? "",
    tradeSectors:           company?.trade_sectors ?? [],
    debtCollectionProvider: company?.debt_collection_provider ?? "",
    currentBroker:          company?.current_broker ?? "",

    // Contact
    contactName:            company?.contact_name ?? "",
    contactPosition:        company?.contact_position ?? "",
    contactTelephone:       company?.contact_telephone ?? "",
    contactEmail:           company?.contact_email ?? "",

    // Financial
    currency:               financial?.currency ?? "",
    invoicingDeadline:      financial?.invoicing_deadline ?? "",
    creditStatusProvider:   financial?.credit_status_provider ?? "",
    creditStatusExpiry:     fmtDate(financial?.credit_status_expiry),
    currentlyInsured:       financial?.currently_insured ?? null,
    insurerName:            financial?.insurer_name ?? "",
    insurerRenewalDate:     fmtDate(financial?.insurer_renewal_date),
    hasInvoiceDiscounting:  financial?.has_invoice_discounting ?? null,
    factoringCompany:       financial?.factoring_company ?? "",
    factoringNoticePeriod:  financial?.factoring_notice_period ?? "",

    // Trading questions
    hasSeasonalPeaks:       financial?.has_seasonal_peaks ?? null,
    seasonalPeaksDetail:    financial?.seasonal_peaks_detail ?? "",
    hasConsignmentStock:    financial?.has_consignment_stock ?? null,
    consignmentStockDetail: financial?.consignment_stock_detail ?? "",
    hasLongTermContracts:   financial?.has_long_term_contracts ?? null,
    longTermContractsDetail: financial?.long_term_contracts_detail ?? "",
    hasContraPayments:      financial?.has_contra_payments ?? null,
    contraPaymentsDetail:   financial?.contra_payments_detail ?? "",
    hasPaidWhenPaid:        financial?.has_paid_when_paid ?? null,
    paidWhenPaidDetail:     financial?.paid_when_paid_detail ?? "",
    hasWipPreCredit:        financial?.has_wip_pre_credit ?? null,
    wipPreCreditDetail:     financial?.wip_pre_credit_detail ?? "",
    hasRetentionOfTitle:    financial?.has_retention_of_title ?? null,
    retentionOfTitleDetail: financial?.retention_of_title_detail ?? "",
    hasWorkOnSite:          financial?.has_work_on_site ?? null,
    workOnSiteDetail:       financial?.work_on_site_detail ?? "",

    // Tables
    turnoverRows:  turnover  ?? [],
    lossHistory:   lossHistory ?? [],
    buyers:        buyers    ?? [],
    debtorDist:    debtorDist ?? [],
    debtorBal:     debtorBal ?? null,
    overdueAccounts: overdue ?? [],
  };
}

export async function downloadPDF(submissionId: string, filename?: string) {
  const data = await fetchPDFData(submissionId);
  const blob = await pdf(React.createElement(ProposalPDF, { data })).toBlob();
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = filename ?? `${data.reference}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
  return data;
}

/** Generates the PDF and returns it as a base64 string (no download triggered). */
export async function generatePDFBase64(submissionId: string): Promise<{ base64: string; filename: string }> {
  const data = await fetchPDFData(submissionId);
  const blob = await pdf(React.createElement(ProposalPDF, { data })).toBlob();
  const arrayBuffer = await blob.arrayBuffer();
  const uint8 = new Uint8Array(arrayBuffer);
  let binary = "";
  for (let i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i]);
  const base64 = btoa(binary);
  const filename = `${data.reference}.pdf`;
  return { base64, filename };
}

// ─── Helper: shared company/contact fetch ────────────────────────────────────
async function fetchSharedData(submissionId: string) {
  const [{ data: sub }, { data: company }] = await Promise.all([
    supabase.from("submissions").select("reference, policy_year, submitted_at, declaration_accepted_at").eq("id", submissionId).single(),
    supabase.from("submission_company").select("*").eq("submission_id", submissionId).maybeSingle(),
  ]);
  const fmtDateTime = (d: string | null | undefined) =>
    d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) +
        " at " + new Date(d).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "";
  return {
    reference:            sub?.reference ?? "—",
    policyYear:           sub?.policy_year ?? new Date().getFullYear(),
    submittedAt:          fmtDateTime(sub?.submitted_at),
    declarationAcceptedAt: fmtDateTime(sub?.declaration_accepted_at),
    companyName:          company?.company_name ?? "",
    addressLine1:         company?.address_line1 ?? "",
    addressLine2:         company?.address_line2 ?? "",
    city:                 company?.city ?? "",
    postcode:             company?.postcode ?? "",
    country:              company?.country ?? "",
    companyRegNumber:     company?.company_reg_number ?? "",
    website:              company?.website ?? "",
    contactName:          company?.contact_name ?? "",
    contactPosition:      company?.contact_position ?? "",
    contactTelephone:     company?.contact_telephone ?? "",
    contactEmail:         company?.contact_email ?? "",
  };
}

// ─── Fetch + download per class ──────────────────────────────────────────────
async function fetchCyberPDFData(submissionId: string): Promise<CyberPDFData> {
  const [shared, { data: cyber }] = await Promise.all([
    fetchSharedData(submissionId),
    supabase.from("submission_cyber").select("*").eq("submission_id", submissionId).maybeSingle(),
  ]);
  return {
    ...shared,
    annualRevenue:             cyber?.annual_revenue_cyber ?? null,
    cyberEssentialsCertified: cyber?.cyber_essentials_certified ?? null,
    cyberEssentialsPlus:       cyber?.cyber_essentials_plus ?? null,
    mfaAllRemoteAccess:        cyber?.mfa_all_remote_access ?? null,
    patchingPolicy:            cyber?.patching_policy ?? null,
    offsiteBackups:            cyber?.offsite_backups ?? null,
    edrSoftware:               cyber?.edr_software ?? null,
    incidentResponsePlan:      cyber?.incident_response_plan ?? null,
    sufferedBreach:            cyber?.suffered_breach ?? null,
    breachDetails:             cyber?.breach_details ?? "",
    personalDataRecords:       cyber?.personal_data_records ?? "",
    processesPaymentCards:     cyber?.processes_payment_cards ?? null,
  };
}

async function fetchDNOPDFData(submissionId: string): Promise<DNOPDFData> {
  const [shared, { data: dno }] = await Promise.all([
    fetchSharedData(submissionId),
    supabase.from("submission_dno").select("*").eq("submission_id", submissionId).maybeSingle(),
  ]);
  return {
    ...shared,
    annualTurnover:              dno?.annual_turnover_dno ?? null,
    numberOfDirectors:           dno?.number_of_directors ?? null,
    companyListed:               dno?.company_listed ?? null,
    directorDisqualified:        dno?.director_disqualified ?? null,
    directorDisqualifiedDetails: dno?.director_disqualified_details ?? "",
    pendingClaims:               dno?.pending_claims ?? null,
    pendingClaimsDetails:        dno?.pending_claims_details ?? "",
    hasAuditCommittee:           dno?.has_audit_committee ?? null,
    recentAcquisitions:          dno?.recent_acquisitions ?? null,
    recentAcquisitionsDetails:   dno?.recent_acquisitions_details ?? "",
    netAssets:                   dno?.net_assets ?? null,
  };
}

async function fetchTerrorismPDFData(submissionId: string): Promise<TerrorismPDFData> {
  const [shared, { data: terror }] = await Promise.all([
    fetchSharedData(submissionId),
    supabase.from("submission_terrorism").select("*").eq("submission_id", submissionId).maybeSingle(),
  ]);
  return {
    ...shared,
    propertyAddress:        terror?.property_address ?? "",
    constructionType:       terror?.construction_type ?? "",
    yearOfConstruction:     terror?.year_of_construction ?? null,
    sumInsured:             terror?.sum_insured ?? null,
    nearLandmark:           terror?.near_landmark ?? null,
    occupancyType:          terror?.occupancy_type ?? "",
    existingTerrorismCover: terror?.existing_terrorism_cover ?? null,
    existingCoverDetails:   terror?.existing_cover_details ?? "",
  };
}

/** Download a class-specific proposal PDF. Handles cyber, dno, terrorism. Falls back to TC for trade_credit. */
export async function downloadClassPDF(submissionId: string, classKey: string, filename?: string) {
  if (classKey === "trade_credit") {
    return downloadPDF(submissionId, filename);
  }
  let blob: Blob;
  let ref = filename ?? submissionId;
  if (classKey === "cyber") {
    const data = await fetchCyberPDFData(submissionId);
    ref = filename ?? `${data.reference}.pdf`;
    blob = await pdf(React.createElement(CyberProposalPDF, { data })).toBlob();
  } else if (classKey === "dno") {
    const data = await fetchDNOPDFData(submissionId);
    ref = filename ?? `${data.reference}.pdf`;
    blob = await pdf(React.createElement(DNOProposalPDF, { data })).toBlob();
  } else if (classKey === "terrorism") {
    const data = await fetchTerrorismPDFData(submissionId);
    ref = filename ?? `${data.reference}.pdf`;
    blob = await pdf(React.createElement(TerrorismProposalPDF, { data })).toBlob();
  } else {
    throw new Error(`Unknown class: ${classKey}`);
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = ref;
  a.click();
  URL.revokeObjectURL(url);
}

/** Generate a class PDF as base64 (for email attachment). */
export async function generateClassPDFBase64(submissionId: string, classKey: string): Promise<{ base64: string; filename: string }> {
  if (classKey === "trade_credit") {
    return generatePDFBase64(submissionId);
  }
  let blob: Blob;
  let filename: string;
  if (classKey === "cyber") {
    const data = await fetchCyberPDFData(submissionId);
    blob = await pdf(React.createElement(CyberProposalPDF, { data })).toBlob();
    filename = `${data.reference}.pdf`;
  } else if (classKey === "dno") {
    const data = await fetchDNOPDFData(submissionId);
    blob = await pdf(React.createElement(DNOProposalPDF, { data })).toBlob();
    filename = `${data.reference}.pdf`;
  } else if (classKey === "terrorism") {
    const data = await fetchTerrorismPDFData(submissionId);
    blob = await pdf(React.createElement(TerrorismProposalPDF, { data })).toBlob();
    filename = `${data.reference}.pdf`;
  } else {
    throw new Error(`Unknown class: ${classKey}`);
  }
  const arrayBuffer = await blob.arrayBuffer();
  const uint8 = new Uint8Array(arrayBuffer);
  let binary = "";
  for (let i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i]);
  return { base64: btoa(binary), filename };
}
