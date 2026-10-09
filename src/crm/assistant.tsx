import * as React from "react"
import { Brain, Sparkles, X, Zap } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"

import { AgentActivity, type AgentActivityItem } from "@/components/agents/agent-activity"
import {
  Message,
  MessageAvatar,
  MessageBubble,
  MessageBubbleContent,
  MessageContent,
  MessageGroup,
  MessageHeader,
} from "@/components/agents/message"
import { PromptInput } from "@/components/agents/prompt-input"
import { ShimmerText } from "@/components/motion/shimmer-text"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { spring } from "@/lib/motion"

import { errorCopy, fallbackBrief, isPermanent, pipelineContext, prospectLine, useAI } from "./ai"
import { AIMark } from "./bits"
import {
  STAGES,
  at,
  daysFromToday,
  isCold,
  isOpen,
  leadScore,
  money,
  owner,
  relative,
  stageLabel,
  type CRMState,
  type Prospect,
  type StageId,
} from "./data"
import { ME, useStore, type Store } from "./store"

type Turn = {
  id: string
  role: "user" | "assistant"
  text: string
  activity: AgentActivityItem[]
  status: "working" | "complete"
  error?: string
}

const SUGGESTIONS = [
  "What should I do first today?",
  "Which deals are at risk of slipping?",
  "Move Bumpa to Meeting booked",
  "Create a high-priority task to call Carbon tomorrow",
]

const MODELS = [
  { value: "quick", label: "Quick", icon: <Zap /> },
  { value: "default", label: "Balanced", icon: <Sparkles /> },
  { value: "complex", label: "Deep", icon: <Brain /> },
]

const RULES = `You are the assistant inside "Prospect", the CRM for OpenDraft Studio, a design studio. You talk to Emmanuel, the owner.
Answer in plain, friendly British-leaning English with short sentences and no em dashes. Be specific: name prospects, amounts and dates.
Use the tools to look things up or make changes when asked. Never invent prospects. Confirm what you changed in one line.
Keep answers under 120 words unless asked for more. Use simple "- " bullets for lists.`

/* ---------------- fuzzy lookup ---------------- */

function findProspect(s: CRMState, name: unknown): Prospect | undefined {
  const q = String(name ?? "").toLowerCase().trim()
  if (!q) return undefined
  return (
    s.prospects.find((p) => p.company.toLowerCase() === q) ??
    s.prospects.find((p) => p.company.toLowerCase().includes(q) || q.includes(p.company.toLowerCase())) ??
    s.prospects.find((p) => p.contact.toLowerCase().includes(q))
  )
}

function findStage(v: unknown): StageId | undefined {
  const q = String(v ?? "").toLowerCase()
  return STAGES.find((x) => x.id === q || x.label.toLowerCase() === q || q.includes(x.label.toLowerCase()) || q.includes(x.id))?.id
}

/* ---------------- tools the assistant can call ---------------- */

