import {
  ArrowRightLeft,
  Bot,
  CalendarCheck,
  ListOrdered,
  Mail,
  Phone,
  Sparkles,
  StickyNote,
  User,
  Zap,
} from "lucide-react"
import { motion } from "motion/react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { spring } from "@/lib/motion"

import {
  initials,
  owner,
  scoreBand,
  stageLabel,
  type ActivityKind,
  type OwnerId,
  type StageId,
  type TaskSource,
} from "./data"

const STAGE_VARIANT: Record<
  StageId,
  "outline" | "secondary" | "brand" | "warning" | "success" | "destructive"
> = {
  researching: "outline",
  contacted: "secondary",
  replied: "brand",
  meeting: "brand",
  proposal: "warning",
  won: "success",
  lost: "destructive",
}

export function StageBadge({ stage, className }: { stage: StageId; className?: string }) {
  return (
    <Badge variant={STAGE_VARIANT[stage]} dot className={className}>
      {stageLabel(stage)}
    </Badge>
  )
}

/** Five square pips. Fit is how closely the prospect matches the ideal client. */
export function FitScore({ value, className }: { value: number; className?: string }) {
  return (
    <span role="img" aria-label={`Fit ${value} of 5`} className={cn("inline-flex items-center gap-0.5", className)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={cn("size-2", n <= value ? "bg-primary" : "bg-muted ring-1 ring-inset ring-border")} />
      ))}
    </span>
  )
}

const BAND_TEXT = {
  success: "text-success",
  brand: "text-brand",
  warning: "text-warning",
  muted: "text-muted-foreground",
} as const

const BAND_BG = {
  success: "bg-success",
  brand: "bg-primary",
  warning: "bg-warning",
  muted: "bg-muted-foreground/60",
} as const

/** Lead score as a number with a thin meter underneath. */
export function ScoreBadge({ score, className }: { score: number; className?: string }) {
  const band = scoreBand(score)
  return (
    <span className={cn("inline-flex w-10 flex-col gap-1", className)} title={`Lead score ${score}, ${band.label}`}>
      <span className={cn("font-mono text-xs leading-none tabular-nums", BAND_TEXT[band.tone])}>{score}</span>
      <span className="h-0.5 w-full bg-muted">
        <motion.span
          className={cn("block h-full origin-left", BAND_BG[band.tone])}
          initial={false}
          animate={{ scaleX: score / 100 }}
          transition={spring.smooth}
        />
      </span>
    </span>
  )
}

/** Larger ring for the prospect panel. */
export function ScoreRing({ score, size = 64 }: { score: number; size?: number }) {
  const band = scoreBand(score)
  const r = size / 2 - 4
  const c = 2 * Math.PI * r
  return (
    <span className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={4} className="stroke-muted" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={4}
          strokeLinecap="butt"
          className={cn(
            band.tone === "success" && "stroke-success",
            band.tone === "brand" && "stroke-primary",
            band.tone === "warning" && "stroke-warning",
            band.tone === "muted" && "stroke-muted-foreground"
          )}
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - score / 100) }}
          transition={spring.gentle}
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center">
        <span className="flex flex-col items-center leading-none">
          <span className="font-mono text-lg tabular-nums">{score}</span>
          <span className={cn("mt-0.5 font-mono text-[9px] uppercase tracking-wider", BAND_TEXT[band.tone])}>{band.label}</span>
        </span>
      </span>
    </span>
  )
}

export function CompanyMark({ name, className }: { name: string; className?: string }) {
  return (
    <Avatar className={cn("size-8 rounded-md", className)}>
      <AvatarFallback className="rounded-md font-mono text-[11px]">{initials(name)}</AvatarFallback>
    </Avatar>
  )
}

export function OwnerAvatar({ id, className }: { id: OwnerId; className?: string }) {
  const o = owner(id)
  return (
    <Avatar className={cn("size-6", className)} title={o.name}>
      {o.avatarUrl ? <AvatarImage src={o.avatarUrl} alt="" /> : null}
      <AvatarFallback className="font-mono text-[10px]">{o.initials}</AvatarFallback>
    </Avatar>
  )
}

export const ACTIVITY_ICON: Record<ActivityKind, typeof Mail> = {
  email: Mail,
  call: Phone,
  meeting: CalendarCheck,
  note: StickyNote,
  stage: ArrowRightLeft,
  automation: Zap,
  ai: Sparkles,
}

export function SectionLabel({
  children,
  count,
  className,
}: {
  children: React.ReactNode
  count?: number
  className?: string
}) {
  return (
    <div className={cn("flex items-center gap-2 text-muted-foreground", className)}>
      <span className="eyebrow">{children}</span>
      {count !== undefined ? <span className="font-mono text-[11px] tabular-nums">{count}</span> : null}
    </div>
  )
}

/** Where a task came from: you, a rule, a sequence or the assistant. */
export function SourceChip({ source }: { source: TaskSource }) {
  const map = {
    manual: { icon: User, text: "You" },
    automation: { icon: Zap, text: source.kind === "automation" ? source.name : "" },
    sequence: { icon: ListOrdered, text: source.kind === "sequence" ? `${source.name} · step ${source.step + 1}` : "" },
    ai: { icon: Bot, text: "Assistant" },
  } as const
  const { icon: Icon, text } = map[source.kind]
  return (
    <span className="inline-flex max-w-full items-center gap-1 truncate font-mono text-[11px] text-muted-foreground">
      <Icon aria-hidden className="size-3 shrink-0" />
      <span className="truncate">{text}</span>
    </span>
  )
}

/** Marks AI-produced content. */
export function AIMark({ live, className }: { live: boolean; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider",
        live ? "border-brand/25 bg-brand/10 text-brand" : "text-muted-foreground",
        className
      )}
      title={live ? "Written by Claude" : "Built-in rules (Claude is not connected on this page)"}
    >
      <Sparkles aria-hidden className="size-3" />
      {live ? "Claude" : "Rules"}
    </span>
  )
}

export function PageHeader({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string
  title: string
  children?: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-2">
        <p className="eyebrow text-muted-foreground">{eyebrow}</p>
        <h1 className="font-display text-3xl font-light tracking-[-0.02em] text-balance md:text-4xl">{title}</h1>
      </div>
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  )
}
