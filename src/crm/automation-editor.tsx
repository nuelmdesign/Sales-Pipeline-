import * as React from "react"
import { Filter, GitBranch, Plus, Trash2, Zap } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { spring } from "@/lib/motion"

import {
  ACTION_OPTIONS,
  FIELD_OPTIONS,
  INDUSTRIES,
  OWNERS,
  SOURCES,
  STAGES,
  TRIGGER_OPTIONS,
  defaultAction,
  defaultTrigger,
  describeAction,
  describeCondition,
  describeTrigger,
  newId,
  type Action,
  type ActionType,
  type Automation,
  type Condition,
  type ConditionField,
  type Sequence,
  type StageId,
  type Trigger,
} from "./data"
import { previewMatches } from "./engine"
import { useStore } from "./store"

export function blankAutomation(): Automation {
  return {
    id: newId("au"),
    name: "",
    description: "",
    enabled: true,
    trigger: { type: "stage_changed", to: "replied" },
    conditions: [],
    actions: [{ type: "create_task", title: "Follow up with {contact}", dueInDays: 1, priority: "normal" }],
    runs: 0,
    lastRunAt: null,
    origin: "custom",
    createdAt: new Date().toISOString(),
  }
}

/* ------------------------------------------------------------------ */
/* Workflow visual: trigger, conditions and actions as a vertical flow  */
/* ------------------------------------------------------------------ */

export function WorkflowView({ automation, sequences, compact }: { automation: Automation; sequences: Sequence[]; compact?: boolean }) {
  const nodes = [
    { id: "trigger", kind: "trigger" as const, text: describeTrigger(automation.trigger) },
    ...(automation.conditions.length
      ? [{ id: "conds", kind: "condition" as const, text: automation.conditions.map(describeCondition).join(" and ") }]
      : []),
    ...automation.actions.map((a, i) => ({ id: `a${i}-${a.type}`, kind: "action" as const, text: describeAction(a, sequences) })),
  ]
  return (
    <ol className="flex flex-col">
      <AnimatePresence initial={false}>
        {nodes.map((n, i) => (
          <motion.li
            key={n.id}
            layout
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={spring.smooth}
            className="flex flex-col items-stretch"
          >
            {i > 0 ? (
              <span aria-hidden className="mx-auto h-4 w-px bg-border" />
            ) : null}
            <div
              className={cn(
                "flex items-start gap-2.5 rounded-md border p-2.5",
                n.kind === "trigger" && "border-brand/30 bg-brand/5",
                n.kind === "condition" && "border-dashed bg-surface",
                n.kind === "action" && "bg-card",
                compact && "p-2"
              )}
            >
              <span
                className={cn(
                  "mt-0.5 grid size-5 shrink-0 place-items-center rounded-sm",
                  n.kind === "trigger" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                )}
              >
                {n.kind === "trigger" ? <Zap className="size-3" /> : n.kind === "condition" ? <Filter className="size-3" /> : <GitBranch className="size-3" />}
              </span>
              <div className="min-w-0">
                <p className="eyebrow text-[10px] text-muted-foreground">
                  {n.kind === "trigger" ? "When" : n.kind === "condition" ? "Only if" : "Then"}
                </p>
                <p className="mt-1 text-sm leading-snug">{n.text}</p>
              </div>
            </div>
          </motion.li>
        ))}
      </AnimatePresence>
    </ol>
  )
}

/* ------------------------------------------------------------------ */
/* Editor dialog                                                        */
/* ------------------------------------------------------------------ */

