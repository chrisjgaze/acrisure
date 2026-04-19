import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import FormCard from "@/components/FormCard";
import FormInput from "@/components/FormInput";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

const CLASS_META: Record<string, { label: string; description: string; time: string }> = {
  trade_credit: {
    label: "Trade Credit Insurance",
    description: "Protect against non-payment by customers",
    time: "15–20 min",
  },
  cyber: {
    label: "Cyber Insurance",
    description: "Cover for cyber attacks and data breaches",
    time: "2–3 min",
  },
  dno: {
    label: "Directors & Officers",
    description: "Personal liability for directors and officers",
    time: "3–4 min",
  },
  terrorism: {
    label: "Terrorism Insurance",
    description: "Property cover for terrorism events",
    time: "1–2 min",
  },
};

const NewClientPage: React.FC = () => {
  const navigate = useNavigate();
  const { session, licensedClasses } = useAuth();

  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [selectedClass, setSelectedClass] = useState<string>(licensedClasses[0] ?? "trade_credit");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const accessToken = session?.access_token;
      if (!accessToken) throw new Error("Not authenticated — please log in again");

      const res = await fetch("/api/clients", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          display_name: companyName,
          contact_name: contactName,
          contact_email: contactEmail,
          class_of_business: selectedClass,
        }),
      });

      const data = await res.json() as { error?: string; magicUrl?: string };

      if (!res.ok) throw new Error(data.error ?? "Request failed");

      toast.success(`Invitation sent to ${contactEmail}`);

      // If email delivery is restricted (dev), show the link as fallback
      if (data.magicUrl) {
        console.info("[NewClientPage] Magic link:", data.magicUrl);
      }

      navigate("/dashboard");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-silver/30">
      <div className="max-w-[560px] mx-auto px-6 py-8">
        <button
          onClick={() => navigate("/dashboard")}
          className="text-navy text-helper hover:underline mb-6 inline-block"
        >
          ← Dashboard
        </button>

        <h1 className="mb-6">Add new client</h1>

        <FormCard>
          <form onSubmit={handleSubmit}>
            <FormInput label="Company name" value={companyName} onChange={setCompanyName} required />
            <FormInput label="Contact name" value={contactName} onChange={setContactName} required />
            <FormInput
              label="Contact email"
              type="email"
              value={contactEmail}
              onChange={setContactEmail}
              helperText="This is where the invitation link will be sent"
              required
            />

            {/* Class of business selector */}
            <div className="mb-5">
              <label className="block text-label text-text-primary mb-2">
                Product <span className="text-error-red">*</span>
              </label>
              <div className="space-y-2">
                {licensedClasses.map((key) => {
                  const meta = CLASS_META[key];
                  if (!meta) return null;
                  const isSelected = selectedClass === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSelectedClass(key)}
                      className={`w-full text-left px-4 py-3 rounded-lg border transition-all ${
                        isSelected
                          ? "border-navy bg-navy/5"
                          : "border-silver bg-white hover:border-navy/40"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className={`text-body font-medium ${isSelected ? "text-navy" : "text-text-primary"}`}>
                            {meta.label}
                          </p>
                          <p className="text-helper text-slate-400">{meta.description}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-[11px] text-slate-400">{meta.time}</span>
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                            isSelected ? "border-navy" : "border-slate-300"
                          }`}>
                            {isSelected && <div className="w-2 h-2 rounded-full bg-navy" />}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <p className="text-helper text-helper mt-4 mb-4">
              An email invitation with a secure link will be sent to the contact. The link is valid for 72 hours.
            </p>

            <div className="flex items-center justify-between">
              <Button variant="ghost" type="button" onClick={() => navigate("/dashboard")}>
                Cancel
              </Button>
              <Button type="submit" loading={loading}>
                Send invitation →
              </Button>
            </div>
          </form>
        </FormCard>
      </div>
    </div>
  );
};

export default NewClientPage;
