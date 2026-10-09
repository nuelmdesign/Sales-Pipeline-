import * as React from "react"
import { CalendarCheck, Copy, ListOrdered, Mail, Phone, Plus, RefreshCw, Send, Sparkles, X } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { toast } from "sonner"

import { RecommendationCard, type RecommendationOption } from "@/components/agents/recommendation-card"
import { Drawer } from "@/components/motion/drawer"
import { ShimmerText } from "@/components/motion/shimmer-text"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { spring } from "@/lib/motion"

import {
  draftPrompt,
  errorCopy,
  fallbackDraft,
  fallbackNBA,
  fallbackSummary,
  isPermanent,
  nbaPrompt,
  summaryPrompt,
  useAI,
  type NBA,
} from "./ai"
import { ACTIVITY_ICON, AIMark, CompanyMark, ScoreRing, StageBadge } from "./bits"
import { BookMeetingDialog } from "./book-meeting"
import { PeopleList } from "./companies"
import {
  OWNERS,
  STAGES,
  at,
  clock,
  daysFromToday,
  owner,
  relative,
  scoreBreakdown,
  money,
  shortDate,
  stageLabel,
  stageProbability,
  type ActivityKind,
  type OwnerId,
  type Prospect,
  type StageId,
} from "./data"
import { TaskRow } from "./inbox"
import { useStore } from "./store"

const QUICK: { kind: ActivityKind; label: string; icon: typeof Mail; text: string }[] = [
  { kind: "email", label: "Email", icon: Mail, text: "Sent a follow-up email" },
  { kind: "call", label: "Call", icon: Phone, text: "Logged a call" },
]

