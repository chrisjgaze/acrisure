import React from "react";
import { cn } from "@/lib/utils";

interface FormCardProps {
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  headerAction?: React.ReactNode;
}

const FormCard: React.FC<FormCardProps> = ({ title, description, children, className, headerAction }) => {
  return (
    <div className={cn("bg-card rounded-lg shadow-card p-6 mb-6", className)}>
      {(title || headerAction) && (
        <div className="flex items-center justify-between mb-1">
          {title && <h3 className="text-h3 text-navy">{title}</h3>}
          {headerAction && <div>{headerAction}</div>}
        </div>
      )}
      {description && <p className="text-helper text-helper mb-4">{description}</p>}
      {children}
    </div>
  );
};

export default FormCard;
