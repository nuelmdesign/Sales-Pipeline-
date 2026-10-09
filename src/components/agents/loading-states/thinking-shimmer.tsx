import type { ReactNode } from "react"
import { ShimmerText } from "@/components/motion/shimmer-text"
import { cn } from "@/lib/utils"

export interface ThinkingShimmerProps {
  /** Loading message shown to the user. */
  children?: ReactNode
  /** Seconds taken for one shimmer pass. */
  duration?: number
  className?: string
}

export function ThinkingShimmer({
  children = "Thinking…",
  duration = 1.8,
  className,
}: ThinkingShimmerProps) {
  return (
    <ShimmerText duration={duration} className={cn("font-medium", className)}>
      {children}
    </ShimmerText>
  )
}