export function ProspectDrawer({ id, onClose, onOpenCompany }: { id: string | null; onClose: () => void; onOpenCompany?: (companyId: string) => void }) {
  const { state, get, update, moveStage, log, enroll, unenroll, addTask, setPrimaryContact, saveContact } = useStore()
  const p = id ? get(id) : undefined
  const last = React.useRef(p)
  if (p) last.current = p
  const shown = p ?? last.current
  const [booking, setBooking] = React.useState<Prospect | null>(null)
  const [aiTab, setAiTab] = React.useState("summary")
  const [draftIntent, setDraftIntent] = React.useState<string | null>(null)
  const [newTask, setNewTask] = React.useState("")

  React.useEffect(() => {
    setAiTab("summary")
    setDraftIntent(null)
    setNewTask("")
  }, [id])

  const tasks = shown ? state.tasks.filter((t) => t.prospectId === shown.id && !t.done).sort((a, b) => a.due.localeCompare(b.due)) : []
  const meetings = shown ? state.meetings.filter((m) => m.prospectId === shown.id && daysFromToday(m.at) >= 0) : []
  const seq = shown?.enrollment ? state.sequences.find((s) => s.id === shown.enrollment!.sequenceId) : undefined
  const breakdown = shown ? scoreBreakdown(shown) : null

  return (
    <>
      <Drawer
        open={Boolean(id && p)}
        onOpenChange={(o) => !o && onClose()}
        side="right"
        ariaLabel={shown ? `${shown.company} details` : "Prospect details"}
        className="w-[min(34rem,100vw)] max-w-full overflow-y-auto"
      >
        {shown && breakdown ? (
          <div className="flex flex-col">
            <div className="sticky top-0 z-20 flex items-center justify-between border-b bg-background px-6 py-3">
              <p className="eyebrow text-muted-foreground">{shown.industry} · {shown.city}</p>
              <Button variant="ghost" size="icon-sm" aria-label="Close" onClick={onClose}>
                <X />
              </Button>
            </div>

            {/* Identity */}
            <div className="flex flex-col gap-5 px-6 pt-6 pb-5">
              <div className="flex items-start gap-3">
                <CompanyMark name={shown.company} className="size-11" />
                <div className="min-w-0 flex-1">
                  <h2 className="font-display text-3xl font-light tracking-[-0.02em]">{shown.company}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{shown.contact}, {shown.role}</p>
                  <button
                    type="button"
                    className="mt-0.5 inline-flex items-center gap-1.5 font-mono text-xs text-brand hover:underline"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(shown.email)
                        toast("Email address copied")
                      } catch {
                        toast(shown.email, { description: "Copy the address from here." })
                      }
                    }}
                  >
                    {shown.email} <Copy className="size-3" />
                  </button>
                </div>
                <ScoreRing score={breakdown.score} />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <StageBadge stage={shown.stage} />
                <span className="font-mono text-[11px] text-muted-foreground">Owner {owner(shown.owner).name}</span>
                {seq ? (
                  <span className="inline-flex items-center gap-1 font-mono text-[11px] text-brand">
                    <ListOrdered className="size-3" /> {seq.name} · step {shown.enrollment!.step + 1}/{seq.steps.length}
                  </span>
                ) : null}
              </div>

              <div className="grid grid-cols-3 gap-2">
                {QUICK.map((q) => (
                  <Button
                    key={q.kind}
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      log(shown.id, q.kind, q.text)
                      toast.success(q.text, { description: `${shown.company}. Score and rules updated.` })
                    }}
                  >
                    <q.icon /> {q.label}
                  </Button>
                ))}
                <Button size="sm" onClick={() => setBooking(shown)}>
                  <CalendarCheck /> Book
                </Button>
              </div>
            </div>

            {/* AI */}
            <section className="border-y bg-surface px-6 py-5">
              <AIPanel
                prospect={shown}
                tab={aiTab}
                onTab={setAiTab}
                intent={draftIntent}
                onAccept={(o) => {
                  switch (o.kind) {
                    case "email":
                      setDraftIntent(o.action)
                      setAiTab("draft")
                      break
                    case "meeting":
                      setBooking(shown)
                      break
                    default:
                      if (o.kind === "stage" && o.stage && STAGES.some((s) => s.id === o.stage)) {
                        moveStage(shown.id, o.stage as StageId)
                        toast(`Moved to ${stageLabel(o.stage as StageId)}`)
                      } else {
                        addTask({ prospectId: shown.id, title: o.action, due: at(0, 17), owner: shown.owner, priority: "normal", source: { kind: "ai" } })
                        toast.success("Added to your Inbox", { description: o.action })
                      }
                  }
                }}
              />
            </section>

            {/* People */}
            <section className="flex flex-col gap-3 px-6 pt-5">
              <div className="flex items-center justify-between">
                <span className="eyebrow text-muted-foreground">People on this deal <span className="font-mono tabular-nums">{shown.contactIds.length}</span></span>
                {onOpenCompany ? (
                  <button type="button" onClick={() => onOpenCompany(shown.companyId)} className="text-xs text-brand hover:underline">View {shown.company}</button>
                ) : null}
              </div>
              <PeopleList
                companyId={shown.companyId}
                dealId={shown.id}
                people={shown.contactIds.map((cid) => state.contacts.find((c) => c.id === cid)).filter((c): c is NonNullable<typeof c> => Boolean(c))}
                primaryId={shown.contactIds[0]}
                onMakePrimary={(cid) => {
                  setPrimaryContact(shown.id, cid)
                  toast("Main contact updated")
                }}
                onUnlink={(cid) => update(shown.id, { contactIds: shown.contactIds.filter((x) => x !== cid) })}
              />
              {(() => {
                const others = state.contacts.filter((c) => c.companyId === shown.companyId && !shown.contactIds.includes(c.id))
                if (!others.length) return null
                return (
                  <Select
                    value=""
                    onValueChange={(cid) => {
                      const c = state.contacts.find((x) => x.id === cid)
                      if (c) {
                        saveContact(c, shown.id)
                        toast.success(`${c.name} added to this deal`)
                      }
                    }}
                  >
                    <SelectTrigger aria-label="Add someone from this company" className="h-8 w-fit text-xs text-muted-foreground">
                      <SelectValue placeholder={`Add from ${shown.company} (${others.length})`} />
                    </SelectTrigger>
                    <SelectContent>
                      {others.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}{c.role ? `, ${c.role}` : ""}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )
              })()}
            </section>

            {/* Score */}
            <section className="flex flex-col gap-3 px-6 py-5">
              <div className="flex items-center justify-between">
                <span className="eyebrow text-muted-foreground">Why this score</span>
                <span className="font-mono text-[11px] text-muted-foreground">{breakdown.score} / 100</span>
              </div>
              <ul className="grid gap-2">
                {breakdown.factors.map((f) => (
                  <li key={f.key} className="grid grid-cols-[8.5rem_1fr_auto] items-center gap-3 text-xs">
                    <span className="truncate text-muted-foreground">{f.label}</span>
                    <span className="h-1.5 bg-muted">
                      <motion.span className="block h-full origin-left bg-primary" initial={{ scaleX: 0 }} animate={{ scaleX: f.points / f.max }} transition={spring.smooth} />
                    </span>
                    <span className="w-28 truncate text-right font-mono text-[11px] text-muted-foreground">{f.points}/{f.max} · {f.note}</span>
                  </li>
                ))}
              </ul>
            </section>

            {/* Fields */}
            <dl className="grid grid-cols-2 gap-x-4 gap-y-4 border-y bg-surface px-6 py-5">
              <Field label="Stage" htmlFor="d-stage">
                <Select value={shown.stage} onValueChange={(v) => { moveStage(shown.id, v as StageId); toast(`Moved to ${stageLabel(v as StageId)}`) }}>
                  <SelectTrigger id="d-stage" className="w-full bg-card"><SelectValue /></SelectTrigger>
                  <SelectContent>{STAGES.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Est. value (USD)" htmlFor="d-value">
                <Input id="d-value" type="number" inputMode="numeric" min={0} step={1000} value={shown.value} onChange={(e) => update(shown.id, { value: Math.max(0, Number(e.target.value) || 0) })} className="bg-card font-mono tabular-nums" />
              </Field>
              <Field label="Fit" htmlFor="d-fit">
                <Select value={String(shown.fit)} onValueChange={(v) => update(shown.id, { fit: Number(v) })}>
                  <SelectTrigger id="d-fit" className="w-full bg-card"><SelectValue /></SelectTrigger>
                  <SelectContent>{[5, 4, 3, 2, 1].map((n) => <SelectItem key={n} value={String(n)}>{n} of 5</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Owner" htmlFor="d-owner">
                <Select value={shown.owner} onValueChange={(v) => update(shown.id, { owner: v as OwnerId })}>
                  <SelectTrigger id="d-owner" className="w-full bg-card"><SelectValue /></SelectTrigger>
                  <SelectContent>{OWNERS.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Expected close" htmlFor="d-close">
                <Input
                  id="d-close"
                  type="date"
                  value={shown.expectedClose ? shown.expectedClose.slice(0, 10) : ""}
                  onChange={(e) => update(shown.id, { expectedClose: e.target.value ? new Date(`${e.target.value}T12:00:00`).toISOString() : null })}
                  className="bg-card font-mono text-xs"
                  disabled={shown.stage === "won" || shown.stage === "lost"}
                />
              </Field>
              <Field label={shown.closedAt ? "Closed" : "Weighted value"} htmlFor="d-weighted">
                <span id="d-weighted" className="flex h-9 items-center font-mono text-sm tabular-nums text-muted-foreground">
                  {shown.closedAt ? shortDate(shown.closedAt) : money(Math.round(shown.value * stageProbability(shown.stage)))}
                </span>
              </Field>
              <Field label="Sequence" htmlFor="d-seq" className="col-span-2">
                <div className="flex gap-2">
                  <Select
                    value={shown.enrollment?.sequenceId ?? "none"}
                    onValueChange={(v) => {
                      if (v === "none") { unenroll(shown.id); toast("Removed from sequence") }
                      else { enroll(shown.id, v); toast.success(`Enrolled in "${state.sequences.find((s) => s.id === v)?.name}"`, { description: "First step is in the Inbox." }) }
                    }}
                  >
                    <SelectTrigger id="d-seq" className="w-full bg-card"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not in a sequence</SelectItem>
                      {state.sequences.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </Field>
              <div className="col-span-2 flex flex-wrap gap-x-6 gap-y-1 font-mono text-[11px] text-muted-foreground">
                <span>Source: {shown.source}</span>
                <span>Added {shortDate(shown.createdAt)}</span>
                <span>Last touch {relative(shown.lastTouch).toLowerCase()}</span>
              </div>
            </dl>

            {/* Tasks + meetings */}
            <section className="flex flex-col gap-3 px-6 py-5">
              <div className="flex items-center gap-2 text-muted-foreground">
                <span className="eyebrow">Open tasks</span>
                <span className="font-mono text-[11px] tabular-nums">{tasks.length}</span>
              </div>
              <div className="overflow-hidden rounded-lg border">
                <ul className="divide-y">
                  <AnimatePresence initial={false}>
                    {tasks.map((t) => <TaskRow key={t.id} task={t} onOpen={() => {}} compact />)}
                  </AnimatePresence>
                </ul>
                <form
                  className={cn("flex items-center gap-2 p-2", tasks.length && "border-t")}
                  onSubmit={(e) => {
                    e.preventDefault()
                    if (!newTask.trim()) return
                    addTask({ prospectId: shown.id, title: newTask.trim(), due: at(1, 9), owner: shown.owner, priority: "normal", source: { kind: "manual" } })
                    setNewTask("")
                    toast.success("Task added for tomorrow")
                  }}
                >
                  <Input id="d-task" aria-label="New task" placeholder="Add a task" value={newTask} onChange={(e) => setNewTask(e.target.value)} className="h-8 border-0 bg-transparent shadow-none focus-visible:ring-0" />
                  <Button type="submit" variant="ghost" size="icon-sm" aria-label="Add task" disabled={!newTask.trim()}><Plus /></Button>
                </form>
              </div>
              {meetings.length ? (
                <ul className="grid gap-2">
                  {meetings.map((m) => (
                    <li key={m.id} className="flex items-center gap-3 rounded-md border border-brand/25 bg-brand/5 px-3 py-2 text-sm">
                      <CalendarCheck className="size-4 text-brand" />
                      <span className="min-w-0 flex-1 truncate">{m.title}</span>
                      <span className="font-mono text-[11px] text-muted-foreground">{relative(m.at)} {clock(m.at)} · {m.minutes}m</span>
                      {m.meetUrl ? <a href={m.meetUrl} target="_blank" rel="noreferrer" className="font-mono text-[11px] text-brand hover:underline">Meet</a> : null}
                      {m.calendarLink ? <a href={m.calendarLink} target="_blank" rel="noreferrer" className="font-mono text-[11px] text-brand hover:underline">Calendar</a> : null}
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>

            {/* Activity */}
            <section className="flex flex-col gap-4 border-t px-6 pt-5 pb-10">
              <span className="eyebrow text-muted-foreground">Activity</span>
              <ol className="relative flex flex-col gap-4 before:absolute before:top-2 before:bottom-2 before:left-3 before:w-px before:bg-border">
                <AnimatePresence initial={false}>
                  {shown.activities.slice(0, 20).map((a) => {
                    const Icon = ACTIVITY_ICON[a.kind] ?? Mail
                    return (
                      <motion.li key={a.id} layout initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={spring.smooth} className="relative flex gap-3">
                        <span className={cn("z-10 grid size-6 shrink-0 place-items-center rounded-md border bg-background", a.kind === "automation" || a.kind === "ai" ? "text-brand" : "text-muted-foreground")}>
                          <Icon aria-hidden className="size-3.5" />
                        </span>
                        <div className="min-w-0 flex-1 pt-0.5">
                          <p className="text-sm">{a.text}</p>
                          <p className="font-mono text-[11px] text-muted-foreground">{shortDate(a.at)} · {relative(a.at)}{a.by ? ` · ${owner(a.by).first}` : a.kind === "automation" ? " · Automation" : ""}</p>
                        </div>
                      </motion.li>
                    )
                  })}
                </AnimatePresence>
              </ol>
            </section>
          </div>
        ) : null}
      </Drawer>
      <BookMeetingDialog prospect={booking} onClose={() => setBooking(null)} />
    </>
  )
}

function Field({ label, htmlFor, className, children }: { label: string; htmlFor: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <Label htmlFor={htmlFor} className="eyebrow text-[11px] leading-none font-normal text-muted-foreground">{label}</Label>
      {children}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* AI panel                                                             */
/* ------------------------------------------------------------------ */

const INTENTS = ["Follow up on our last conversation", "Re-engage after going quiet", "Nudge on the proposal", "Ask for a short call", "Say thank you after the meeting"]
const TONES = ["Warm", "Direct", "Formal"]

function AIPanel({
  prospect: p,
  tab,
  onTab,
  intent,
  onAccept,
}: {
  prospect: Prospect
  tab: string
  onTab: (t: string) => void
  intent: string | null
  onAccept: (o: NBA) => void
}) {
  const ai = useAI()
  const live = ai.status === "ready"
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-medium">
          <Sparkles className="size-4 text-brand" /> Deal assistant
        </span>
        <AIMark live={live} />
      </div>
      <Tabs value={tab} onValueChange={onTab}>
        <TabsList>
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="next">Next best action</TabsTrigger>
          <TabsTrigger value="draft">Draft email</TabsTrigger>
        </TabsList>
        <TabsContent value="summary" className="pt-3"><Summary prospect={p} /></TabsContent>
        <TabsContent value="next" className="pt-3"><NextBest prospect={p} onAccept={onAccept} /></TabsContent>
        <TabsContent value="draft" className="pt-3"><Draft prospect={p} initialIntent={intent} /></TabsContent>
      </Tabs>
    </div>
  )
}

function useAsk() {
  const ai = useAI()
  const ctl = React.useRef<AbortController | null>(null)
  React.useEffect(() => () => ctl.current?.abort(), [])
  return {
    ai,
    stop: () => ctl.current?.abort(),
    async text(prompt: string, onText: (t: string) => void, opts: Record<string, unknown> = {}) {
      if (!ai.sample) throw { code: "not_granted" }
      ctl.current?.abort()
      ctl.current = new AbortController()
      const r = await ai.sample(prompt, { signal: ctl.current.signal, onText: ({ text }: { text: string }) => onText(text), ...opts })
      return r.text
    },
    async json<T>(prompt: string, opts: Record<string, unknown> = {}) {
      if (!ai.sample) throw { code: "not_granted" }
      ctl.current?.abort()
      ctl.current = new AbortController()
      return ai.sample.json<T>(prompt, { signal: ctl.current.signal, ...opts })
    },
  }
}

function Thinking({ children }: { children: string }) {
  return <ShimmerText className="text-sm">{children}</ShimmerText>
}

function Summary({ prospect: p }: { prospect: Prospect }) {
  const { state, log } = useStore()
  const ask = useAsk()
  const [text, setText] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [waiting, setWaiting] = React.useState(false)

  React.useEffect(() => { setText(""); setBusy(false) }, [p.id])

  const run = async () => {
    setBusy(true)
    setWaiting(true)
    setText("")
    try {
      const out = await ask.text(summaryPrompt(state, p), (t) => { setWaiting(false); setText(t) }, { modelTier: "quick", cache: { gcTime: 600_000 } })
      setText(out)
    } catch (e) {
      if (isPermanent(e)) ask.ai.disable()
      const code = (e as { code?: string })?.code
      if (code !== "cancelled") {
        if (ask.ai.sample && !isPermanent(e)) toast(errorCopy(e))
        setText(fallbackSummary(state, p))
      }
    } finally {
      setBusy(false)
      setWaiting(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <AnimatePresence mode="wait">
        {waiting ? (
          <motion.div key="t" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><Thinking>Reading the deal history…</Thinking></motion.div>
        ) : text ? (
          <motion.p key="s" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="text-sm leading-relaxed text-pretty">{text}</motion.p>
        ) : (
          <motion.p key="e" className="text-sm text-muted-foreground">Get a three-sentence read on where this deal stands, its main risk and what to do next.</motion.p>
        )}
      </AnimatePresence>
      <div className="flex gap-2">
        {busy ? (
          <Button variant="outline" size="sm" onClick={ask.stop}>Stop</Button>
        ) : (
          <Button variant="outline" size="sm" onClick={run}>
            {text ? <RefreshCw /> : <Sparkles />} {text ? "Refresh" : "Summarise"}
          </Button>
        )}
        {text && !busy ? (
          <Button variant="ghost" size="sm" onClick={() => { log(p.id, "ai", `Summary: ${text}`); toast("Saved to activity") }}>Save to activity</Button>
        ) : null}
      </div>
    </div>
  )
}

function NextBest({ prospect: p, onAccept }: { prospect: Prospect; onAccept: (o: NBA) => void }) {
  const { state } = useStore()
  const ask = useAsk()
  const [items, setItems] = React.useState<NBA[] | null>(null)
  const [busy, setBusy] = React.useState(false)

  React.useEffect(() => { setItems(null) }, [p.id])

  const run = async () => {
    setBusy(true)
    try {
      const raw = await ask.json<NBA[]>(nbaPrompt(state, p), { modelTier: "default" })
      const list = (Array.isArray(raw) ? raw : []).filter((x) => x && typeof x.action === "string").slice(0, 3)
      setItems(list.length ? list : fallbackNBA(state, p))
    } catch (e) {
      if (isPermanent(e)) ask.ai.disable()
      if ((e as { code?: string })?.code !== "cancelled") {
        if (ask.ai.sample && !isPermanent(e)) toast(errorCopy(e))
        setItems(fallbackNBA(state, p))
      }
    } finally {
      setBusy(false)
    }
  }

  const options: RecommendationOption[] | undefined = items?.map((x, i) => {
    const signal = Math.max(0, Math.min(3, Math.round(Number(x.confidence) || 0)))
    return {
      key: String(i),
      body: (
        <span>
          <span className="font-medium text-foreground">{x.action}</span>
          <span className="block text-muted-foreground">{x.why}</span>
        </span>
      ),
      short: x.action,
      signal,
      tone: signal >= 3 ? "success" : signal >= 2 ? "warning" : "muted",
      label: signal >= 3 ? "High confidence" : signal >= 2 ? "Worth doing" : "Low signal",
      cta: x.kind === "email" ? "Draft it" : x.kind === "meeting" ? "Book it" : x.kind === "stage" ? "Move stage" : "Add to Inbox",
      ctaVariant: i === 0 ? "default" : "outline",
    }
  })

  if (busy) return <Thinking>Weighing the options…</Thinking>
  if (!options)
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">Three ranked moves for this deal, each one click to act on.</p>
        <Button variant="outline" size="sm" className="w-fit" onClick={run}><Sparkles /> Suggest next moves</Button>
      </div>
    )
  return (
    <div className="flex flex-col gap-2">
      <RecommendationCard
        key={options.map((o) => o.short).join("|")}
        options={options}
        labels={{ title: `Best next move for ${p.company}`, alternatives: "Alternatives", otherOptions: "Other moves", accepted: "Done" }}
        onAccept={(key) => items && onAccept(items[Number(key)])}
        className="w-full max-w-none"
      />
      <Button variant="ghost" size="sm" className="w-fit text-muted-foreground" onClick={run}><RefreshCw /> Try again</Button>
    </div>
  )
}

function Draft({ prospect: p, initialIntent }: { prospect: Prospect; initialIntent: string | null }) {
  const { state, log } = useStore()
  const ask = useAsk()
  const [intent, setIntent] = React.useState(initialIntent ?? INTENTS[0])
  const [tone, setTone] = React.useState("Warm")
  const [body, setBody] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [waiting, setWaiting] = React.useState(false)

  React.useEffect(() => { setBody("") }, [p.id])
  React.useEffect(() => { if (initialIntent) setIntent(initialIntent) }, [initialIntent])

  const run = async () => {
    setBusy(true)
    setWaiting(true)
    try {
      const out = await ask.text(draftPrompt(state, p, intent, tone), (t) => { setWaiting(false); setBody(t) }, { cache: false })
      setBody(out)
    } catch (e) {
      if (isPermanent(e)) ask.ai.disable()
      const err = e as { code?: string; text?: string }
      if (err?.code === "cancelled") setBody(err.text ?? body)
      else {
        if (ask.ai.sample && !isPermanent(e)) toast(errorCopy(e))
        setBody(fallbackDraft(p, intent))
      }
    } finally {
      setBusy(false)
      setWaiting(false)
    }
  }

  const intents = INTENTS.includes(intent) ? INTENTS : [intent, ...INTENTS]

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <Select value={intent} onValueChange={setIntent}>
          <SelectTrigger aria-label="Purpose" className="min-w-0 flex-1 basis-56 bg-card"><SelectValue /></SelectTrigger>
          <SelectContent>{intents.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={tone} onValueChange={setTone}>
          <SelectTrigger aria-label="Tone" className="w-28 bg-card"><SelectValue /></SelectTrigger>
          <SelectContent>{TONES.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="relative">
        <Textarea
          id="d-draft"
          aria-label="Email draft"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={`Pick a purpose and tone, then write. You can edit the draft before you log it.`}
          className="min-h-44 bg-card font-sans text-sm leading-relaxed"
        />
        {waiting ? (
          <div className="pointer-events-none absolute inset-x-3 top-3"><Thinking>{`Writing to ${p.contact.split(" ")[0]}…`}</Thinking></div>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {busy ? (
          <Button variant="outline" size="sm" onClick={ask.stop}>Stop</Button>
        ) : (
          <Button variant="outline" size="sm" onClick={run}>
            <Sparkles /> {body ? "Rewrite" : "Write draft"}
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          disabled={!body || busy}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(body)
              toast("Draft copied")
            } catch {
              toast("Select the draft and copy it by hand")
            }
          }}
        >
          <Copy /> Copy
        </Button>
        <Button
          size="sm"
          className="ml-auto"
          disabled={!body || busy}
          onClick={() => {
            const subject = body.split("\n")[0].replace(/^Subject:\s*/i, "")
            log(p.id, "email", `Sent: ${subject}`)
            toast.success("Logged as sent", { description: "Last touch, engagement and score updated." })
            setBody("")
          }}
        >
          <Send /> Log as sent
        </Button>
      </div>
    </div>
  )
}
