import * as React from "react"
import {
  motion,
  useInView,
  useSpring,
  useTransform,
  type SpringOptions,
} from "motion/react"

import { cn } from "@/lib/utils"

type AnimatedNumberProps = {
  value: number
  /** Intl.NumberFormat options, e.g. { style: "currency", currency: "USD" }. */
  format?: Intl.NumberFormatOptions
  locale?: string
  spring?: SpringOptions
  /** Start counting from 0 the first time the number scrolls into view. */
  countOnView?: boolean
  className?: string
}

function AnimatedNumber({
  value,
  format,
  locale = "en-US",
  spring = { stiffness: 120, damping: 24, mass: 0.8 },
  countOnView = false,
  className,
}: AnimatedNumberProps) {
  const ref = React.useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: "-40px" })
  const motionValue = useSpring(countOnView ? 0 : value, spring)
  const formatter = React.useMemo(
    () => new Intl.NumberFormat(locale, format),
    [locale, format]
  )
  const display = useTransform(motionValue, (v) => formatter.format(v))

  React.useEffect(() => {
    if (!countOnView || inView) motionValue.set(value)
  }, [value, inView, countOnView, motionValue])

  return (
    <motion.span
      ref={ref}
      data-slot="animated-number"
      className={cn("tabular-nums", className)}
    >
      {display}
    </motion.span>
  )
}

export { AnimatedNumber }
