/**
 * The CRM store.
 *
 * Two modes run the same app:
 *  - demo: the sample workspace, kept in this browser only.
 *  - workspace: one shared pipeline in the artifact's database. Every
 *    teammate sees the same records live, and owners are real people.
 *
 * Every change goes through `apply`, which computes the next state, shows it
 * straight away and, in workspace mode, writes only the records that changed.
 */
import * as React from "react"
import { toast } from "sonner"

import {
  DEMO_OWNERS,
  applyStage,
  newId,
  ownerFromName,
  setOwners,
  stageLabel,
  type ActivityKind,
  type Automation,
  type Company,
  type Contact,
  type CRMState,
  type Industry,
  type Meeting,
  type OwnerId,
  type Prospect,
  type Routing,
  type Sequence,
  type Source,
  type StageId,
  type Task,
} from "./data"
import { dispatch, sequenceTask, sweep } from "./engine"
import { AUTOMATIONS, SEQUENCES, buildState } from "./seed"

/* ------------------------------------------------------------------ */
/* Who "me" is. A live binding: demo uses the sample owner, a workspace */
/* uses the viewer's own id.                                            */
/* ------------------------------------------------------------------ */

export let ME: OwnerId = "em"

const DEMO_KEY = "prospect-crm:v3"
const MODE_KEY = "prospect-crm:mode"

export const COLLECTIONS = ["prospects", "companies", "contacts", "tasks", "notices", "meetings", "automations", "runs", "sequences"] as const
type Col = (typeof COLLECTIONS)[number]

const EMPTY_ROUTING: Routing = { mode: "round_robin", pool: [], cursor: 0, industryMap: {} }

export function emptyState(): CRMState {
  return {
    version: 3,
    prospects: [],
    companies: [],
    contacts: [],
    tasks: [],
    notices: [],
    meetings: [],
    automations: [],
    runs: [],
    sequences: [],
    routing: { ...EMPTY_ROUTING },
    fired: {},
  }
}

function loadDemo(): CRMState {
  try {
    const raw = window.localStorage.getItem(DEMO_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as CRMState
      if (parsed?.version === 3 && Array.isArray(parsed.prospects)) return parsed
    }
  } catch {
    /* storage unavailable; fall back to the sample workspace */
  }
  return sweep(buildState())
}

function sortCol(col: Col, list: Record<string, unknown>[]) {
  const by = (k: string, dir = 1) => (a: Record<string, unknown>, b: Record<string, unknown>) => String(a[k] ?? "").localeCompare(String(b[k] ?? "")) * dir
  switch (col) {
    case "prospects":
    case "companies":
    case "contacts":
    case "automations":
      return list.sort(by("createdAt", -1))
    case "notices":
    case "runs":
      return list.sort(by("at", -1))
    case "meetings":
      return list.sort(by("at"))
    case "tasks":
      return list.sort(by("due"))
    case "sequences":
      return list.sort(by("name"))
  }
}

/* ------------------------------------------------------------------ */
/* Capability plumbing (typed loosely; see the platform contract)       */
/* ------------------------------------------------------------------ */

type Snap = { id: string; exists: boolean; data(): Record<string, unknown> | undefined }
type QSnap = { docs: Snap[] }
type DocRef = {
  set(d: Record<string, unknown>): Promise<void>
  delete(): Promise<void>
  get(): Promise<Snap>
  onSnapshot(n: (s: Snap) => void, e?: (err: { code: string }) => void): () => void
  acquire(o: { holder: string; ttlMs?: number }): Promise<{ acquired: boolean }>
}
type ColRef = { onSnapshot(n: (s: QSnap) => void, e?: (err: { code: string }) => void): () => void; doc(id: string): DocRef }
type DB = { doc(path: string): DocRef; collection(path: string): ColRef }
type UserNS = {
  id(): Promise<string | null>
  can(c: string): Promise<boolean | null>
  isOwner(): Promise<boolean>
  profiles(ids: string[]): Promise<Record<string, { name: string; avatarUrl: string }>>
}

export type Mode = "demo" | "workspace"
export type WorkspaceStatus = "unavailable" | "loading" | "setup" | "ready"

