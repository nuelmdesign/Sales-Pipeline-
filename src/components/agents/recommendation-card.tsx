"use client"

import { Building2 } from "lucide-react"
import { type ReactNode, useState } from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/* The card holds its shape. Pressing "Alternatives" opens a drawer listing
 * the other options; picking one promotes it to the recommendation. The
 * primary action confirms. */

export type RecommendationTone = "success" | "warning" | "muted"

export type RecommendationOption = {
  key: string
  body: ReactNode
  short: string
  /** Confidence bars lit, 0–3. */
  signal: number
  tone: RecommendationTone
  label: string
  cta: string
  ctaVariant: "default" | "ink" | "outline"
}

export type RecommendationLabels = {
  title: string
  alternatives: string
  otherOptions: string
  accepted: string
}

export interface RecommendationCardProps {
  options?: RecommendationOption[]
  labels?: Partial<RecommendationLabels>
  /** Fired with the option key when its action is pressed. */
  onAccept?: (key: string) => void
  className?: string
}

const DEFAULT_LABELS: RecommendationLabels = {
  title: "Want me to place this restock order?",
  alternatives: "Alternatives",
  otherOptions: "Other options",
  accepted: "Accepted",
}

const TONE_BG: Record<RecommendationTone, string> = {
  success: "bg-success",
  warning: "bg-warning",
  muted: "bg-muted-foreground/70",
}

/** An inline entity reference: icon + name. */
function EntityChip({ name }: { name: string }) {
  return (
    <span className="inline-flex translate-y-[-1px] items-center gap-1 rounded-md border bg-muted px-1.5 align-middle text-[12.5px] leading-5 font-medium text-foreground">
      <Building2 className="size-3 text-muted-foreground" />
      {name}
    </span>
  )
}

/** An inline value: neutral, or tinted by meaning. */
function ValuePill({
  tone,
  children,
}: {
  tone?: "success"
  children: ReactNode
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-md px-1.5 align-middle font-mono text-[12px] leading-5 font-medium tabular-nums",
        tone === "success"
          ? "bg-success/10 text-success"
          : "bg-muted text-foreground"
      )}
    >
      {children}
    </span>
  )
}

const OPTIONS: RecommendationOption[] = [
  {
    key: "high",
    body: (
      <>
        Reorder waffle cones from <EntityChip name="Cone King" /> with lead time{" "}
        <ValuePill tone="success">7 days</ValuePill>
      </>
    ),
    short: "Reorder from Cone King · 7-day lead",
    signal: 3,
    tone: "success",
    label: "High confidence",
    cta: "Accept",
    ctaVariant: "default",
  },
  {
    key: "review",
    body: (
      <>
        Switch vanilla to <ValuePill>Vanilla Madagascar</ValuePill> for peak
        season.
      </>
    ),
    short: "Switch to Vanilla Madagascar",
    signal: 2,
    tone: "warning",
    label: "Needs review",
    cta: "Configure",
    ctaVariant: "ink",
  },
  {
    key: "none",
    body: (
      <>
        Fall back to a{" "}
        <span className="font-medium text-foreground">full restock</span> across
        every SKU.
      </>
    ),
    short: "Full restock across every SKU",
    signal: 0,
    tone: "muted",
    label: "No signal",
    cta: "Accept full restock",
    ctaVariant: "ink",
  },
]

function Meter({ signal, tone }: { signal: number; tone: RecommendationTone }) {
  return (
    <span
      data-slot="recommendation-card-meter"
      aria-hidden
      className="flex items-end gap-0.5"
    >
      {[0, 1, 2].map((bar) => (
        <span
          key={bar}
          className={cn(
            "h-2.5 w-1 rounded-[1px] transition-colors duration-300",
            bar < signal ? TONE_BG[tone] : "bg-input"
          )}
        />
      ))}
    </span>
  )
}

export function RecommendationCard({
  options = OPTIONS,
  labels,
  onAccept,
  className,
}: RecommendationCardProps) {
  const t = { ...DEFAULT_LABELS, ...labels }
  const [selected, setSelected] = useState(0)
  const [open, setOpen] = useState(false)
  const [accepted, setAccepted] = useState(false)

  const active = options[selected]
  const others = options
    .map((o, i) => ({ o, i }))
    .filter(({ i }) => i !== selected)

  return (
    <div
      data-slot="recommendation-card"
      className={cn(
        "w-full max-w-95 overflow-hidden rounded-lg border bg-card",
        className
      )}
    >
      <div className="p-3">
        <span className="text-sm font-medium text-foreground">{t.title}</span>
        <p
          key={active.key}
          data-slot="recommendation-card-body"
          className="mt-1.5 min-h-12 animate-fade-in text-[13px] leading-relaxed text-muted-foreground"
        >
          {active.body}
        </p>
      </div>

      {/* alternatives drawer: a distinctly new section of the card */}
      <div
        data-slot="recommendation-card-alternatives"
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-300 ease-out",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        )}
        inert={!open}
      >
        <div className="overflow-hidden">
          <div className="border-t bg-card p-2">
            <p className="px-1.5 pb-1 eyebrow text-muted-foreground/70">
              {t.otherOptions}
            </p>
            {others.map(({ o, i }) => (
              <button
                key={o.key}
                type="button"
                onClick={() => {
                  setSelected(i)
                  setAccepted(false)
                }}
                className="flex w-full items-center gap-2.5 rounded-md px-1.5 py-1.5 text-left transition-colors duration-100 hover:bg-accent"
              >
                <Meter signal={o.signal} tone={o.tone} />
                <span className="min-w-0 flex-1 truncate text-[12.5px] text-foreground">
                  {o.short}
                </span>
                <span className="shrink-0 text-[11px] text-muted-foreground/70">
                  {o.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t bg-card px-3 py-2">
        <span className="flex items-center gap-2">
          <Meter signal={active.signal} tone={active.tone} />
          <span className="text-[12.5px] font-medium text-muted-foreground">
            {active.label}
          </span>
        </span>

        <span className="-mr-0.5 flex items-center gap-2">
          <Button
            variant="outline"
            size="xs"
            aria-expanded={open}
            onClick={() => setOpen((current) => !current)}
            className="text-[12.5px]"
          >
            {t.alternatives}
          </Button>
          <Button
            variant={accepted ? undefined : active.ctaVariant}
            size="xs"
            onClick={() => {
              setAccepted(true)
              onAccept?.(active.key)
            }}
            className={cn(
              "text-[12.5px]",
              accepted &&
                "bg-success text-primary-foreground hover:bg-success/90"
            )}
          >
            {accepted ? t.accepted : active.cta}
          </Button>
        </span>
      </div>
    </div>
  )
}
