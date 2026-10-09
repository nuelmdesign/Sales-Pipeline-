/**
 * Automation engine.
 *
 * Every change to the CRM is expressed as an event. `dispatch` finds the
 * enabled automations whose trigger matches, checks their conditions and
 * runs their actions in order. Actions can raise new events (moving a stage
 * raises stage_changed), so one rule can chain into another, up to a depth
 * limit and never re-running the same rule on the same prospect in one chain.
 *
 * Time-based triggers (no contact for N days, overdue next step, lead score
 * reaching a value) are checked by `sweep`, which remembers what it already
 * fired on so a rule fires once per condition, not once per check.
 */
import {
  applyStage,
  at,
  daysFromToday,
  fill,
  isDue,
  isOpen,
  leadScore,
  newId,
  owner,
  stageLabel,
  type Action,
  type Automation,
  type Condition,
  type CRMState,
  type OwnerId,
  type Prospect,
  type StageId,
  type Task,
} from "./data"

export type CRMEvent =
  | { type: "prospect_created"; prospectId: string }
  | { type: "stage_changed"; prospectId: string; from: StageId; to: StageId }
  | { type: "meeting_booked"; prospectId: string }
  | { type: "touched"; prospectId: string }

const MAX_DEPTH = 3

/* ---------------- conditions ---------------- */

export function conditionMet(c: Condition, p: Prospect) {
  const actual: string | number =
    c.field === "value" ? p.value : c.field === "fit" ? p.fit : (p[c.field] as string)
  switch (c.op) {
    case "is":
      return String(actual) === c.value
    case "is_not":
      return String(actual) !== c.value
    case "gte":
      return Number(actual) >= Number(c.value)
    case "lte":
      return Number(actual) <= Number(c.value)
  }
}

export const conditionsMet = (a: Automation, p: Prospect) => a.conditions.every((c) => conditionMet(c, p))

function triggerMatches(a: Automation, e: CRMEvent) {
  const t = a.trigger
  if (e.type === "prospect_created") return t.type === "prospect_created"
  if (e.type === "meeting_booked") return t.type === "meeting_booked"
  if (e.type === "stage_changed") return t.type === "stage_changed" && (t.to === "any" || t.to === e.to)
  return false
}

/* ---------------- helpers that mutate a draft ---------------- */

function dueAt(days: number) {
  // Same-day tasks are due at end of day; future ones first thing.
  return days <= 0 ? at(0, 17) : at(days, 9)
}

function nextOwner(draft: CRMState, p: Prospect): OwnerId {
  const r = draft.routing
  if (r.mode === "by_industry" && r.industryMap[p.industry]) return r.industryMap[p.industry]!
  const pool = r.pool.length ? r.pool : (["em"] as OwnerId[])
  const pick = pool[r.cursor % pool.length]
  r.cursor = (r.cursor + 1) % pool.length
  return pick
}

function dropPendingSequenceTasks(draft: CRMState, prospectId: string) {
  draft.tasks = draft.tasks.filter(
    (t) => !(t.prospectId === prospectId && !t.done && t.source.kind === "sequence")
  )
}

export function sequenceTask(draft: CRMState, p: Prospect, sequenceId: string, step: number): Task | null {
  const seq = draft.sequences.find((s) => s.id === sequenceId)
  const s = seq?.steps[step]
  if (!seq || !s) return null
  const start = p.enrollment ? new Date(p.enrollment.startedAt).getTime() : Date.now()
  const due = new Date(Math.max(Date.now(), start + s.day * 86_400_000))
  due.setHours(9, 0, 0, 0)
  return {
    id: newId("t"),
    prospectId: p.id,
    title: fill(s.title, p),
    due: due.toISOString(),
    owner: p.owner,
    priority: "normal",
    done: false,
    source: { kind: "sequence", id: seq.id, name: seq.name, step },
  }
}

