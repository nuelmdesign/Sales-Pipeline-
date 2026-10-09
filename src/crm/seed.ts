import {
  OPEN_STAGES,
  STAGES,
  at,
  newId,
  type Activity,
  type Company,
  type Contact,
  type StageId,
  type ActivityKind,
  type Automation,
  type CRMState,
  type Meeting,
  type Prospect,
  type Sequence,
  type Task,
} from "./data"

type Seed = Omit<
  Prospect,
  "id" | "activities" | "createdAt" | "lastTouch" | "nextDue" | "enrollment" | "companyId" | "contactIds" | "expectedClose" | "closedAt" | "stageHistory"
> & {
  touch: number
  due: number | null
  log: [ActivityKind, string, number][]
}

const SEEDS: Seed[] = [
  {
    company: "Kora Pay", domain: "korapay.com", industry: "Fintech", city: "Lagos",
    contact: "Adaeze Okonkwo", role: "Head of Product", email: "adaeze@korapay.com",
    stage: "proposal", value: 48000, fit: 5, engagement: 8, source: "Referral", owner: "em",
    nextStep: "Walk through proposal and timeline", touch: -2, due: 0,
    log: [
      ["email", "Sent proposal v2 with phased scope", -2],
      ["meeting", "Discovery call. Merchant dashboard is the pain point", -9],
      ["email", "Intro from Tunde at Paystack", -16],
    ],
  },
  {
    company: "Helium Health", domain: "heliumhealth.com", industry: "Health", city: "Lagos",
    contact: "Ifeoma Nwosu", role: "VP Design", email: "ifeoma@heliumhealth.com",
    stage: "meeting", value: 36000, fit: 4, engagement: 6, source: "Event", owner: "em",
    nextStep: "Prep audit of patient app onboarding", touch: -1, due: 1,
    log: [
      ["meeting", "Booked working session for Thursday", -1],
      ["email", "Followed up after UDC panel", -6],
    ],
  },
  {
    company: "Sendbox", domain: "sendbox.co", industry: "Logistics", city: "Lagos",
    contact: "Kunle Adeyemi", role: "CEO", email: "kunle@sendbox.co",
    stage: "replied", value: 22000, fit: 4, engagement: 5, source: "LinkedIn", owner: "ib",
    nextStep: "Send two relevant case studies", touch: -3, due: 0,
    log: [
      ["email", "Replied. Interested, asked for logistics work", -3],
      ["email", "Cold intro on brand refresh", -7],
    ],
  },
  {
    company: "Northwind Labs", domain: "northwind.dev", industry: "Climate", city: "San Francisco",
    contact: "Maya Chen", role: "Founder", email: "maya@northwind.dev",
    stage: "contacted", value: 30000, fit: 3, engagement: 2, source: "Cold outbound", owner: "em",
    nextStep: "Second touch with seed deck teardown", touch: -8, due: -1,
    log: [["email", "First touch on pre-seed brand", -8]],
  },
  {
    company: "Edukoya", domain: "edukoya.com", industry: "Education", city: "Lagos",
    contact: "Bisi Lawal", role: "Product Lead", email: "bisi@edukoya.com",
    stage: "researching", value: 15000, fit: 3, engagement: 1, source: "LinkedIn", owner: "to",
    nextStep: "Find warm path through Sections", touch: -4, due: 2,
    log: [["note", "Their app store reviews mention navigation", -4]],
  },
  {
    company: "Moniepoint", domain: "moniepoint.com", industry: "Fintech", city: "Lagos",
    contact: "Chinedu Eze", role: "Design Director", email: "chinedu@moniepoint.com",
    stage: "won", value: 64000, fit: 5, engagement: 9, source: "Referral", owner: "em",
    nextStep: "Kickoff workshop", touch: -5, due: 4,
    log: [
      ["stage", "Signed SOW for design system audit", -5],
      ["meeting", "Final pricing review", -12],
    ],
  },
  {
    company: "Lumen Audio", domain: "lumenaudio.co", industry: "Consumer", city: "Austin",
    contact: "Jordan Pike", role: "COO", email: "jordan@lumenaudio.co",
    stage: "contacted", value: 18000, fit: 2, engagement: 1, source: "Inbound", owner: "ib",
    nextStep: "Check if budget is approved", touch: -19, due: -4,
    log: [["email", "Sent rates after inbound form", -19]],
  },
  {
    company: "Bumpa", domain: "getbumpa.com", industry: "Consumer", city: "Lagos",
    contact: "Ope Bello", role: "Head of Growth", email: "ope@getbumpa.com",
    stage: "replied", value: 26000, fit: 4, engagement: 6, source: "Event", owner: "to",
    nextStep: "Book a call for next week", touch: -2, due: 1,
    log: [["email", "Asked for availability next week", -2]],
  },
  {
    company: "Farmcrowdy", domain: "farmcrowdy.com", industry: "Climate", city: "Lagos",
    contact: "Tobi Akin", role: "CTO", email: "tobi@farmcrowdy.com",
    stage: "lost", value: 20000, fit: 2, engagement: 0, source: "Cold outbound", owner: "ib",
    nextStep: "Revisit in Q2", touch: -24, due: null,
    log: [["stage", "Went with in-house hire", -24]],
  },
  {
    company: "Pillar Mobility", domain: "pillar.africa", industry: "Logistics", city: "Nairobi",
    contact: "Wanjiru Kamau", role: "Product Director", email: "wanjiru@pillar.africa",
    stage: "meeting", value: 40000, fit: 4, engagement: 4, source: "Referral", owner: "em",
    nextStep: "Confirm attendees for discovery", touch: -15, due: 0,
    log: [
      ["meeting", "Discovery booked, attendees pending", -15],
      ["email", "Intro from Multigate partner team", -20],
    ],
  },
  {
    company: "Scribe Studio", domain: "scribe.so", industry: "Media", city: "London",
    contact: "Hannah Webb", role: "Co-founder", email: "hannah@scribe.so",
    stage: "researching", value: 12000, fit: 3, engagement: 3, source: "Inbound", owner: "to",
    nextStep: "Review their current site and pitch", touch: -1, due: 3,
    log: [["note", "Signed up for newsletter, viewed pricing", -1]],
  },
  {
    company: "Carbon", domain: "getcarbon.co", industry: "Fintech", city: "Lagos",
    contact: "Femi Ojo", role: "Brand Lead", email: "femi@getcarbon.co",
    stage: "proposal", value: 52000, fit: 4, engagement: 5, source: "LinkedIn", owner: "ib",
    nextStep: "Chase signature on SOW", touch: -17, due: -2,
    log: [
      ["email", "Sent SOW for rebrand", -17],
      ["meeting", "Scoping workshop", -23],
    ],
  },
  {
    company: "Paystack", domain: "paystack.com", industry: "Fintech", city: "Lagos",
    contact: "Tunde Bakare", role: "Brand Director", email: "tunde@paystack.com",
    stage: "contacted", value: 70000, fit: 5, engagement: 7, source: "Referral", owner: "em",
    nextStep: "Share studio credentials deck", touch: -1, due: 1,
    log: [["email", "Warm intro, asked for credentials", -1]],
  },
  {
    company: "Reliance Health", domain: "reliancehealth.com", industry: "Health", city: "Lagos",
    contact: "Zainab Musa", role: "Head of Design", email: "zainab@reliancehealth.com",
    stage: "researching", value: 28000, fit: 4, engagement: 2, source: "Event", owner: "to",
    nextStep: "Map their member app journey", touch: -6, due: 0,
    log: [["note", "Met at Sections meetup, open to an audit", -6]],
  },
]

