import React, { useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface DateInputProps {
  label?: string;
  value?: { day: string; month: string; year: string };
  onChange?: (value: { day: string; month: string; year: string }) => void;
  error?: string;
  required?: boolean;
  readOnly?: boolean;
  className?: string;
}

const DateInput: React.FC<DateInputProps> = ({
  label,
  value = { day: "", month: "", year: "" },
  onChange,
  error,
  required,
  readOnly,
  className,
}) => {
  const monthRef = useRef<HTMLInputElement>(null);
  const yearRef = useRef<HTMLInputElement>(null);

  const handleChange = (field: "day" | "month" | "year", val: string) => {
    const numVal = val.replace(/\D/g, "");
    const maxLen = field === "year" ? 4 : 2;
    const trimmed = numVal.slice(0, maxLen);

    onChange?.({ ...value, [field]: trimmed });

    if (field === "day" && trimmed.length === 2) monthRef.current?.focus();
    if (field === "month" && trimmed.length === 2) yearRef.current?.focus();
  };

  return (
    <div className={cn("mb-4", className)}>
      {label && (
        <label className="block text-label text-text-primary mb-1">
          {label}{required && " *"}
        </label>
      )}
      <div className="flex items-center gap-2">
        <input
          type="text"
          placeholder="DD"
          value={value.day}
          onChange={(e) => handleChange("day", e.target.value)}
          readOnly={readOnly}
          className={cn(
            "w-14 h-10 text-center text-body border rounded-md transition-all",
            "focus:outline-none focus:ring-2 focus:ring-accent-blue",
            error ? "border-error-red" : "border-silver",
            readOnly && "bg-silver/30"
          )}
        />
        <span className="text-helper">/</span>
        <input
          ref={monthRef}
          type="text"
          placeholder="MM"
          value={value.month}
          onChange={(e) => handleChange("month", e.target.value)}
          readOnly={readOnly}
          className={cn(
            "w-14 h-10 text-center text-body border rounded-md transition-all",
            "focus:outline-none focus:ring-2 focus:ring-accent-blue",
            error ? "border-error-red" : "border-silver",
            readOnly && "bg-silver/30"
          )}
        />
        <span className="text-helper">/</span>
        <input
          ref={yearRef}
          type="text"
          placeholder="YYYY"
          value={value.year}
          onChange={(e) => handleChange("year", e.target.value)}
          readOnly={readOnly}
          className={cn(
            "w-20 h-10 text-center text-body border rounded-md transition-all",
            "focus:outline-none focus:ring-2 focus:ring-accent-blue",
            error ? "border-error-red" : "border-silver",
            readOnly && "bg-silver/30"
          )}
        />
      </div>
      {error && <p className="text-helper text-error-red mt-1">{error}</p>}
    </div>
  );
};

export default DateInput;
