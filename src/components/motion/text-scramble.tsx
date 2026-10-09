import { useReducedMotion } from "motion/react"
import { useEffect, useRef, useState, type CSSProperties } from "react"
import { cn } from "@/lib/utils"

const DEFAULT_GLYPHS = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#%&@$?/"

export interface TextScrambleProps {
  /** Final text revealed by the scramble animation. */
  text: string
  /** Maximum animation duration in milliseconds. */
  duration?: number
  /** Characters sampled while unresolved positions are scrambling. */
  glyphs?: string
  className?: string
  style?: CSSProperties
}

/** Character scramble that resolves to `text` and respects reduced motion. */
export function TextScramble({
  text,
  duration,
  glyphs = DEFAULT_GLYPHS,
  className,
  style,
}: TextScrambleProps) {
  const reduce = useReducedMotion() ?? false
  // The frame in flight, tagged with the text it resolves to. Anything stale
  // (or none at all) shows the final text, so no effect has to reset it.
  const [frameState, setFrameState] = useState<{
    text: string
    value: string
  } | null>(null)
  const mounted = useRef(false)
  const display = frameState?.text === text ? frameState.value : text

  useEffect(() => {
    // The first render shows the text as-is; only later changes scramble.
    if (!mounted.current) {
      mounted.current = true
      return
    }
    if (reduce || !glyphs) return

    const characters = text.split("")
    const startedAt = performance.now()
    const animationDuration =
      duration ?? Math.min(760, Math.max(420, characters.length * 32))
    let frame = 0
    let lastUpdate = 0

    const animate = (now: number) => {
      if (now - lastUpdate >= 40) {
        lastUpdate = now
        const progress = Math.min((now - startedAt) / animationDuration, 1)
        const settled = Math.floor(progress * characters.length)
        setFrameState({
          text,
          value: characters
            .map((character, index) => {
              if (index < settled || character === " ") return character
              return glyphs[Math.floor(Math.random() * glyphs.length)]
            })
            .join(""),
        })
      }

      if (now - startedAt < animationDuration) {
        frame = requestAnimationFrame(animate)
      } else {
        setFrameState(null)
      }
    }

    frame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frame)
  }, [duration, glyphs, reduce, text])

  return (
    <span
      className={cn("inline-block whitespace-pre", className)}
      style={style}
    >
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">{reduce ? text : display}</span>
    </span>
  )
}