export const SEQUENCES: Sequence[] = [
  {
    id: "seq_cold",
    name: "Cold outreach",
    description: "Five touches over two weeks for new prospects with no warm path.",
    exitOnReply: true,
    steps: [
      { id: "s1", day: 0, kind: "email", title: "Intro email with one relevant case study" },
      { id: "s2", day: 2, kind: "linkedin", title: "Connect on LinkedIn with a short note" },
      { id: "s3", day: 5, kind: "email", title: "Share a teardown of their product" },
      { id: "s4", day: 9, kind: "call", title: "Call to offer a 20-minute audit" },
      { id: "s5", day: 14, kind: "email", title: "Polite break-up email" },
    ],
  },
  {
    id: "seq_revive",
    name: "Revive cold deal",
    description: "Re-open a stalled conversation with something useful, not a nudge.",
    exitOnReply: true,
    steps: [
      { id: "r1", day: 0, kind: "email", title: "Send a relevant idea or insight for {company}" },
      { id: "r2", day: 3, kind: "call", title: "Quick call to check priorities have not changed" },
      { id: "r3", day: 7, kind: "email", title: "Ask if we should close the file for now" },
    ],
  },
  {
    id: "seq_proposal",
    name: "Proposal chaser",
    description: "Keep momentum after a proposal without being pushy.",
    exitOnReply: false,
    steps: [
      { id: "p1", day: 2, kind: "email", title: "Answer open questions on the proposal" },
      { id: "p2", day: 5, kind: "call", title: "Call to walk through scope and timeline" },
      { id: "p3", day: 10, kind: "email", title: "Offer a smaller first phase" },
    ],
  },
]

