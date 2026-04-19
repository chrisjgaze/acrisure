import React, { useState, useEffect, useRef, useCallback } from "react";
import FormShell from "@/components/FormShell";
import FormCard from "@/components/FormCard";
import FormInput from "@/components/FormInput";
import DateInput from "@/components/DateInput";
import SearchableSelect from "@/components/SearchableSelect";
import { countryOptions } from "@/data/staticData";
import { Loader2, Search, Check, AlertTriangle, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { useStepCompletion } from "@/lib/formProgress";

const CLASS_META: Record<string, { steps: string[]; stepRoutes: string[]; nextRoute: string }> = {
  cyber: {
    steps: ["Company", "Cyber Details", "Declaration"],
    stepRoutes: ["/form/company-contact", "/form/cyber", "/form/class-review/cyber"],
    nextRoute: "/form/cyber",
  },
  dno: {
    steps: ["Company", "D&O Details", "Declaration"],
    stepRoutes: ["/form/company-contact", "/form/dno", "/form/class-review/dno"],
    nextRoute: "/form/dno",
  },
  terrorism: {
    steps: ["Company", "Property Details", "Declaration"],
    stepRoutes: ["/form/company-contact", "/form/terrorism", "/form/class-review/terrorism"],
    nextRoute: "/form/terrorism",
  },
};

type CHResult = {
  company_name: string; company_number: string; company_status: string;
  date_of_creation: string | null; address_line_1: string; address_line_2: string;
  locality: string; postal_code: string; country: string;
};

const CompanyContactPage: React.FC = () => {
  const navigate = useNavigate();
  const submissionId = sessionStorage.getItem("ff_submission_id");
  const clientId     = sessionStorage.getItem("ff_client_id");

  useEffect(() => {
    if (!submissionId) navigate("/", { replace: true });
  }, [submissionId, navigate]);

  const [pageLoading, setPageLoading]     = useState(true);
  const [saving, setSaving]               = useState(false);
  const [classKey, setClassKey]           = useState("");
  // editableCompany = true only on first-time form (no prior company data)
  const [editableCompany, setEditableCompany] = useState(false);
  // refreshing = direct CH lookup in progress
  const [refreshing, setRefreshing] = useState(false);
  // editingWebsite = website input is unlocked in read-only mode
  const [editingWebsite, setEditingWebsite] = useState(false);

  const saveTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRef   = useRef<HTMLDivElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isRenewal = parseInt(sessionStorage.getItem("ff_policy_year") ?? "0") > new Date().getFullYear();
  const { completedSteps, refresh: refreshSteps } = useStepCompletion(submissionId, isRenewal);

  // Company fields
  const [companyName, setCompanyName]   = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity]                 = useState("");
  const [postcode, setPostcode]         = useState("");
  const [country, setCountry]           = useState("GB");
  const [regNumber, setRegNumber]       = useState("");
  const [website, setWebsite]           = useState("");
  const [verifiedFromCH, setVerifiedFromCH]   = useState(false);
  const [dissolvedWarning, setDissolvedWarning] = useState(false);

  // Contact fields (always editable)
  const [fullName, setFullName]     = useState("");
  const [position, setPosition]     = useState("");
  const [telephone, setTelephone]   = useState("");
  const [email, setEmail]           = useState("");

  // Policy date
  const [policyStartDate, setPolicyStartDate] = useState({ day: "", month: "", year: "" });

  // Companies House search
  const [searchQuery, setSearchQuery]     = useState("");
  const [searching, setSearching]         = useState(false);
  const [showResults, setShowResults]     = useState(false);
  const [searchResults, setSearchResults] = useState<CHResult[]>([]);

  useEffect(() => {
    if (!submissionId) return;
    const load = async () => {
      const [{ data: sub }, { data: companyData }] = await Promise.all([
        supabase.from("submissions").select("class_of_business, renewal_date, client_id").eq("id", submissionId).single(),
        supabase.from("submission_company").select("*").eq("submission_id", submissionId).maybeSingle(),
      ]);

      if (sub?.class_of_business) setClassKey(sub.class_of_business);

      if (sub?.renewal_date) {
        const [y, m, d] = sub.renewal_date.split("-");
        setPolicyStartDate({ year: y, month: m, day: d });
      }

      const hasCompanyData = !!companyData?.company_name;

      if (hasCompanyData && companyData) {
        setCompanyName(companyData.company_name ?? "");
        setAddressLine1(companyData.address_line1 ?? "");
        setAddressLine2(companyData.address_line2 ?? "");
        setCity(companyData.city ?? "");
        setPostcode(companyData.postcode ?? "");
        setCountry(companyData.country ?? "GB");
        setRegNumber(companyData.company_reg_number ?? "");
        setWebsite(companyData.website ?? "");
        setFullName(companyData.contact_name ?? "");
        setPosition(companyData.contact_position ?? "");
        setTelephone(companyData.contact_telephone ?? "");
        setEmail(companyData.contact_email ?? "");
        setEditableCompany(false);
      } else {
        // No company data for this submission — try to pre-fill from a sibling
        // submission for the same client (e.g. when a new class has just been added)
        let filledFromSibling = false;
        if (clientId) {
          const { data: siblingSubs } = await supabase
            .from("submissions")
            .select("id")
            .eq("client_id", clientId)
            .neq("id", submissionId);

          for (const s of siblingSubs ?? []) {
            const { data: sibling } = await supabase
              .from("submission_company")
              .select("*")
              .eq("submission_id", s.id)
              .not("company_name", "is", null)
              .maybeSingle();

            if (sibling?.company_name) {
              setCompanyName(sibling.company_name ?? "");
              setAddressLine1(sibling.address_line1 ?? "");
              setAddressLine2(sibling.address_line2 ?? "");
              setCity(sibling.city ?? "");
              setPostcode(sibling.postcode ?? "");
              setCountry(sibling.country ?? "GB");
              setRegNumber(sibling.company_reg_number ?? "");
              setWebsite(sibling.website ?? "");
              setFullName(sibling.contact_name ?? "");
              setPosition(sibling.contact_position ?? "");
              setTelephone(sibling.contact_telephone ?? "");
              setEmail(sibling.contact_email ?? "");
              setEditableCompany(false);
              filledFromSibling = true;
              break;
            }
          }
        }
        if (!filledFromSibling) setEditableCompany(true);
      }

      setPageLoading(false);
    };
    load();
  }, [submissionId, clientId]);

  const save = useCallback(async () => {
    if (!submissionId) return;
    setSaving(true);

    const policyStartDateIso =
      policyStartDate.year && policyStartDate.month && policyStartDate.day
        ? `${policyStartDate.year}-${policyStartDate.month.padStart(2, "0")}-${policyStartDate.day.padStart(2, "0")}`
        : null;

    // Always save all company fields — CH refresh or website edit may have changed them
    const payload: Record<string, unknown> = {
      submission_id:      submissionId,
      contact_name:       fullName,
      contact_position:   position,
      contact_telephone:  telephone,
      contact_email:      email,
      company_name:       companyName,
      address_line1:      addressLine1,
      address_line2:      addressLine2,
      city,
      postcode,
      country,
      company_reg_number: regNumber,
      website,
    };

    const res = await fetch("/api/save-company", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, client_id: clientId }),
    });
    const saveError = res.ok ? null : await res.json().catch(() => ({ error: "Failed" }));

    if (saveError) {
      toast.error("Failed to save");
    } else {
      await Promise.all([
        supabase.from("submissions").update({ renewal_date: policyStartDateIso, last_activity: new Date().toISOString() }).eq("id", submissionId),
        supabase.from("submissions").update({ completion_pct: 25 }).eq("id", submissionId).lt("completion_pct", 25),
        supabase.from("submissions").update({ status: "in_progress" }).eq("id", submissionId).eq("status", "not_started"),
      ]);
      refreshSteps();
    }
    setSaving(false);
  }, [
    submissionId, fullName, position, telephone, email, policyStartDate,
    companyName, addressLine1, addressLine2, city, postcode,
    country, regNumber, website, refreshSteps,
  ]);

  useEffect(() => {
    if (pageLoading) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(save, 1000);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [save, pageLoading]);

  // Companies House debounced search — first-time form only
  const chSearchActive = editableCompany;
  useEffect(() => {
    if (!chSearchActive) return;
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (searchQuery.trim().length < 2) { setSearchResults([]); setShowResults(false); return; }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/companies-house?q=${encodeURIComponent(searchQuery.trim())}`);
        const data = await res.json() as { items?: CHResult[]; error?: string };
        if (res.ok) { setSearchResults(data.items ?? []); setShowResults(true); }
        else toast.error(`Company search failed: ${data.error ?? "unknown error"}`);
      } finally { setSearching(false); }
    }, 400);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [searchQuery, chSearchActive]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowResults(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const applyResult = (r: CHResult) => {
    setCompanyName(r.company_name);
    setAddressLine1(r.address_line_1);
    setAddressLine2(r.address_line_2);
    setCity(r.locality);
    setPostcode(r.postal_code);
    const countryMap: Record<string, string> = { England: "GB", Scotland: "GB", Wales: "GB", "Northern Ireland": "GB", "United Kingdom": "GB" };
    setCountry(countryMap[r.country] ?? (r.country || "GB"));
    setRegNumber(r.company_number);
    setVerifiedFromCH(true);
    setDissolvedWarning(r.company_status !== "active");
    setShowResults(false);
    setSearchQuery("");
  };

  const handleRefreshFromCH = async () => {
    if (!regNumber) return;
    setRefreshing(true);
    try {
      const res = await fetch(`/api/companies-house?number=${encodeURIComponent(regNumber)}`);
      const data = await res.json() as CHResult & { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Could not fetch from Companies House");
        return;
      }
      applyResult(data);
      toast.success("Company details updated from Companies House");
    } catch {
      toast.error("Could not reach Companies House — please try again");
    } finally {
      setRefreshing(false);
    }
  };

  if (pageLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 text-accent-blue animate-spin" /></div>;
  }

  const meta = CLASS_META[classKey] ?? CLASS_META.cyber;
  const addressParts = [addressLine1, addressLine2, city, postcode].filter(Boolean);

  return (
    <FormShell currentStep={0} completedSteps={completedSteps} saving={saving} steps={meta.steps} stepRoutes={meta.stepRoutes} onNext={() => navigate(meta.nextRoute)}>
      <h1 className="mb-1">Company details</h1>
      <p className="text-helper text-helper mb-6">
        {editableCompany ? "Tell us about your business" : "Confirm your details before continuing"}
      </p>

      {/* First-time: standalone CH search card */}
      {editableCompany && (
        <FormCard title="Find your company" description="We'll fill in your details automatically using Companies House data">
          <div className="relative" ref={searchRef}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-helper" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => searchResults.length > 0 && setShowResults(true)}
                placeholder="Search by company name or number"
                className="w-full h-10 pl-10 pr-10 text-body border border-silver rounded-md focus:outline-none focus:ring-2 focus:ring-accent-blue"
              />
              {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-helper animate-spin" />}
            </div>
            {showResults && searchResults.length > 0 && (
              <ul className="absolute z-50 w-full mt-1 bg-white border border-silver rounded-md shadow-lg max-h-72 overflow-y-auto">
                {searchResults.map((r) => (
                  <li key={r.company_number}>
                    <button type="button" onClick={() => applyResult(r)}
                      className="w-full text-left px-4 py-3 hover:bg-slate-50 border-b border-silver last:border-0">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-body font-medium text-text-primary leading-snug">{r.company_name}</span>
                        <span className={`text-helper shrink-0 mt-0.5 ${r.company_status === "active" ? "text-accent-foreground" : "text-warning-amber-text"}`}>{r.company_status}</span>
                      </div>
                      <div className="text-helper text-helper-text mt-0.5">{r.company_number}{r.postal_code ? ` · ${r.postal_code}` : ""}</div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {dissolvedWarning && (
            <div className="mt-4 p-3 bg-warning-amber-bg border-l-4 border-warning-amber-text rounded-md flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-warning-amber-text mt-0.5 shrink-0" />
              <p className="text-helper text-warning-amber-text">This company appears to be dissolved. Please verify before continuing.</p>
            </div>
          )}
        </FormCard>
      )}

      {/* Company section */}
      <FormCard
        title="Your company"
        headerAction={
          !editableCompany ? (
            <button
              type="button"
              onClick={handleRefreshFromCH}
              disabled={refreshing || !regNumber}
              className="flex items-center gap-1 text-[12px] font-medium text-navy hover:text-navy/70 transition-colors disabled:opacity-50"
            >
              {refreshing
                ? <Loader2 className="h-3 w-3 animate-spin" />
                : <RefreshCw className="h-3 w-3" />
              }
              {refreshing ? "Refreshing…" : "Refresh from Companies House"}
            </button>
          ) : undefined
        }
      >
        {editableCompany ? (
          <>
            <FormInput label="Legal company name" value={companyName} onChange={setCompanyName} required />
            <p className="text-label text-text-primary mb-1">Registered address *</p>
            <FormInput placeholder="Address line 1" value={addressLine1} onChange={setAddressLine1} />
            <FormInput placeholder="Address line 2" value={addressLine2} onChange={setAddressLine2} />
            <div className="grid grid-cols-1 md:grid-cols-[3fr_2fr] gap-x-4">
              <FormInput placeholder="City" value={city} onChange={setCity} />
              <FormInput placeholder="Postcode" value={postcode} onChange={setPostcode} />
            </div>
            <SearchableSelect options={countryOptions} value={country} onChange={setCountry} placeholder="Select country" />
            <FormInput label="Website" value={website} onChange={setWebsite} placeholder="www.example.com" />
            <div className="relative">
              <FormInput label="Company registration number" value={regNumber} readOnly />
              {verifiedFromCH && (
                <div className="flex items-center gap-1 mt-[-12px] mb-4">
                  <Check className="h-3.5 w-3.5 text-accent-foreground" />
                  <span className="text-helper text-accent-foreground">Verified via Companies House</span>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            {/* Dissolved warning (shown after a refresh if company is not active) */}
            {dissolvedWarning && (
              <div className="mb-4 p-3 bg-warning-amber-bg border-l-4 border-warning-amber-text rounded-md flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-warning-amber-text mt-0.5 shrink-0" />
                <p className="text-helper text-warning-amber-text">This company appears to be dissolved. Please verify before continuing.</p>
              </div>
            )}

            {/* Read-only field list */}
            <div className="space-y-1">
              <div className="grid grid-cols-[160px_1fr] gap-2 py-2 border-b border-silver/40">
                <span className="text-helper text-slate-500">Company name</span>
                <span className="text-body text-text-primary font-medium">{companyName || "—"}</span>
              </div>
              <div className="grid grid-cols-[160px_1fr] gap-2 py-2 border-b border-silver/40">
                <span className="text-helper text-slate-500">Registered address</span>
                <span className="text-body text-text-primary">{addressParts.join(", ") || "—"}</span>
              </div>
              {regNumber && (
                <div className="grid grid-cols-[160px_1fr] gap-2 py-2 border-b border-silver/40">
                  <span className="text-helper text-slate-500">Reg. number</span>
                  <span className="text-body text-text-primary">{regNumber}</span>
                </div>
              )}
              {/* Website — editable inline */}
              <div className="grid grid-cols-[160px_1fr] gap-2 py-2 items-center">
                <span className="text-helper text-slate-500">Website</span>
                {editingWebsite ? (
                  <FormInput
                    value={website}
                    onChange={setWebsite}
                    placeholder="www.example.com"
                    onBlur={() => setEditingWebsite(false)}
                    autoFocus
                  />
                ) : (
                  <div className="flex items-center gap-3">
                    <span className="text-body text-text-primary">{website || "—"}</span>
                    <button
                      type="button"
                      onClick={() => setEditingWebsite(true)}
                      className="text-[11px] font-medium text-navy hover:text-navy/70 transition-colors shrink-0"
                    >
                      Edit
                    </button>
                  </div>
                )}
              </div>
            </div>

            {verifiedFromCH && (
              <div className="flex items-center gap-1.5 mt-3">
                <Check className="h-3.5 w-3.5 text-accent-foreground" />
                <span className="text-helper text-accent-foreground text-[12px]">Updated from Companies House</span>
              </div>
            )}
          </>
        )}
      </FormCard>

      {/* Contact details — always editable */}
      <FormCard title="Your contact details">
        {!editableCompany && (
          <p className="text-helper text-slate-500 mb-4 text-sm">
            These can be different from your previous contact — please fill in the details of the person completing this form.
          </p>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
          <FormInput label="Full name" value={fullName} onChange={setFullName} required />
          <FormInput label="Position" value={position} onChange={setPosition} required />
        </div>
        <FormInput label="Telephone" value={telephone} onChange={setTelephone} required />
        <FormInput label="Email" type="email" value={email} onChange={setEmail} required />
      </FormCard>

      {/* Policy date */}
      <FormCard title="Policy details">
        <DateInput
          label="Policy start / renewal date"
          value={policyStartDate}
          onChange={setPolicyStartDate}
          helperText="When would you like cover to start?"
        />
      </FormCard>
    </FormShell>
  );
};

export default CompanyContactPage;
