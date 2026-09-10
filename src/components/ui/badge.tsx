import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-lg border px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-orange-500/20 text-orange-400 border-orange-500/30",
        secondary:
          "border-transparent bg-blue-500/20 text-blue-300 border-blue-500/30",
        outline: "text-slate-300 border-slate-600",
        success:
          "border-transparent bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
        destructive:
          "border-transparent bg-red-500/20 text-red-400 border-red-500/30",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
