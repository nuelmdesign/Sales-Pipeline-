import * as React from "react"
import { AtSign, ListChecks, Mail, Phone, Plus, Trash2, UserPlus, X } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { spring, stagger } from "@/lib/motion"

import { CompanyMark, PageHeader, ScoreBadge, StageBadge } from "./bits"
import { isOpen, leadScore, newId, type Sequence, type SequenceStep } from "./data"
import { useStore } from "./store"
import { FeatureEmpty } from "./empty-states"

const KIND_ICON = { email: Mail, call: Phone, linkedin: AtSign, task: ListChecks } as const
const KIND_LABEL = { email: "Email", call: "Call", linkedin: "LinkedIn", task: "Task" } as const

export function SequencesView({ onOpen }: { onOpen: (id: string) => void }) {
  const { state, saveSequence } = useStore()
  const [enrolling, setEnrolling] = React.useState<Sequence | null>(null)
  const [editing, setEditing] = React.useState<Sequence | null>(null)

  const newSequence = () =>
    setEditing({ id: newId("seq"), name: "", description: "", exitOnReply: true, steps: [{ id: newId("st"), day: 0, kind: "email", title: "Intro email to {contact}" }] })

  if (!state.sequences.length)
    return (
      <>
        <FeatureEmpty feature="sequences" primary={{ label: "New sequence", onClick: newSequence }} />
        <SequenceEditor value={editing} onClose={() => setEditing(null)} />
      </>
    )

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 md:px-8">
      <PageHeader eyebrow="Sequences" title="Outreach that keeps its own rhythm">
        <Button
          onClick={() =>
            setEditing({
              id: newId("seq"),
              name: "",
              description: "",
              exitOnReply: true,
              steps: [{ id: newId("st"), day: 0, kind: "email", title: "Intro email to {contact}" }],
            })
          }
        >
          <Plus /> New sequence
        </Button>
      </PageHeader>

      <p className="-mt-4 max-w-2xl text-sm text-muted-foreground">
        Each step lands in the owner's Inbox on its day. Completing a step queues the next. Sequences with "stop on reply" end as soon as a prospect moves to Replied.
      </p>

      <div className="grid gap-5">
        {state.sequences.map((seq, i) => {
          const enrolled = state.prospects.filter((p) => p.enrollment?.sequenceId === seq.id)
          return (
            <motion.div key={seq.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring.smooth, delay: i * stagger.base }}>
              <Card className="gap-0 py-0">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b p-5">
                  <div className="min-w-0">
                    <h2 className="font-display text-2xl font-light tracking-[-0.01em]">{seq.name}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{seq.description}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Switch
                        checked={seq.exitOnReply}
                        onCheckedChange={(v) => {
                          saveSequence({ ...seq, exitOnReply: v })
                          toast(v ? "Stops when they reply" : "Keeps running after a reply")
                        }}
                        aria-label="Stop on reply"
                      />
                      Stop on reply
                    </label>
                    <Button variant="outline" size="sm" onClick={() => setEditing(structuredClone(seq))}>
                      Edit steps
                    </Button>
                    <Button size="sm" onClick={() => setEnrolling(seq)}>
                      <UserPlus /> Enrol
                    </Button>
                  </div>
                </div>

                {/* Timeline */}
                <div className="overflow-x-auto border-b">
                  <ol
                    className="relative grid gap-4 px-5 pt-6 pb-5"
                    style={{ gridTemplateColumns: `repeat(${seq.steps.length}, minmax(9rem, 1fr))` }}
                  >
                    <span aria-hidden className="absolute top-[3.05rem] right-5 left-5 h-px bg-border" />
                    {seq.steps.map((s, idx) => {
                      const Icon = KIND_ICON[s.kind]
                      const gap = idx > 0 ? s.day - seq.steps[idx - 1].day : 0
                      return (
                        <li key={s.id} className="relative flex min-w-0 flex-col gap-2">
                          <span className="font-mono text-[11px] text-muted-foreground">
                            Day {s.day}
                            {idx > 0 ? <span className="opacity-70"> · +{gap}d</span> : null}
                          </span>
                          <span className="relative z-10 grid size-8 place-items-center rounded-md border bg-card text-muted-foreground">
                            <Icon className="size-4" />
                          </span>
                          <span className="text-xs leading-snug">
                            <span className="block font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{KIND_LABEL[s.kind]}</span>
                            {s.title}
                          </span>
                        </li>
                      )
                    })}
                  </ol>
                </div>

                {/* Enrolled */}
                <div className="p-5">
                  <div className="mb-3 flex items-center gap-2 text-muted-foreground">
                    <span className="eyebrow">Enrolled</span>
                    <span className="font-mono text-[11px] tabular-nums">{enrolled.length}</span>
                  </div>
                  {enrolled.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nobody yet. Enrol prospects by hand, or let an automation do it.</p>
                  ) : (
                    <ul className="grid gap-2 md:grid-cols-2">
                      <AnimatePresence initial={false}>
                        {enrolled.map((p) => (
                          <EnrolledRow key={p.id} prospectId={p.id} sequence={seq} onOpen={onOpen} />
                        ))}
                      </AnimatePresence>
                    </ul>
                  )}
                </div>
              </Card>
            </motion.div>
          )
        })}
      </div>

      <EnrolDialog sequence={enrolling} onClose={() => setEnrolling(null)} />
      <SequenceEditor value={editing} onClose={() => setEditing(null)} />
    </div>
  )
}

