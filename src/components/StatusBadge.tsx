import React from "react";
import { cn } from "@/lib/utils";

type StatusType = "not_started" | "in_progress" | "submitted" | "referred" | "lapsed";

interface StatusBadgeProps {
  status: StatusType;
  className?: string;
}

const statusConfig: Record<StatusType, { label: string; bg: string; text: string }> = {
  not_started: { label: "Not started", bg: "bg-silver", text: "text-helper" },
  in_progress: { label: "In progress", bg: "bg-ice-blue", text: "text-navy" },
  submitted: { label: "Submitted", bg: "bg-sage", text: "text-accent-foreground" },
  referred: { label: "Referred", bg: "bg-warning-amber-bg", text: "text-warning-amber-text" },
  lapsed: { label: "Lapsed", bg: "bg-[hsl(0,92%,95%)]", text: "text-[#991B1B]" },
};

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className }) => {
  const config = statusConfig[status];
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-sm text-helper font-medium",
        config.bg,
        config.text,
        className
      )}
    >
      {config.label}
    </span>
  );
};

export default StatusBadge;
export type { StatusType };
