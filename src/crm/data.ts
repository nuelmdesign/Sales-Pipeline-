/* ------------------------------------------------------------------ */
/* Reference data                                                       */
/* ------------------------------------------------------------------ */

export const STAGES = [
  { id: "researching", label: "Researching", probability: 0.05 },
  { id: "contacted", label: "Contacted", probability: 0.1 },
  { id: "replied", label: "Replied", probability: 0.25 },
  { id: "meeting", label: "Meeting booked", probability: 0.45 },
  { id: "proposal", label: "Proposal sent", probability: 0.7 },
  { id: "won", label: "Won", probability: 1 },
  { id: "lost", label: "Lost", probability: 0 },
] as const

export type StageId = (typeof STAGES)[number]["id"]

export const OPEN_STAGES: StageId[] = [
  "researching",
  "contacted",
  "replied",
  "meeting",
  "proposal",
]

export const INDUSTRIES = [
  "Fintech",
  "Health",
  "Logistics",
  "Education",
  "Consumer",
  "Climate",
  "Media",
] as const
export type Industry = (typeof INDUSTRIES)[number]

export const SOURCES = [
  "Referral",
  "LinkedIn",
  "Inbound",
  "Event",
  "Cold outbound",
] as const
export type Source = (typeof SOURCES)[number]

export type Owner = { id: string; name: string; first: string; initials: string; avatarUrl?: string }
export type OwnerId = string

export const DEMO_OWNERS: Owner[] = [
  { id: "em", name: "Emmanuel Michael", first: "Emmanuel", initials: "EM" },
  { id: "ib", name: "Ibukun A.", first: "Ibukun", initials: "IA" },
  { id: "to", name: "Tosin O.", first: "Tosin", initials: "TO" },
]

/**
 * The team directory. In demo mode it holds the sample team; in a shared
 * workspace it holds real teammates, resolved from their ids at render time.
 * It is a live array so every screen reads the current team.
 */
export const OWNERS: Owner[] = [...DEMO_OWNERS]

export function setOwners(list: Owner[]) {
  OWNERS.splice(0, OWNERS.length, ...list)
}

export function ownerFromName(id: string, name: string, avatarUrl?: string): Owner {
  const clean = name.trim() || "Teammate"
  const parts = clean.split(/\s+/)
  return {
    id,
    name: clean,
    first: parts[0],
    initials: (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : clean.slice(0, 2)).toUpperCase(),
    avatarUrl,
  }
}

/* ------------------------------------------------------------------ */
/* Records                                                              */
/* ------------------------------------------------------------------ */

export type ActivityKind = "email" | "call" | "meeting" | "note" | "stage" | "automation" | "ai"

export type Activity = {
  id: string
  kind: ActivityKind
  text: string
  at: string // ISO
  /** Who did it. Empty for automations. */
  by?: OwnerId
}

export type Company = {
  id: string
  name: string
  domain: string
  industry: Industry
  city: string
  notes: string
  createdAt: string
}

export type Contact = {
  id: string
  companyId: string
  name: string
  role: string
  email: string
  phone: string
  createdAt: string
}

export type StageEvent = { stage: StageId; at: string }

export type Enrollment = {
  sequenceId: string
  step: number // index of the step currently waiting
  startedAt: string
}

export type Prospect = {
  id: string
  company: string
  domain: string
  industry: Industry
  city: string
  contact: string
  role: string
  email: string
  stage: StageId
  value: number // USD, estimated engagement size
  fit: number // 1–5, ideal client match
  engagement: number // 0–10, opens, clicks, replies
  source: Source
  owner: OwnerId
  lastTouch: string
  nextStep: string
  nextDue: string | null
  createdAt: string
  enrollment: Enrollment | null
  activities: Activity[]
  /** The company record this deal belongs to. */
  companyId: string
  /** People on this deal; the first is the main contact. */
  contactIds: string[]
  expectedClose: string | null
  closedAt: string | null
  stageHistory: StageEvent[]
}

export type TaskSource =
  | { kind: "manual" }
  | { kind: "automation"; id: string; name: string }
  | { kind: "sequence"; id: string; name: string; step: number }
  | { kind: "ai" }