function EnrolledRow({ prospectId, sequence, onOpen }: { prospectId: string; sequence: Sequence; onOpen: (id: string) => void }) {
  const { state, unenroll } = useStore()
  const p = state.prospects.find((x) => x.id === prospectId)
  if (!p?.enrollment) return null
  const step = p.enrollment.step
  return (
    <motion.li layout initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} transition={spring.smooth} className="flex items-center gap-3 rounded-md border bg-surface p-2.5">
      <CompanyMark name={p.company} className="size-7" />
      <button type="button" onClick={() => onOpen(p.id)} className="min-w-0 flex-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <span className="block truncate text-sm font-medium">{p.company}</span>
        <span className="block truncate text-xs text-muted-foreground">Step {step + 1} of {sequence.steps.length}: {sequence.steps[step]?.title.replaceAll("{company}", p.company).replaceAll("{contact}", p.contact.split(" ")[0])}</span>
      </button>
      <span className="flex gap-0.5" aria-label={`Step ${step + 1} of ${sequence.steps.length}`}>
        {sequence.steps.map((s, i) => (
          <motion.span key={s.id} className={cn("h-3 w-1.5", i < step ? "bg-primary" : i === step ? "bg-primary/50" : "bg-muted")} initial={false} animate={{ scaleY: i === step ? [1, 1.3, 1] : 1 }} transition={{ duration: 1.4, repeat: i === step ? Infinity : 0 }} />
        ))}
      </span>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={`Remove ${p.company} from sequence`}
        className="text-muted-foreground"
        onClick={() => {
          unenroll(p.id)
          toast(`${p.company} removed from "${sequence.name}"`)
        }}
      >
        <X />
      </Button>
    </motion.li>
  )
}

