import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { Loader2, Download } from "lucide-react";
import TenantLogo from "@/components/TenantLogo";
import { downloadPDF } from "@/lib/generatePDF";
import { toast } from "sonner";

interface SubmissionSummary {
  reference: string;
  submittedAt: string;
  contactName: string;
  contactPosition: string;
}

const PostSubmissionPage: React.FC = () => {
  const location = useLocation();
  const submissionId = location.state?.submissionId ?? null;
  const email = location.state?.email ?? "";

  const [data, setData] = useState<SubmissionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  // Prevent the browser back button from leaving this confirmation page.
  // Push a duplicate history entry so the first "back" press just stays here.
  useEffect(() => {
    window.history.pushState(null, "", "/form/submitted");
    const handlePop = () => window.history.pushState(null, "", "/form/submitted");
    window.addEventListener("popstate", handlePop);
    return () => window.removeEventListener("popstate", handlePop);
  }, []);

  useEffect(() => {
    if (!submissionId) {
      setLoading(false);
      return;
    }

    const load = async () => {
      const [{ data: sub }, { data: company }] = await Promise.all([
        supabase
          .from("submissions")
          .select("reference, submitted_at")
          .eq("id", submissionId)
          .single(),
        supabase
          .from("submission_company")
          .select("contact_name, contact_position")
          .eq("submission_id", submissionId)
          .maybeSingle(),
      ]);

      if (sub) {
        setData({
          reference: sub.reference,
          submittedAt: sub.submitted_at
            ? new Date(sub.submitted_at).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "long",
                year: "numeric",
              }) +
              " at " +
              new Date(sub.submitted_at).toLocaleTimeString("en-GB", {
                hour: "2-digit",
                minute: "2-digit",
              })
            : "",
          contactName: company?.contact_name ?? "",
          contactPosition: company?.contact_position ?? "",
        });
      }

      setLoading(false);
    };

    load();
  }, [submissionId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 text-accent-blue animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-silver/30 px-4">
      <div className="max-w-md w-full text-center">
        <TenantLogo src={sessionStorage.getItem("ff_tenant_logo")} className="h-10 w-auto mx-auto mb-8" />

        <svg className="w-20 h-20 mx-auto mb-6" viewBox="0 0 100 100" fill="none">
          <circle
            cx="50" cy="50" r="45"
            stroke="hsl(80, 34%, 75%)"
            strokeWidth="4"
          />
          <path
            d="M30 52 L44 66 L70 38"
            stroke="hsl(80, 34%, 55%)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>

        <h1 className="mb-4">Proposal submitted</h1>

        <div className="inline-block px-4 py-2 bg-navy rounded-md mb-6">
          <span className="text-primary-foreground font-mono text-[24px] font-medium tracking-wide">
            {data?.reference ?? "—"}
          </span>
        </div>

        <div className="text-helper text-helper space-y-1 mb-6">
          {data?.submittedAt && <p>Submitted: {data.submittedAt}</p>}
          {data?.contactName && (
            <p>
              By: {data.contactName}
              {data.contactPosition ? `, ${data.contactPosition}` : ""}
            </p>
          )}
        </div>

        <hr className="border-silver mb-6" />

        <h3 className="mb-3">What happens next</h3>
        <p className="text-body text-text-primary mb-4">
          Your broker will be in touch shortly to discuss the next steps for your credit insurance proposal.
        </p>
        {email && (
          <p className="text-helper text-helper mb-6">
            A confirmation has been sent to {email}
          </p>
        )}

        <Button
          variant="secondary"
          className="gap-2"
          disabled={!submissionId || downloading}
          onClick={async () => {
            if (!submissionId) return;
            setDownloading(true);
            try {
              await downloadPDF(submissionId);
            } catch (err) {
              console.error("PDF generation failed:", err);
              toast.error("Failed to generate PDF");
            } finally {
              setDownloading(false);
            }
          }}
        >
          {downloading ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Generating…</>
          ) : (
            <><Download className="h-4 w-4" /> Download your proposal (PDF)</>
          )}
        </Button>
      </div>
    </div>
  );
};

export default PostSubmissionPage;