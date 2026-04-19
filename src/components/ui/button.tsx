import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue focus-visible:ring-offset-2 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-navy text-primary-foreground hover:brightness-90 disabled:bg-silver disabled:text-silver disabled:cursor-not-allowed disabled:hover:brightness-100",
        secondary: "border border-navy text-navy bg-transparent hover:bg-ice-blue disabled:border-silver disabled:text-silver disabled:cursor-not-allowed",
        outline: "border border-silver bg-card hover:bg-ice-blue/50 text-navy",
        ghost: "text-navy bg-transparent hover:bg-ice-blue/50 disabled:text-silver disabled:cursor-not-allowed",
        destructive: "bg-error-red text-primary-foreground hover:brightness-90",
        link: "text-accent-blue underline-offset-4 hover:underline p-0 h-auto",
      },
      size: {
        default: "h-10 px-4 py-2 text-[15px] leading-[1.5] rounded-md",
        sm: "h-9 px-3 text-[13px] leading-[1.5] rounded-md",
        lg: "h-11 px-8 text-[15px] leading-[1.5] rounded-md",
        icon: "h-10 w-10 rounded-md",
        full: "h-10 px-4 py-2 text-[15px] leading-[1.5] rounded-md w-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : children}
      </Comp>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