type NewDeal = {
  companyId?: string
  companyName: string
  domain?: string
  industry: Industry
  city: string
  contactId?: string
  contactName: string
  role: string
  email: string
  phone?: string
  value: number
  source: Source
  stage?: StageId
  fit?: number
  expectedClose?: string | null
}

export type ImportRow = {
  company: string
  domain?: string
  industry?: string
  city?: string
  contact?: string
  role?: string
  email?: string
  phone?: string
  value?: number
  stage?: StageId
  source?: string
  notes?: string
}

export type ImportSummary = { deals: number; companies: number; contacts: number; skipped: number }

export type Store = {
  state: CRMState
  mode: Mode
  setMode: (m: Mode) => void
  workspace: WorkspaceStatus
  canWrite: boolean
  isMember: boolean
  isOwner: boolean
  setupWorkspace: () => Promise<void>
  joinTeam: () => Promise<void>
  get: (id: string) => Prospect | undefined
  addProspect: (p: NewDeal) => Prospect | null
  update: (id: string, patch: Partial<Prospect>) => void
  moveStage: (id: string, stage: StageId) => void
  log: (id: string, kind: ActivityKind, text: string) => void
  bookMeeting: (id: string, m: Omit<Meeting, "id" | "prospectId">) => void
  remove: (ids: string[]) => void
  addTask: (t: Omit<Task, "id" | "done">) => void
  setTaskDone: (id: string, done: boolean) => void
  snoozeTask: (id: string, days: number) => void
  markRead: (id?: string) => void
  toggleAutomation: (id: string) => void
  saveAutomation: (a: Automation) => void
  deleteAutomation: (id: string) => void
  runChecks: (automationId?: string) => number
  enroll: (prospectId: string, sequenceId: string) => void
  unenroll: (prospectId: string) => void
  saveSequence: (s: Sequence) => void
  setRouting: (r: Partial<Routing>) => void
  saveCompany: (c: Company) => void
  saveContact: (c: Contact, attachTo?: string) => Contact
  removeContact: (id: string) => void
  setPrimaryContact: (prospectId: string, contactId: string) => void
  importRows: (rows: ImportRow[], runAutomations: boolean) => ImportSummary
  reset: () => void
}

const Ctx = React.createContext<Store | null>(null)

function mutate(s: CRMState, fn: (d: CRMState) => void): CRMState {
  const d = structuredClone(s)
  fn(d)
  return d
}

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

/** Keeps the denormalised company and contact fields on deals in step. */
function syncDeal(d: CRMState, p: Prospect) {
  const co = d.companies.find((c) => c.id === p.companyId)
  if (co) Object.assign(p, { company: co.name, domain: co.domain, industry: co.industry, city: co.city })
  const main = d.contacts.find((c) => c.id === p.contactIds[0])
  if (main) Object.assign(p, { contact: main.name, role: main.role, email: main.email })
  else if (!p.contactIds.length) Object.assign(p, { contact: "No contact yet", role: "", email: "" })
}

