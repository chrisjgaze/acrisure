import React from "react";
import { cn } from "@/lib/utils";

interface ToggleGroupProps {
  value: boolean | null;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}

const ToggleGroup: React.FC<ToggleGroupProps> = ({ value, onChange, disabled }) => {
  return (
    <div className="inline-flex rounded-md overflow-hidden border border-silver">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(true)}
        className={cn(
          "w-[72px] h-10 text-body font-medium transition-colors duration-150",
          value === true
            ? "bg-navy text-primary-foreground"
            : "bg-card text-navy hover:bg-ice-blue/30"
        )}
      >
        Yes
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(false)}
        className={cn(
          "w-[72px] h-10 text-body font-medium transition-colors duration-150 border-l border-silver",
          value === false
            ? "bg-navy text-primary-foreground"
            : "bg-card text-navy hover:bg-ice-blue/30"
        )}
      >
        No
      </button>
    </div>
  );
};

export default ToggleGroup;