function automation(a: Omit<Automation, "runs" | "lastRunAt" | "createdAt" | "origin"> & Partial<Automation>): Automation {
  return { runs: 0, lastRunAt: null, createdAt: at(-30), origin: "template", ...a }
}

export const AUTOMATIONS: Automation[] = [
  automation({
    id: "au_welcome",
    name: "Route and research new prospects",
    description: "Every new prospect gets an owner by round robin and a research task, like Chili Piper routing.",
    enabled: true,
    trigger: { type: "prospect_created" },
    conditions: [],
    actions: [
      { type: "assign_owner", owner: "round_robin" },
      { type: "create_task", title: "Research {company} and plan first touch", dueInDays: 1, priority: "normal" },
    ],
    runs: 14, lastRunAt: at(-1, 16),
  }),
  automation({
    id: "au_hot",
    name: "Hot lead alert",
    description: "When a lead score crosses 75, alert the owner and ask for a call within the day.",
    enabled: true,
    trigger: { type: "score_above", value: 75 },
    conditions: [],
    actions: [
      { type: "notify", text: "{company} just turned hot. Call {contact} today." },
      { type: "create_task", title: "Call {contact} while they are hot", dueInDays: 0, priority: "high" },
    ],
    runs: 6, lastRunAt: at(-2, 11),
  }),
  automation({
    id: "au_revive",
    name: "Revive cold deals",
    description: "Open deals with no contact for 14 days get a re-engage task and the Revive sequence.",
    enabled: true,
    trigger: { type: "inactive", days: 14 },
    conditions: [{ id: "c1", field: "value", op: "gte", value: "15000" }],
    actions: [
      { type: "create_task", title: "Re-engage {contact} with something useful", dueInDays: 0, priority: "high" },
      { type: "enroll_sequence", sequenceId: "seq_revive" },
    ],
    runs: 9, lastRunAt: at(-3, 9),
  }),
  automation({
    id: "au_reply",
    name: "Stop outreach when they reply",
    description: "A reply ends any running sequence and tells the owner, the HubSpot way.",
    enabled: true,
    trigger: { type: "stage_changed", to: "replied" },
    conditions: [],
    actions: [
      { type: "unenroll_sequence" },
      { type: "notify", text: "{contact} at {company} replied. Sequence stopped." },
      { type: "set_next_step", text: "Book a discovery call with {contact}", dueInDays: 1 },
    ],
    runs: 11, lastRunAt: at(-3, 14),
  }),
  automation({
    id: "au_meeting",
    name: "Meeting booked hand-off",
    description: "Booking a meeting moves the deal forward and queues the agenda.",
    enabled: true,
    trigger: { type: "meeting_booked" },
    conditions: [],
    actions: [
      { type: "move_stage", to: "meeting" },
      { type: "create_task", title: "Send agenda to {contact}", dueInDays: 0, priority: "normal" },
    ],
    runs: 7, lastRunAt: at(-1, 10),
  }),
  automation({
    id: "au_proposal",
    name: "Proposal follow-through",
    description: "After a proposal goes out, start the Proposal chaser sequence.",
    enabled: true,
    trigger: { type: "stage_changed", to: "proposal" },
    conditions: [],
    actions: [
      { type: "enroll_sequence", sequenceId: "seq_proposal" },
      { type: "set_next_step", text: "Follow up on the proposal", dueInDays: 3 },
    ],
    runs: 4, lastRunAt: at(-5, 15),
  }),
  automation({
    id: "au_won",
    name: "Won deal kickoff",
    description: "Signed deals get a kickoff task and the team hears about it, Monday style.",
    enabled: true,
    trigger: { type: "stage_changed", to: "won" },
    conditions: [],
    actions: [
      { type: "unenroll_sequence" },
      { type: "notify", text: "{company} signed. Nice work, {owner}." },
      { type: "create_task", title: "Send kickoff pack to {contact}", dueInDays: 1, priority: "high" },
    ],
    runs: 2, lastRunAt: at(-5, 12),
  }),
  automation({
    id: "au_lost",
    name: "Lost deal nurture",
    description: "Lost deals are parked with a reminder to revisit in a quarter.",
    enabled: false,
    trigger: { type: "stage_changed", to: "lost" },
    conditions: [],
    actions: [
      { type: "unenroll_sequence" },
      { type: "set_next_step", text: "Revisit {company} next quarter", dueInDays: 90 },
    ],
    runs: 1, lastRunAt: at(-24, 10),
  }),
  automation({
    id: "au_overdue",
    name: "Escalate overdue next steps",
    description: "Overdue next steps on big deals raise an alert, like a Zendesk SLA breach.",
    enabled: true,
    trigger: { type: "overdue" },
    conditions: [{ id: "c2", field: "value", op: "gte", value: "40000" }],
    actions: [{ type: "notify", text: "Next step on {company} is overdue: big deal at risk." }],
    runs: 3, lastRunAt: at(-2, 8),
  }),
]

