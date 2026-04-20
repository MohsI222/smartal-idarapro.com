import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const NUMERIC_TYPES = new Set(["number", "tel", "date", "time", "datetime-local"]);

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, lang, ...props }, ref) => {
    const numeric = type != null && NUMERIC_TYPES.has(type);
    const resolvedLang = lang ?? (numeric ? "en-US" : undefined);
    const latinDigitFont = numeric || resolvedLang === "en-US";
    return (
      <input
        type={type}
        lang={resolvedLang}
        className={cn(
          "flex h-10 w-full rounded-xl border border-slate-700 bg-slate-900/50 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40 disabled:cursor-not-allowed disabled:opacity-50",
          "tabular-nums [font-variant-numeric:lining-nums]",
          latinDigitFont && "font-[Arial,Helvetica,sans-serif]",
          numeric && "[direction:ltr] [unicode-bidi:isolate]",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