/** Applies one action. Returns a sentence for the run log (or null if nothing changed) and any follow-up events. */
function applyAction(
  draft: CRMState,
  p: Prospect,
  action: Action,
  auto: Automation
): { step: string | null; events: CRMEvent[] } {
  const now = new Date().toISOString()
  switch (action.type) {
    case "create_task": {
      const title = fill(action.title, p)
      draft.tasks.push({
        id: newId("t"),
        prospectId: p.id,
        title,
        due: dueAt(action.dueInDays),
        owner: p.owner,
        priority: action.priority,
        done: false,
        source: { kind: "automation", id: auto.id, name: auto.name },
      })
      return { step: `Created ${action.priority === "high" ? "high-priority " : ""}task "${title}"`, events: [] }
    }
    case "move_stage": {
      if (p.stage === action.to) return { step: null, events: [] }
      const from = p.stage
      applyStage(p, action.to)
      p.activities.unshift({ id: newId("a"), kind: "stage", text: `Moved to ${stageLabel(action.to)}`, at: now })
      return {
        step: `Moved to ${stageLabel(action.to)}`,
        events: [{ type: "stage_changed", prospectId: p.id, from, to: action.to }],
      }
    }
    case "assign_owner": {
      const next = action.owner === "round_robin" ? nextOwner(draft, p) : action.owner
      p.owner = next
      draft.tasks.forEach((t) => {
        if (t.prospectId === p.id && !t.done) t.owner = next
      })
      return {
        step: `Assigned to ${owner(next).name}${action.owner === "round_robin" ? (draft.routing.mode === "by_industry" ? " (by industry)" : " (round robin)") : ""}`,
        events: [],
      }
    }
    case "enroll_sequence": {
      const seq = draft.sequences.find((s) => s.id === action.sequenceId)
      if (!seq) return { step: null, events: [] }
      if (p.enrollment?.sequenceId === seq.id) return { step: null, events: [] }
      dropPendingSequenceTasks(draft, p.id)
      p.enrollment = { sequenceId: seq.id, step: 0, startedAt: now }
      const t = sequenceTask(draft, p, seq.id, 0)
      if (t) draft.tasks.push(t)
      return { step: `Enrolled in "${seq.name}"`, events: [] }
    }
    case "unenroll_sequence": {
      if (!p.enrollment) return { step: null, events: [] }
      const name = draft.sequences.find((s) => s.id === p.enrollment!.sequenceId)?.name ?? "sequence"
      dropPendingSequenceTasks(draft, p.id)
      p.enrollment = null
      return { step: `Stopped "${name}"`, events: [] }
    }
    case "notify": {
      const text = fill(action.text, p)
      draft.notices.unshift({
        id: newId("n"),
        kind: "automation",
        text,
        prospectId: p.id,
        automationId: auto.id,
        at: now,
        read: false,
      })
      return { step: `Notified ${owner(p.owner).first}`, events: [] }
    }
    case "set_next_step": {
      const text = fill(action.text, p)
      p.nextStep = text
      p.nextDue = dueAt(action.dueInDays)
      draft.tasks = draft.tasks.filter((t) => !(t.prospectId === p.id && t.isNextStep && !t.done))
      draft.tasks.push({
        id: newId("t"),
        prospectId: p.id,
        title: text,
        due: p.nextDue,
        owner: p.owner,
        priority: "normal",
        done: false,
        source: { kind: "automation", id: auto.id, name: auto.name },
        isNextStep: true,
      })
      return { step: `Set next step "${text}"`, events: [] }
    }
  }
}

/* ---------------- running a rule ---------------- */