function buildTools(get: () => Store, record: (item: AgentActivityItem) => void) {
  const s = () => get().state
  return [
    {
      name: "find_prospects",
      description: "Search prospects. Returns a list with company, stage, value, lead score, owner, last touch and next step. All filters optional.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Text to match in company, contact, industry or city" },
          stage: { type: "string", description: "Stage id or label" },
          min_score: { type: "number" },
          only_open: { type: "boolean" },
        },
      },
      execute(input: Record<string, unknown>) {
        record({ id: crypto.randomUUID(), type: "tool", action: "read", target: input.query ? `Searched "${String(input.query)}"` : "Searched prospects" })
        const q = String(input.query ?? "").toLowerCase()
        const st = findStage(input.stage)
        return s()
          .prospects.filter((p) => (!q || [p.company, p.contact, p.industry, p.city].join(" ").toLowerCase().includes(q)) && (!st || p.stage === st) && (!input.min_score || leadScore(p) >= Number(input.min_score)) && (!input.only_open || isOpen(p)))
          .slice(0, 20)
          .map(prospectLine)
      },
    },
    {
      name: "list_tasks",
      description: "List open tasks. when: overdue, today, week or all. Returns title, prospect, due and owner.",
      inputSchema: { type: "object", properties: { when: { type: "string", enum: ["overdue", "today", "week", "all"] } } },
      execute(input: Record<string, unknown>) {
        const when = String(input.when ?? "all")
        record({ id: crypto.randomUUID(), type: "tool", action: "read", target: `Read ${when} tasks` })
        return s()
          .tasks.filter((t) => !t.done)
          .filter((t) => {
            const d = daysFromToday(t.due)
            return when === "overdue" ? d < 0 : when === "today" ? d <= 0 : when === "week" ? d <= 7 : true
          })
          .slice(0, 30)
          .map((t) => `${t.title} | ${s().prospects.find((p) => p.id === t.prospectId)?.company ?? "no prospect"} | due ${relative(t.due).toLowerCase()} | ${t.priority} | ${owner(t.owner).name}`)
      },
    },
    {
      name: "move_stage",
      description: "Move a prospect to a stage. This can trigger automations. Returns what happened.",
      inputSchema: { type: "object", properties: { company: { type: "string" }, stage: { type: "string" } }, required: ["company", "stage"] },
      execute(input: Record<string, unknown>) {
        const p = findProspect(s(), input.company)
        const st = findStage(input.stage)
        if (!p) throw new Error(`No prospect matches "${String(input.company)}"`)
        if (!st) throw new Error(`Unknown stage. Use one of ${STAGES.map((x) => x.label).join(", ")}`)
        const before = s().runs.length
        get().moveStage(p.id, st)
        record({ id: crypto.randomUUID(), type: "tool", action: "edit", target: `${p.company} → ${stageLabel(st)}` })
        return { moved: p.company, to: stageLabel(st), note: "Automations for this stage ran if enabled.", runs_before: before }
      },
    },
    {
      name: "create_task",
      description: "Create a task in the Inbox, optionally for a prospect.",
      inputSchema: {
        type: "object",
        properties: { company: { type: "string" }, title: { type: "string" }, due_in_days: { type: "number" }, priority: { type: "string", enum: ["high", "normal"] } },
        required: ["title"],
      },
      execute(input: Record<string, unknown>) {
        const p = input.company ? findProspect(s(), input.company) : undefined
        const days = Math.max(0, Number(input.due_in_days) || 0)
        get().addTask({ prospectId: p?.id ?? null, title: String(input.title), due: days === 0 ? at(0, 17) : at(days, 9), owner: p?.owner ?? ME, priority: input.priority === "high" ? "high" : "normal", source: { kind: "ai" } })
        record({ id: crypto.randomUUID(), type: "tool", action: "edit", target: `Task: ${String(input.title)}` })
        return { created: String(input.title), for: p?.company ?? "no prospect", due: days === 0 ? "today" : `in ${days} days` }
      },
    },
    {
      name: "log_activity",
      description: "Log an email, call or note on a prospect. Emails and calls count as contact and raise the lead score.",
      inputSchema: { type: "object", properties: { company: { type: "string" }, kind: { type: "string", enum: ["email", "call", "note"] }, text: { type: "string" } }, required: ["company", "kind", "text"] },
      execute(input: Record<string, unknown>) {
        const p = findProspect(s(), input.company)
        if (!p) throw new Error(`No prospect matches "${String(input.company)}"`)
        const kind = (["email", "call", "note"].includes(String(input.kind)) ? input.kind : "note") as "email"
        get().log(p.id, kind, String(input.text))
        record({ id: crypto.randomUUID(), type: "tool", action: "edit", target: `Logged ${kind} on ${p.company}` })
        return { logged: kind, on: p.company }
      },
    },
    {
      name: "run_automation_checks",
      description: "Check time-based automations now (cold deals, overdue next steps, lead score thresholds). Returns how many ran.",
      execute() {
        const n = get().runChecks()
        record({ id: crypto.randomUUID(), type: "tool", action: "run", target: `Automation checks: ${n} ran` })
        return { runs: n }
      },
    },
  ]
}

/* ---------------- offline answers ---------------- */

