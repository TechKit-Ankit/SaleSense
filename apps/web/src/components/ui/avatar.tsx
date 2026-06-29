"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/* ── Avatar ───────────────────────────────────────────────────────── */

interface AvatarProps extends React.HTMLAttributes<HTMLSpanElement> {}

const Avatar = React.forwardRef<HTMLSpanElement, AvatarProps>(
  ({ className, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(
        "relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full",
        className,
      )}
      {...props}
    />
  ),
);
Avatar.displayName = "Avatar";

/* ── AvatarImage ──────────────────────────────────────────────────── */

interface AvatarImageProps
  extends React.ImgHTMLAttributes<HTMLImageElement> {}

const AvatarImage = React.forwardRef<HTMLImageElement, AvatarImageProps>(
  ({ className, alt, ...props }, ref) => {
    const [hasError, setHasError] = React.useState(false);

    if (hasError) return null;

    return (
      <img
        ref={ref}
        alt={alt}
        className={cn("aspect-square h-full w-full object-cover", className)}
        onError={() => setHasError(true)}
        {...props}
      />
    );
  },
);
AvatarImage.displayName = "AvatarImage";

/* ── AvatarFallback ───────────────────────────────────────────────── */

interface AvatarFallbackProps
  extends React.HTMLAttributes<HTMLSpanElement> {}

const AvatarFallback = React.forwardRef<HTMLSpanElement, AvatarFallbackProps>(
  ({ className, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(
        "flex h-full w-full items-center justify-center rounded-full bg-[var(--muted)] text-sm font-medium text-[var(--muted-foreground)]",
        className,
      )}
      {...props}
    />
  ),
);
AvatarFallback.displayName = "AvatarFallback";

export { Avatar, AvatarImage, AvatarFallback };