/** Creates or reuses a company and contact, then the deal. Pure on a draft. */
function createDeal(d: CRMState, input: NewDeal, by: OwnerId): Prospect {
  const now = new Date().toISOString()
  let co = input.companyId ? d.companies.find((c) => c.id === input.companyId) : undefined
  co ??= d.companies.find((c) => sameName(c.name, input.companyName) || (input.domain && c.domain && sameName(c.domain, input.domain)))
  if (!co) {
    co = { id: newId("co"), name: input.companyName.trim(), domain: input.domain ?? "", industry: input.industry, city: input.city || "Lagos", notes: "", createdAt: now }
    d.companies.unshift(co)
  }
  let ct = input.contactId ? d.contacts.find((c) => c.id === input.contactId) : undefined
  if (!ct && input.contactName.trim()) {
    ct = d.contacts.find((c) => c.companyId === co!.id && ((input.email && sameName(c.email, input.email)) || sameName(c.name, input.contactName)))
    if (!ct) {
      ct = { id: newId("ct"), companyId: co.id, name: input.contactName.trim(), role: input.role || "Contact", email: input.email ?? "", phone: input.phone ?? "", createdAt: now }
      d.contacts.unshift(ct)
    }
  }
  const stage = input.stage ?? "researching"
  const p: Prospect = {
    id: newId("p"),
    company: co.name,
    domain: co.domain,
    industry: co.industry,
    city: co.city,
    contact: ct?.name ?? "No contact yet",
    role: ct?.role ?? "",
    email: ct?.email ?? "",
    stage,
    value: Math.max(0, input.value || 0),
    fit: input.fit ?? 3,
    engagement: 0,
    source: input.source,
    owner: by,
    lastTouch: now,
    nextStep: "Research and plan first touch",
    nextDue: null,
    createdAt: now,
    enrollment: null,
    activities: [{ id: newId("a"), kind: "note", text: "Added to pipeline", at: now, by }],
    companyId: co.id,
    contactIds: ct ? [ct.id] : [],
    expectedClose:
      input.expectedClose ??
      (stage === "won" || stage === "lost"
        ? null
        : new Date(Date.now() + ({ researching: 90, contacted: 60, replied: 45, meeting: 30, proposal: 14 } as Record<string, number>)[stage] * 86_400_000).toISOString()),
    closedAt: stage === "won" || stage === "lost" ? now : null,
    stageHistory: [{ stage, at: now }],
  }
  d.prospects.unshift(p)
  return p
}

