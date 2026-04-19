import React from "react";
import { cn } from "@/lib/utils";

interface ProgressBarProps {
  value: number;
  className?: string;
  height?: string;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ value, className, height = "h-1.5" }) => {
  return (
    <div className={cn("w-full bg-silver rounded-full overflow-hidden", height, className)}>
      <div
        className={cn("bg-accent-blue rounded-full transition-all duration-300", height)}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
};

export default ProgressBar;
