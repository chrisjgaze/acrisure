import React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string;
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  maxWidth = "max-w-[720px]",
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-foreground/40" onClick={onClose} />
      <div
        className={cn(
          "relative bg-card rounded-lg shadow-dropdown w-full mx-4 max-h-[90vh] flex flex-col",
          maxWidth
        )}
      >
        <div className="flex items-center justify-between p-8 pb-4">
          {title && <h2 className="text-h2 text-navy">{title}</h2>}
          <button
            onClick={onClose}
            className="text-helper hover:text-text-primary transition-colors ml-auto"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-8 pb-4">{children}</div>
        {footer && (
          <div className="flex items-center justify-between p-8 pt-4 border-t border-silver">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export default Modal;
