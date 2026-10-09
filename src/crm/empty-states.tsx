/**
 * Empty states for every screen.
 *
 * Shown in two situations:
 *  - the team workspace is not set up yet (every screen explains itself and
 *    offers setup, so a click in the sidebar always lands somewhere), and
 *  - the workspace is set up but this screen has nothing in it yet.
 * Each one says what the screen is for, why it is empty and what to do next,
 * with a faint preview of the screen once it fills up.
 */
import * as React from "react"
import { ArrowRight, Check, FlaskConical, Plus, Upload, Zap } from "lucide-react"
import { motion } from "motion/react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { spring, stagger } from "@/lib/motion"

import { useStore } from "./store"

export type FeatureKey = "inbox" | "pipeline" | "prospects" | "companies" | "reports" | "automations" | "sequences"

type Copy = {
  eyebrow: string
  title: string
  body: string
  points: string[]
  /** What fills this screen once the workspace is in use. */
  fills: string
}

const COPY: Record<FeatureKey, Copy> = {
  inbox: {
    eyebrow: "Inbox",
    title: "Work lands here when it needs a person.",
    body: "Tasks from your automations, sequence steps and anything you add yourself appear here, with what is overdue at the top.",
    points: ["Time left on every task, like a support queue", "Snooze to tomorrow or next week", "Updates when a rule runs or a meeting is booked"],
    fills: "Fills up as soon as prospects arrive and your rules create tasks.",
  },
  pipeline: {
    eyebrow: "Pipeline",
    title: "See every deal by stage.",
    body: "Each prospect becomes a card you can drag from Researching to Won. Moving a card can set off your automations.",
    points: ["Value and lead score on every card", "Cold and overdue deals flagged", "Undo any move from the toast"],
    fills: "Cards appear here once you add or import prospects.",
  },
  prospects: {
    eyebrow: "Prospects",
    title: "Everyone you are courting, in one table.",
    body: "Sort by lead score, filter by owner or industry, and move or remove many deals at once.",
    points: ["Lead score from 0 to 100, with the reasons", "Saved views for hot, due and cold deals", "Bulk stage changes"],
    fills: "Rows appear here once you add or import prospects.",
  },
  companies: {
    eyebrow: "Companies",
    title: "Organisations, with their people and deals.",
    body: "Each company keeps everyone you know there and every deal you have with them, so two contacts at one firm never get muddled.",
    points: ["Several people per company", "Every deal, open or closed", "Notes on who decides and what they care about"],
    fills: "Companies are created when you add or import prospects.",
  },
  reports: {
    eyebrow: "Reports",
    title: "Reports fill in as you work.",
    body: "Win rate, a forecast by close month, where deals stall and who is closing. They need a handful of deals before they say anything useful.",
    points: ["Forecast weighted by stage", "Conversion and time in each stage", "Results by owner and by source"],
    fills: "Numbers appear here once deals start moving through stages.",
  },
  automations: {
    eyebrow: "Automations",
    title: "Rules that do the busywork.",
    body: "When something happens, like a reply or a deal going quiet, a rule creates the task, moves the stage or tells the right person.",
    points: ["Nine ready-made rules to start from", "Describe a rule in plain English", "A full history of every run"],
    fills: "Your starter rules are added when the workspace is set up.",
  },
  sequences: {
    eyebrow: "Sequences",
    title: "Outreach that keeps its own rhythm.",
    body: "A sequence is a set of steps over days: an email, a call, a follow-up. Each step lands in the owner's Inbox on its day and stops when they reply.",
    points: ["Cold outreach, revive and proposal chaser", "Stops automatically on a reply", "Enrol by hand or from a rule"],
    fills: "Three starter sequences are added when the workspace is set up.",
  },
}

