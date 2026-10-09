"use client"

import { useEffect, useState } from "react"

import { ShimmerText } from "@/components/motion/shimmer-text"
import { cn } from "@/lib/utils"

/* ─────────────────────────────────────────────────────────
 * PIXEL LOADER — pixel-grid loader for long-running work
 *
 *   drive  — square cells, chevron wavefront driving right;
 *            the 650ms cycle is shorter than the sweep, so
 *            two fronts are always in flight
 *   dots   — same wavefront, circular cells
 *   orbit  — a comet lapping the grid perimeter
 *   surfer — the drive loader paired with a video card below
 *
 * Paired with a shimmering label and a live elapsed timer in
 * mono tabular figures. Reduced motion freezes the grid to its
 * dim state; the timer still ticks.
 * ───────────────────────────────────────────────────────── */

export type PixelLoaderVariant = "drive" | "dots" | "orbit" | "surfer"

const chevron = Array.from({ length: 9 }, (_, i) => {
  const r = Math.floor(i / 3)
  const c = i % 3
  return (c + Math.abs(r - 1)) * 90
})

const ORBIT_ORDER = [0, 1, 2, 5, 8, 7, 6, 3]
const orbit = Array.from({ length: 9 }, (_, i) => {
  const k = ORBIT_ORDER.indexOf(i)
  return k === -1 ? null : k * 110
})

type Pattern = { delays: (number | null)[]; dur: number; round: boolean }

const PATTERNS: Record<Exclude<PixelLoaderVariant, "surfer">, Pattern> = {
  drive: { delays: chevron, dur: 650, round: false },
  dots: { delays: chevron, dur: 650, round: true },
  orbit: { delays: orbit, dur: 950, round: false },
}

function LoaderGrid({
  delays,
  dur,
  round,
  cellClassName,
}: Pattern & { cellClassName?: string }) {
  return (
    <span
      aria-hidden
      data-slot="pixel-loader-grid"
      className="grid shrink-0 grid-cols-[repeat(3,4px)] gap-[1.5px]"
    >
      {delays.map((delay, index) => (
        <span
          key={index}
          className={cn(
            "size-1 bg-foreground",
            round ? "rounded-full" : "rounded-sm",
            delay !== null && "animate-pixel-on",
            cellClassName
          )}
          style={
            delay === null
              ? { opacity: 0.07 }
              : {
                  opacity: 0.15,
                  animationDuration: `${dur}ms`,
                  animationDelay: `${delay}ms`,
                }
          }
        />
      ))}
    </span>
  )
}

function useElapsed() {
  const [ds, setDs] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setDs((d) => d + 1), 100)
    return () => clearInterval(t)
  }, [])
  const total = ds / 10
  if (total < 60) return `${total.toFixed(1)}s`
  return `${Math.floor(total / 60)}m ${(total % 60).toFixed(1)}s`
}

export interface PixelLoaderProps {
  /** Status text next to the grid. Defaults to "Churning" ("Subway surfing" for surfer). */
  label?: string
  variant?: PixelLoaderVariant
  /** Video shown in the surfer variant's card. Without it the card shows the loader. */
  videoSrc?: string
  className?: string
}

export function PixelLoader({
  label,
  variant = "drive",
  videoSrc,
  className,
}: PixelLoaderProps) {
  const elapsed = useElapsed()
  const surfer = variant === "surfer"
  const resolvedLabel = label ?? (surfer ? "Subway surfing" : "Churning")
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const videoOk = !!videoSrc && failedSrc !== videoSrc
  const pattern = surfer ? PATTERNS.drive : PATTERNS[variant]

  const row = (
    <div className="flex items-center gap-2.5">
      <LoaderGrid {...pattern} />
      <ShimmerText duration={1.4} className="text-[13px] font-medium">
        {resolvedLabel}
      </ShimmerText>
      <span className="font-mono text-xs text-muted-foreground/70 tabular-nums">
        {elapsed}
      </span>
    </div>
  )

  if (!surfer) {
    return (
      <div
        role="status"
        data-slot="pixel-loader"
        data-variant={variant}
        className={cn("flex w-fit items-center", className)}
      >
        {row}
      </div>
    )
  }

  return (
    <div
      role="status"
      data-slot="pixel-loader"
      data-variant={variant}
      className={cn("flex w-fit flex-col items-start", className)}
    >
      {row}

      {/* the context card follows the status text it is illustrating */}
      <div
        data-slot="pixel-loader-card"
        className="mt-2 w-56 origin-top-left animate-pop-in overflow-hidden rounded-lg border bg-ink shadow-md"
        style={{ animationDuration: "200ms" }}
      >
        <div className="relative aspect-video w-full">
          {videoOk ? (
            <video
              src={videoSrc}
              autoPlay
              muted
              loop
              playsInline
              onError={() => setFailedSrc(videoSrc)}
              className="size-full object-cover"
            />
          ) : (
            <div className="flex size-full flex-col items-center justify-center gap-1.5">
              <LoaderGrid
                {...PATTERNS.drive}
                cellClassName="bg-ink-foreground"
              />
              <span className="px-3 text-center font-mono text-[10px] text-ink-foreground/60">
                {videoSrc ? "Video unavailable" : "Working in the background"}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
