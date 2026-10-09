import * as React from "react"
import { Copy, MoreHorizontal, Pencil, Play, Plus, RefreshCw, Check, Trash2, Sparkles, Zap, Link2 } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { toast } from "sonner"

import { ApprovalCard, type ApprovalCardStatus } from "@/components/agents/approval-card"
import { ReasoningText } from "@/components/agents/loading-states"
import { PromptInput } from "@/components/agents/prompt-input"
import { AnimatedNumber } from "@/components/motion/animated-number"
import { ActionSwapButton } from "@/components/motion/action-swap"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { spring, stagger } from "@/lib/motion"

import {
  automationPrompt,
  errorCopy,
  fallbackAutomation,
  isPermanent,
  sanitizeAutomation,
  useAI,
} from "./ai"
import { AutomationEditor, WorkflowView, blankAutomation } from "./automation-editor"
import { AIMark, OwnerAvatar, PageHeader, SectionLabel } from "./bits"
import {
  INDUSTRIES,
  OWNERS,
  TRIGGER_OPTIONS,
  describeAction,
  describeCondition,
  describeTrigger,
  newId,
  owner,
  timeAgo,
  type Automation,
  type OwnerId,
} from "./data"
import { useStore } from "./store"
import { FeatureEmpty } from "./empty-states"

const TIMED = ["inactive", "overdue", "score_above"]

const EXAMPLES = [
  "When a fintech deal over $30k goes quiet for 10 days, create a high-priority call task",
  "When a prospect replies, notify me and stop their sequence",
  "When a lead score passes 80, alert the owner and book a call today",
]