export function FeatureEmpty({
  feature,
  onImport,
  onAdd,
  primary,
}: {
  feature: FeatureKey
  onImport?: () => void
  onAdd?: () => void
  /** Overrides the default next step once the workspace is ready. */
  primary?: { label: string; onClick: () => void }
}) {
  const { mode, workspace, canWrite, setupWorkspace, setMode } = useStore()
  const [busy, setBusy] = React.useState(false)
  const c = COPY[feature]
  const needsSetup = mode === "workspace" && workspace === "setup"

  const setup = async () => {
    setBusy(true)
    try {
      await setupWorkspace()
      toast.success("Workspace ready", { description: feature === "automations" || feature === "sequences" ? "Your starters are in. Have a look." : "Import a spreadsheet or add your first prospect." })
    } catch {
      toast("Setup did not finish. Try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-10 md:px-8 lg:grid-cols-[1fr_1.05fr] lg:items-center lg:py-16 [&>*]:min-w-0">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-3">
          <p className="eyebrow text-muted-foreground">{c.eyebrow}</p>
          <h1 className="font-display text-4xl font-light tracking-[-0.02em] text-balance md:text-5xl">{c.title}</h1>
          <p className="max-w-lg text-sm leading-relaxed text-muted-foreground">{c.body}</p>
        </div>

        <ul className="flex flex-col gap-2">
          {c.points.map((p, i) => (
            <motion.li key={p} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ ...spring.smooth, delay: 0.1 + i * stagger.base }} className="flex items-start gap-2.5 text-sm">
              <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-sm bg-brand/10 text-brand">
                <Check className="size-3" />
              </span>
              {p}
            </motion.li>
          ))}
        </ul>

        <div className="flex flex-col gap-3 border-t pt-5">
          <p className="text-xs text-muted-foreground">
            {needsSetup ? "The team workspace is not set up yet. Setting it up takes one click and adds no sample data." : c.fills}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {needsSetup ? (
              canWrite ? (
                <>
                  <Button loading={busy} onClick={setup}>
                    Set up the workspace <ArrowRight />
                  </Button>
                  <Button variant="ghost" onClick={() => setMode("demo")}>
                    <FlaskConical /> See it in the demo
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">Ask the workspace owner to set it up.</p>
                  <Button variant="ghost" onClick={() => setMode("demo")}>
                    <FlaskConical /> See it in the demo
                  </Button>
                </>
              )
            ) : primary ? (
              <Button onClick={primary.onClick} disabled={!canWrite}>
                <Plus /> {primary.label}
              </Button>
            ) : (
              <>
                {onImport ? (
                  <Button onClick={onImport} disabled={!canWrite}>
                    <Upload /> Import a spreadsheet
                  </Button>
                ) : null}
                {onAdd ? (
                  <Button variant="outline" onClick={onAdd} disabled={!canWrite}>
                    <Plus /> Add a prospect
                  </Button>
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>

      <Preview feature={feature} />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Ghost previews: the screen's shape, drawn faintly                    */
/* ------------------------------------------------------------------ */

function Bar({ className }: { className?: string }) {
  return <span className={cn("block h-2 rounded-sm bg-muted", className)} />
}

const item = (i: number) => ({
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { ...spring.smooth, delay: 0.15 + i * stagger.base },
})

function Preview({ feature }: { feature: FeatureKey }) {
  return (
    <div aria-hidden className="relative overflow-hidden rounded-lg border bg-surface p-5 select-none md:p-6">
      <div className="pointer-events-none absolute inset-0 bg-dots opacity-60" />
      <div className="relative">
        <p className="mb-4 font-mono text-[10px] tracking-wider text-muted-foreground uppercase">Preview</p>
        {feature === "pipeline" ? (
          <div className="grid grid-cols-4 gap-2">
            {[3, 2, 2, 1].map((n, col) => (
              <motion.div key={col} {...item(col)} className="flex flex-col gap-2 rounded-md border bg-card/70 p-2">
                <Bar className="w-2/3" />
                {Array.from({ length: n }).map((_, k) => (
                  <div key={k} className="flex flex-col gap-1.5 rounded-sm border bg-card p-2">
                    <Bar className={k === 0 && col === 3 ? "w-4/5 bg-primary/30" : "w-4/5"} />
                    <Bar className="h-1.5 w-1/2" />
                  </div>
                ))}
              </motion.div>
            ))}
          </div>
        ) : feature === "reports" ? (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-3 gap-2">
              {[0, 1, 2].map((i) => (
                <motion.div key={i} {...item(i)} className="flex flex-col gap-2 rounded-md border bg-card p-3">
                  <Bar className="h-1.5 w-1/2" />
                  <Bar className="h-4 w-2/3" />
                </motion.div>
              ))}
            </div>
            <div className="flex h-36 items-end gap-2 rounded-md border bg-card p-3">
              {[45, 70, 60, 85, 35, 55].map((h, i) => (
                <motion.span key={i} className="relative flex-1 origin-bottom bg-primary/15" style={{ height: `${h}%` }} initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ ...spring.smooth, delay: 0.2 + i * stagger.tight }}>
                  <span className="absolute inset-x-0 bottom-0 h-1/2 bg-primary/35" />
                </motion.span>
              ))}
            </div>
          </div>
        ) : feature === "automations" ? (
          <div className="flex flex-col gap-2">
            {[
              ["w-24", ["w-20", "w-28"]],
              ["w-32", ["w-24"]],
              ["w-20", ["w-16", "w-24", "w-14"]],
            ].map(([t, acts], i) => (
              <motion.div key={i} {...item(i)} className="flex flex-wrap items-center gap-2 rounded-md border bg-card p-3">
                <span className="relative h-4 w-7 rounded-sm bg-primary/40">
                  <span className="absolute top-0.5 right-0.5 size-3 rounded-sm bg-card" />
                </span>
                <span className="inline-flex items-center gap-1 rounded-sm border border-brand/25 bg-brand/10 px-1.5 py-1">
                  <Zap className="size-3 text-brand/60" />
                  <Bar className={cn("h-1.5 bg-brand/30", t as string)} />
                </span>
                <span className="text-muted-foreground/60">→</span>
                {(acts as string[]).map((w, k) => (
                  <span key={k} className="rounded-sm border bg-surface px-1.5 py-1">
                    <Bar className={cn("h-1.5", w)} />
                  </span>
                ))}
              </motion.div>
            ))}
          </div>
        ) : feature === "sequences" ? (
          <motion.div {...item(0)} className="rounded-md border bg-card p-4">
            <Bar className="mb-4 h-3 w-1/3" />
            <div className="relative grid grid-cols-5 gap-2">
              <span className="absolute top-[1.65rem] right-2 left-2 h-px bg-border" />
              {[0, 2, 5, 9, 14].map((d, i) => (
                <motion.div key={d} {...item(i + 1)} className="relative flex flex-col gap-2">
                  <span className="font-mono text-[10px] text-muted-foreground/70">Day {d}</span>
                  <span className={cn("relative z-10 size-6 rounded-md border bg-card", i < 2 && "border-brand/40 bg-brand/10")} />
                  <Bar className="h-1.5 w-full" />
                  <Bar className="h-1.5 w-2/3" />
                </motion.div>
              ))}
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2">
              {[0, 1].map((i) => (
                <div key={i} className="flex items-center gap-2 rounded-sm border bg-surface p-2">
                  <span className="size-5 rounded-sm bg-muted" />
                  <Bar className="flex-1" />
                  <span className="flex gap-0.5">{[0, 1, 2, 3, 4].map((k) => <span key={k} className={cn("h-3 w-1", k <= i + 1 ? "bg-primary/40" : "bg-muted")} />)}</span>
                </div>
              ))}
            </div>
          </motion.div>
        ) : (
          // inbox, prospects, companies: rows
          <div className="overflow-hidden rounded-md border bg-card">
            {feature !== "inbox" ? (
              <div className="flex gap-3 border-b bg-surface px-3 py-2.5">
                {["w-16", "w-12", "w-10", "w-14"].map((w, i) => <Bar key={i} className={cn("h-1.5", w)} />)}
              </div>
            ) : null}
            {[0, 1, 2, 3, 4].map((i) => (
              <motion.div key={i} {...item(i)} className="flex items-center gap-3 border-b px-3 py-3 last:border-0">
                {feature === "inbox" ? <span className="size-3.5 rounded-sm border" /> : null}
                <span className="size-6 shrink-0 rounded-md bg-muted" />
                <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <Bar className={["w-2/5", "w-1/2", "w-1/3", "w-3/5", "w-2/5"][i]} />
                  <Bar className="h-1.5 w-1/4" />
                </span>
                {feature === "inbox" ? (
                  <span className={cn("h-2 w-10 rounded-sm", i === 0 ? "bg-destructive/30" : i === 1 ? "bg-warning/30" : "bg-muted")} />
                ) : feature === "prospects" ? (
                  <span className="flex w-10 flex-col gap-1">
                    <Bar className="h-1.5 w-6" />
                    <span className="h-0.5 w-full bg-muted"><span className="block h-full bg-primary/40" style={{ width: `${[85, 70, 55, 40, 30][i]}%` }} /></span>
                  </span>
                ) : (
                  <span className="flex -space-x-1.5">
                    {[0, 1].map((k) => <span key={k} className="size-5 rounded-full border-2 border-card bg-muted" />)}
                  </span>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
