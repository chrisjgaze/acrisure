import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { Eye, EyeOff } from "lucide-react";
import { filterNumericValue } from "@/lib/numericInput";

interface FormInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  label?: string;
  error?: string;
  helperText?: string;
  helpText?: string; // alias for helperText
  onChange?: (value: string) => void;
  showPasswordToggle?: boolean;
  prefix?: string;
  suffix?: React.ReactNode;
  rightAlign?: boolean;
  numeric?: boolean;
  multiline?: boolean;
}

const FormInput: React.FC<FormInputProps> = ({
  label,
  error,
  helperText,
  helpText,
  onChange,
  showPasswordToggle,
  prefix,
  suffix,
  rightAlign,
  numeric,
  multiline,
  className,
  type,
  required,
  ...props
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const inputType = showPasswordToggle ? (showPassword ? "text" : "password") : type;
  const hint = helperText ?? helpText;

  return (
    <div className={cn("mb-4", className)}>
      {label && (
        <label className="block text-label text-text-primary mb-1">
          {label}
          {required && " *"}
        </label>
      )}
      <div className="relative">
        {prefix && !multiline && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-helper text-body">
            {prefix}
          </span>
        )}
        {multiline ? (
          <textarea
            onChange={(e) => onChange?.(e.target.value)}
            className={cn(
              "w-full min-h-[80px] px-3 py-2 text-body text-text-primary bg-card border rounded-md transition-all duration-150 resize-y",
              "focus:outline-none focus:ring-2 focus:ring-accent-blue focus:border-transparent",
              "placeholder:text-helper",
              error ? "border-error-red" : "border-silver",
            )}
            value={props.value as string}
            placeholder={props.placeholder}
            readOnly={props.readOnly}
          />
        ) : (
          <input
            type={inputType}
            onChange={(e) => {
              const val = numeric ? filterNumericValue(e.target.value) : e.target.value;
              onChange?.(val);
            }}
            inputMode={numeric ? "decimal" : undefined}
            className={cn(
              "w-full h-10 px-3 text-body text-text-primary bg-card border rounded-md transition-all duration-150",
              "focus:outline-none focus:ring-2 focus:ring-accent-blue focus:border-transparent",
              "placeholder:text-helper",
              error ? "border-error-red" : "border-silver",
              prefix && "pl-10",
              (suffix || showPasswordToggle) && "pr-10",
              rightAlign && "text-right"
            )}
            {...props}
          />
        )}
        {showPasswordToggle && !multiline && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-helper hover:text-text-primary transition-colors"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
        {suffix && !showPasswordToggle && !multiline && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2">{suffix}</span>
        )}
      </div>
      {error && <p className="text-helper text-error-red mt-1">{error}</p>}
      {hint && !error && <p className="text-helper text-helper mt-1">{hint}</p>}
    </div>
  );
};

export default FormInput;
