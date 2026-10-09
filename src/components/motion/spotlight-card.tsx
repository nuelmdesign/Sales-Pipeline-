import * as React from "react"
import { motion, useMotionTemplate, useMotionValue } from "motion/react"

import { cn } from "@/lib/utils"

/** A card whose border and surface light up under the cursor. */
function SpotlightCard({
  className,
  children,
  size = 320,
  ...props
}: React.ComponentProps<"div"> & { size?: number }) {
  const x = useMotionValue(-size)
  const y = useMotionValue(-size)

  const glow = useMotionTemplate`radial-gradient(${size}px circle at ${x}px ${y}px, color-mix(in oklch, var(--brand) 14%, transparent), transparent 70%)`
  const border = useMotionTemplate`radial-gradient(${size * 0.6}px circle at ${x}px ${y}px, color-mix(in oklch, var(--brand) 70%, transparent), transparent 70%)`

  return (
    <div
      data-slot="spotlight-card"
      onPointerMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect()
        x.set(e.clientX - rect.left)
        y.set(e.clientY - rect.top)
      }}
      onPointerLeave={() => {
        x.set(-size)
        y.set(-size)
      }}
      className={cn(
        "group relative overflow-hidden rounded-xl border bg-card p-6 text-card-foreground [box-shadow:var(--highlight),var(--shadow-sm)]",
        className
      )}
      {...props}
    >
      {/* Border glow: a 1px ring masked to the card's edge. */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[inherit] p-px opacity-0 transition-opacity duration-300 [mask:linear-gradient(#000_0_0)_content-box_exclude,linear-gradient(#000_0_0)] group-hover:opacity-100"
        style={{ background: border }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: glow }}
      />
      <div className="relative">{children}</div>
    </div>
  )
}

export { SpotlightCard }
