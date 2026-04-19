import React, { useState, useEffect, useRef, useCallback } from "react";
import FormShell from "@/components/FormShell";
import FormCard from "@/components/FormCard";
import FormInput from "@/components/FormInput";
import DateInput from "@/components/DateInput";
import SearchableSelect from "@/components/SearchableSelect";
import MultiSelectTags from "@/components/MultiSelectTags";
import SlideReveal from "@/components/SlideReveal";
import { Button } from "@/components/ui/button";
import {
  countryOptions,
  capacityOptions,
  tradeSectorOptions,
} from "@/data/staticData";
import { Search, Loader2, Check, AlertTriangle, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { useStepCompletion } from "@/lib/formProgress";


const CompanyDetailsPage: React.FC = () => {
  const navigate = useNavigate();
  const submissionId = sessionStorage.getItem("ff_submission_id");
  const clientId     = sessionStorage.getItem("ff_client_id");

  // Redirect if no session context
  useEffect(() => {
    if (!submissionId) navigate("/", { replace: true });
  }, [submissionId, navigate]);

  const [pageLoading, setPageLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isRenewal = parseInt(sessionStorage.getItem("ff_policy_year") ?? "0") > new Date().getFullYear();
  const { completedSteps, refresh: refreshSteps } = useStepCompletion(submissionId, isRenewal);

  // Company fields
  const [companyName, setCompanyName] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [postcode, setPostcode] = useState("");
  const [country, setCountry] = useState("GB");
  const [hasTradingAddress, setHasTradingAddress] = useState(false);
  const [tradingLine1, setTradingLine1] = useState("");
  const [tradingLine2, setTradingLine2] = useState("");
  const [tradingCity, setTradingCity] = useState("");
  const [tradingPostcode, setTradingPostcode] = useState("");
  const [website, setWebsite] = useState("");
  const [regNumber, setRegNumber] = useState("");
  const [vatNumber, setVatNumber] = useState("");
  const [formationDate, setFormationDate] = useState({ day: "", month: "", year: "" });
  const [verifiedFromCH, setVerifiedFromCH] = useState(false);
  const [editableCompany, setEditableCompany] = useState(true); // true until data loaded
  const [editingWebsite, setEditingWebsite] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [editableBusinessDetails, setEditableBusinessDetails] = useState(false);

  // Policy details
  const [policyStartDate, setPolicyStartDate] = useState({ day: "", month: "", year: "" });

  // Contact fields
  const [fullName, setFullName] = useState("");
  const [position, setPosition] = useState("");
  const [telephone, setTelephone] = useState("");
  const [email, setEmail] = useState("");

  // Business fields
  const [natureOfBusiness, setNatureOfBusiness] = useState("");
  const [capacity, setCapacity] = useState("");
  const [tradeSectors, setTradeSectors] = useState<string[]>([]);
  const [debtCollection, setDebtCollection] = useState("");
  const [currentBroker, setCurrentBroker] = useState("");

  // Companies House search
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [dissolvedWarning, setDissolvedWarning] = useState(false);
  const [searchResults, setSearchResults] = useState<
    {
      company_name: string;
      company_number: string;
      company_status: string;
      date_of_creation: string | null;
      address_line_1: string;
      address_line_2: string;
      locality: string;
      postal_code: string;
      country: string;
      description: string;
    }[]
  >([]);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load existing data on mount
  useEffect(() => {
    if (!submissionId) return;

    const load = async () => {
      const [{ data, error }, { data: subData }] = await Promise.all([
        supabase.from("submission_company").select("*").eq("submission_id", submissionId).maybeSingle(),
        supabase.from("submissions").select("renewal_date").eq("id", submissionId).single(),
      ]);

      if (error) {
        toast.error("Failed to load saved data");
      } else if (data) {
        setCompanyName(data.company_name ?? "");
        setAddressLine1(data.address_line1 ?? "");
        setAddressLine2(data.address_line2 ?? "");
        setCity(data.city ?? "");
        setPostcode(data.postcode ?? "");
        setCountry(data.country ?? "GB");
        setHasTradingAddress(data.trading_address_different ?? false);
        setTradingLine1(data.trading_address_line1 ?? "");
        setTradingLine2(data.trading_address_line2 ?? "");
        setTradingCity(data.trading_city ?? "");
        setTradingPostcode(data.trading_postcode ?? "");
        setWebsite(data.website ?? "");
        setRegNumber(data.company_reg_number ?? "");
        setVatNumber(data.vat_number ?? "");
        setFullName(data.contact_name ?? "");
        setPosition(data.contact_position ?? "");
        setTelephone(data.contact_telephone ?? "");
        setEmail(data.contact_email ?? "");
        setNatureOfBusiness(data.nature_of_business ?? "");
        setCapacity(data.capacity ?? "");
        setTradeSectors(data.trade_sectors ?? []);
        setDebtCollection(data.debt_collection_provider ?? "");
        setCurrentBroker(data.current_broker ?? "");

        if (data.formation_date) {
          const [y, m, d] = data.formation_date.split("-");
          setFormationDate({ year: y, month: m, day: d });
        }

        // If company data already exists, switch to read-only mode
        if (data.company_name) {
          setEditableCompany(false);
        }
      } else {
        // No company row — try to pre-fill from a sibling submission (e.g. new class added)
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
              break;
            }
          }
        }
      }

      if (subData?.renewal_date) {
        const [y, m, d] = subData.renewal_date.split("-");
        setPolicyStartDate({ year: y, month: m, day: d });
      }

      setPageLoading(false);
    };

    load();
  }, [submissionId]);

  // Auto-save — debounced 1s after last change
  const save = useCallback(async () => {
    if (!submissionId) return;
    setSaving(true);

    const formationDateIso =
      formationDate.year && formationDate.month && formationDate.day
        ? `${formationDate.year}-${formationDate.month.padStart(2, "0")}-${formationDate.day.padStart(2, "0")}`
        : null;

    const payload = {
      submission_id: submissionId,
      company_name: companyName,
      address_line1: addressLine1,
      address_line2: addressLine2,
      city,
      postcode,
      country,
      trading_address_different: hasTradingAddress,
      trading_address_line1: tradingLine1,
      trading_address_line2: tradingLine2,
      trading_city: tradingCity,
      trading_postcode: tradingPostcode,
      website,
      company_reg_number: regNumber,
      vat_number: vatNumber,
      formation_date: formationDateIso,
      contact_name: fullName,
      contact_position: position,
      contact_telephone: telephone,
      contact_email: email,
      nature_of_business: natureOfBusiness,
      capacity,
      trade_sectors: tradeSectors,
      debt_collection_provider: debtCollection,
      current_broker: currentBroker,
    };

    const policyStartDateIso =
      policyStartDate.year && policyStartDate.month && policyStartDate.day
        ? `${policyStartDate.year}-${policyStartDate.month.padStart(2, "0")}-${policyStartDate.day.padStart(2, "0")}`
        : null;

    const res = await fetch("/api/save-company", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, client_id: clientId }),
    });
    const saveError = res.ok ? null : await res.json().catch(() => ({ error: "Failed" }));

    if (saveError) toast.error("Failed to save");
    else {
      await Promise.all([
        supabase.from("submissions").update({ renewal_date: policyStartDateIso, last_activity: new Date().toISOString() }).eq("id", submissionId),
        supabase.from("submissions").update({ completion_pct: 25 }).eq("id", submissionId).lt("completion_pct", 25),
        supabase.from("submissions").update({ status: "in_progress" }).eq("id", submissionId).eq("status", "not_started"),
      ]);
      refreshSteps();
    }
    setSaving(false);
  }, [
    submissionId, companyName, addressLine1, addressLine2, city, postcode,
    country, hasTradingAddress, tradingLine1, tradingLine2, tradingCity,
    tradingPostcode, website, regNumber, vatNumber, formationDate, fullName,
    position, telephone, email, natureOfBusiness, capacity, tradeSectors,
    debtCollection, currentBroker, policyStartDate,
  ]);

  // Trigger debounced save whenever any field changes
  useEffect(() => {
    if (pageLoading) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(save, 1000);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [save, pageLoading]);

  // Debounced Companies House search
  useEffect(() => {
    if (!editableCompany) return;
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/companies-house?q=${encodeURIComponent(searchQuery.trim())}`);
        const data = await res.json() as { items?: typeof searchResults; error?: string; detail?: string };
        if (res.ok) {
          setSearchResults(data.items ?? []);
          setShowResults(true);
        } else {
          console.error("[companies-house search]", data.error, data.detail);
          toast.error(`Company search failed: ${data.error ?? "unknown error"}`);
        }
      } catch (err) {
        console.error("[companies-house search] fetch error:", err);
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [searchQuery]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const applyCompanyHouseResult = (result: (typeof searchResults)[0]) => {
    setCompanyName(result.company_name);
    setAddressLine1(result.address_line_1);
    setAddressLine2(result.address_line_2);
    setCity(result.locality);
    setPostcode(result.postal_code);
    // Map country string to ISO code where possible
    const countryMap: Record<string, string> = {
      "England": "GB",
      "Scotland": "GB",
      "Wales": "GB",
      "Northern Ireland": "GB",
      "United Kingdom": "GB",
    };
    setCountry(countryMap[result.country] ?? (result.country || "GB"));
    setRegNumber(result.company_number);
    if (result.date_of_creation) {
      const [y, m, d] = result.date_of_creation.split("-");
      setFormationDate({ year: y, month: m, day: d });
    }
    setVerifiedFromCH(true);
    setDissolvedWarning(result.company_status !== "active");
    setShowResults(false);
    setSearchQuery("");
  };

  const handleRefreshFromCH = async () => {
    if (!regNumber) return;
    setRefreshing(true);
    try {
      const res = await fetch(`/api/companies-house?number=${encodeURIComponent(regNumber)}`);
      const data = await res.json() as { company_name?: string; company_number?: string; company_status?: string; date_of_creation?: string | null; address_line_1?: string; address_line_2?: string; locality?: string; postal_code?: string; country?: string; error?: string };
      if (!res.ok) { toast.error(data.error ?? "Could not fetch from Companies House"); return; }
      const countryMap: Record<string, string> = { England: "GB", Scotland: "GB", Wales: "GB", "Northern Ireland": "GB", "United Kingdom": "GB" };
      setCompanyName(data.company_name ?? companyName);
      setAddressLine1(data.address_line_1 ?? "");
      setAddressLine2(data.address_line_2 ?? "");
      setCity(data.locality ?? "");
      setPostcode(data.postal_code ?? "");
      setCountry(countryMap[data.country ?? ""] ?? (data.country || "GB"));
      setRegNumber(data.company_number ?? regNumber);
      setVerifiedFromCH(true);
      setDissolvedWarning(data.company_status !== "active");
      toast.success("Company details updated from Companies House");
    } catch { toast.error("Could not reach Companies House — please try again"); }
    finally { setRefreshing(false); }
  };

  if (pageLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 text-accent-blue animate-spin" />
      </div>
    );
  }

  const addressDisplay = [addressLine1, addressLine2, city, postcode].filter(Boolean).join(", ");

  return (
    <FormShell
      currentStep={0}
      completedSteps={completedSteps}
      saving={saving}
      onNext={() => navigate("/form/financial")}
    >
      <h1 className="mb-1">Company details</h1>
      <p className="text-helper text-helper mb-6">
        {editableCompany ? "Tell us about your business" : "Confirm your details before continuing"}
      </p>

      {editableCompany ? (
        <>
          {/* Card 1 — Find your company */}
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
                {searching && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-helper animate-spin" />
                )}
              </div>
              {showResults && searchResults.length > 0 && (
                <ul className="absolute z-50 w-full mt-1 bg-white border border-silver rounded-md shadow-lg max-h-72 overflow-y-auto">
                  {searchResults.map((r) => (
                    <li key={r.company_number}>
                      <button
                        type="button"
                        onClick={() => applyCompanyHouseResult(r)}
                        className="w-full text-left px-4 py-3 hover:bg-slate-50 border-b border-silver last:border-0"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-body font-medium text-text-primary leading-snug">{r.company_name}</span>
                          <span className={`text-helper shrink-0 mt-0.5 ${r.company_status === "active" ? "text-accent-foreground" : "text-warning-amber-text"}`}>
                            {r.company_status}
                          </span>
                        </div>
                        <div className="text-helper text-helper-text mt-0.5">
                          {r.company_number}{r.postal_code ? ` · ${r.postal_code}` : ""}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {dissolvedWarning && (
              <div className="mt-4 p-3 bg-warning-amber-bg border-l-4 border-warning-amber-text rounded-md flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-warning-amber-text mt-0.5 shrink-0" />
                <p className="text-helper text-warning-amber-text">
                  This company appears to be dissolved. Please verify before continuing.
                </p>
              </div>
            )}
          </FormCard>

          {/* Card 2 — Your company (editable) */}
          <FormCard title="Your company">
            <FormInput label="Legal company name" value={companyName} onChange={setCompanyName} required />
            <p className="text-label text-text-primary mb-1">Registered address *</p>
            <FormInput placeholder="Address line 1" value={addressLine1} onChange={setAddressLine1} />
            <FormInput placeholder="Address line 2" value={addressLine2} onChange={setAddressLine2} />
            <div className="grid grid-cols-1 md:grid-cols-[3fr_2fr] gap-x-4">
              <FormInput placeholder="City" value={city} onChange={setCity} />
              <FormInput placeholder="Postcode" value={postcode} onChange={setPostcode} />
            </div>
            <SearchableSelect options={countryOptions} value={country} onChange={setCountry} placeholder="Select country" />

            <label className="flex items-center gap-2 mb-4 cursor-pointer">
              <input
                type="checkbox"
                checked={hasTradingAddress}
                onChange={(e) => setHasTradingAddress(e.target.checked)}
                className="w-4 h-4 rounded border-silver text-navy focus:ring-accent-blue"
              />
              <span className="text-body text-text-primary">My trading address is different from my registered address</span>
            </label>

            <SlideReveal isOpen={hasTradingAddress}>
              <p className="text-label text-text-primary mb-1">Trading address</p>
              <FormInput placeholder="Address line 1" value={tradingLine1} onChange={setTradingLine1} />
              <FormInput placeholder="Address line 2" value={tradingLine2} onChange={setTradingLine2} />
              <div className="grid grid-cols-1 md:grid-cols-[3fr_2fr] gap-x-4">
                <FormInput placeholder="City" value={tradingCity} onChange={setTradingCity} />
                <FormInput placeholder="Postcode" value={tradingPostcode} onChange={setTradingPostcode} />
              </div>
            </SlideReveal>

            <FormInput label="Website" value={website} onChange={setWebsite} placeholder="www.example.com" />

            <div className="relative">
              <FormInput label="Company registration number" value={regNumber} onChange={setRegNumber} />
              {verifiedFromCH && (
                <div className="flex items-center gap-1 mt-[-12px] mb-4">
                  <Check className="h-3.5 w-3.5 text-accent-foreground" />
                  <span className="text-helper text-accent-foreground">Verified via Companies House</span>
                </div>
              )}
            </div>

            <div className="flex items-end gap-3">
              <div className="flex-1">
                <FormInput label="VAT number" value={vatNumber} onChange={setVatNumber} prefix="GB" />
              </div>
              <Button variant="secondary" className="mb-4 shrink-0">Validate</Button>
            </div>

            <DateInput label="Company formation date" value={formationDate} onChange={setFormationDate} />
          </FormCard>

          {/* Card 3 — Contact details */}
          <FormCard title="Your contact details">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
              <FormInput label="Full name" value={fullName} onChange={setFullName} required />
              <FormInput label="Position" value={position} onChange={setPosition} required />
            </div>
            <FormInput label="Telephone" value={telephone} onChange={setTelephone} required />
            <FormInput label="Email" type="email" value={email} onChange={setEmail} required />
          </FormCard>

          {/* Card 4 — About your business */}
          <FormCard title="About your business">
            <FormInput label="Nature of business" value={natureOfBusiness} onChange={setNatureOfBusiness} required />
            <SearchableSelect label="In what capacity do you act?" options={capacityOptions} value={capacity} onChange={setCapacity} required />
            <MultiSelectTags label="Which trade sectors do you sell in?" options={tradeSectorOptions} value={tradeSectors} onChange={setTradeSectors} />
            <FormInput label="Third party debt collection / legal action provider" value={debtCollection} onChange={setDebtCollection} />
            <FormInput label="Current insurance broker" value={currentBroker} onChange={setCurrentBroker} />
          </FormCard>

          {/* Card 5 — Policy details */}
          <FormCard title="Policy details">
            <DateInput
              label="Policy start / renewal date"
              value={policyStartDate}
              onChange={setPolicyStartDate}
              helperText="When would you like cover to start? If renewing an existing policy, enter your current renewal date."
            />
          </FormCard>
        </>
      ) : (
        <>
          {/* Read-only: Your company */}
          <FormCard
            title="Your company"
            headerAction={
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
            }
          >
            {dissolvedWarning && (
              <div className="mb-4 p-3 bg-warning-amber-bg border-l-4 border-warning-amber-text rounded-md flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-warning-amber-text mt-0.5 shrink-0" />
                <p className="text-helper text-warning-amber-text">This company appears to be dissolved. Please verify before continuing.</p>
              </div>
            )}
            <div className="space-y-1">
              <div className="grid grid-cols-[180px_1fr] gap-2 py-2 border-b border-silver/40">
                <span className="text-helper text-slate-500">Company name</span>
                <span className="text-body text-text-primary">{companyName || "—"}</span>
              </div>
              <div className="grid grid-cols-[180px_1fr] gap-2 py-2 border-b border-silver/40">
                <span className="text-helper text-slate-500">Registered address</span>
                <span className="text-body text-text-primary">{addressDisplay || "—"}</span>
              </div>
              <div className="grid grid-cols-[180px_1fr] gap-2 py-2 border-b border-silver/40">
                <span className="text-helper text-slate-500">Reg. number</span>
                <span className="text-body text-text-primary">{regNumber || "—"}</span>
              </div>
              <div className="grid grid-cols-[180px_1fr] gap-2 py-2 items-center">
                <span className="text-helper text-slate-500">Website</span>
                {editingWebsite ? (
                  <FormInput value={website} onChange={setWebsite} placeholder="www.example.com" onBlur={() => setEditingWebsite(false)} autoFocus />
                ) : (
                  <div className="flex items-center gap-3">
                    <span className="text-body text-text-primary">{website || "—"}</span>
                    <button type="button" onClick={() => setEditingWebsite(true)} className="text-[11px] font-medium text-navy hover:text-navy/70 transition-colors shrink-0">Edit</button>
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
          </FormCard>

          {/* Contact details — always editable */}
          <FormCard title="Your contact details">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
              <FormInput label="Full name" value={fullName} onChange={setFullName} required />
              <FormInput label="Position" value={position} onChange={setPosition} required />
            </div>
            <FormInput label="Telephone" value={telephone} onChange={setTelephone} required />
            <FormInput label="Email" type="email" value={email} onChange={setEmail} required />
          </FormCard>

          {/* About your business — read-only with edit toggle */}
          <FormCard
            title="About your business"
            headerAction={
              !editableBusinessDetails ? (
                <button
                  type="button"
                  onClick={() => setEditableBusinessDetails(true)}
                  className="text-[12px] font-medium text-navy hover:text-navy/70 transition-colors"
                >
                  Edit
                </button>
              ) : undefined
            }
          >
            {editableBusinessDetails ? (
              <>
                <FormInput label="Nature of business" value={natureOfBusiness} onChange={setNatureOfBusiness} required />
                <SearchableSelect label="In what capacity do you act?" options={capacityOptions} value={capacity} onChange={setCapacity} required />
                <MultiSelectTags label="Which trade sectors do you sell in?" options={tradeSectorOptions} value={tradeSectors} onChange={setTradeSectors} />
                <FormInput label="Third party debt collection / legal action provider" value={debtCollection} onChange={setDebtCollection} />
                <FormInput label="Current insurance broker" value={currentBroker} onChange={setCurrentBroker} />
              </>
            ) : (
              <div className="space-y-1">
                <div className="grid grid-cols-[180px_1fr] gap-2 py-2 border-b border-silver/40">
                  <span className="text-helper text-slate-500">Nature of business</span>
                  <span className="text-body text-text-primary">{natureOfBusiness || "—"}</span>
                </div>
                <div className="grid grid-cols-[180px_1fr] gap-2 py-2 border-b border-silver/40">
                  <span className="text-helper text-slate-500">Capacity</span>
                  <span className="text-body text-text-primary">{capacity || "—"}</span>
                </div>
                <div className="grid grid-cols-[180px_1fr] gap-2 py-2 border-b border-silver/40">
                  <span className="text-helper text-slate-500">Trade sectors</span>
                  <span className="text-body text-text-primary">{tradeSectors.join(", ") || "—"}</span>
                </div>
                <div className="grid grid-cols-[180px_1fr] gap-2 py-2 border-b border-silver/40">
                  <span className="text-helper text-slate-500">Debt collection provider</span>
                  <span className="text-body text-text-primary">{debtCollection || "—"}</span>
                </div>
                <div className="grid grid-cols-[180px_1fr] gap-2 py-2 border-b border-silver/40">
                  <span className="text-helper text-slate-500">Current broker</span>
                  <span className="text-body text-text-primary">{currentBroker || "—"}</span>
                </div>
              </div>
            )}
          </FormCard>

          {/* Policy details — always editable */}
          <FormCard title="Policy details">
            <DateInput
              label="Policy start / renewal date"
              value={policyStartDate}
              onChange={setPolicyStartDate}
              helperText="When would you like cover to start? If renewing an existing policy, enter your current renewal date."
            />
          </FormCard>
        </>
      )}
    </FormShell>
  );
};

export default CompanyDetailsPage;