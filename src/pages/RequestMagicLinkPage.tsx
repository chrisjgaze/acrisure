import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Mail, CheckCircle } from "lucide-react";

const RequestMagicLinkPage: React.FC = () => {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    try {
      await fetch("/api/request-magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
    } catch {
      // swallow — always show the neutral success message
    } finally {
      setSubmitting(false);
      setDone(true);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-silver/50 px-4">
      <img src="/acrisure-logo-black.svg" alt="Acrisure" className="h-10 w-auto mb-8" />

      <div className="bg-white rounded-xl shadow-card w-full max-w-md p-8">
        {done ? (
          <div className="text-center">
            <CheckCircle className="h-10 w-10 text-accent-foreground mx-auto mb-4" />
            <h2 className="mb-2">Check your inbox</h2>
            <p className="text-body text-helper">
              If we have that email address on file, a new link is on its way. Check your inbox — and your spam folder.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-full bg-ice-blue flex items-center justify-center shrink-0">
                <Mail className="h-5 w-5 text-accent-blue" />
              </div>
              <div>
                <h2 className="leading-tight">Get a new link</h2>
                <p className="text-helper text-helper">We'll email you a fresh access link</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-label text-text-primary block mb-1">
                  Email address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  required
                  autoFocus
                  className="w-full h-10 px-3 text-body border border-silver rounded-md focus:outline-none focus:ring-2 focus:ring-accent-blue"
                />
              </div>
              <Button type="submit" className="w-full" disabled={submitting || !email.trim()}>
                {submitting ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" />Sending…</>
                ) : (
                  "Send link"
                )}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default RequestMagicLinkPage;
