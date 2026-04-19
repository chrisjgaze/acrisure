import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import TenantLogo from "@/components/TenantLogo";

type State = "validating" | "expired" | "error";

const MagicLinkPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [state, setState] = useState<State>("validating");

  useEffect(() => {
    if (!token) { setState("error"); return; }

    const validate = async () => {
      try {
        const res = await fetch("/api/validate-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });

        const data = await res.json();

        if (!res.ok) {
          setState(res.status === 410 ? "expired" : "error");
          return;
        }

        // Store session context for form steps
        sessionStorage.setItem("ff_submission_id", data.submissionId);
        sessionStorage.setItem("ff_client_id", data.clientId);
        sessionStorage.setItem("ff_email", data.email);
        sessionStorage.setItem("ff_token", token);
        sessionStorage.setItem("ff_submissions", JSON.stringify(data.submissions ?? []));
        if (data.policyYear) sessionStorage.setItem("ff_policy_year", String(data.policyYear));
        if (data.tenantLogoUrl) sessionStorage.setItem("ff_tenant_logo", data.tenantLogoUrl);

        const submissions: { id: string; class_of_business: string; status: string }[] = data.submissions ?? [];

        // Multiple classes → class picker
        if (submissions.length > 1) {
          navigate("/form/classes", { replace: true });
          return;
        }

        // Single submission — route based on class and status
        const sub = submissions[0];
        const cls = sub?.class_of_business ?? "trade_credit";
        const status = sub?.status ?? "not_started";

        const CLASS_FORM_ROUTES: Record<string, string> = {
          cyber:     "/form/cyber",
          dno:       "/form/dno",
          terrorism: "/form/terrorism",
        };

        if (cls === "trade_credit") {
          navigate("/form/company", { replace: true });
        } else if (status === "not_started") {
          navigate("/form/company-contact", { replace: true });
        } else {
          navigate(CLASS_FORM_ROUTES[cls] ?? "/form/company-contact", { replace: true });
        }
      } catch {
        setState("error");
      }
    };

    validate();
  }, [token, navigate]);

  if (state === "validating") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-silver/50">
        <TenantLogo src={sessionStorage.getItem("ff_tenant_logo")} className="h-10 w-auto mb-8" />
        <p className="text-body text-navy mb-4">Checking your link…</p>
        <Loader2 className="h-6 w-6 text-accent-blue animate-spin" />
      </div>
    );
  }

  if (state === "expired") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-silver/50 px-4">
        <img src="/acrisure-logo-black.svg" alt="Acrisure" className="h-10 w-auto mb-8" />
        <div className="bg-white rounded-xl shadow-card w-full max-w-md p-8 text-center">
          <h2 className="mb-2">This link has expired</h2>
          <p className="text-body text-helper mb-6">
            Invitation links expire after 72 hours. Request a new one below and we'll email it to you straight away.
          </p>
          <Link
            to="/invite/request"
            className="inline-flex items-center justify-center h-10 px-6 rounded-md bg-navy text-primary-foreground text-body font-medium hover:bg-navy/90 transition-colors"
          >
            Get a new link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-silver/50 px-4">
      <img src="/acrisure-logo-black.svg" alt="Acrisure" className="h-10 w-auto mb-8" />
      <div className="bg-white rounded-xl shadow-card w-full max-w-md p-8 text-center">
        <h2 className="mb-2">Something went wrong</h2>
        <p className="text-body text-helper mb-6">This link is invalid or has already been used.</p>
        <Link
          to="/invite/request"
          className="inline-flex items-center justify-center h-10 px-6 rounded-md bg-navy text-primary-foreground text-body font-medium hover:bg-navy/90 transition-colors"
        >
          Get a new link
        </Link>
      </div>
    </div>
  );
};

export default MagicLinkPage;