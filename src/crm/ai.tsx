/**
 * AI layer. Uses the artifact's `sample` capability (Claude, on the viewer's
 * own account) when it is available, and rule-based fallbacks otherwise, so
 * every AI surface still does something useful when Claude is not allowed.
 */
import * as React from "react"

import {
  ACTION_OPTIONS,
  INDUSTRIES,
  OWNERS,
  STAGES,
  TRIGGER_OPTIONS,
  daysFromToday,
  fill,
  isCold,
  isOpen,
  leadScore,
  money,
  newId,
  owner,
  relative,
  scoreBreakdown,
  stageLabel,
  type Action,
  type Automation,
  type CRMState,
  type Condition,
  type Prospect,
  type StageId,
  type Trigger,
} from "./data"

/* ---------------- capability plumbing ---------------- */

type SampleFn = ((input: unknown, opts?: Record<string, unknown>) => Promise<{ text: string; truncated: boolean }>) & {
  json: <T>(input: unknown, opts?: Record<string, unknown>) => Promise<T>
  limits: () => Promise<{ tools?: { maxCount: number } }>
}

type ClaudeGlobal = { use: (name: string) => Promise<unknown> }

declare global {
  interface Window {
    claude?: ClaudeGlobal
  }
}

export type AIStatus = "checking" | "ready" | "off"

type AICtx = {
  sample: SampleFn | null
  status: AIStatus
  tools: boolean
  /** Call when a request fails with a permanent code, so the UI falls back. */
  disable: () => void
}

const Ctx = React.createContext<AICtx>({ sample: null, status: "off", tools: false, disable: () => {} })