function activity(kind: ActivityKind, text: string, d: number): Activity {
  return { id: newId("a"), kind, text, at: at(d, 11) }
}

/** Deals that closed in the last few months, so Reports has history. */
const HISTORY: { company: string; domain: string; industry: Seed["industry"]; contact: string; role: string; value: number; won: boolean; source: Seed["source"]; owner: string; closedDaysAgo: number; cycle: number }[] = [
  { company: "Flutterwave", domain: "flutterwave.com", industry: "Fintech", contact: "Gbenga Ola", role: "VP Brand", value: 58000, won: true, source: "Referral", owner: "em", closedDaysAgo: 75, cycle: 34 },
  { company: "Cowrywise", domain: "cowrywise.com", industry: "Fintech", contact: "Razaq Ade", role: "Head of Design", value: 24000, won: true, source: "Event", owner: "to", closedDaysAgo: 40, cycle: 21 },
  { company: "TeamApt", domain: "teamapt.com", industry: "Fintech", contact: "Seyi Lade", role: "Product Lead", value: 30000, won: false, source: "LinkedIn", owner: "ib", closedDaysAgo: 60, cycle: 28 },
  { company: "PiggyVest", domain: "piggyvest.com", industry: "Fintech", contact: "Odun Eweniyi", role: "COO", value: 36000, won: true, source: "Inbound", owner: "ib", closedDaysAgo: 100, cycle: 26 },
  { company: "Andela", domain: "andela.com", industry: "Education", contact: "Ope Ilori", role: "Brand Director", value: 45000, won: false, source: "Cold outbound", owner: "em", closedDaysAgo: 20, cycle: 40 },
  { company: "Kuda", domain: "kuda.com", industry: "Fintech", contact: "Tobi Iyanda", role: "Design Lead", value: 26000, won: false, source: "Referral", owner: "to", closedDaysAgo: 110, cycle: 18 },
  { company: "Lifebank", domain: "lifebank.ng", industry: "Health", contact: "Temie Giwa", role: "CEO", value: 32000, won: true, source: "Event", owner: "em", closedDaysAgo: 12, cycle: 30 },
]

