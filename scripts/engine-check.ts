/**
 * Checks the automation engine against the demo data.
 * Run with: npm run check:engine
 * Every line should say PASS. Run it after any change to src/crm/engine.ts,
 * src/crm/seed.ts or the automation rules.
 */
import { buildState } from "../src/crm/seed"
import { dispatch, previewMatches, sweep } from "../src/crm/engine"
import { applyStage, newId, type CRMState, type Prospect, type StageId } from "../src/crm/data"

let passed = 0
let failed = 0
function check(name: string, ok: boolean, info: unknown = "") {
  if (ok) passed++
  else failed++
  console.log(ok ? "PASS" : "FAIL", name, ok ? "" : JSON.stringify(info))
}

function moveTo(s: CRMState, id: string, to: StageId) {
  const d = structuredClone(s)
  const p = d.prospects.find((x) => x.id === id)!
  const from = p.stage
  applyStage(p, to)
  return dispatch(d, { type: "stage_changed", prospectId: id, from, to })
}

const byName = (s: CRMState, n: string) => s.prospects.find((p) => p.company === n)!

let s = buildState()
const seedRuns = s.runs.length
s = sweep(s)
const fresh = s.runs.slice(0, s.runs.length - seedRuns)
check("cold deals over $15k get revived", fresh.filter((r) => r.automationId === "au_revive").length >= 2, fresh)
check("overdue alerts only on deals of $40k or more", fresh.filter((r) => r.automationId === "au_overdue").every((r) => s.prospects.find((p) => p.id === r.prospectId)!.value >= 40000))
check("a second check fires nothing new", sweep(s).runs.length === s.runs.length)

// New prospect: routing plus a research task
const now = new Date().toISOString()
const fresh1: Prospect = {
  id: newId("p"), company: "Test Co", domain: "", industry: "Media", city: "Lagos",
  contact: "Ada Test", role: "CEO", email: "", stage: "researching", value: 20000, fit: 3,
  engagement: 0, source: "Inbound", owner: "em", lastTouch: now, nextStep: "x", nextDue: null,
  createdAt: now, enrollment: null, activities: [], companyId: "co_test", contactIds: [],
  expectedClose: null, closedAt: null, stageHistory: [{ stage: "researching", at: now }],
}
s.prospects.unshift(fresh1)
const cursor = s.routing.cursor
s = dispatch(s, { type: "prospect_created", prospectId: fresh1.id })
check("new prospects are routed", s.runs[0].automationId === "au_welcome" && s.routing.cursor === (cursor + 1) % s.routing.pool.length)
check("new prospects get a research task", s.tasks.some((t) => t.prospectId === fresh1.id && t.title.startsWith("Research Test Co")))

// A reply stops the sequence
const north = byName(s, "Northwind Labs")
check("Northwind starts in a sequence", Boolean(north.enrollment))
s = moveTo(s, north.id, "replied")
const n2 = byName(s, "Northwind Labs")
check("a reply stops the sequence", n2.enrollment === null)
check("a reply sets the next step", n2.nextStep.startsWith("Book a discovery call"))
check("stage history records the reply", n2.stageHistory.at(-1)?.stage === "replied")

// Booking moves the stage through a chained rule
const bumpa = byName(s, "Bumpa")
s = dispatch(s, { type: "meeting_booked", prospectId: bumpa.id })
check("booking a meeting moves to Meeting booked", byName(s, "Bumpa").stage === "meeting")

// Proposal starts the chaser sequence
const helium = byName(s, "Helium Health")
s = moveTo(s, helium.id, "proposal")
check("a proposal starts the Proposal chaser", byName(s, "Helium Health").enrollment?.sequenceId === "seq_proposal")

// Won sets the close date
s = moveTo(s, byName(s, "Kora Pay").id, "won")
check("winning a deal records the close date", Boolean(byName(s, "Kora Pay").closedAt))

// Disabled rules stay quiet
const before = s.runs.length
s = moveTo(s, byName(s, "Edukoya").id, "lost")
check("the switched-off lost rule does not run", !s.runs.slice(0, s.runs.length - before).some((r) => r.automationId === "au_lost"))

check("rule preview finds matches", previewMatches(s, s.automations.find((a) => a.id === "au_revive")!).length > 0)

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
