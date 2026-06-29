import * as React from "react";
import { cn } from "@/lib/utils";

const badgeVariants = {
  default:
    "bg-[var(--primary)] text-[var(--primary-foreground)] shadow-sm",
  secondary:
    "bg-[var(--secondary)] text-[var(--secondary-foreground)]",
  destructive:
    "bg-[var(--destructive)] text-[var(--destructive-foreground)] shadow-sm",
  outline: "border border-[var(--border)] text-[var(--foreground)]",
  success:
    "bg-[var(--success)] text-[var(--success-foreground)] shadow-sm",
} as const;

type BadgeVariant = keyof typeof badgeVariants;

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-medium transition-colors",
        "focus:outline-none focus:ring-2 focus:ring-[var(--ring)] focus:ring-offset-2",
        badgeVariants[variant],
        className,
      )}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
