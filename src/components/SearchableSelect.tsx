import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { ChevronDown, Search, X } from "lucide-react";

interface Option {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  label?: string;
  options: Option[];
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  error?: string;
  required?: boolean;
  className?: string;
  displayValue?: (option: Option) => string;
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({
  label,
  options,
  value,
  onChange,
  placeholder = "Select...",
  error,
  required,
  className,
  displayValue,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

  const selected = options.find((o) => o.value === value);
  const filtered = options.filter((o) =>
    o.label.toLowerCase().includes(search.toLowerCase())
  );

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const dropdownHeight = 280;
    const openAbove = spaceBelow < dropdownHeight && rect.top > dropdownHeight;

    setDropdownStyle({
      position: "fixed",
      left: rect.left,
      width: rect.width,
      zIndex: 9999,
      ...(openAbove
        ? { bottom: window.innerHeight - rect.top + 4 }
        : { top: rect.bottom + 4 }),
    });
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        wrapperRef.current && !wrapperRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (isOpen) {
      updatePosition();
      window.addEventListener("scroll", updatePosition, true);
      window.addEventListener("resize", updatePosition);
      return () => {
        window.removeEventListener("scroll", updatePosition, true);
        window.removeEventListener("resize", updatePosition);
      };
    }
  }, [isOpen, updatePosition]);

  return (
    <div className={cn("mb-4 relative", className)} ref={wrapperRef}>
      {label && (
        <label className="block text-label text-text-primary mb-1">
          {label}{required && " *"}
        </label>
      )}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full h-10 px-3 text-left text-body bg-card border rounded-md flex items-center justify-between transition-all overflow-hidden",
          "focus:outline-none focus:ring-2 focus:ring-accent-blue",
          error ? "border-error-red" : "border-silver"
        )}
      >
        <span className={cn("truncate min-w-0", selected ? "text-text-primary" : "text-helper")}>
          {selected ? (displayValue ? displayValue(selected) : selected.label) : placeholder}
        </span>
        <ChevronDown className="h-4 w-4 text-helper" />
      </button>
      {isOpen && createPortal(
        <div ref={dropdownRef} style={dropdownStyle} className="bg-card border border-silver rounded-md shadow-dropdown max-h-[280px] overflow-hidden">
          <div className="p-2 border-b border-silver">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-helper" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
               className="w-full h-8 pl-8 pr-8 text-body border border-silver rounded-md focus:outline-none focus:ring-2 focus:ring-accent-blue"
                ref={(el) => { if (el) requestAnimationFrame(() => el.focus({ preventScroll: true })); }}
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2">
                  <X className="h-3 w-3 text-helper" />
                </button>
              )}
            </div>
          </div>
          <div className="overflow-y-auto max-h-[220px]">
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-helper text-helper">No results found</div>
            ) : (
              filtered.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange?.(option.value);
                    setIsOpen(false);
                    setSearch("");
                  }}
                  className={cn(
                    "w-full px-3 py-2 text-left text-body hover:bg-ice-blue/50 transition-colors",
                    value === option.value && "bg-ice-blue text-navy font-medium"
                  )}
                >
                  {option.label}
                </button>
              ))
            )}
          </div>
        </div>,
        document.body
      )}
      {error && <p className="text-helper text-error-red mt-1">{error}</p>}
    </div>
  );
};

export default SearchableSelect;