const EXTRA_CONTACTS: Record<string, [string, string, string][]> = {
  Paystack: [["Kemi Adeyemi", "Head of Marketing", "kemi@paystack.com"]],
  "Kora Pay": [["Bayo Smith", "CTO", "bayo@korapay.com"]],
  "Helium Health": [["Tola Ige", "COO", "tola@heliumhealth.com"]],
}

const CLOSE_IN: Record<StageId, number> = { researching: 90, contacted: 60, replied: 45, meeting: 30, proposal: 14, won: 0, lost: 0 }

/** Spreads a plausible stage history between two dates. */
function history(stage: StageId, fromDays: number, toDays: number) {
  const order = STAGES.map((x) => x.id).filter((x) => OPEN_STAGES.includes(x))
  const path: StageId[] = stage === "won" ? [...order, "won"] : stage === "lost" ? ["researching", "contacted", "replied", "lost"] : order.slice(0, order.indexOf(stage) + 1)
  return path.map((st, i) => ({ stage: st, at: at(Math.round(fromDays + ((toDays - fromDays) * i) / Math.max(1, path.length - 1)), 10) }))
}

export function buildState(): CRMState {
  const companies: Company[] = []
  const contacts: Contact[] = []
  const addCompany = (name: string, domain: string, industry: Seed["industry"], city: string, created: string) => {
    const c: Company = { id: newId("co"), name, domain, industry, city, notes: "", createdAt: created }
    companies.push(c)
    return c
  }
  const addContact = (companyId: string, name: string, role: string, email: string, created: string) => {
    const c: Contact = { id: newId("ct"), companyId, name, role, email, phone: "", createdAt: created }
    contacts.push(c)
    return c
  }

  const prospects: Prospect[] = SEEDS.map(({ touch, due, log, ...rest }) => {
    const createdDays = Math.min(-25, touch - 3)
    const created = at(createdDays)
    const co = addCompany(rest.company, rest.domain, rest.industry, rest.city, created)
    const main = addContact(co.id, rest.contact, rest.role, rest.email, created)
    const extra = (EXTRA_CONTACTS[rest.company] ?? []).map(([n, r, e]) => addContact(co.id, n, r, e, created))
    const closed = rest.stage === "won" || rest.stage === "lost"
    const stageHistory = history(rest.stage, createdDays, touch)
    return {
      ...rest,
      id: newId("p"),
      lastTouch: at(touch, 15),
      nextDue: due === null ? null : at(due, 9),
      createdAt: created,
      enrollment: null,
      activities: log.map(([k, t, d]) => activity(k, t, d)),
      companyId: co.id,
      contactIds: [main.id, ...extra.map((x) => x.id)],
      expectedClose: closed ? null : at(CLOSE_IN[rest.stage], 12),
      closedAt: closed ? stageHistory[stageHistory.length - 1].at : null,
      stageHistory,
    }
  })

  for (const h of HISTORY) {
    const created = at(-(h.closedDaysAgo + h.cycle))
    const co = addCompany(h.company, h.domain, h.industry, "Lagos", created)
    const ct = addContact(co.id, h.contact, h.role, `${h.contact.split(" ")[0].toLowerCase()}@${h.domain}`, created)
    const stage: StageId = h.won ? "won" : "lost"
    const stageHistory = history(stage, -(h.closedDaysAgo + h.cycle), -h.closedDaysAgo)
    prospects.push({
      id: newId("p"), company: h.company, domain: h.domain, industry: h.industry, city: "Lagos",
      contact: h.contact, role: h.role, email: ct.email, stage, value: h.value, fit: h.won ? 4 : 3,
      engagement: h.won ? 7 : 2, source: h.source, owner: h.owner, lastTouch: at(-h.closedDaysAgo, 15),
      nextStep: h.won ? "Delivered" : "Closed", nextDue: null, createdAt: created, enrollment: null,
      activities: [activity("stage", h.won ? "Signed" : "Closed lost", -h.closedDaysAgo)],
      companyId: co.id, contactIds: [ct.id], expectedClose: null, closedAt: stageHistory[stageHistory.length - 1].at, stageHistory,
    })
  }

  const byName = (n: string) => prospects.find((p) => p.company === n)!

  // Next steps become the owner's tasks.
  const tasks: Task[] = prospects
    .filter((p) => p.nextDue && !["won", "lost"].includes(p.stage))
    .map((p) => ({
      id: newId("t"),
      prospectId: p.id,
      title: p.nextStep,
      due: p.nextDue!,
      owner: p.owner,
      priority: p.value >= 40000 ? "high" : "normal",
      done: false,
      source: { kind: "manual" },
      isNextStep: true,
    }))

  // Northwind is mid-way through cold outreach.
  const north = byName("Northwind Labs")
  north.enrollment = { sequenceId: "seq_cold", step: 2, startedAt: at(-8) }
  tasks.push({
    id: newId("t"), prospectId: north.id, title: "Share a teardown of their product",
    due: at(-3, 9), owner: "em", priority: "normal", done: false,
    source: { kind: "sequence", id: "seq_cold", name: "Cold outreach", step: 2 },
  })

  const scribe = byName("Scribe Studio")
  scribe.enrollment = { sequenceId: "seq_cold", step: 0, startedAt: at(0) }
  tasks.push({
    id: newId("t"), prospectId: scribe.id, title: "Intro email with one relevant case study",
    due: at(0, 9), owner: "to", priority: "normal", done: false,
    source: { kind: "sequence", id: "seq_cold", name: "Cold outreach", step: 0 },
  })

  const meetings: Meeting[] = [
    { id: newId("m"), prospectId: byName("Helium Health").id, owner: "em", at: at(1, 11), minutes: 45, title: "Patient app working session" },
    { id: newId("m"), prospectId: byName("Pillar Mobility").id, owner: "em", at: at(2, 14), minutes: 30, title: "Discovery call" },
    { id: newId("m"), prospectId: byName("Moniepoint").id, owner: "em", at: at(4, 10), minutes: 60, title: "Kickoff workshop" },
  ]

  const runs = [
    { name: "Meeting booked hand-off", id: "au_meeting", company: "Helium Health", d: -1, steps: ["Moved to Meeting booked", 'Created task "Send agenda to Ifeoma"'] },
    { name: "Hot lead alert", id: "au_hot", company: "Kora Pay", d: -2, steps: ["Notified Emmanuel", 'Created high-priority task "Call Adaeze while they are hot"'] },
    { name: "Stop outreach when they reply", id: "au_reply", company: "Sendbox", d: -3, steps: ["Stopped Cold outreach", "Notified Ibukun", 'Set next step "Book a discovery call with Kunle"'] },
    { name: "Proposal follow-through", id: "au_proposal", company: "Carbon", d: -17, steps: ['Enrolled in "Proposal chaser"', 'Set next step "Follow up on the proposal"'] },
  ].map((r) => ({
    id: newId("r"),
    automationId: r.id,
    automationName: r.name,
    prospectId: byName(r.company).id,
    company: r.company,
    at: at(r.d, 10, 24),
    steps: r.steps,
    chained: false,
  }))

  return {
    version: 3,
    prospects,
    companies,
    contacts,
    tasks,
    notices: [
      { id: newId("n"), kind: "meeting", text: "Ifeoma Nwosu booked a 45 minute working session for tomorrow.", prospectId: byName("Helium Health").id, at: at(-1, 9, 40), read: false },
      { id: newId("n"), kind: "automation", text: "Kora Pay just turned hot. Call Adaeze today.", prospectId: byName("Kora Pay").id, automationId: "au_hot", at: at(-2, 11, 5), read: true },
      { id: newId("n"), kind: "system", text: "Welcome to your automations. Templates are switched on and ready to run.", at: at(-3, 8), read: true },
    ],
    meetings,
    automations: AUTOMATIONS.map((a) => ({ ...a })),
    runs,
    sequences: SEQUENCES.map((s) => ({ ...s, steps: s.steps.map((x) => ({ ...x })) })),
    routing: {
      mode: "round_robin",
      pool: ["em", "ib", "to"],
      cursor: 0,
      industryMap: { Fintech: "em", Health: "to", Logistics: "ib", Climate: "ib", Media: "to", Education: "to", Consumer: "ib" },
    },
    fired: {},
  }
}