/* ------------------------------------------------------------------ */

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = React.useState<Mode>(() => {
    try {
      const m = window.localStorage.getItem(MODE_KEY)
      if (m === "demo" || m === "workspace") return m
    } catch {
      /* ignore */
    }
    return window.claude?.use ? "workspace" : "demo"
  })
  const [workspace, setWorkspace] = React.useState<WorkspaceStatus>(window.claude?.use ? "loading" : "unavailable")
  const [state, setState] = React.useState<CRMState>(() => (mode === "demo" ? loadDemo() : emptyState()))
  const [canWrite, setCanWrite] = React.useState(true)
  const [isOwner, setIsOwner] = React.useState(false)
  const [team, setTeam] = React.useState<string[]>([])
  const [, force] = React.useReducer((n: number) => n + 1, 0)

  const stateRef = React.useRef(state)
  stateRef.current = state
  const modeRef = React.useRef(mode)
  modeRef.current = mode
  const dbRef = React.useRef<DB | null>(null)
  const userRef = React.useRef<UserNS | null>(null)
  const meRef = React.useRef<string | null>(null)
  const queues = React.useRef(new Map<string, Promise<unknown>>())
  const warned = React.useRef(false)

  /* ---------- writes ---------- */

  const write = React.useCallback((path: string, body: Record<string, unknown> | null) => {
    const db = dbRef.current
    if (!db) return
    const prev = queues.current.get(path) ?? Promise.resolve()
    const next = prev
      .catch(() => {})
      .then(() => (body ? db.doc(path).set(body) : db.doc(path).delete()))
      .catch((e: { code?: string }) => {
        if (e?.code === "invalid_argument" && !warned.current) {
          warned.current = true
          setCanWrite(false)
          toast("You can view this workspace but not change it", { description: "Ask the owner for Contributor access." })
        } else if (e?.code === "quota_exceeded") {
          toast("The workspace is full", { description: "Delete old records or runs to make room." })
        }
      })
    queues.current.set(path, next)
  }, [])

  const persist = React.useCallback(
    (prev: CRMState, next: CRMState) => {
      for (const col of COLLECTIONS) {
        if (prev[col] === next[col]) continue
        const before = new Map((prev[col] as { id: string }[]).map((x) => [x.id, x]))
        const after = new Map((next[col] as { id: string }[]).map((x) => [x.id, x]))
        for (const [id, rec] of after) {
          const old = before.get(id)
          if (!old || JSON.stringify(old) !== JSON.stringify(rec)) write(`${col}/${id}`, rec as unknown as Record<string, unknown>)
        }
        for (const id of before.keys()) if (!after.has(id)) write(`${col}/${id}`, null)
      }
      if (JSON.stringify(prev.routing) !== JSON.stringify(next.routing)) write("meta/routing", next.routing as unknown as Record<string, unknown>)
      if (JSON.stringify(prev.fired) !== JSON.stringify(next.fired)) write("meta/fired", { map: next.fired })
    },
    [write]
  )

  /** The one way state changes. */
  const apply = React.useCallback(
    (fn: (s: CRMState) => CRMState): boolean => {
      if (modeRef.current === "workspace" && !canWriteRef.current) {
        toast("You have view access to this workspace")
        return false
      }
      const prev = stateRef.current
      let next = fn(prev)
      if (next === prev) return true
      if (next.notices.length > 100) next = { ...next, notices: next.notices.slice(0, 100) }
      stateRef.current = next
      setState(next)
      if (modeRef.current === "workspace") persist(prev, next)
      return true
    },
    [persist]
  )
  const canWriteRef = React.useRef(canWrite)
  canWriteRef.current = canWrite

  /* ---------- demo persistence ---------- */

  const demoLoaded = React.useRef(false)
  React.useEffect(() => {
    // Only save once the demo data is the data on screen.
    if (mode !== "demo" || !demoLoaded.current) return
    try {
      window.localStorage.setItem(DEMO_KEY, JSON.stringify(state))
    } catch {
      /* ignore */
    }
  }, [mode, state])

  /* ---------- mode switching ---------- */

  React.useEffect(() => {
    if (mode === "demo") {
      ME = DEMO_OWNERS[0].id
      setOwners(DEMO_OWNERS)
      const s = loadDemo()
      stateRef.current = s
      setState(s)
      demoLoaded.current = true
      // Time-based rules get checked each time the demo opens.
      apply((x) => sweep(x))
    } else {
      demoLoaded.current = false
      stateRef.current = emptyState()
      setState(stateRef.current)
    }
    force()
  }, [mode, apply])

  /* ---------- workspace connection ---------- */

  React.useEffect(() => {
    if (mode !== "workspace") return
    const c = window.claude
    if (!c?.use) {
      setWorkspace("unavailable")
      return
    }
    let alive = true
    const unsubs: (() => void)[] = []
    setWorkspace("loading")
    ;(async () => {
      const [db, user] = await Promise.all([c.use("db") as Promise<DB | null>, c.use("user") as Promise<UserNS | null>])
      if (!alive) return
      if (!db) {
        setWorkspace("unavailable")
        return
      }
      dbRef.current = db
      userRef.current = user
      const id = (await user?.id()) ?? null
      meRef.current = id
      if (id) ME = id
      setIsOwner((await user?.isOwner()) ?? false)
      const w = await user?.can("data.write")
      if (w === false) setCanWrite(false)

      if (!alive) return
      const loaded = new Set<string>()
      const total = COLLECTIONS.length + 3
      let exists = false
      const markLoaded = (k: string) => {
        if (!alive) return
        loaded.add(k)
        if (loaded.size === total && alive) setWorkspace(exists ? "ready" : "setup")
      }
      const take = (patch: Partial<CRMState>) => {
        if (!alive || modeRef.current !== "workspace") return
        const next = { ...stateRef.current, ...patch }
        stateRef.current = next
        setState(next)
      }

      for (const col of COLLECTIONS) {
        unsubs.push(
          db.collection(col).onSnapshot(
            (snap) => {
              const list = snap.docs.filter((d) => d.exists).map((d) => d.data() as Record<string, unknown>)
              take({ [col]: sortCol(col, list) } as Partial<CRMState>)
              markLoaded(col)
            },
            () => markLoaded(col)
          )
        )
      }
      unsubs.push(
        db.doc("meta/routing").onSnapshot(
          (s) => {
            if (s.exists) take({ routing: s.data() as unknown as Routing })
            markLoaded("routing")
          },
          () => markLoaded("routing")
        )
      )
      unsubs.push(
        db.doc("meta/fired").onSnapshot(
          (s) => {
            take({ fired: ((s.data()?.map as Record<string, string>) ?? {}) })
            markLoaded("fired")
          },
          () => markLoaded("fired")
        )
      )
      unsubs.push(
        db.doc("meta/workspace").onSnapshot(
          (s) => {
            if (!alive) return
            exists = s.exists
            if (loaded.has("workspace") && alive) setWorkspace(s.exists ? "ready" : "setup")
            markLoaded("workspace")
          },
          () => markLoaded("workspace")
        )
      )
      unsubs.push(
        db.collection("team").onSnapshot((snap) => {
          if (!alive) return
          setTeam(snap.docs.filter((d) => d.exists).map((d) => d.id))
        })
      )
    })()
    return () => {
      alive = false
      unsubs.forEach((u) => u())
    }
  }, [mode])

  // Resolve teammates' names from their ids, every time the team changes.
  React.useEffect(() => {
    if (mode !== "workspace") return
    const user = userRef.current
    const ids = team.length ? team : meRef.current ? [meRef.current] : []
    if (!ids.length) return
    let alive = true
    ;(user?.profiles(ids) ?? Promise.resolve({} as Record<string, { name: string; avatarUrl: string }>)).then((ps) => {
      if (!alive) return
      setOwners(ids.map((id) => ownerFromName(id, ps[id]?.name || (id === meRef.current ? "You" : "Teammate"), ps[id]?.avatarUrl)))
      force()
    })
    return () => {
      alive = false
    }
  }, [mode, team])

  // One teammate at a time checks time-based rules when the workspace opens.
  const swept = React.useRef(false)
  React.useEffect(() => {
    if (mode !== "workspace" || workspace !== "ready" || swept.current || !canWrite || !dbRef.current) return
    swept.current = true
    dbRef.current
      .doc("meta/sweep")
      .acquire({ holder: meRef.current ?? "anon", ttlMs: 60_000 })
      .then((r) => {
        if (r.acquired) apply((s) => sweep(s))
      })
      .catch(() => {})
  }, [mode, workspace, canWrite, apply])

  /* ---------- store API ---------- */

  const store = React.useMemo<Store>(() => {
    const now = () => new Date().toISOString()
    const me = ME
    const isMember = mode === "demo" || (meRef.current ? team.includes(meRef.current) : false)

    return {
      state,
      mode,
      setMode: (m) => {
        try {
          window.localStorage.setItem(MODE_KEY, m)
        } catch {
          /* ignore */
        }
        swept.current = false
        setModeState(m)
      },
      workspace,
      canWrite: mode === "demo" || canWrite,
      isMember,
      isOwner,

      setupWorkspace: async () => {
        const db = dbRef.current
        const id = meRef.current
        if (!db) return
        const t = now()
        const automations = AUTOMATIONS.map((a) => ({ ...structuredClone(a), runs: 0, lastRunAt: null, createdAt: t }))
        const routing: Routing = { mode: "round_robin", pool: id ? [id] : [], cursor: 0, industryMap: {} }
        apply((s) => ({ ...s, automations, sequences: SEQUENCES.map((q) => structuredClone(q)), routing }))
        if (id) await db.doc(`team/${id}`).set({ joinedAt: t })
        await db.doc("meta/workspace").set({ createdAt: t, version: 3 })
      },

      joinTeam: async () => {
        const db = dbRef.current
        const id = meRef.current
        if (!db || !id) return
        await db.doc(`team/${id}`).set({ joinedAt: now() })
        apply((s) => (s.routing.pool.includes(id) ? s : { ...s, routing: { ...s.routing, pool: [...s.routing.pool, id] } }))
        toast.success("You joined the team", { description: "New prospects can now be routed to you." })
      },

      get: (id) => state.prospects.find((p) => p.id === id),

      addProspect: (input) => {
        let created: Prospect | null = null
        const ok = apply((s) => {
          let pid = ""
          const next = mutate(s, (d) => {
            created = createDeal(d, input, me)
            pid = created.id
          })
          return dispatch(next, { type: "prospect_created", prospectId: pid })
        })
        return ok ? created : null
      },

      update: (id, patch) =>
        apply((s) =>
          dispatch(
            mutate(s, (d) => {
              const p = d.prospects.find((x) => x.id === id)
              if (!p) return
              Object.assign(p, patch)
              if (patch.owner) d.tasks.forEach((t) => t.prospectId === id && !t.done && (t.owner = patch.owner!))
            }),
            { type: "touched", prospectId: id }
          )
        ),

      moveStage: (id, stage) =>
        apply((s) => {
          const p0 = s.prospects.find((x) => x.id === id)
          if (!p0 || p0.stage === stage) return s
          const from = p0.stage
          const next = mutate(s, (d) => {
            const p = d.prospects.find((x) => x.id === id)!
            applyStage(p, stage)
            p.activities.unshift({ id: newId("a"), kind: "stage", text: `Moved to ${stageLabel(stage)}`, at: now(), by: me })
            const seq = p.enrollment ? d.sequences.find((x) => x.id === p.enrollment!.sequenceId) : undefined
            if (seq?.exitOnReply && (stage === "replied" || stage === "won" || stage === "lost")) {
              d.tasks = d.tasks.filter((t) => !(t.prospectId === p.id && !t.done && t.source.kind === "sequence"))
              p.enrollment = null
              p.activities.unshift({ id: newId("a"), kind: "note", text: `Left "${seq.name}" because they ${stage === "replied" ? "replied" : "closed"}`, at: now() })
            }
          })
          return dispatch(next, { type: "stage_changed", prospectId: id, from, to: stage })
        }),

      log: (id, kind, text) =>
        apply((s) =>
          dispatch(
            mutate(s, (d) => {
              const p = d.prospects.find((x) => x.id === id)
              if (!p) return
              if (kind !== "note" && kind !== "ai") {
                p.lastTouch = now()
                p.engagement = Math.min(10, p.engagement + 1)
              }
              p.activities.unshift({ id: newId("a"), kind, text, at: now(), by: me })
              p.activities = p.activities.slice(0, 100)
            }),
            { type: "touched", prospectId: id }
          )
        ),

      bookMeeting: (id, m) =>
        apply((s) =>
          dispatch(
            mutate(s, (d) => {
              const p = d.prospects.find((x) => x.id === id)
              if (!p) return
              d.meetings.push({ ...m, id: newId("m"), prospectId: id })
              d.meetings.sort((a, b) => a.at.localeCompare(b.at))
              p.owner = m.owner
              p.lastTouch = now()
              p.engagement = Math.min(10, p.engagement + 2)
              const when = new Date(m.at).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
              p.activities.unshift({ id: newId("a"), kind: "meeting", text: `Booked "${m.title}" for ${when}${m.calendarLink ? " (on Google Calendar)" : ""}`, at: now(), by: me })
              d.notices.unshift({ id: newId("n"), kind: "meeting", text: `${p.contact} is booked for ${when}.`, prospectId: id, at: now(), read: false })
            }),
            { type: "meeting_booked", prospectId: id }
          )
        ),

      remove: (ids) =>
        apply((s) =>
          mutate(s, (d) => {
            d.prospects = d.prospects.filter((p) => !ids.includes(p.id))
            d.tasks = d.tasks.filter((t) => !t.prospectId || !ids.includes(t.prospectId))
            d.meetings = d.meetings.filter((m) => !ids.includes(m.prospectId))
          })
        ),

      addTask: (t) =>
        apply((s) =>
          mutate(s, (d) => {
            d.tasks.push({ ...t, id: newId("t"), done: false })
          })
        ),

      setTaskDone: (taskId, done) =>
        apply((s) => {
          const t0 = s.tasks.find((t) => t.id === taskId)
          if (!t0 || t0.done === done) return s
          const next = mutate(s, (d) => {
            const t = d.tasks.find((x) => x.id === taskId)!
            t.done = done
            t.doneAt = done ? now() : undefined
            const p = t.prospectId ? d.prospects.find((x) => x.id === t.prospectId) : undefined
            if (!p || !done) return
            p.lastTouch = now()
            p.engagement = Math.min(10, p.engagement + 1)
            p.activities.unshift({ id: newId("a"), kind: "note", text: `Done: ${t.title}`, at: now(), by: me })
            if (t.isNextStep) p.nextDue = null
            const src = t.source
            if (src.kind === "sequence" && p.enrollment?.sequenceId === src.id && p.enrollment.step === src.step) {
              const seq = d.sequences.find((x) => x.id === src.id)
              const nextStep = p.enrollment.step + 1
              if (seq && nextStep < seq.steps.length) {
                p.enrollment.step = nextStep
                const nt = sequenceTask(d, p, seq.id, nextStep)
                if (nt) d.tasks.push(nt)
              } else {
                p.enrollment = null
                d.notices.unshift({ id: newId("n"), kind: "system", text: `${p.company} finished "${seq?.name ?? "the sequence"}".`, prospectId: p.id, at: now(), read: false })
              }
            }
          })
          return t0.prospectId ? dispatch(next, { type: "touched", prospectId: t0.prospectId }) : next
        }),

      snoozeTask: (taskId, days) =>
        apply((s) =>
          mutate(s, (d) => {
            const t = d.tasks.find((x) => x.id === taskId)
            if (!t) return
            const due = new Date(Math.max(Date.now(), new Date(t.due).getTime()) + days * 86_400_000)
            due.setHours(9, 0, 0, 0)
            t.due = due.toISOString()
          })
        ),

      markRead: (id) =>
        apply((s) =>
          mutate(s, (d) => {
            d.notices.forEach((n) => {
              if (!id || n.id === id) n.read = true
            })
          })
        ),

      toggleAutomation: (id) =>
        apply((s) => {
          const a = s.automations.find((x) => x.id === id)
          const next = mutate(s, (d) => {
            const x = d.automations.find((y) => y.id === id)
            if (x) x.enabled = !x.enabled
          })
          return a && !a.enabled ? sweep(next, id) : next
        }),

      saveAutomation: (a) =>
        apply((s) => {
          const next = mutate(s, (d) => {
            const i = d.automations.findIndex((x) => x.id === a.id)
            if (i >= 0) d.automations[i] = a
            else d.automations.unshift(a)
            Object.keys(d.fired).forEach((k) => k.startsWith(`${a.id}:`) && delete d.fired[k])
          })
          return a.enabled ? sweep(next, a.id) : next
        }),

      deleteAutomation: (id) =>
        apply((s) =>
          mutate(s, (d) => {
            d.automations = d.automations.filter((a) => a.id !== id)
          })
        ),

      runChecks: (automationId) => {
        const before = stateRef.current.runs.length
        apply((s) => sweep(s, automationId))
        return stateRef.current.runs.length - before
      },

      enroll: (prospectId, sequenceId) =>
        apply((s) =>
          mutate(s, (d) => {
            const p = d.prospects.find((x) => x.id === prospectId)
            const seq = d.sequences.find((x) => x.id === sequenceId)
            if (!p || !seq) return
            d.tasks = d.tasks.filter((t) => !(t.prospectId === p.id && !t.done && t.source.kind === "sequence"))
            p.enrollment = { sequenceId, step: 0, startedAt: now() }
            const t = sequenceTask(d, p, sequenceId, 0)
            if (t) d.tasks.push(t)
            p.activities.unshift({ id: newId("a"), kind: "note", text: `Enrolled in "${seq.name}"`, at: now(), by: me })
          })
        ),

      unenroll: (prospectId) =>
        apply((s) =>
          mutate(s, (d) => {
            const p = d.prospects.find((x) => x.id === prospectId)
            if (!p?.enrollment) return
            const name = d.sequences.find((x) => x.id === p.enrollment!.sequenceId)?.name
            d.tasks = d.tasks.filter((t) => !(t.prospectId === p.id && !t.done && t.source.kind === "sequence"))
            p.enrollment = null
            p.activities.unshift({ id: newId("a"), kind: "note", text: `Removed from "${name}"`, at: now(), by: me })
          })
        ),

      saveSequence: (seq) =>
        apply((s) =>
          mutate(s, (d) => {
            const i = d.sequences.findIndex((x) => x.id === seq.id)
            if (i >= 0) d.sequences[i] = seq
            else d.sequences.push(seq)
          })
        ),

      setRouting: (r) =>
        apply((s) =>
          mutate(s, (d) => {
            d.routing = { ...d.routing, ...r }
          })
        ),

      saveCompany: (c) =>
        apply((s) =>
          mutate(s, (d) => {
            const i = d.companies.findIndex((x) => x.id === c.id)
            if (i >= 0) d.companies[i] = c
            else d.companies.unshift(c)
            d.prospects.filter((p) => p.companyId === c.id).forEach((p) => syncDeal(d, p))
          })
        ),

      saveContact: (c, attachTo) => {
        apply((s) =>
          mutate(s, (d) => {
            const i = d.contacts.findIndex((x) => x.id === c.id)
            if (i >= 0) d.contacts[i] = c
            else d.contacts.unshift(c)
            if (attachTo) {
              const p = d.prospects.find((x) => x.id === attachTo)
              if (p && !p.contactIds.includes(c.id)) p.contactIds.push(c.id)
            }
            d.prospects.filter((p) => p.contactIds.includes(c.id)).forEach((p) => syncDeal(d, p))
          })
        )
        return c
      },

      removeContact: (id) =>
        apply((s) =>
          mutate(s, (d) => {
            d.contacts = d.contacts.filter((c) => c.id !== id)
            d.prospects.forEach((p) => {
              if (p.contactIds.includes(id)) {
                p.contactIds = p.contactIds.filter((x) => x !== id)
                syncDeal(d, p)
              }
            })
          })
        ),

      setPrimaryContact: (prospectId, contactId) =>
        apply((s) =>
          mutate(s, (d) => {
            const p = d.prospects.find((x) => x.id === prospectId)
            if (!p) return
            p.contactIds = [contactId, ...p.contactIds.filter((x) => x !== contactId)]
            syncDeal(d, p)
          })
        ),

      importRows: (rows, runAutomations) => {
        const summary: ImportSummary = { deals: 0, companies: 0, contacts: 0, skipped: 0 }
        apply((s) => {
          const newDeals: string[] = []
          let next = mutate(s, (d) => {
            const coBefore = d.companies.length
            const ctBefore = d.contacts.length
            for (const r of rows) {
              if (!r.company?.trim()) {
                summary.skipped++
                continue
              }
              const existing = d.companies.find((c) => sameName(c.name, r.company) || (r.domain && c.domain && sameName(c.domain, r.domain)))
              const openDeal = existing && d.prospects.some((p) => p.companyId === existing.id && !["won", "lost"].includes(p.stage))
              if (openDeal) {
                // Still pick up a new contact at a company already in the pipeline.
                if (r.contact?.trim() && !d.contacts.some((c) => c.companyId === existing!.id && ((r.email && sameName(c.email, r.email)) || sameName(c.name, r.contact!)))) {
                  d.contacts.unshift({ id: newId("ct"), companyId: existing!.id, name: r.contact.trim(), role: r.role ?? "", email: r.email ?? "", phone: r.phone ?? "", createdAt: now() })
                }
                summary.skipped++
                continue
              }
              const ind = (["Fintech", "Health", "Logistics", "Education", "Consumer", "Climate", "Media"].find((x) => sameName(x, r.industry ?? "")) ?? "Fintech") as Industry
              const src = (["Referral", "LinkedIn", "Inbound", "Event", "Cold outbound"].find((x) => sameName(x, r.source ?? "")) ?? "Cold outbound") as Source
              const p = createDeal(
                d,
                { companyName: r.company, domain: r.domain, industry: ind, city: r.city ?? "", contactName: r.contact ?? "", role: r.role ?? "", email: r.email ?? "", phone: r.phone, value: r.value ?? 0, source: src, stage: r.stage },
                me
              )
              p.activities[0].text = "Imported from a spreadsheet"
              if (r.notes) p.activities.push({ id: newId("a"), kind: "note", text: r.notes, at: now(), by: me })
              newDeals.push(p.id)
              summary.deals++
            }
            summary.companies = d.companies.length - coBefore
            summary.contacts = d.contacts.length - ctBefore
          })
          if (runAutomations) for (const id of newDeals) next = dispatch(next, { type: "prospect_created", prospectId: id })
          return next
        })
        return summary
      },

      reset: () => {
        if (mode !== "demo") return
        apply(() => sweep(buildState()))
      },
    }
  }, [state, mode, workspace, canWrite, isOwner, team, apply])

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>
}

export function useStore() {
  const s = React.useContext(Ctx)
  if (!s) throw new Error("useStore must be used inside StoreProvider")
  return s
}