function offlineAnswer(text: string, store: Store): { reply: string; activity: AgentActivityItem[] } {
  const s = store.state
  const q = text.toLowerCase()
  const act: AgentActivityItem[] = []
  const move = q.match(/move (.+?) to (.+)/)
  if (move) {
    const p = findProspect(s, move[1])
    const st = findStage(move[2])
    if (p && st) {
      store.moveStage(p.id, st)
      act.push({ id: crypto.randomUUID(), type: "tool", action: "edit", target: `${p.company} → ${stageLabel(st)}` })
      return { reply: `Moved ${p.company} to ${stageLabel(st)}. Any rules for that stage have run.`, activity: act }
    }
  }
  if (/task|remind/.test(q)) {
    const p = s.prospects.find((x) => q.includes(x.company.toLowerCase()))
    const days = /tomorrow/.test(q) ? 1 : /next week/.test(q) ? 7 : 0
    const title = p ? (/call/.test(q) ? `Call ${p.contact.split(" ")[0]} at ${p.company}` : `Follow up with ${p.company}`) : text
    store.addTask({ prospectId: p?.id ?? null, title, due: days ? at(days, 9) : at(0, 17), owner: p?.owner ?? ME, priority: /high|urgent/.test(q) ? "high" : "normal", source: { kind: "ai" } })
    act.push({ id: crypto.randomUUID(), type: "tool", action: "edit", target: `Task: ${title}` })
    return { reply: `Added "${title}" to the Inbox, due ${days ? `in ${days} day${days > 1 ? "s" : ""}` : "today"}.`, activity: act }
  }
  if (/risk|slip|cold|quiet/.test(q)) {
    const list = s.prospects.filter((p) => isCold(p) || (isOpen(p) && p.nextDue && daysFromToday(p.nextDue) < 0)).sort((a, b) => b.value - a.value)
    act.push({ id: crypto.randomUUID(), type: "tool", action: "read", target: "Checked last touch and overdue next steps" })
    return {
      reply: list.length
        ? `These need attention:\n${list.map((p) => `- ${p.company}, ${money(p.value)}: ${isCold(p) ? `${-daysFromToday(p.lastTouch)} days without contact` : "next step overdue"}`).join("\n")}`
        : "Nothing is at risk right now. Every open deal has recent contact.",
      activity: act,
    }
  }
  act.push({ id: crypto.randomUUID(), type: "tool", action: "read", target: "Read tasks, scores and meetings" })
  const brief = fallbackBrief(s)
  return {
    reply: /first|today|priorit|focus|brief/.test(q)
      ? `Here is where I would start:\n${brief.map((b) => `- ${b}`).join("\n")}`
      : `Claude is not connected on this page, so I can only handle a few things offline: today's priorities, deals at risk, moving a deal ("move Sendbox to Replied") and adding tasks.\n\nFor now:\n${brief.map((b) => `- ${b}`).join("\n")}`,
    activity: act,
  }
}

/* ---------------- panel ---------------- */