export type Task = {
  id: string
  prospectId: string | null
  title: string
  due: string
  owner: OwnerId
  priority: "high" | "normal"
  done: boolean
  doneAt?: string
  source: TaskSource
  /** Completing this task clears the prospect's next-step due date. */
  isNextStep?: boolean
}

export type Notice = {
  id: string
  kind: "automation" | "ai" | "system" | "meeting"
  text: string
  prospectId?: string
  automationId?: string
  at: string
  read: boolean
}

export type Meeting = {
  id: string
  prospectId: string
  owner: OwnerId
  at: string
  minutes: number
  title: string
  /** Set when the meeting was also put on Google Calendar. */
  calendarLink?: string
  meetUrl?: string
}

/* ------------------------------------------------------------------ */
/* Automations                                                          */
/* ------------------------------------------------------------------ */

export type Trigger =
  | { type: "prospect_created" }
  | { type: "stage_changed"; to: StageId | "any" }
  | { type: "meeting_booked" }
  | { type: "inactive"; days: number }
  | { type: "overdue" }
  | { type: "score_above"; value: number }

export type ConditionField = "industry" | "source" | "owner" | "value" | "fit" | "stage"
export type ConditionOp = "is" | "is_not" | "gte" | "lte"

export type Condition = {
  id: string
  field: ConditionField
  op: ConditionOp
  value: string
}

export type Action =
  | { type: "create_task"; title: string; dueInDays: number; priority: "high" | "normal" }
  | { type: "move_stage"; to: StageId }
  | { type: "assign_owner"; owner: OwnerId | "round_robin" }
  | { type: "enroll_sequence"; sequenceId: string }
  | { type: "unenroll_sequence" }
  | { type: "notify"; text: string }
  | { type: "set_next_step"; text: string; dueInDays: number }

export type ActionType = Action["type"]

export type Automation = {
  id: string
  name: string
  description: string
  enabled: boolean
  trigger: Trigger
  conditions: Condition[]
  actions: Action[]
  runs: number
  lastRunAt: string | null
  origin: "template" | "ai" | "custom"
  createdAt: string
}

export type Run = {
  id: string
  automationId: string
  automationName: string
  prospectId: string
  company: string
  at: string
  steps: string[]
  chained: boolean
}

export type SequenceStep = {
  id: string
  day: number // offset from enrolment
  kind: "email" | "call" | "linkedin" | "task"
  title: string
}

export type Sequence = {
  id: string
  name: string
  description: string
  steps: SequenceStep[]
  exitOnReply: boolean
}

export type Routing = {
  mode: "round_robin" | "by_industry"
  pool: OwnerId[]
  cursor: number
  industryMap: Partial<Record<Industry, OwnerId>>
}

export type CRMState = {
  version: 3
  prospects: Prospect[]
  companies: Company[]
  contacts: Contact[]
  tasks: Task[]
  notices: Notice[]
  meetings: Meeting[]
  automations: Automation[]
  runs: Run[]
  sequences: Sequence[]
  routing: Routing
  /** automationId:prospectId -> token, so time-based rules fire once per condition. */
  fired: Record<string, string>
}

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

export const DAY = 86_400_000

export function newId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
}

export function at(daysFromToday: number, hour = 10, minute = 0) {
  const d = new Date()
  d.setHours(hour, minute, 0, 0)
  return new Date(d.getTime() + daysFromToday * DAY).toISOString()
}

function startOfDay(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

export function daysFromToday(iso: string) {
  return Math.round(
    (startOfDay(new Date(iso)).getTime() - startOfDay(new Date()).getTime()) / DAY
  )
}

export function relative(iso: string) {
  const d = daysFromToday(iso)
  if (d === 0) return "Today"
  if (d === -1) return "Yesterday"
  if (d === 1) return "Tomorrow"
  if (d < 0) return `${-d}d ago`
  return `In ${d}d`
}

export function timeAgo(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 45) return "Just now"
  if (s < 3600) return `${Math.round(s / 60)}m ago`
  if (s < 86400) return `${Math.round(s / 3600)}h ago`
  return relative(iso)
}

export function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
}

export function clock(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
}