export function AutomationsView({ onOpen }: { onOpen: (id: string) => void }) {
  const { state, toggleAutomation, saveAutomation, deleteAutomation, runChecks } = useStore()
  const [editing, setEditing] = React.useState<Automation | null>(null)
  const [tab, setTab] = React.useState("rules")
  const [runState, setRunState] = React.useState("idle")

  const active = state.automations.filter((a) => a.enabled).length
  const weekAgo = Date.now() - 7 * 86_400_000
  const runsThisWeek = state.runs.filter((r) => new Date(r.at).getTime() >= weekAgo).length
  const autoTasks = state.tasks.filter((t) => t.source.kind === "automation" || t.source.kind === "sequence").length
  const totalRuns = state.automations.reduce((s, a) => s + a.runs, 0)

  const runAll = () => {
    setRunState("running")
    window.setTimeout(() => {
      const n = runChecks()
      setRunState("done")
      toast(n ? `${n} automation run${n === 1 ? "" : "s"} triggered` : "Checked every rule. Nothing new to do.", {
        description: n ? "See Run history for what changed." : "Time-based rules only fire once per condition.",
      })
      window.setTimeout(() => setRunState("idle"), 1600)
    }, 700)
  }

  if (!state.automations.length)
    return (
      <>
        <FeatureEmpty feature="automations" primary={{ label: "New automation", onClick: () => setEditing(blankAutomation()) }} />
        <AutomationEditor
          value={editing}
          onClose={() => setEditing(null)}
          onSave={(a) => {
            saveAutomation(a)
            setEditing(null)
            toast.success(`Created "${a.name}"`, { description: a.enabled ? "It is live now." : "It is saved but switched off." })
          }}
        />
      </>
    )

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 md:px-8">
      <PageHeader eyebrow="Automations" title="Rules that do the busywork">
        <ActionSwapButton
          variant="outline"
          animation="roll"
          value={runState}
          onClick={runState === "idle" ? runAll : undefined}
          aria-label="Run checks now"
          items={[
            { id: "idle", label: "Run checks", icon: <RefreshCw className="size-4" /> },
            { id: "running", label: "Checking…", icon: <RefreshCw className="size-4 animate-spin" /> },
            { id: "done", label: "Done", icon: <Check className="size-4" /> },
          ]}
        />
        <Button onClick={() => setEditing(blankAutomation())}>
          <Plus /> New automation
        </Button>
      </PageHeader>

      <AIBuilder onEdit={setEditing} />

      <section aria-label="Automation summary" className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border lg:grid-cols-4">
        <Stat label="Active rules" hint={`${state.automations.length} in total`}><AnimatedNumber value={active} /></Stat>
        <Stat label="Runs this week" hint={`${totalRuns} all time`}><AnimatedNumber value={runsThisWeek} /></Stat>
        <Stat label="Tasks made for you" hint="By rules and sequences"><AnimatedNumber value={autoTasks} /></Stat>
        <Stat label="Time saved" hint="At about 4 minutes a run"><AnimatedNumber value={Math.round((totalRuns * 4) / 60)} /><span className="text-base text-muted-foreground"> h</span></Stat>
      </section>

      <Tabs value={tab} onValueChange={setTab} variant="underline">
        <TabsList>
          <TabsTrigger value="rules" className="gap-1.5">Rules <span className="font-mono text-[11px] text-muted-foreground">{state.automations.length}</span></TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5">Run history <span className="font-mono text-[11px] text-muted-foreground">{state.runs.length}</span></TabsTrigger>
          <TabsTrigger value="routing">Lead routing</TabsTrigger>
        </TabsList>

        <TabsContent value="rules" className="pt-5">
          <ul className="grid gap-3">
            <AnimatePresence initial={false}>
              {state.automations.map((a, i) => (
                <motion.li
                  key={a.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ ...spring.smooth, delay: Math.min(i, 8) * stagger.tight }}
                >
                  <RuleCard
                    automation={a}
                    onToggle={() => {
                      toggleAutomation(a.id)
                      toast(a.enabled ? `"${a.name}" is off` : `"${a.name}" is on`, {
                        description: a.enabled ? "It will not run until you switch it back on." : TIMED.includes(a.trigger.type) ? "Checked straight away against your pipeline." : "It runs the next time its trigger happens.",
                      })
                    }}
                    onEdit={() => setEditing(a)}
                    onRun={() => {
                      const n = runChecks(a.id)
                      toast(n ? `"${a.name}" ran ${n} time${n === 1 ? "" : "s"}` : `"${a.name}" had nothing new to act on`)
                    }}
                    onDuplicate={() => {
                      const copy = { ...structuredClone(a), id: newId("au"), name: `${a.name} (copy)`, enabled: false, runs: 0, lastRunAt: null, origin: "custom" as const }
                      saveAutomation(copy)
                      toast(`Duplicated "${a.name}"`, { description: "The copy is off until you edit it." })
                    }}
                    onDelete={() => {
                      deleteAutomation(a.id)
                      toast(`Deleted "${a.name}"`, { action: { label: "Undo", onClick: () => saveAutomation(a) } })
                    }}
                  />
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </TabsContent>

        <TabsContent value="history" className="pt-5">
          <RunHistory onOpen={onOpen} />
        </TabsContent>

        <TabsContent value="routing" className="pt-5">
          <RoutingPanel />
        </TabsContent>
      </Tabs>

      <AutomationEditor
        value={editing}
        onClose={() => setEditing(null)}
        onSave={(a) => {
          const isNew = !state.automations.some((x) => x.id === a.id)
          saveAutomation(a)
          setEditing(null)
          toast.success(isNew ? `Created "${a.name}"` : `Saved "${a.name}"`, {
            description: a.enabled ? "It is live now." : "It is saved but switched off.",
          })
        }}
      />
    </div>
  )
}

function Stat({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 bg-card p-5">
      <span className="eyebrow text-muted-foreground">{label}</span>
      <span className="font-mono text-2xl tabular-nums tracking-tight md:text-3xl">{children}</span>
      <span className="text-xs text-muted-foreground">{hint}</span>
    </div>
  )
}

/* ------------------------------------------------------------------ */

function RuleCard({
  automation: a,
  onToggle,
  onEdit,
  onRun,
  onDuplicate,
  onDelete,
}: {
  automation: Automation
  onToggle: () => void
  onEdit: () => void
  onRun: () => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  const { state } = useStore()
  const inspired = TRIGGER_OPTIONS.find((t) => t.type === a.trigger.type)?.inspired
  const timed = TIMED.includes(a.trigger.type)
  return (
    <Card className={cn("gap-0 py-0 transition-opacity", !a.enabled && "opacity-70")}>
      <div className="flex items-start gap-4 p-4 md:p-5">
        <Switch checked={a.enabled} onCheckedChange={onToggle} aria-label={`${a.name} ${a.enabled ? "on" : "off"}`} className="mt-0.5" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={onEdit} className="text-left text-sm font-medium hover:text-brand focus-visible:text-brand focus-visible:outline-none">
              {a.name}
            </button>
            {a.origin === "ai" ? <Badge variant="brand"><Sparkles /> Made with AI</Badge> : null}
            {timed ? <Badge variant="outline">Time-based</Badge> : null}
          </div>
          {a.description ? <p className="mt-1 text-sm text-muted-foreground">{a.description}</p> : null}

          <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
            <span className="inline-flex items-center gap-1 rounded-sm border border-brand/25 bg-brand/10 px-1.5 py-0.5 text-brand">
              <Zap className="size-3" /> {describeTrigger(a.trigger)}
            </span>
            {a.conditions.map((c) => (
              <span key={c.id} className="rounded-sm border border-dashed px-1.5 py-0.5 text-muted-foreground">
                if {describeCondition(c)}
              </span>
            ))}
            <span aria-hidden className="text-muted-foreground">→</span>
            {a.actions.map((x, i) => (
              <span key={i} className="rounded-sm border bg-surface px-1.5 py-0.5">
                {describeAction(x, state.sequences)}
              </span>
            ))}
          </div>
        </div>

        <div className="hidden shrink-0 flex-col items-end gap-1 text-right sm:flex">
          <span className="font-mono text-sm tabular-nums">{a.runs}</span>
          <span className="font-mono text-[11px] text-muted-foreground">{a.lastRunAt ? `runs · last ${timeAgo(a.lastRunAt).toLowerCase()}` : "runs · never"}</span>
          {inspired ? <span className="font-mono text-[10px] text-muted-foreground">after {inspired}</span> : null}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${a.name}`} className="-mr-1 text-muted-foreground">
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onSelect={onEdit}><Pencil /> Edit</DropdownMenuItem>
            {timed ? (
              <DropdownMenuItem onSelect={onRun} disabled={!a.enabled}><Play /> Run on matches now</DropdownMenuItem>
            ) : null}
            <DropdownMenuItem onSelect={onDuplicate}><Copy /> Duplicate</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={onDelete}><Trash2 /> Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* AI builder: describe a rule, review it, approve it                   */
/* ------------------------------------------------------------------ */

function AIBuilder({ onEdit }: { onEdit: (a: Automation) => void }) {
  const { state, saveAutomation } = useStore()
  const ai = useAI()
  const [text, setText] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [proposal, setProposal] = React.useState<{ automation: Automation; live: boolean } | null>(null)
  const [status, setStatus] = React.useState<ApprovalCardStatus>("pending")
  const ctl = React.useRef<AbortController | null>(null)

  const submit = async (request: string) => {
    const q = request.trim()
    if (!q) return
    setLoading(true)
    setProposal(null)
    setStatus("pending")
    let result: Automation | null = null
    let live = false
    if (ai.sample) {
      ctl.current = new AbortController()
      try {
        const raw = await ai.sample.json(automationPrompt(state, q), { signal: ctl.current.signal, modelTier: "default" })
        result = sanitizeAutomation(raw, state)
        live = Boolean(result)
      } catch (e) {
        if (isPermanent(e)) ai.disable()
        const msg = errorCopy(e)
        if ((e as { code?: string })?.code === "cancelled") {
          setLoading(false)
          return
        }
        if (msg) toast(msg)
      }
    }
    if (!result) result = fallbackAutomation(q, state)
    setLoading(false)
    if (!result) {
      toast("I could not turn that into a rule. Try naming a trigger and an action.")
      return
    }
    setProposal({ automation: result, live })
  }

  return (
    <Card className="gap-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles aria-hidden className="size-4 text-brand" />
          <span className="text-sm font-medium">Describe an automation</span>
        </div>
        <AIMark live={ai.status === "ready"} />
      </div>

      <PromptInput
        value={text}
        onValueChange={setText}
        placeholder="When a deal over $40k sits in Proposal for a week, alert me and create a call task"
        loading={loading}
        onSubmit={(v) => submit(v)}
        onStop={() => ctl.current?.abort()}
        minRows={1}
        maxRows={4}
        aria-label="Describe an automation"
      />

      {!proposal && !loading ? (
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => {
                setText(ex)
                submit(ex)
              }}
              className="rounded-md border bg-surface px-2.5 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:border-input hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {ex}
            </button>
          ))}
        </div>
      ) : null}

      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <ReasoningText
              phrases={["Reading your request", "Choosing a trigger", "Matching your stages and sequences", "Drafting the rule"]}
              className="text-sm"
            />
          </motion.div>
        ) : proposal ? (
          <motion.div key={proposal.automation.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={spring.smooth}>
            <ApprovalCard
              title={`Create "${proposal.automation.name}"?`}
              description={proposal.live ? "Claude drafted this from your description. Check it before it goes live." : "Built from your words with built-in rules. Check it before it goes live."}
              status={status}
              approveLabel="Turn it on"
              onApprove={() => {
                setStatus("submitting")
                window.setTimeout(() => {
                  saveAutomation(proposal.automation)
                  setStatus("approved")
                  toast.success(`"${proposal.automation.name}" is live`)
                  setText("")
                }, 450)
              }}
              onRequestChanges={() => {
                onEdit(proposal.automation)
                setStatus("changes-requested")
              }}
              onReject={() => setStatus("rejected")}
              onDismiss={() => setProposal(null)}
              result={
                status === "approved"
                  ? "Saved and switched on. You will find it in Rules."
                  : status === "changes-requested"
                    ? "Opened in the editor so you can adjust it."
                    : "Discarded. Nothing was saved."
              }
            >
              <WorkflowView automation={proposal.automation} sequences={state.sequences} compact />
            </ApprovalCard>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </Card>
  )
}

/* ------------------------------------------------------------------ */

function RunHistory({ onOpen }: { onOpen: (id: string) => void }) {
  const { state } = useStore()
  const [rule, setRule] = React.useState("all")
  const runs = state.runs.filter((r) => rule === "all" || r.automationId === rule)
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={rule} onValueChange={setRule}>
          <SelectTrigger aria-label="Filter by rule" className="w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All rules</SelectItem>
            {state.automations.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="ml-auto font-mono text-[11px] text-muted-foreground">{runs.length} runs</span>
      </div>
      <Card className="gap-0 py-0">
        {runs.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted-foreground">No runs yet for this rule.</p>
        ) : (
          <ol className="divide-y">
            <AnimatePresence initial={false}>
              {runs.slice(0, 60).map((r) => (
                <motion.li key={r.id} layout initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} transition={spring.smooth} className="relative flex items-start gap-3 px-5 py-3">
                  <motion.span aria-hidden className="pointer-events-none absolute inset-0 bg-brand/5" initial={{ opacity: 1 }} animate={{ opacity: 0 }} transition={{ duration: 1.6, delay: 0.3 }} />
                  <span className="relative mt-0.5 grid size-6 shrink-0 place-items-center rounded-md border bg-surface text-brand">
                    <Zap aria-hidden className="size-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">
                      <span className="font-medium">{r.automationName}</span>
                      <span className="text-muted-foreground"> on </span>
                      <button type="button" onClick={() => onOpen(r.prospectId)} className="font-medium hover:text-brand focus-visible:text-brand focus-visible:outline-none">
                        {r.company}
                      </button>
                      {r.chained ? (
                        <span className="ml-2 inline-flex items-center gap-1 font-mono text-[10px] text-muted-foreground"><Link2 className="size-3" /> chained</span>
                      ) : null}
                    </p>
                    <ul className="mt-1.5 flex flex-wrap gap-1">
                      {r.steps.map((s, i) => (
                        <li key={i} className="rounded-sm border bg-surface px-1.5 py-0.5 text-xs text-muted-foreground">{s}</li>
                      ))}
                    </ul>
                  </div>
                  <span className="shrink-0 font-mono text-[11px] text-muted-foreground">{timeAgo(r.at)}</span>
                </motion.li>
              ))}
            </AnimatePresence>
          </ol>
        )}
      </Card>
    </div>
  )
}

/* ------------------------------------------------------------------ */

function RoutingPanel() {
  const { state, setRouting } = useStore()
  const r = state.routing
  const queue = React.useMemo(() => {
    const pool = r.pool.length ? r.pool : (["em"] as OwnerId[])
    return [0, 1, 2, 3].map((i) => pool[(r.cursor + i) % pool.length])
  }, [r])
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1fr] [&>*]:min-w-0">
      <Card className="gap-5 p-5">
        <div>
          <SectionLabel>How new prospects get an owner</SectionLabel>
          <p className="mt-2 text-sm text-muted-foreground">
            Used by any rule that assigns by lead routing, and by meeting booking. Works like Chili Piper's router.
          </p>
        </div>
        <RadioGroup value={r.mode} onValueChange={(v) => setRouting({ mode: v as typeof r.mode })} className="gap-3">
          {[
            ["round_robin", "Round robin", "Take turns across everyone in the pool."],
            ["by_industry", "By industry", "Send each industry to its specialist, then round robin."],
          ].map(([value, label, hint]) => (
            <div key={value} className="flex items-start gap-3">
              <RadioGroupItem value={value} id={`route-${value}`} className="mt-0.5" />
              <Label htmlFor={`route-${value}`} className="grid gap-1">
                {label}
                <span className="text-xs font-normal text-muted-foreground">{hint}</span>
              </Label>
            </div>
          ))}
        </RadioGroup>
        <div className="grid gap-2 border-t pt-4">
          <span className="eyebrow text-muted-foreground">In the pool</span>
          {OWNERS.map((o) => (
            <label key={o.id} className="flex items-center gap-3 text-sm">
              <Checkbox
                checked={r.pool.includes(o.id)}
                onCheckedChange={(v) =>
                  setRouting({ pool: v === true ? [...r.pool, o.id] : r.pool.filter((x) => x !== o.id), cursor: 0 })
                }
              />
              <OwnerAvatar id={o.id} />
              {o.name}
            </label>
          ))}
        </div>
      </Card>

      <div className="flex flex-col gap-6">
        <Card className="gap-4 p-5">
          <SectionLabel>Next up</SectionLabel>
          <ol className="flex items-center gap-2">
            <AnimatePresence initial={false} mode="popLayout">
              {queue.map((id, i) => (
                <motion.li key={`${r.cursor}-${i}`} layout initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1 - i * 0.2, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={spring.smooth} className="flex items-center gap-2 rounded-md border bg-surface px-2 py-1.5 text-sm">
                  <OwnerAvatar id={id} className="size-5" />
                  {owner(id).first}
                </motion.li>
              ))}
            </AnimatePresence>
          </ol>
          <p className="text-xs text-muted-foreground">The next new prospect goes to {owner(queue[0]).first}.</p>
        </Card>

        <Card className={cn("gap-3 p-5", r.mode !== "by_industry" && "opacity-60")}>
          <SectionLabel>Industry specialists</SectionLabel>
          <div className="grid gap-2 sm:grid-cols-2">
            {INDUSTRIES.map((ind) => (
              <label key={ind} className="flex items-center justify-between gap-2 text-sm">
                <span className="text-muted-foreground">{ind}</span>
                <Select
                  value={r.industryMap[ind] ?? "none"}
                  disabled={r.mode !== "by_industry"}
                  onValueChange={(v) => setRouting({ industryMap: { ...r.industryMap, [ind]: v === "none" ? undefined : (v as OwnerId) } })}
                >
                  <SelectTrigger aria-label={`${ind} owner`} className="h-8 w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Round robin</SelectItem>
                    {OWNERS.map((o) => (
                      <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
