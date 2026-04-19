import React from "react";
import { cn } from "@/lib/utils";

interface SlideRevealProps {
  isOpen: boolean;
  children: React.ReactNode;
  className?: string;
}

const SlideReveal: React.FC<SlideRevealProps> = ({ isOpen, children, className }) => {
  return (
    <div
      className={cn(
        "overflow-hidden transition-all duration-200 ease-in-out",
        className
      )}
      style={{
        maxHeight: isOpen ? "1000px" : "0",
        opacity: isOpen ? 1 : 0,
      }}
    >
      <div className="pt-4">{children}</div>
    </div>
  );
};

export default SlideReveal;