export function AssistantPanel({ open, onClose, onOpenProspect }: { open: boolean; onClose: () => void; onOpenProspect: (id: string) => void }) {
  const store = useStore()
  const storeRef = React.useRef(store)
  storeRef.current = store
  const ai = useAI()
  const [turns, setTurns] = React.useState<Turn[]>([])
  const [value, setValue] = React.useState("")
  const [model, setModel] = React.useState("default")
  const [busy, setBusy] = React.useState(false)
  const ctl = React.useRef<AbortController | null>(null)
  const scroller = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" })
  }, [turns])

  const patchLast = (fn: (t: Turn) => Turn) => setTurns((all) => all.map((t, i) => (i === all.length - 1 ? fn(t) : t)))

  const send = async (text: string) => {
    const q = text.trim()
    if (!q || busy) return
    setValue("")
    const user: Turn = { id: crypto.randomUUID(), role: "user", text: q, activity: [], status: "complete" }
    const bot: Turn = { id: crypto.randomUUID(), role: "assistant", text: "", activity: [], status: "working" }
    const history = [...turns, user]
    setTurns([...history, bot])
    setBusy(true)

    if (!ai.sample) {
      await new Promise((r) => setTimeout(r, 500))
      const { reply, activity } = offlineAnswer(q, storeRef.current)
      patchLast((t) => ({ ...t, text: reply, activity, status: "complete" }))
      setBusy(false)
      return
    }

    ctl.current = new AbortController()
    const record = (item: AgentActivityItem) => patchLast((t) => ({ ...t, activity: [...t.activity, item] }))
    const convo = [
      { role: "user" as const, content: `${RULES}\n\nCurrent workspace:\n${pipelineContext(storeRef.current.state)}` },
      ...history.slice(-10).map((t) => ({ role: t.role, content: t.text || "(no reply)" })),
    ]
    try {
      const r = await ai.sample(convo, {
        signal: ctl.current.signal,
        cache: false,
        modelTier: model,
        onText: ({ text: t }: { text: string }) => patchLast((x) => ({ ...x, text: t })),
        ...(ai.tools ? { tools: buildTools(() => storeRef.current, record) } : {}),
      })
      patchLast((t) => ({ ...t, text: r.text, status: "complete" }))
    } catch (e) {
      if (isPermanent(e)) ai.disable()
      const err = e as { code?: string; text?: string }
      if (isPermanent(e)) {
        const { reply, activity } = offlineAnswer(q, storeRef.current)
        patchLast((t) => ({ ...t, text: reply, activity: [...t.activity, ...activity], status: "complete" }))
      } else {
        patchLast((t) => ({ ...t, text: err.text ?? t.text, status: "complete", error: errorCopy(e) || undefined }))
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <Sparkles className="size-4 text-brand" />
        <span className="text-sm font-medium">Assistant</span>
        <AIMark live={ai.status === "ready"} className="ml-1" />
        <div className="ml-auto flex items-center gap-1">
          {turns.length ? (
            <Button variant="ghost" size="sm" onClick={() => setTurns([])} disabled={busy}>
              Clear
            </Button>
          ) : null}
          <Button variant="ghost" size="icon-sm" aria-label="Close assistant" onClick={onClose}>
            <X />
          </Button>
        </div>
      </header>

      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
        {turns.length === 0 ? (
          <div className="flex h-full flex-col justify-end gap-5">
            <div>
              <h2 className="font-display text-2xl font-light tracking-[-0.01em] text-balance">Ask about your pipeline, or tell me what to change.</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {ai.status === "ready"
                  ? ai.tools
                    ? "I can search deals, move stages, add tasks, log activity and run your automations."
                    : "I can read your whole pipeline and answer questions about it."
                  : "Claude is not connected here, so I will use built-in rules for a few common requests."}
              </p>
            </div>
            <div className="grid gap-2">
              {SUGGESTIONS.map((s, i) => (
                <motion.button
                  key={s}
                  type="button"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...spring.smooth, delay: 0.05 * i }}
                  onClick={() => send(s)}
                  className="rounded-md border bg-surface px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:border-input hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  {s}
                </motion.button>
              ))}
            </div>
          </div>
        ) : (
          <MessageGroup spacing="default">
            {turns.map((t) =>
              t.role === "user" ? (
                <Message key={t.id} from="user" animateIn>
                  <MessageContent>
                    <MessageBubble variant="solid">
                      <MessageBubbleContent>{t.text}</MessageBubbleContent>
                    </MessageBubble>
                  </MessageContent>
                </Message>
              ) : (
                <Message key={t.id} from="assistant" animateIn>
                  <MessageAvatar className="bg-brand/10 text-brand">
                    <Sparkles />
                  </MessageAvatar>
                  <MessageContent className="min-w-0">
                    <MessageHeader>Assistant</MessageHeader>
                    {t.activity.length ? (
                      <AgentActivity items={t.activity} status={t.status} maxHeight={120} activeLabel="Working in your CRM" className="mb-2" />
                    ) : null}
                    <MessageBubble variant="ghost">
                      <MessageBubbleContent>
                        {t.text ? (
                          <RichText text={t.text} onOpen={onOpenProspect} />
                        ) : t.status === "working" ? (
                          <ShimmerText className="text-sm">Thinking…</ShimmerText>
                        ) : null}
                        {t.error ? <p className="mt-2 text-xs text-destructive">{t.error}</p> : null}
                      </MessageBubbleContent>
                    </MessageBubble>
                  </MessageContent>
                </Message>
              )
            )}
          </MessageGroup>
        )}
      </div>

      <div className="shrink-0 border-t p-3">
        <PromptInput
          value={value}
          onValueChange={setValue}
          onSubmit={(v, m) => {
            if (m) setModel(m)
            send(v)
          }}
          loading={busy}
          onStop={() => ctl.current?.abort()}
          models={ai.status === "ready" ? MODELS : undefined}
          model={model}
          onModelChange={setModel}
          placeholder="Ask or instruct…"
          minRows={1}
          maxRows={5}
          aria-label="Message the assistant"
        />
      </div>
    </div>
  )
}

