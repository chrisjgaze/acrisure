import React from "react";
import { cn } from "@/lib/utils";

interface Option {
  value: string;
  label: string;
}

interface ButtonGroupProps {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  disabled?: boolean;
}

const ButtonGroup: React.FC<ButtonGroupProps> = ({ value, onChange, options, disabled }) => {
  return (
    <div className="inline-flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(opt.value)}
          className={cn(
            "px-4 h-10 rounded-md border text-body font-medium transition-colors duration-150",
            value === opt.value
              ? "bg-navy text-primary-foreground border-navy"
              : "bg-card text-navy border-silver hover:bg-ice-blue/30 hover:border-navy/30"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
};

export default ButtonGroup;