export function AIProvider({ children }: { children: React.ReactNode }) {
  const [sample, setSample] = React.useState<SampleFn | null>(null)
  const [status, setStatus] = React.useState<AIStatus>(() =>
    typeof window !== "undefined" && window.claude?.use ? "checking" : "off"
  )
  const [tools, setTools] = React.useState(false)

  React.useEffect(() => {
    let alive = true
    const c = window.claude
    if (!c?.use) return
    c.use("sample")
      .then(async (fn) => {
        if (!alive) return
        if (!fn) return setStatus("off")
        const s = fn as SampleFn
        setSample(() => s)
        setStatus("ready")
        try {
          const lim = await s.limits()
          if (alive) setTools(Boolean(lim?.tools))
        } catch {
          /* tools stay off */
        }
      })
      .catch(() => alive && setStatus("off"))
    return () => {
      alive = false
    }
  }, [])

  const value = React.useMemo<AICtx>(
    () => ({
      sample: status === "ready" ? sample : null,
      status,
      tools: status === "ready" && tools,
      disable: () => setStatus("off"),
    }),
    [sample, status, tools]
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useAI = () => React.useContext(Ctx)

const PERMANENT = new Set([
  "not_granted",
  "sampling_disabled",
  "not_declared",
  "capability_disabled",
  "capability_removed",
])

export type AIError = { code: string; message?: string; text?: string }

export function isPermanent(e: unknown) {
  return PERMANENT.has((e as AIError)?.code)
}

export function errorCopy(e: unknown) {
  const code = (e as AIError)?.code
  switch (code) {
    case "cancelled":
      return ""
    case "rate_limited":
      return "Claude is busy for you right now. Try again in a minute."
    case "session_expired":
      return "Your Claude session expired. Sign in again to use AI."
    case "refused":
      return "Claude would not answer that. Try rephrasing."
    case "invalid_json":
      return "Claude's answer came back malformed. Try again."
    default:
      return PERMANENT.has(code) ? "AI is switched off for this page, so suggestions come from built-in rules." : "Something interrupted Claude. Try again."
  }
}

/* ---------------- context builders ---------------- */

export function prospectLine(p: Prospect) {
  return [
    p.company,
    `contact ${p.contact} (${p.role})`,
    p.industry,
    p.city,
    `stage ${stageLabel(p.stage)}`,
    `value ${money(p.value)}`,
    `score ${leadScore(p)}`,
    `fit ${p.fit}/5`,
    `last touch ${relative(p.lastTouch).toLowerCase()}`,
    `next step "${p.nextStep}"${p.nextDue ? ` due ${relative(p.nextDue).toLowerCase()}` : ""}`,
    `owner ${owner(p.owner).name}`,
    `source ${p.source}`,
  ].join(" | ")
}

export function pipelineContext(s: CRMState, limit = 40) {
  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
  const openTasks = s.tasks.filter((t) => !t.done)
  const overdue = openTasks.filter((t) => daysFromToday(t.due) < 0).length
  const dueToday = openTasks.filter((t) => daysFromToday(t.due) === 0).length
  return [
    `Today is ${today}. The workspace is OpenDraft Studio, a design studio prospecting for client work. Values are estimated engagement sizes in USD.`,
    `Open tasks: ${openTasks.length} (${overdue} overdue, ${dueToday} due today). Upcoming meetings: ${s.meetings.filter((m) => daysFromToday(m.at) >= 0).length}.`,
    "Prospects:",
    ...s.prospects.slice(0, limit).map((p) => `- ${prospectLine(p)}`),
  ].join("\n")
}

function prospectDetail(s: CRMState, p: Prospect) {
  const tasks = s.tasks.filter((t) => t.prospectId === p.id && !t.done)
  return [
    prospectLine(p),
    `Email: ${p.email}`,
    `Engagement signals: ${p.engagement}`,
    p.enrollment ? `In sequence: ${s.sequences.find((x) => x.id === p.enrollment!.sequenceId)?.name}, step ${p.enrollment.step + 1}` : "Not in a sequence",
    `Open tasks: ${tasks.map((t) => `"${t.title}" due ${relative(t.due).toLowerCase()}`).join("; ") || "none"}`,
    "Recent activity (newest first):",
    ...p.activities.slice(0, 8).map((a) => `- ${relative(a.at)}: ${a.text}`),
  ].join("\n")
}

const VOICE =
  "Write in plain, warm British-leaning English. No em dashes. No buzzwords. Short sentences."

/* ---------------- prompts ---------------- */

export function briefPrompt(s: CRMState) {
  return `${pipelineContext(s)}

Write today's pipeline brief for Emmanuel, the studio owner. Give exactly 4 short bullet points, each starting with "- ". Each bullet names the specific prospect and the specific action. Prioritise money at risk, hot leads and anything overdue. No heading, no intro, no sign-off. ${VOICE}`
}

export function summaryPrompt(s: CRMState, p: Prospect) {
  return `${prospectDetail(s, p)}

Summarise this deal for the account owner in 3 short sentences: where it stands, the main risk, and the one thing to do next. ${VOICE}`
}

export function nbaPrompt(s: CRMState, p: Prospect) {
  return `${prospectDetail(s, p)}

Suggest the next best actions for this deal. Reply with only a JSON array of exactly 3 objects, best first:
[{"action": "short imperative, under 12 words", "why": "one sentence", "confidence": 0-3, "kind": "email"|"call"|"meeting"|"task"|"stage", "stage": "optional stage id when kind is stage"}]
Stage ids: ${STAGES.map((x) => x.id).join(", ")}. ${VOICE}`
}

export function draftPrompt(s: CRMState, p: Prospect, intent: string, tone: string) {
  return `${prospectDetail(s, p)}

Write an email from Emmanuel at OpenDraft Studio to ${p.contact}. Purpose: ${intent}. Tone: ${tone}.
Format: first line "Subject: ...", a blank line, then the body. Under 120 words. Refer to real details from the activity above. End with a clear, low-pressure ask. Sign off as Emmanuel. ${VOICE}`
}

export function automationPrompt(s: CRMState, request: string) {
  return `Turn this request into a CRM automation rule: "${request}"

Reply with only one JSON object of this shape:
{"name": string (under 6 words), "description": string (one sentence),
 "trigger": one of
   {"type":"prospect_created"} | {"type":"stage_changed","to": stage id or "any"} | {"type":"meeting_booked"} |
   {"type":"inactive","days": number} | {"type":"overdue"} | {"type":"score_above","value": number},
 "conditions": [{"field": "industry"|"source"|"owner"|"value"|"fit"|"stage", "op": "is"|"is_not"|"gte"|"lte", "value": string}],
 "actions": array of
   {"type":"create_task","title": string,"dueInDays": number,"priority":"high"|"normal"} |
   {"type":"move_stage","to": stage id} | {"type":"assign_owner","owner": owner id or "round_robin"} |
   {"type":"enroll_sequence","sequenceId": sequence id} | {"type":"unenroll_sequence"} |
   {"type":"notify","text": string} | {"type":"set_next_step","text": string,"dueInDays": number}
}
Stage ids: ${STAGES.map((x) => `${x.id} (${x.label})`).join(", ")}.
Owner ids: ${OWNERS.map((o) => `${o.id} (${o.name})`).join(", ")}.
Sequence ids: ${s.sequences.map((q) => `${q.id} (${q.name})`).join(", ")}.
Industries: ${INDUSTRIES.join(", ")}.
Text fields may use {company}, {contact} and {owner} placeholders. Use only the ids listed. ${VOICE}`
}

/* ---------------- validation of AI-made rules ---------------- */

const STAGE_IDS = STAGES.map((x) => x.id) as string[]
const OWNER_IDS = OWNERS.map((o) => o.id) as string[]

export function sanitizeAutomation(raw: unknown, s: CRMState): Automation | null {
  if (!raw || typeof raw !== "object") return null
  const r = raw as Record<string, unknown>
  const t = r.trigger as Record<string, unknown> | undefined
  let trigger: Trigger | null = null
  switch (t?.type) {
    case "prospect_created":
    case "meeting_booked":
    case "overdue":
      trigger = { type: t.type }
      break
    case "stage_changed":
      trigger = { type: "stage_changed", to: (STAGE_IDS.includes(String(t.to)) ? t.to : "any") as StageId | "any" }
      break
    case "inactive":
      trigger = { type: "inactive", days: Math.max(1, Math.min(120, Number(t.days) || 14)) }
      break
    case "score_above":
      trigger = { type: "score_above", value: Math.max(1, Math.min(100, Number(t.value) || 75)) }
      break
  }
  if (!trigger) return null

  const conditions: Condition[] = (Array.isArray(r.conditions) ? r.conditions : [])
    .map((c: Record<string, unknown>) => ({
      id: newId("c"),
      field: String(c.field) as Condition["field"],
      op: String(c.op) as Condition["op"],
      value: String(c.value ?? ""),
    }))
    .filter((c) => ["industry", "source", "owner", "value", "fit", "stage"].includes(c.field) && ["is", "is_not", "gte", "lte"].includes(c.op))

  const actions: Action[] = (Array.isArray(r.actions) ? r.actions : [])
    .map((a: Record<string, unknown>): Action | null => {
      switch (a.type) {
        case "create_task":
          return { type: "create_task", title: String(a.title || "Follow up with {contact}"), dueInDays: Math.max(0, Number(a.dueInDays) || 0), priority: a.priority === "high" ? "high" : "normal" }
        case "move_stage":
          return STAGE_IDS.includes(String(a.to)) ? { type: "move_stage", to: a.to as StageId } : null
        case "assign_owner":
          return { type: "assign_owner", owner: OWNER_IDS.includes(String(a.owner)) ? (a.owner as "em") : "round_robin" }
        case "enroll_sequence":
          return s.sequences.some((q) => q.id === a.sequenceId) ? { type: "enroll_sequence", sequenceId: String(a.sequenceId) } : null
        case "unenroll_sequence":
          return { type: "unenroll_sequence" }
        case "notify":
          return { type: "notify", text: String(a.text || "{company} needs attention") }
        case "set_next_step":
          return { type: "set_next_step", text: String(a.text || "Check in with {contact}"), dueInDays: Math.max(0, Number(a.dueInDays) || 1) }
        default:
          return null
      }
    })
    .filter(Boolean) as Action[]
  if (!actions.length) return null

  return {
    id: newId("au"),
    name: String(r.name || "New automation").slice(0, 60),
    description: String(r.description || ""),
    enabled: true,
    trigger,
    conditions,
    actions,
    runs: 0,
    lastRunAt: null,
    origin: "ai",
    createdAt: new Date().toISOString(),
  }
}

/* ---------------- rule-based fallbacks ---------------- */

export function fallbackBrief(s: CRMState): string[] {
  const open = s.prospects.filter(isOpen)
  const lines: string[] = []
  const overdue = s.tasks
    .filter((t) => !t.done && daysFromToday(t.due) < 0 && t.prospectId)
    .map((t) => ({ t, p: s.prospects.find((p) => p.id === t.prospectId)! }))
    .filter((x) => x.p)
    .sort((a, b) => b.p.value - a.p.value)
  if (overdue[0]) lines.push(`${overdue[0].p.company} has an overdue task: "${overdue[0].t.title}". Clear it first, it is ${money(overdue[0].p.value)} of pipeline.`)
  const hot = [...open].sort((a, b) => leadScore(b) - leadScore(a))[0]
  if (hot) lines.push(`${hot.company} is your hottest lead at ${leadScore(hot)}. Keep momentum: ${hot.nextStep.toLowerCase()}.`)
  const cold = open.filter(isCold).sort((a, b) => b.value - a.value)[0]
  if (cold) lines.push(`${cold.company} has gone quiet for ${-daysFromToday(cold.lastTouch)} days. Send something useful, not a nudge.`)
  const meet = s.meetings.filter((m) => daysFromToday(m.at) >= 0)[0]
  if (meet) {
    const p = s.prospects.find((x) => x.id === meet.prospectId)
    if (p) lines.push(`Prep for "${meet.title}" with ${p.company} ${relative(meet.at).toLowerCase()}.`)
  }
  return lines.slice(0, 4)
}

export type NBA = { action: string; why: string; confidence: number; kind: string; stage?: string }

export function fallbackNBA(s: CRMState, p: Prospect): NBA[] {
  const out: NBA[] = []
  const idle = -daysFromToday(p.lastTouch)
  const hasMeeting = s.meetings.some((m) => m.prospectId === p.id && daysFromToday(m.at) >= 0)
  if (idle >= 14) out.push({ action: `Send ${p.contact.split(" ")[0]} a useful idea for ${p.company}`, why: `No contact for ${idle} days, so lead with value.`, confidence: 3, kind: "email" })
  if (p.stage === "replied" && !hasMeeting) out.push({ action: "Book a discovery call", why: "They replied, so the next step is a conversation.", confidence: 3, kind: "meeting" })
  if (p.stage === "proposal") out.push({ action: "Call to walk through the proposal", why: "Proposals close faster after a live walkthrough.", confidence: 2, kind: "call" })
  if (p.stage === "meeting" && hasMeeting) out.push({ action: "Send the agenda and one pre-read", why: "A clear agenda raises show rates.", confidence: 2, kind: "email" })
  if (p.stage === "researching") out.push({ action: "Move to Contacted after first touch", why: "Research is done when you have a reason to reach out.", confidence: 2, kind: "stage", stage: "contacted" })
  if (p.fit >= 4 && !p.enrollment && ["researching", "contacted"].includes(p.stage)) out.push({ action: "Enrol in Cold outreach", why: "Strong fit, and a sequence keeps touches consistent.", confidence: 1, kind: "task" })
  out.push({ action: `Log a quick check-in with ${p.contact.split(" ")[0]}`, why: "Keeps the record current for the team.", confidence: 1, kind: "call" })
  return out.slice(0, 3)
}

export function fallbackSummary(s: CRMState, p: Prospect) {
  const { score } = scoreBreakdown(p)
  const idle = -daysFromToday(p.lastTouch)
  const risk = idle >= 14 ? `it has gone quiet for ${idle} days` : p.fit <= 2 ? "fit is weak" : p.value >= 40000 && p.stage !== "won" ? "a lot of value rides on the next step" : "nothing urgent"
  return `${p.company} is at ${stageLabel(p.stage)} worth ${money(p.value)} with a lead score of ${score}. The main risk is that ${risk}. Next, ${p.nextStep.toLowerCase()}.`
}

export function fallbackDraft(p: Prospect, intent: string) {
  const first = p.contact.split(" ")[0]
  return fill(
    `Subject: ${p.company} next steps

Hi ${first},

Following up on our last conversation. ${intent.charAt(0).toUpperCase() + intent.slice(1)}.

I put together a couple of thoughts specific to {company} that I think would be useful whatever you decide. Would 20 minutes this week work to go through them?

Best,
Emmanuel`,
    p
  )
}

/** Small keyword parser so the automation builder works without Claude. */
export function fallbackAutomation(request: string, s: CRMState): Automation | null {
  const q = request.toLowerCase()
  let trigger: Trigger = { type: "stage_changed", to: "any" }
  const stage = STAGES.find((x) => q.includes(x.label.toLowerCase()) || q.includes(x.id))
  const days = Number(q.match(/(\d+)\s*day/)?.[1])
  const score = Number(q.match(/score[^0-9]*(\d+)/)?.[1])
  if (/new (prospect|lead)|is added|gets added|created/.test(q)) trigger = { type: "prospect_created" }
  else if (/meeting|booked|books/.test(q)) trigger = { type: "meeting_booked" }
  else if (/overdue|late/.test(q)) trigger = { type: "overdue" }
  else if (score) trigger = { type: "score_above", value: score }
  else if (/quiet|no contact|inactive|haven.t|silent|cold/.test(q)) trigger = { type: "inactive", days: days || 14 }
  else if (stage) trigger = { type: "stage_changed", to: stage.id }

  const actions: Action[] = []
  if (/assign|route|round robin/.test(q)) actions.push({ type: "assign_owner", owner: "round_robin" })
  if (/notify|alert|tell|ping|let me know/.test(q)) actions.push({ type: "notify", text: "{company} needs your attention" })
  const seq = s.sequences.find((x) => q.includes(x.name.toLowerCase()))
  if (/sequence|cadence|enrol|enroll/.test(q) && !/stop/.test(q)) actions.push({ type: "enroll_sequence", sequenceId: (seq ?? s.sequences[0]).id })
  if (/stop/.test(q) && /sequence/.test(q)) actions.push({ type: "unenroll_sequence" })
  if (/task|remind|follow up|follow-up|call/.test(q) || actions.length === 0)
    actions.push({ type: "create_task", title: /call/.test(q) ? "Call {contact}" : "Follow up with {contact}", dueInDays: /today|now|immediately/.test(q) ? 0 : 1, priority: /urgent|asap|high|immediately/.test(q) ? "high" : "normal" })

  const conditions: Condition[] = []
  const ind = INDUSTRIES.find((i) => q.includes(i.toLowerCase()))
  if (ind) conditions.push({ id: newId("c"), field: "industry", op: "is", value: ind })
  const value = q.match(/\$?\s?(\d+)\s?k\b/)
  if (value) conditions.push({ id: newId("c"), field: "value", op: "gte", value: String(Number(value[1]) * 1000) })

  const subject = `${ind ? `${ind} ` : ""}${ind ? "deals" : "Deals"}`
  const short: Record<Trigger["type"], string> = {
    prospect_created: `New ${ind ? `${ind} ` : ""}prospects`,
    meeting_booked: `${subject} with a meeting booked`,
    overdue: `${subject} with overdue next steps`,
    inactive: `${subject} going quiet`,
    score_above: `${subject} scoring ${trigger.type === "score_above" ? trigger.value : ""}+`,
    stage_changed: trigger.type === "stage_changed" && trigger.to !== "any" ? `${subject} moved to ${stageLabel(trigger.to)}` : `${subject} changing stage`,
  }
  void TRIGGER_OPTIONS
  return {
    id: newId("au"),
    name: short[trigger.type].charAt(0).toUpperCase() + short[trigger.type].slice(1),
    description: `Built from: "${request}"`,
    enabled: true,
    trigger,
    conditions,
    actions,
    runs: 0,
    lastRunAt: null,
    origin: "custom",
    createdAt: new Date().toISOString(),
  }
}

export const ACTION_LABEL = Object.fromEntries(ACTION_OPTIONS.map((a) => [a.type, a.label]))
