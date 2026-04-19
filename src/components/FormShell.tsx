import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Check, HelpCircle, Loader2, X, Phone, Mail } from "lucide-react";
import { useNavigate } from "react-router-dom";
import TenantLogo from "@/components/TenantLogo";

const defaultStepRoutes = ["/form/company", "/form/financial", "/form/customers", "/form/review"];
const defaultSteps = ["Company", "Financial", "Customers", "Declaration"];

interface FormShellProps {
  children: React.ReactNode;
  currentStep: number;
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  backLabel?: string;
  showFooter?: boolean;
  onStepClick?: (step: number) => void;
  completedSteps?: number[];
  maxWidth?: string;
  saving?: boolean;
  steps?: string[];
  stepRoutes?: string[];
}

const FormShell: React.FC<FormShellProps> = ({
  children,
  currentStep,
  onBack,
  onNext,
  nextLabel = "Save and continue →",
  backLabel = "← Back",
  showFooter = true,
  onStepClick,
  completedSteps = [],
  maxWidth,
  saving = false,
  steps = defaultSteps,
  stepRoutes = defaultStepRoutes,
}) => {
  const navigate = useNavigate();
  const [helpOpen, setHelpOpen] = useState(false);

  const handleStepClick = (step: number) => {
    if (onStepClick) {
      onStepClick(step);
    } else {
      navigate(stepRoutes[step]);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-silver/30">
      {/* Sticky header */}
      <header className="sticky top-0 z-40 h-16 bg-card border-b border-silver flex items-center justify-between px-6">
        <TenantLogo src={sessionStorage.getItem("ff_tenant_logo")} className="h-8 w-auto" />
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            {saving ? (
              <>
                <Loader2 className="w-3 h-3 text-helper animate-spin" />
                <span className="text-helper text-helper">Saving…</span>
              </>
            ) : (
              <>
                <div className="w-2 h-2 rounded-full bg-sage" />
                <span className="text-helper text-helper">All changes saved</span>
              </>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={() => setHelpOpen(true)}>
            <HelpCircle className="h-4 w-4 mr-1" />
            Help
          </Button>
        </div>
      </header>

      {/* Progress bar */}
      <div className="sticky top-16 z-30 h-14 bg-card border-b border-silver flex items-center justify-center px-6">
        <div className="flex items-center gap-0 max-w-lg w-full">
          {steps.map((step, i) => {
            const isCompleted = completedSteps.includes(i);
            const isCurrent = i === currentStep;

            return (
              <React.Fragment key={step}>
                <button
                  onClick={() => handleStepClick(i)}
                  className="flex flex-col items-center gap-1 min-w-[80px] cursor-pointer group"
                >
                  <div
                    className={cn(
                      "w-7 h-7 rounded-full flex items-center justify-center font-medium transition-colors",
                      isCompleted
                        ? "bg-sage text-white"
                        : isCurrent
                        ? "bg-navy text-white"
                        : "bg-slate-200 text-slate-500 group-hover:bg-slate-300 group-hover:text-navy"
                    )}
                  >
                    {isCompleted ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      <span className="text-[11px]">{i + 1}</span>
                    )}
                  </div>
                  <span
                    className={cn(
                      "text-[11px] font-medium",
                      isCompleted ? "text-text-primary" : isCurrent ? "text-navy" : "text-slate-400 group-hover:text-navy"
                    )}
                  >
                    {step}
                  </span>
                </button>
                {i < steps.length - 1 && (
                  <div
                    className={cn(
                      "flex-1 h-0.5 mx-1 mt-[-12px]",
                      isCompleted ? "bg-sage" : "bg-slate-200"
                    )}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 w-full mx-auto px-6 py-8" style={{ maxWidth: maxWidth || '800px' }}>
        {children}
      </main>

      {/* Help dialog */}
      {helpOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setHelpOpen(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <button
              onClick={() => setHelpOpen(false)}
              className="absolute top-4 right-4 text-helper hover:text-text-primary"
            >
              <X className="h-5 w-5" />
            </button>
            <h3 className="mb-1">Need help?</h3>
            <p className="text-helper text-helper mb-5">
              If you're unsure about any part of the form, get in touch with your broker directly.
            </p>
            <div className="space-y-4">
              <div>
                <p className="text-body font-medium text-text-primary">James Whitfield</p>
                <p className="text-helper text-helper">Senior Credit Insurance Broker</p>
              </div>
              <a
                href="tel:+442071234567"
                className="flex items-center gap-3 text-body text-text-primary hover:text-navy"
              >
                <Phone className="h-4 w-4 text-accent-blue shrink-0" />
                +44 (0)207 123 4567
              </a>
              <a
                href="mailto:j.whitfield@acribroker.com"
                className="flex items-center gap-3 text-body text-text-primary hover:text-navy"
              >
                <Mail className="h-4 w-4 text-accent-blue shrink-0" />
                j.whitfield@acribroker.com
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      {showFooter && (
        <footer className="sticky bottom-0 z-30 h-16 bg-card border-t border-silver flex items-center justify-between px-6">
          <div>
            {onBack && (
              <Button variant="ghost" onClick={onBack}>
                {backLabel}
              </Button>
            )}
          </div>
          <div>
            {onNext && (
              <Button onClick={onNext}>
                {nextLabel}
              </Button>
            )}
          </div>
        </footer>
      )}
    </div>
  );
};

export default FormShell;