export function AutomationEditor({
  value,
  onClose,
  onSave,
}: {
  value: Automation | null
  onClose: () => void
  onSave: (a: Automation) => void
}) {
  const { state } = useStore()
  const [draft, setDraft] = React.useState<Automation | null>(value)
  const [tried, setTried] = React.useState(false)

  React.useEffect(() => {
    setDraft(value ? structuredClone(value) : null)
    setTried(false)
  }, [value])

  const set = (patch: Partial<Automation>) => setDraft((d) => (d ? { ...d, ...patch } : d))
  const matches = React.useMemo(() => (draft ? previewMatches(state, draft) : []), [draft, state])

  if (!draft) return <Dialog open={false} />

  const nameMissing = !draft.name.trim()
  const isTimed = ["inactive", "overdue", "score_above"].includes(draft.trigger.type)

  return (
    <Dialog open={Boolean(value)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl font-light tracking-[-0.02em]">
            {state.automations.some((a) => a.id === draft.id) ? "Edit automation" : "New automation"}
          </DialogTitle>
          <DialogDescription>
            Build it like a sentence. The flow on the right updates as you go.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 md:grid-cols-[1.35fr_1fr] [&>*]:min-w-0">
          <div className="flex flex-col gap-5">
            <div className="grid gap-1.5">
              <Label htmlFor="au-name">Name</Label>
              <Input
                id="au-name"
                value={draft.name}
                onChange={(e) => set({ name: e.target.value })}
                placeholder="Revive quiet fintech deals"
                aria-invalid={tried && nameMissing}
              />
              {tried && nameMissing ? <p className="text-xs text-destructive">Give the rule a name your team will recognise.</p> : null}
            </div>

            {/* WHEN */}
            <fieldset className="grid gap-2">
              <legend className="eyebrow mb-2 text-muted-foreground">When</legend>
              <div className="flex flex-wrap items-center gap-2">
                <Select value={draft.trigger.type} onValueChange={(v) => set({ trigger: defaultTrigger(v as Trigger["type"]) })}>
                  <SelectTrigger aria-label="Trigger" className="w-64">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TRIGGER_OPTIONS.map((t) => (
                      <SelectItem key={t.type} value={t.type}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <TriggerParam trigger={draft.trigger} onChange={(trigger) => set({ trigger })} />
              </div>
              {isTimed ? (
                <p className="text-xs text-muted-foreground">Checked each time the workspace opens, and whenever you press Run checks.</p>
              ) : null}
            </fieldset>

            {/* IF */}
            <fieldset className="grid gap-2">
              <legend className="eyebrow mb-2 text-muted-foreground">Only if <span className="normal-case tracking-normal">(optional)</span></legend>
              <AnimatePresence initial={false}>
                {draft.conditions.map((c, i) => (
                  <motion.div key={c.id} layout initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={spring.smooth}>
                    <ConditionRow
                      condition={c}
                      onChange={(next) => set({ conditions: draft.conditions.map((x, j) => (j === i ? next : x)) })}
                      onRemove={() => set({ conditions: draft.conditions.filter((_, j) => j !== i) })}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-fit text-muted-foreground"
                onClick={() => set({ conditions: [...draft.conditions, { id: newId("c"), field: "industry", op: "is", value: "Fintech" }] })}
              >
                <Plus /> Add condition
              </Button>
            </fieldset>

            {/* THEN */}
            <fieldset className="grid gap-2">
              <legend className="eyebrow mb-2 text-muted-foreground">Then</legend>
              <AnimatePresence initial={false}>
                {draft.actions.map((a, i) => (
                  <motion.div key={`${i}-${a.type}`} layout initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={spring.smooth}>
                    <ActionRow
                      index={i}
                      action={a}
                      sequences={state.sequences}
                      onChange={(next) => set({ actions: draft.actions.map((x, j) => (j === i ? next : x)) })}
                      onRemove={draft.actions.length > 1 ? () => set({ actions: draft.actions.filter((_, j) => j !== i) }) : undefined}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-fit text-muted-foreground"
                onClick={() => set({ actions: [...draft.actions, defaultAction("notify", state.sequences)] })}
              >
                <Plus /> Add action
              </Button>
              <p className="text-xs text-muted-foreground">
                Text can use <code className="font-mono">{"{company}"}</code>, <code className="font-mono">{"{contact}"}</code> and <code className="font-mono">{"{owner}"}</code>.
              </p>
            </fieldset>
          </div>

          <aside className="flex flex-col gap-4 rounded-lg border bg-surface p-4">
            <div className="flex items-center justify-between">
              <span className="eyebrow text-muted-foreground">Flow</span>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={draft.enabled} onCheckedChange={(v) => set({ enabled: v })} aria-label="Rule on" />
                {draft.enabled ? "On" : "Off"}
              </label>
            </div>
            <WorkflowView automation={draft} sequences={state.sequences} compact />
            <div className="border-t pt-3">
              <p className="eyebrow text-muted-foreground">
                {isTimed ? "Would act on now" : "Prospects matching today"}
                <span className="ml-2 font-mono tabular-nums">{matches.length}</span>
              </p>
              <ul className="mt-2 flex flex-wrap gap-1">
                {matches.slice(0, 8).map((p) => (
                  <li key={p.id} className="rounded-sm border bg-card px-1.5 py-0.5 text-xs">
                    {p.company}
                  </li>
                ))}
                {matches.length > 8 ? <li className="px-1 text-xs text-muted-foreground">+{matches.length - 8} more</li> : null}
                {matches.length === 0 ? <li className="text-xs text-muted-foreground">None right now.</li> : null}
              </ul>
            </div>
          </aside>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              setTried(true)
              if (nameMissing) return
              onSave(draft)
            }}
          >
            Save automation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function TriggerParam({ trigger, onChange }: { trigger: Trigger; onChange: (t: Trigger) => void }) {
  if (trigger.type === "stage_changed")
    return (
      <Select value={trigger.to} onValueChange={(v) => onChange({ type: "stage_changed", to: v as StageId | "any" })}>
        <SelectTrigger aria-label="To stage" className="w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="any">to any stage</SelectItem>
          {STAGES.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              to {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  if (trigger.type === "inactive")
    return (
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        <Input aria-label="Days" type="number" min={1} max={120} value={trigger.days} onChange={(e) => onChange({ type: "inactive", days: Math.max(1, Number(e.target.value) || 1) })} className="w-20 font-mono" />
        days
      </span>
    )
  if (trigger.type === "score_above")
    return (
      <Input aria-label="Score" type="number" min={1} max={100} value={trigger.value} onChange={(e) => onChange({ type: "score_above", value: Math.max(1, Math.min(100, Number(e.target.value) || 1)) })} className="w-20 font-mono" />
    )
  return null
}

function ConditionRow({ condition: c, onChange, onRemove }: { condition: Condition; onChange: (c: Condition) => void; onRemove: () => void }) {
  const numeric = c.field === "value" || c.field === "fit"
  const choices: { value: string; label: string }[] | null =
    c.field === "industry"
      ? INDUSTRIES.map((x) => ({ value: x, label: x }))
      : c.field === "source"
        ? SOURCES.map((x) => ({ value: x, label: x }))
        : c.field === "owner"
          ? OWNERS.map((o) => ({ value: o.id, label: o.name }))
          : c.field === "stage"
            ? STAGES.map((s) => ({ value: s.id, label: s.label }))
            : null
  return (
    <div className="flex flex-wrap items-center gap-2 py-0.5">
      <Select
        value={c.field}
        onValueChange={(v) => {
          const field = v as ConditionField
          const isNum = field === "value" || field === "fit"
          const first = field === "industry" ? "Fintech" : field === "source" ? "Referral" : field === "owner" ? "em" : field === "stage" ? "researching" : field === "value" ? "20000" : "4"
          onChange({ ...c, field, op: isNum ? "gte" : "is", value: first })
        }}
      >
        <SelectTrigger aria-label="Field" className="w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {FIELD_OPTIONS.map((f) => (
            <SelectItem key={f.field} value={f.field}>
              {f.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={c.op} onValueChange={(v) => onChange({ ...c, op: v as Condition["op"] })}>
        <SelectTrigger aria-label="Comparison" className="w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(numeric ? (["gte", "lte", "is"] as const) : (["is", "is_not"] as const)).map((op) => (
            <SelectItem key={op} value={op}>
              {{ is: "is", is_not: "is not", gte: "at least", lte: "at most" }[op]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {choices ? (
        <Select value={c.value} onValueChange={(v) => onChange({ ...c, value: v })}>
          <SelectTrigger aria-label="Value" className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {choices.map((x) => (
              <SelectItem key={x.value} value={x.value}>
                {x.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Input aria-label="Value" type="number" value={c.value} onChange={(e) => onChange({ ...c, value: e.target.value })} className="w-28 font-mono" />
      )}
      <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove condition" onClick={onRemove} className="text-muted-foreground">
        <Trash2 />
      </Button>
    </div>
  )
}

function ActionRow({
  index,
  action: a,
  sequences,
  onChange,
  onRemove,
}: {
  index: number
  action: Action
  sequences: Sequence[]
  onChange: (a: Action) => void
  onRemove?: () => void
}) {
  return (
    <div className="flex flex-col gap-2 rounded-md border bg-card p-3">
      <div className="flex items-center gap-2">
        <span className="font-mono text-[11px] tabular-nums text-muted-foreground">{index + 1}</span>
        <Select value={a.type} onValueChange={(v) => onChange(defaultAction(v as ActionType, sequences))}>
          <SelectTrigger aria-label="Action" className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ACTION_OPTIONS.map((o) => (
              <SelectItem key={o.type} value={o.type}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {onRemove ? (
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove action" onClick={onRemove} className="ml-auto text-muted-foreground">
            <Trash2 />
          </Button>
        ) : null}
      </div>
      {a.type === "create_task" ? (
        <div className="flex flex-wrap items-center gap-2">
          <Input aria-label="Task title" value={a.title} onChange={(e) => onChange({ ...a, title: e.target.value })} className="min-w-0 flex-1 basis-48" />
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            due in
            <Input aria-label="Due in days" type="number" min={0} value={a.dueInDays} onChange={(e) => onChange({ ...a, dueInDays: Math.max(0, Number(e.target.value) || 0) })} className="w-16 font-mono" />
            d
          </span>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Switch checked={a.priority === "high"} onCheckedChange={(v) => onChange({ ...a, priority: v ? "high" : "normal" })} aria-label="High priority" />
            High
          </label>
        </div>
      ) : a.type === "move_stage" ? (
        <Select value={a.to} onValueChange={(v) => onChange({ ...a, to: v as StageId })}>
          <SelectTrigger aria-label="Stage" className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STAGES.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : a.type === "assign_owner" ? (
        <Select value={a.owner} onValueChange={(v) => onChange({ ...a, owner: v as typeof a.owner })}>
          <SelectTrigger aria-label="Owner" className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="round_robin">Use lead routing</SelectItem>
            {OWNERS.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : a.type === "enroll_sequence" ? (
        <Select value={a.sequenceId} onValueChange={(v) => onChange({ ...a, sequenceId: v })}>
          <SelectTrigger aria-label="Sequence" className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {sequences.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : a.type === "notify" ? (
        <Input aria-label="Message" value={a.text} onChange={(e) => onChange({ ...a, text: e.target.value })} />
      ) : a.type === "set_next_step" ? (
        <div className="flex flex-wrap items-center gap-2">
          <Input aria-label="Next step" value={a.text} onChange={(e) => onChange({ ...a, text: e.target.value })} className="min-w-0 flex-1 basis-48" />
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            due in
            <Input aria-label="Due in days" type="number" min={0} value={a.dueInDays} onChange={(e) => onChange({ ...a, dueInDays: Math.max(0, Number(e.target.value) || 0) })} className="w-16 font-mono" />
            d
          </span>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Removes the prospect from any sequence and clears its pending steps.</p>
      )}
    </div>
  )
}
