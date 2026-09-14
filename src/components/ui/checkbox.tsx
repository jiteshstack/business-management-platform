import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const Checkbox = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        type="checkbox"
        className={cn(
          "h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-2 focus:ring-emerald-600/20",
          className
        )}
        {...props}
      />
    );
  }
);
Checkbox.displayName = "Checkbox";