/** Renders bullets and links company names to their panel. */
function RichText({ text, onOpen }: { text: string; onOpen: (id: string) => void }) {
  const { state } = useStore()
  const names = React.useMemo(() => [...state.prospects].sort((a, b) => b.company.length - a.company.length), [state.prospects])
  const linkify = (line: string, key: string) => {
    const parts: React.ReactNode[] = []
    let rest = line
    let n = 0
    while (rest) {
      let hit: { i: number; p: Prospect } | null = null
      for (const p of names) {
        const i = rest.indexOf(p.company)
        if (i >= 0 && (!hit || i < hit.i)) hit = { i, p }
      }
      if (!hit) {
        parts.push(rest)
        break
      }
      if (hit.i) parts.push(rest.slice(0, hit.i))
      const pid = hit.p.id
      parts.push(
        <button key={`${key}-${n++}`} type="button" onClick={() => onOpen(pid)} className="font-medium text-brand hover:underline">
          {hit.p.company}
        </button>
      )
      rest = rest.slice(hit.i + hit.p.company.length)
    }
    return parts
  }
  const lines = text.replace(/\*\*(.+?)\*\*/g, "$1").split("\n")
  return (
    <div className="flex flex-col gap-1.5 text-sm leading-relaxed">
      {lines.map((l, i) =>
        /^\s*[-•*]\s+/.test(l) ? (
          <p key={i} className="flex gap-2 pl-1">
            <span aria-hidden className="mt-2 size-1 shrink-0 bg-muted-foreground" />
            <span>{linkify(l.replace(/^\s*[-•*]\s+/, ""), `l${i}`)}</span>
          </p>
        ) : l.trim() ? (
          <p key={i}>{linkify(l, `l${i}`)}</p>
        ) : null
      )}
    </div>
  )
}

function useMedia(query: string) {
  const [match, setMatch] = React.useState(() => typeof window !== "undefined" && window.matchMedia(query).matches)
  React.useEffect(() => {
    const m = window.matchMedia(query)
    const on = () => setMatch(m.matches)
    m.addEventListener("change", on)
    return () => m.removeEventListener("change", on)
  }, [query])
  return match
}

/** Animated container: a docked column that pushes the page on desktop, a sliding sheet on phones. */
export function AssistantDock({ open, children }: { open: boolean; children: React.ReactNode }) {
  const desktop = useMedia("(min-width: 768px)")
  const wide = useMedia("(min-width: 1280px)")
  const width = wide ? 416 : 384
  return (
    <AnimatePresence initial={false}>
      {open ? (
        desktop ? (
          <motion.aside
            key="dock"
            aria-label="Assistant"
            initial={{ width: 0 }}
            animate={{ width }}
            exit={{ width: 0 }}
            transition={spring.smooth}
            className="h-full shrink-0 overflow-hidden border-l bg-background"
          >
            <div className="h-full" style={{ width }}>{children}</div>
          </motion.aside>
        ) : (
          <motion.aside
            key="sheet"
            aria-label="Assistant"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={spring.smooth}
            className={cn("fixed inset-0 z-50 bg-background")}
          >
            {children}
          </motion.aside>
        )
      ) : null}
    </AnimatePresence>
  )
}
