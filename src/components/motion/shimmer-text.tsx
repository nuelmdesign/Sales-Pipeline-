import * as React from "react"

import { cn } from "@/lib/utils"

/** A light sweep across text. Great for "Thinking…" and loading labels. */
function ShimmerText({
  className,
  duration = 2.2,
  style,
  ...props
}: React.ComponentProps<"span"> & { duration?: number }) {
  return (
    <span
      data-slot="shimmer-text"
      className={cn(
        "inline-block animate-shimmer bg-clip-text text-transparent",
        "bg-[linear-gradient(90deg,var(--muted-foreground)_0%,var(--muted-foreground)_40%,var(--foreground)_50%,var(--muted-foreground)_60%,var(--muted-foreground)_100%)] bg-[length:200%_100%]",
        className
      )}
      style={{ animationDuration: `${duration}s`, ...style }}
      {...props}
    />
  )
}

export { ShimmerText }