function EnrolDialog({ sequence, onClose }: { sequence: Sequence | null; onClose: () => void }) {
  const { state, enroll } = useStore()
  const [picked, setPicked] = React.useState<string[]>([])
  React.useEffect(() => setPicked([]), [sequence])
  const candidates = state.prospects
    .filter((p) => isOpen(p) && p.enrollment?.sequenceId !== sequence?.id)
    .sort((a, b) => leadScore(b) - leadScore(a))
  return (
    <Dialog open={Boolean(sequence)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl font-light">Enrol in {sequence?.name}</DialogTitle>
          <DialogDescription>Anyone already in another sequence moves to this one. Their first step is due today.</DialogDescription>
        </DialogHeader>
        <ul className="-mx-2 max-h-80 overflow-y-auto">
          {candidates.map((p) => (
            <li key={p.id}>
              <label className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-accent">
                <Checkbox checked={picked.includes(p.id)} onCheckedChange={(v) => setPicked((x) => (v === true ? [...x, p.id] : x.filter((i) => i !== p.id)))} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{p.company}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {p.contact}
                    {p.enrollment ? ` · in ${state.sequences.find((s) => s.id === p.enrollment!.sequenceId)?.name}` : ""}
                  </span>
                </span>
                <StageBadge stage={p.stage} className="hidden sm:inline-flex" />
                <ScoreBadge score={leadScore(p)} />
              </label>
            </li>
          ))}
        </ul>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            disabled={!picked.length}
            onClick={() => {
              picked.forEach((id) => enroll(id, sequence!.id))
              toast.success(`Enrolled ${picked.length} in "${sequence!.name}"`, { description: "First steps are in their owners' Inbox." })
              onClose()
            }}
          >
            Enrol {picked.length || ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function SequenceEditor({ value, onClose }: { value: Sequence | null; onClose: () => void }) {
  const { state, saveSequence } = useStore()
  const [draft, setDraft] = React.useState<Sequence | null>(value)
  React.useEffect(() => setDraft(value ? structuredClone(value) : null), [value])
  if (!draft) return <Dialog open={false} />
  const setStep = (i: number, patch: Partial<SequenceStep>) => setDraft({ ...draft, steps: draft.steps.map((s, j) => (j === i ? { ...s, ...patch } : s)) })
  const isNew = !state.sequences.some((s) => s.id === draft.id)
  return (
    <Dialog open={Boolean(value)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl font-light">{isNew ? "New sequence" : `Edit ${draft.name}`}</DialogTitle>
          <DialogDescription>Days count from enrolment. Use {"{company}"} and {"{contact}"} in step text.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Input id="seq-name" aria-label="Sequence name" placeholder="Name, like Warm intro follow-up" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          <Input id="seq-desc" aria-label="Description" placeholder="What it is for" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
        </div>
        <ol className="grid gap-2">
          <AnimatePresence initial={false}>
            {draft.steps.map((s, i) => (
              <motion.li key={s.id} layout initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={spring.smooth} className="flex flex-wrap items-center gap-2 rounded-md border bg-surface p-2">
                <span className="w-5 text-center font-mono text-[11px] text-muted-foreground">{i + 1}</span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  Day
                  <Input aria-label="Day" type="number" min={0} value={s.day} onChange={(e) => setStep(i, { day: Math.max(0, Number(e.target.value) || 0) })} className="h-8 w-16 bg-card font-mono" />
                </span>
                <Select value={s.kind} onValueChange={(v) => setStep(i, { kind: v as SequenceStep["kind"] })}>
                  <SelectTrigger aria-label="Step type" className="h-8 w-28 bg-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(KIND_LABEL) as SequenceStep["kind"][]).map((k) => (
                      <SelectItem key={k} value={k}>{KIND_LABEL[k]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input aria-label="Step" value={s.title} onChange={(e) => setStep(i, { title: e.target.value })} className="h-8 min-w-0 flex-1 basis-40 bg-card" />
                <Button variant="ghost" size="icon-sm" aria-label="Remove step" disabled={draft.steps.length === 1} onClick={() => setDraft({ ...draft, steps: draft.steps.filter((_, j) => j !== i) })} className="text-muted-foreground">
                  <Trash2 />
                </Button>
              </motion.li>
            ))}
          </AnimatePresence>
        </ol>
        <Button
          variant="ghost"
          size="sm"
          className="w-fit text-muted-foreground"
          onClick={() => {
            const last = draft.steps[draft.steps.length - 1]
            setDraft({ ...draft, steps: [...draft.steps, { id: newId("st"), day: (last?.day ?? 0) + 3, kind: "email", title: "Follow up with {contact}" }] })
          }}
        >
          <Plus /> Add step
        </Button>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            disabled={!draft.name.trim()}
            onClick={() => {
              saveSequence({ ...draft, steps: [...draft.steps].sort((a, b) => a.day - b.day) })
              toast.success(isNew ? `Created "${draft.name}"` : `Saved "${draft.name}"`)
              onClose()
            }}
          >
            Save sequence
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
