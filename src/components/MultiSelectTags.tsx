import React, { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { X, Plus, ChevronDown } from "lucide-react";

interface Option {
  value: string;
  label: string;
}

interface MultiSelectTagsProps {
  label?: string;
  options: Option[];
  value: string[];
  onChange: (value: string[]) => void;
  required?: boolean;
  className?: string;
}

const MultiSelectTags: React.FC<MultiSelectTagsProps> = ({
  label,
  options,
  value,
  onChange,
  required,
  className,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selectedOptions = options.filter((o) => value.includes(o.value));
  const availableOptions = options.filter((o) => !value.includes(o.value));

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className={cn("mb-4", className)} ref={ref}>
      {label && (
        <label className="block text-label text-text-primary mb-1">
          {label}{required && " *"}
        </label>
      )}
      <div className="flex flex-wrap items-center gap-2 min-h-[40px]">
        {selectedOptions.map((opt) => (
          <span
            key={opt.value}
            className="inline-flex items-center gap-1 px-2 py-1 bg-ice-blue text-navy text-helper font-medium rounded-sm"
          >
            {opt.label}
            <button
              type="button"
              onClick={() => onChange(value.filter((v) => v !== opt.value))}
              className="hover:text-error-red transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="inline-flex items-center gap-1 px-2 py-1 text-navy text-helper font-medium hover:bg-ice-blue/50 rounded-sm transition-colors"
          >
            <Plus className="h-3 w-3" /> Add
          </button>
          {isOpen && availableOptions.length > 0 && (
            <div className="absolute z-50 top-full left-0 mt-1 w-48 bg-card border border-silver rounded-md shadow-dropdown max-h-48 overflow-y-auto">
              {availableOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange([...value, opt.value]);
                  }}
                  className="w-full px-3 py-2 text-left text-body hover:bg-ice-blue/50 transition-colors"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MultiSelectTags;