/** Moves a deal to a stage and keeps its history and close date right. */
export function applyStage(p: Prospect, stage: StageId, when = new Date().toISOString()) {
  p.stage = stage
  p.stageHistory = [...(p.stageHistory ?? []), { stage, at: when }]
  p.closedAt = stage === "won" || stage === "lost" ? when : null
}

export const COLD_AFTER_DAYS = 14

export const isOpen = (p: Prospect) => OPEN_STAGES.includes(p.stage)

export function isCold(p: Prospect) {
  return isOpen(p) && -daysFromToday(p.lastTouch) >= COLD_AFTER_DAYS
}

export function isDue(p: Prospect) {
  return isOpen(p) && p.nextDue !== null && daysFromToday(p.nextDue) <= 0
}

export const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })

export const compactMoney = (n: number) =>
  n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  })

export const stageLabel = (id: StageId) => STAGES.find((s) => s.id === id)?.label ?? id
export const stageProbability = (id: StageId) => STAGES.find((s) => s.id === id)?.probability ?? 0

export const owner = (id: OwnerId): Owner =>
  OWNERS.find((o) => o.id === id) ?? { id, name: "Former teammate", first: "Teammate", initials: "–", avatarUrl: undefined }

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

export function fill(template: string, p: Prospect) {
  return template
    .replaceAll("{company}", p.company)
    .replaceAll("{contact}", p.contact.split(" ")[0])
    .replaceAll("{owner}", owner(p.owner).first)
}

/* ------------------------------------------------------------------ */
/* Lead scoring (HubSpot / Salesforce style, explainable)               */
/* ------------------------------------------------------------------ */

const STAGE_POINTS: Record<StageId, number> = {
  researching: 0,
  contacted: 5,
  replied: 12,
  meeting: 18,
  proposal: 22,
  won: 25,
  lost: 0,
}

const SOURCE_POINTS: Record<Source, number> = {
  Referral: 8,
  Inbound: 7,
  Event: 5,
  LinkedIn: 3,
  "Cold outbound": 1,
}

export type ScoreFactor = { key: string; label: string; points: number; max: number; note: string }

export function scoreBreakdown(p: Prospect): { score: number; factors: ScoreFactor[] } {
  const idle = -daysFromToday(p.lastTouch)
  const recency = idle <= 2 ? 15 : idle <= 7 ? 10 : idle <= 14 ? 5 : 0
  const factors: ScoreFactor[] = [
    { key: "fit", label: "Ideal client fit", points: p.fit * 8, max: 40, note: `${p.fit} of 5` },
    { key: "stage", label: "Deal stage", points: STAGE_POINTS[p.stage], max: 25, note: stageLabel(p.stage) },
    { key: "recency", label: "Recent contact", points: recency, max: 15, note: idle === 0 ? "Today" : `${idle}d since last touch` },
    {
      key: "engagement",
      label: "Engagement",
      points: Math.round(Math.min(10, p.engagement) * 1.2),
      max: 12,
      note: `${p.engagement} signals`,
    },
    { key: "source", label: "Source quality", points: SOURCE_POINTS[p.source], max: 8, note: p.source },
  ]
  let score = factors.reduce((s, f) => s + f.points, 0)
  if (p.stage === "lost") score = Math.min(score, 10)
  return { score: Math.max(0, Math.min(100, score)), factors }
}

export const leadScore = (p: Prospect) => scoreBreakdown(p).score

export function scoreBand(score: number): { label: string; tone: "success" | "brand" | "warning" | "muted" } {
  if (score >= 75) return { label: "Hot", tone: "success" }
  if (score >= 55) return { label: "Warm", tone: "brand" }
  if (score >= 35) return { label: "Cool", tone: "warning" }
  return { label: "Cold", tone: "muted" }
}

/* ------------------------------------------------------------------ */
/* Human-readable automation copy                                       */
/* ------------------------------------------------------------------ */

