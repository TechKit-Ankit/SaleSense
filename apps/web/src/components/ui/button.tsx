"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/* ── Variant definitions ─────────────────────────────────────────── */

const buttonVariants = {
  variant: {
    default:
      "bg-[var(--primary)] text-[var(--primary-foreground)] shadow-sm hover:bg-[var(--primary)]/90",
    destructive:
      "bg-[var(--destructive)] text-[var(--destructive-foreground)] shadow-sm hover:bg-[var(--destructive)]/90",
    outline:
      "border border-[var(--input)] bg-[var(--background)] shadow-xs hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)]",
    secondary:
      "bg-[var(--secondary)] text-[var(--secondary-foreground)] shadow-xs hover:bg-[var(--secondary)]/80",
    ghost:
      "hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)]",
    link: "text-[var(--primary)] underline-offset-4 hover:underline",
  },
  size: {
    default: "h-9 px-4 py-2",
    sm: "h-8 rounded-md px-3 text-xs",
    lg: "h-10 rounded-md px-6",
    icon: "h-9 w-9",
  },
} as const;

type ButtonVariant = keyof typeof buttonVariants.variant;
type ButtonSize = keyof typeof buttonVariants.size;

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant = "default", size = "default", asChild, ...props },
    ref,
  ) => {
    return (
      <button
        className={cn(
          "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius)] text-sm font-medium transition-all",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2",
          "disabled:pointer-events-none disabled:opacity-50",
          "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
          "cursor-pointer",
          buttonVariants.variant[variant],
          buttonVariants.size[size],
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