function fire(
  draft: CRMState,
  auto: Automation,
  p: Prospect,
  chained: boolean,
  seen: Set<string>,
  depth: number
) {
  const key = `${auto.id}:${p.id}`
  if (seen.has(key)) return
  seen.add(key)

  const steps: string[] = []
  const follow: CRMEvent[] = []
  for (const action of auto.actions) {
    const { step, events } = applyAction(draft, p, action, auto)
    if (step) steps.push(step)
    follow.push(...events)
  }
  if (steps.length === 0) return

  const now = new Date().toISOString()
  auto.runs += 1
  auto.lastRunAt = now
  p.activities.unshift({ id: newId("a"), kind: "automation", text: `${auto.name}: ${steps.join(", ")}`, at: now })
  draft.runs.unshift({
    id: newId("r"),
    automationId: auto.id,
    automationName: auto.name,
    prospectId: p.id,
    company: p.company,
    at: now,
    steps,
    chained,
  })
  draft.runs = draft.runs.slice(0, 200)

  for (const e of follow) run(draft, e, depth + 1, seen)
}

function checkScore(draft: CRMState, p: Prospect, seen: Set<string>, depth: number, only?: string) {
  const score = leadScore(p)
  for (const a of draft.automations) {
    if (!a.enabled || a.trigger.type !== "score_above" || (only && a.id !== only)) continue
    const key = `${a.id}:${p.id}`
    if (score >= a.trigger.value && isOpen(p)) {
      if (!draft.fired[key] && conditionsMet(a, p)) {
        draft.fired[key] = "1"
        fire(draft, a, p, depth > 0, seen, depth)
      }
    } else if (draft.fired[key]) {
      delete draft.fired[key] // re-arm once the score drops back
    }
  }
}

function run(draft: CRMState, e: CRMEvent, depth: number, seen: Set<string>) {
  if (depth > MAX_DEPTH) return
  const p = draft.prospects.find((x) => x.id === e.prospectId)
  if (!p) return
  if (e.type !== "touched") {
    for (const a of draft.automations) {
      if (a.enabled && triggerMatches(a, e) && conditionsMet(a, p)) fire(draft, a, p, depth > 0, seen, depth)
    }
  }
  checkScore(draft, p, seen, depth)
}

/** Applies an event to a copy of the state and returns the new state. */
export function dispatch(state: CRMState, e: CRMEvent): CRMState {
  const draft = structuredClone(state)
  run(draft, e, 0, new Set())
  return draft
}

/** Checks time-based rules across every prospect. Pass an id to check one rule. */
export function sweep(state: CRMState, onlyAutomation?: string): CRMState {
  const draft = structuredClone(state)
  const seen = new Set<string>()
  for (const p of draft.prospects) {
    for (const a of draft.automations) {
      if (!a.enabled || (onlyAutomation && a.id !== onlyAutomation)) continue
      const key = `${a.id}:${p.id}`
      if (a.trigger.type === "inactive") {
        const idle = -daysFromToday(p.lastTouch)
        if (isOpen(p) && idle >= a.trigger.days && draft.fired[key] !== p.lastTouch && conditionsMet(a, p)) {
          draft.fired[key] = p.lastTouch
          fire(draft, a, p, false, seen, 0)
        }
      } else if (a.trigger.type === "overdue") {
        if (isDue(p) && daysFromToday(p.nextDue!) < 0 && draft.fired[key] !== p.nextDue && conditionsMet(a, p)) {
          draft.fired[key] = p.nextDue!
          fire(draft, a, p, false, seen, 0)
        }
      }
    }
    checkScore(draft, p, seen, 0, onlyAutomation)
  }
  return draft
}

/** Which prospects a rule would act on right now (for the builder's live preview). */
export function previewMatches(state: CRMState, a: Automation): Prospect[] {
  return state.prospects.filter((p) => {
    if (!conditionsMet(a, p)) return false
    const t = a.trigger
    switch (t.type) {
      case "inactive":
        return isOpen(p) && -daysFromToday(p.lastTouch) >= t.days
      case "overdue":
        return isDue(p) && daysFromToday(p.nextDue!) < 0
      case "score_above":
        return isOpen(p) && leadScore(p) >= t.value
      case "stage_changed":
        return t.to === "any" ? isOpen(p) : p.stage === t.to
      default:
        return isOpen(p)
    }
  })
}