export const TRIGGER_OPTIONS: { type: Trigger["type"]; label: string; inspired: string }[] = [
  { type: "prospect_created", label: "A prospect is added", inspired: "HubSpot" },
  { type: "stage_changed", label: "Stage changes", inspired: "Salesforce" },
  { type: "meeting_booked", label: "A meeting is booked", inspired: "Chili Piper" },
  { type: "inactive", label: "No contact for a number of days", inspired: "Zoho" },
  { type: "overdue", label: "A next step goes overdue", inspired: "Zendesk" },
  { type: "score_above", label: "Lead score reaches", inspired: "HubSpot" },
]

export const ACTION_OPTIONS: { type: ActionType; label: string }[] = [
  { type: "create_task", label: "Create a task" },
  { type: "notify", label: "Notify the owner" },
  { type: "move_stage", label: "Move to a stage" },
  { type: "assign_owner", label: "Assign an owner" },
  { type: "enroll_sequence", label: "Enrol in a sequence" },
  { type: "unenroll_sequence", label: "Stop their sequence" },
  { type: "set_next_step", label: "Set the next step" },
]

export const FIELD_OPTIONS: { field: ConditionField; label: string }[] = [
  { field: "industry", label: "Industry" },
  { field: "source", label: "Source" },
  { field: "owner", label: "Owner" },
  { field: "stage", label: "Stage" },
  { field: "value", label: "Est. value" },
  { field: "fit", label: "Fit" },
]

export function describeTrigger(t: Trigger) {
  switch (t.type) {
    case "prospect_created":
      return "When a prospect is added"
    case "stage_changed":
      return t.to === "any" ? "When any stage changes" : `When stage changes to ${stageLabel(t.to)}`
    case "meeting_booked":
      return "When a meeting is booked"
    case "inactive":
      return `When an open deal has no contact for ${t.days} days`
    case "overdue":
      return "When a next step goes overdue"
    case "score_above":
      return `When lead score reaches ${t.value}`
  }
}

export function describeCondition(c: Condition) {
  const field = FIELD_OPTIONS.find((f) => f.field === c.field)?.label ?? c.field
  const value =
    c.field === "owner"
      ? owner(c.value as OwnerId).name
      : c.field === "stage"
        ? stageLabel(c.value as StageId)
        : c.field === "value"
          ? money(Number(c.value))
          : c.value
  const op = { is: "is", is_not: "is not", gte: "is at least", lte: "is at most" }[c.op]
  return `${field} ${op} ${value}`
}

export function describeAction(a: Action, sequences: Sequence[]) {
  switch (a.type) {
    case "create_task":
      return `Create ${a.priority === "high" ? "a high-priority" : "a"} task "${a.title}" due ${a.dueInDays === 0 ? "today" : `in ${a.dueInDays}d`}`
    case "move_stage":
      return `Move to ${stageLabel(a.to)}`
    case "assign_owner":
      return a.owner === "round_robin" ? "Assign an owner by round robin" : `Assign to ${owner(a.owner).name}`
    case "enroll_sequence":
      return `Enrol in "${sequences.find((s) => s.id === a.sequenceId)?.name ?? "a sequence"}"`
    case "unenroll_sequence":
      return "Stop their sequence"
    case "notify":
      return `Notify: "${a.text}"`
    case "set_next_step":
      return `Set next step "${a.text}" due ${a.dueInDays === 0 ? "today" : `in ${a.dueInDays}d`}`
  }
}

export function defaultAction(type: ActionType, sequences: Sequence[]): Action {
  switch (type) {
    case "create_task":
      return { type, title: "Follow up with {contact}", dueInDays: 1, priority: "normal" }
    case "move_stage":
      return { type, to: "contacted" }
    case "assign_owner":
      return { type, owner: "round_robin" }
    case "enroll_sequence":
      return { type, sequenceId: sequences[0]?.id ?? "" }
    case "unenroll_sequence":
      return { type }
    case "notify":
      return { type, text: "{company} needs attention" }
    case "set_next_step":
      return { type, text: "Check in with {contact}", dueInDays: 2 }
  }
}

export function defaultTrigger(type: Trigger["type"]): Trigger {
  switch (type) {
    case "stage_changed":
      return { type, to: "replied" }
    case "inactive":
      return { type, days: 14 }
    case "score_above":
      return { type, value: 75 }
    default:
      return { type } as Trigger
  }
}
