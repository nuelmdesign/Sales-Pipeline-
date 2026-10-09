import * as React from "react"
import { ArrowRight, CalendarCheck, Flame, RefreshCw, Sparkles, Zap } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { toast } from "sonner"

import { AnimatedNumber } from "@/components/motion/animated-number"
import { BlurText } from "@/components/motion/blur-text"
import { ShimmerText } from "@/components/motion/shimmer-text"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { spring, stagger } from "@/lib/motion"

import { briefPrompt, errorCopy, fallbackBrief, isPermanent, useAI } from "./ai"
import { AIMark, CompanyMark, ScoreBadge, SectionLabel, StageBadge } from "./bits"
import {
  OPEN_STAGES,
  STAGES,
  clock,
  isOpen,
  leadScore,
  money,
  relative,
  stageProbability,
  timeAgo,
  type CRMState,
} from "./data"
import { TaskRow } from "./inbox"
import { EmptyPipeline } from "./workspace"
import { ME, useStore } from "./store"
import { owner } from "./data"

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return "Good morning"
  if (h < 17) return "Good afternoon"
  return "Good evening"
}

export function TodayView({ onOpen, onGo, onImport, onAdd }: { onOpen: (id: string) => void; onGo: (view: "inbox" | "automations" | "pipeline") => void; onImport: () => void; onAdd: () => void }) {
  const { state } = useStore()
  const open = state.prospects.filter(isOpen)
  const pipeline = open.reduce((s, p) => s + p.value, 0)
  const weighted = open.reduce((s, p) => s + p.value * stageProbability(p.stage), 0)
  const won = state.prospects.filter((p) => p.stage === "won").reduce((s, p) => s + p.value, 0)
  const hot = [...open].sort((a, b) => leadScore(b) - leadScore(a)).filter((p) => leadScore(p) >= 75)

  const myTasks = state.tasks
    .filter((t) => !t.done && t.owner === ME && new Date(t.due).getTime() <= new Date().setHours(23, 59, 59, 999))
    .sort((a, b) => (a.priority === b.priority ? a.due.localeCompare(b.due) : a.priority === "high" ? -1 : 1))
  const meetings = state.meetings.filter((m) => new Date(m.at).getTime() >= Date.now() - 3_600_000).slice(0, 4)
  const runs = state.runs.slice(0, 5)

  const date = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 md:px-8">
      <header className="flex flex-col gap-2">
        <p className="eyebrow text-muted-foreground">{date}</p>
        <BlurText as="h1" text={`${greeting()}${(() => { const f = ME === "em" ? "Emmanuel" : owner(ME).first; return f === "You" || f === "Teammate" ? "" : `, ${f}` })()}.`} className="font-display text-4xl font-light tracking-[-0.02em] md:text-5xl" />
        <p className="max-w-xl text-sm text-muted-foreground">
          {myTasks.length ? `${myTasks.length} task${myTasks.length === 1 ? "" : "s"} for you today` : "Nothing due for you today"}
          {meetings.length ? `, ${meetings.length} meeting${meetings.length === 1 ? "" : "s"} coming up` : ""}
          {hot.length ? `, and ${hot.length} hot lead${hot.length === 1 ? "" : "s"} to keep warm.` : "."}
        </p>
      </header>

      {state.prospects.length === 0 ? <EmptyPipeline onImport={onImport} onAdd={onAdd} /> : <Brief state={state} onOpen={onOpen} />}

      <section aria-label="Pipeline summary" className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border lg:grid-cols-4">
        <Kpi label="Open pipeline" hint={`${open.length} deals`}>
          <AnimatedNumber value={pipeline} locale="en-US" format={{ style: "currency", currency: "USD", maximumFractionDigits: 0 }} />
        </Kpi>
        <Kpi label="Weighted forecast" hint="Value × stage likelihood">
          <AnimatedNumber value={Math.round(weighted)} locale="en-US" format={{ style: "currency", currency: "USD", maximumFractionDigits: 0 }} />
        </Kpi>
        <Kpi label="Won" hint="Signed engagements">
          <AnimatedNumber value={won} locale="en-US" format={{ style: "currency", currency: "USD", maximumFractionDigits: 0 }} />
        </Kpi>
        <Kpi label="Hot leads" hint="Lead score 75 or more" tone="success">
          <AnimatedNumber value={hot.length} />
        </Kpi>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.55fr_1fr] [&>*]:min-w-0">
        <Card className="gap-0 py-0">
          <div className="flex items-center justify-between border-b px-5 py-4">
            <SectionLabel count={myTasks.length}>Your queue today</SectionLabel>
            <Button variant="ghost" size="sm" className="-mr-2 text-muted-foreground" onClick={() => onGo("inbox")}>
              Inbox <ArrowRight />
            </Button>
          </div>
          {myTasks.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">You are clear for today.</p>
          ) : (
            <ul className="divide-y">
              <AnimatePresence initial={false}>
                {myTasks.slice(0, 7).map((t) => (
                  <TaskRow key={t.id} task={t} onOpen={onOpen} />
                ))}
              </AnimatePresence>
            </ul>
          )}
        </Card>

        <div className="flex flex-col gap-6">
          <Card className="gap-0 py-0">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <SectionLabel count={meetings.length}>Upcoming meetings</SectionLabel>
              <CalendarCheck aria-hidden className="size-3.5 text-muted-foreground" />
            </div>
            {meetings.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-muted-foreground">No meetings booked. Book one from any prospect.</p>
            ) : (
              <ul className="divide-y">
                {meetings.map((m) => {
                  const p = state.prospects.find((x) => x.id === m.prospectId)
                  if (!p) return null
                  return (
                    <li key={m.id}>
                      <button type="button" onClick={() => onOpen(p.id)} className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none">
                        <span className="flex w-12 shrink-0 flex-col items-center rounded-md border bg-surface py-1">
                          <span className="font-mono text-[10px] uppercase text-muted-foreground">{relative(m.at) === "Today" || relative(m.at) === "Tomorrow" ? relative(m.at).slice(0, 3) : new Date(m.at).toLocaleDateString("en-GB", { weekday: "short" })}</span>
                          <span className="font-mono text-xs tabular-nums">{clock(m.at)}</span>
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{p.company}</span>
                          <span className="block truncate text-xs text-muted-foreground">{m.title} · {m.minutes} min</span>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>

          <Card className="gap-0 py-0">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <SectionLabel>Automations at work</SectionLabel>
              <Button variant="ghost" size="sm" className="-mr-2 text-muted-foreground" onClick={() => onGo("automations")}>
                All <ArrowRight />
              </Button>
            </div>
            <ol className="divide-y">
              <AnimatePresence initial={false}>
                {runs.map((r) => (
                  <motion.li key={r.id} layout initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={spring.pop} className="flex items-start gap-3 px-5 py-3">
                    <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-md border border-brand/25 bg-brand/10 text-brand">
                      <Zap aria-hidden className="size-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">
                        <button type="button" className="font-medium hover:text-brand focus-visible:text-brand focus-visible:outline-none" onClick={() => onOpen(r.prospectId)}>{r.company}</button>
                        <span className="text-muted-foreground"> · {r.automationName}</span>
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{r.steps.join(", ")}</p>
                    </div>
                    <span className="shrink-0 font-mono text-[11px] text-muted-foreground">{timeAgo(r.at)}</span>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ol>
          </Card>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr] [&>*]:min-w-0">
        <Card className="gap-4 px-5 py-5">
          <div className="flex items-center justify-between">
            <SectionLabel>Pipeline by stage</SectionLabel>
            <Button variant="ghost" size="sm" className="-mr-2 text-muted-foreground" onClick={() => onGo("pipeline")}>
              Board <ArrowRight />
            </Button>
          </div>
          <Funnel state={state} />
        </Card>

        <Card className="gap-0 py-0">
          <div className="flex items-center justify-between border-b px-5 py-4">
            <SectionLabel count={hot.length}>Hot leads</SectionLabel>
            <Flame aria-hidden className="size-3.5 text-success" />
          </div>
          <ul className="divide-y">
            {hot.slice(0, 5).map((p, i) => (
              <motion.li key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * stagger.tight }}>
                <button type="button" onClick={() => onOpen(p.id)} className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none">
                  <CompanyMark name={p.company} className="size-7" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{p.company}</span>
                    <span className="block truncate text-xs text-muted-foreground">{p.nextStep}</span>
                  </span>
                  <StageBadge stage={p.stage} className="hidden sm:inline-flex" />
                  <span className="hidden w-20 text-right font-mono text-xs tabular-nums sm:block">{money(p.value)}</span>
                  <ScoreBadge score={leadScore(p)} />
                </button>
              </motion.li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  )
}

function Kpi({ label, hint, tone, children }: { label: string; hint: string; tone?: "success"; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 bg-card p-5">
      <span className="eyebrow text-muted-foreground">{label}</span>
      <span className={cn("font-mono text-2xl tabular-nums tracking-tight md:text-3xl", tone === "success" && "text-success")}>{children}</span>
      <span className="text-xs text-muted-foreground">{hint}</span>
    </div>
  )
}

function Funnel({ state }: { state: CRMState }) {
  const rows = STAGES.filter((s) => OPEN_STAGES.includes(s.id)).map((s) => {
    const list = state.prospects.filter((p) => p.stage === s.id)
    return { ...s, count: list.length, value: list.reduce((n, p) => n + p.value, 0) }
  })
  const max = Math.max(1, ...rows.map((r) => r.value))
  return (
    <ul className="flex flex-col gap-2.5">
      {rows.map((r) => (
        <li key={r.id} className="grid grid-cols-[7rem_1fr_auto] items-center gap-3">
          <span className="truncate text-xs text-muted-foreground">{r.label}</span>
          <span className="h-2 bg-muted">
            <motion.span className="block h-full origin-left bg-primary" initial={{ scaleX: 0 }} animate={{ scaleX: r.value / max }} transition={spring.smooth} />
          </span>
          <span className="w-16 text-right font-mono text-[11px] tabular-nums text-muted-foreground">{r.count} · {Math.round(r.value / 1000)}k</span>
        </li>
      ))}
    </ul>
  )
}

/* ------------------------------------------------------------------ */
/* Daily brief: rules first (always visible), Claude on request         */
/* ------------------------------------------------------------------ */

function Brief({ state, onOpen }: { state: CRMState; onOpen: (id: string) => void }) {
  const ai = useAI()
  const rules = React.useMemo(() => fallbackBrief(state), [state])
  const [aiLines, setAiLines] = React.useState<string[] | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [waiting, setWaiting] = React.useState(false)
  const ctl = React.useRef<AbortController | null>(null)

  const lines = aiLines ?? rules
  const live = Boolean(aiLines)

  const write = async () => {
    if (!ai.sample) return
    ctl.current = new AbortController()
    setBusy(true)
    setWaiting(true)
    const parse = (t: string) => t.split("\n").map((l) => l.replace(/^\s*[-•*]\s*/, "").trim()).filter(Boolean)
    try {
      const r = await ai.sample(briefPrompt(state), {
        signal: ctl.current.signal,
        modelTier: "default",
        cache: { gcTime: 1_800_000 },
        onText: ({ text }: { text: string }) => {
          setWaiting(false)
          setAiLines(parse(text))
        },
      })
      setAiLines(parse(r.text).slice(0, 5))
    } catch (e) {
      if (isPermanent(e)) ai.disable()
      const msg = errorCopy(e)
      if (msg) toast(msg)
    } finally {
      setBusy(false)
      setWaiting(false)
    }
  }

  // Make company names clickable.
  const link = (line: string) => {
    const p = state.prospects.find((x) => line.includes(x.company))
    if (!p) return line
    const [a, ...b] = line.split(p.company)
    return (
      <>
        {a}
        <button type="button" onClick={() => onOpen(p.id)} className="font-medium text-brand hover:underline focus-visible:underline focus-visible:outline-none">{p.company}</button>
        {b.join(p.company)}
      </>
    )
  }

  return (
    <Card className="relative gap-4 overflow-hidden p-5 md:p-6 md:pr-48">
      <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 hidden w-40 border-l bg-dots md:block" />
      <div className="relative flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles aria-hidden className="size-4 text-brand" />
          <span className="text-sm font-medium">Today's brief</span>
          <AIMark live={live} />
        </div>
        {ai.status === "ready" ? (
          busy ? (
            <Button variant="outline" size="sm" onClick={() => ctl.current?.abort()}>Stop</Button>
          ) : (
            <Button variant="outline" size="sm" onClick={write}>
              {live ? <RefreshCw /> : <Sparkles />} {live ? "Rewrite" : "Write with Claude"}
            </Button>
          )
        ) : null}
      </div>
      <AnimatePresence mode="wait">
        {waiting ? (
          <motion.div key="w" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="relative py-2">
            <ShimmerText className="text-sm">Reading {state.prospects.length} prospects, tasks and meetings…</ShimmerText>
          </motion.div>
        ) : (
          <motion.ol key={live ? "ai" : "rules"} className="relative grid gap-2.5 md:grid-cols-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {lines.map((l, i) => (
              <motion.li
                key={`${i}-${l.slice(0, 12)}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...spring.smooth, delay: i * stagger.base }}
                className="flex gap-3 text-sm leading-relaxed"
              >
                <span className="mt-0.5 font-mono text-[11px] tabular-nums text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
                <span className="text-pretty">{link(l)}</span>
              </motion.li>
            ))}
          </motion.ol>
        )}
      </AnimatePresence>
    </Card>
  )
}
