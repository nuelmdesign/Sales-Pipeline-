import * as React from "react"
import { Mail, Phone, Plus, Search, Trash2, Upload, X } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { toast } from "sonner"

import { Drawer } from "@/components/motion/drawer"
import { Table, type TableColumn } from "@/components/motion/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { spring } from "@/lib/motion"

import { CompanyMark, OwnerAvatar, PageHeader, StageBadge } from "./bits"
import { INDUSTRIES, isOpen, money, newId, relative, type Company, type Contact, type Industry } from "./data"
import { useStore } from "./store"
import { FeatureEmpty } from "./empty-states"

type Row = Company & { people: number; open: number; pipeline: number; won: number; last: string | null; owners: string[] }

export function CompaniesView({
  onOpenDeal,
  onNewDeal,
  onImport,
}: {
  onOpenDeal: (id: string) => void
  onNewDeal: (companyId?: string) => void
  onImport: () => void
}) {
  const { state } = useStore()
  const [query, setQuery] = React.useState("")
  const [openId, setOpenId] = React.useState<string | null>(null)

  const rows = React.useMemo<Row[]>(() => {
    const q = query.trim().toLowerCase()
    return state.companies
      .filter((c) => !q || [c.name, c.domain, c.city, c.industry].join(" ").toLowerCase().includes(q) || state.contacts.some((p) => p.companyId === c.id && p.name.toLowerCase().includes(q)))
      .map((c) => {
        const deals = state.prospects.filter((p) => p.companyId === c.id)
        return {
          ...c,
          people: state.contacts.filter((p) => p.companyId === c.id).length,
          open: deals.filter(isOpen).length,
          pipeline: deals.filter(isOpen).reduce((s, p) => s + p.value, 0),
          won: deals.filter((p) => p.stage === "won").reduce((s, p) => s + p.value, 0),
          last: deals.map((p) => p.lastTouch).sort().at(-1) ?? null,
          owners: [...new Set(deals.map((p) => p.owner))],
        }
      })
  }, [state, query])

  const columns = React.useMemo<TableColumn<Row>[]>(
    () => [
      {
        key: "name",
        header: "Company",
        sortable: true,
        width: "1.6fr",
        cell: (c) => (
          <button type="button" onClick={() => setOpenId(c.id)} className="flex min-w-0 items-center gap-2.5 rounded-md text-left outline-none hover:text-brand focus-visible:ring-2 focus-visible:ring-ring">
            <CompanyMark name={c.name} className="size-7" />
            <span className="min-w-0">
              <span className="block truncate font-medium">{c.name}</span>
              <span className="block truncate font-mono text-[11px] text-muted-foreground">{c.industry} · {c.city || "No city"}</span>
            </span>
          </button>
        ),
      },
      { key: "people", header: "People", sortable: true, width: "90px", align: "right", cell: (c) => <span className="font-mono tabular-nums">{c.people}</span> },
      { key: "open", header: "Open deals", sortable: true, width: "110px", align: "right", cell: (c) => <span className="font-mono tabular-nums">{c.open}</span> },
      { key: "pipeline", header: "Pipeline", sortable: true, width: "120px", align: "right", cell: (c) => <span className="font-mono tabular-nums">{c.pipeline ? money(c.pipeline) : "–"}</span> },
      { key: "won", header: "Won", sortable: true, width: "120px", align: "right", cell: (c) => <span className="font-mono tabular-nums text-success">{c.won ? money(c.won) : <span className="text-muted-foreground">–</span>}</span> },
      { key: "last", header: "Last touch", sortable: true, width: "110px", sortValue: (c) => c.last ?? "", cell: (c) => <span className="font-mono text-xs text-muted-foreground">{c.last ? relative(c.last) : "Never"}</span> },
      {
        key: "owners",
        header: "Owners",
        width: "100px",
        cell: (c) => (
          <span className="flex -space-x-1.5">
            {c.owners.slice(0, 3).map((o) => (
              <OwnerAvatar key={o} id={o} className="ring-2 ring-card" />
            ))}
          </span>
        ),
      },
    ],
    []
  )

  if (!state.companies.length)
    return (
      <>
        <FeatureEmpty feature="companies" onImport={onImport} onAdd={() => onNewDeal()} />
      </>
    )

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 md:px-8">
      <PageHeader eyebrow="Companies" title="Every organisation you are talking to">
        <Button variant="outline" onClick={onImport}><Upload /> Import</Button>
        <Button onClick={() => onNewDeal()}><Plus /> New prospect</Button>
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-80">
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input id="co-search" aria-label="Search companies and people" placeholder="Search companies and people" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-8" />
        </div>
        <span className="ml-auto font-mono text-[11px] text-muted-foreground">
          {rows.length} companies · {state.contacts.length} people
        </span>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[860px]">
          <Table
            data={rows}
            columns={columns}
            getRowId={(c) => c.id}
            defaultSort={{ key: "pipeline", direction: "desc" }}
            rowHeight={56}
            height={Math.min(640, Math.max(240, rows.length * 56 + 44))}
            emptyState={
              <div className="flex flex-col items-center gap-3 py-12 text-sm text-muted-foreground">
                {state.companies.length ? "No companies match that search." : "No companies yet. Add a prospect or import a spreadsheet."}
                {!state.companies.length ? (
                  <Button variant="outline" size="sm" onClick={onImport}><Upload /> Import a spreadsheet</Button>
                ) : null}
              </div>
            }
          />
        </div>
      </div>

      <CompanyDrawer id={openId} onClose={() => setOpenId(null)} onOpenDeal={(id) => { setOpenId(null); onOpenDeal(id) }} onNewDeal={(cid) => { setOpenId(null); onNewDeal(cid) }} />
    </div>
  )
}

export function CompanyDrawer({
  id,
  onClose,
  onOpenDeal,
  onNewDeal,
}: {
  id: string | null
  onClose: () => void
  onOpenDeal: (id: string) => void
  onNewDeal: (companyId: string) => void
}) {
  const { state, saveCompany } = useStore()
  const c = id ? state.companies.find((x) => x.id === id) : undefined
  const last = React.useRef(c)
  if (c) last.current = c
  const shown = c ?? last.current
  const [draft, setDraft] = React.useState<Company | null>(null)
  React.useEffect(() => setDraft(shown ? { ...shown } : null), [shown?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!shown || !draft) return <Drawer open={false} onOpenChange={() => {}}>{null}</Drawer>
  const deals = state.prospects.filter((p) => p.companyId === shown.id)
  const people = state.contacts.filter((p) => p.companyId === shown.id)
  const commit = (patch: Partial<Company>) => {
    const next = { ...draft, ...patch }
    setDraft(next)
    if (JSON.stringify(next) !== JSON.stringify(shown)) saveCompany(next)
  }

  return (
    <Drawer open={Boolean(id && c)} onOpenChange={(o) => !o && onClose()} side="right" ariaLabel={`${shown.name} company`} className="w-[min(32rem,100vw)] max-w-full overflow-y-auto">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-background px-6 py-3">
        <p className="eyebrow text-muted-foreground">Company</p>
        <Button variant="ghost" size="icon-sm" aria-label="Close" onClick={onClose}><X /></Button>
      </div>
      <div className="flex flex-col gap-5 px-6 py-6">
        <div className="flex items-center gap-3">
          <CompanyMark name={shown.name} className="size-11" />
          <h2 className="min-w-0 truncate font-display text-3xl font-light tracking-[-0.02em]">{shown.name}</h2>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field id="co-name" label="Name"><Input id="co-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} onBlur={() => draft.name.trim() && commit({ name: draft.name.trim() })} /></Field>
          <Field id="co-domain" label="Website"><Input id="co-domain" value={draft.domain} placeholder="company.com" onChange={(e) => setDraft({ ...draft, domain: e.target.value })} onBlur={() => commit({ domain: draft.domain.trim() })} className="font-mono text-xs" /></Field>
          <Field id="co-ind" label="Industry">
            <Select value={draft.industry} onValueChange={(v) => commit({ industry: v as Industry })}>
              <SelectTrigger id="co-ind" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>{INDUSTRIES.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field id="co-city" label="City"><Input id="co-city" value={draft.city} onChange={(e) => setDraft({ ...draft, city: e.target.value })} onBlur={() => commit({ city: draft.city.trim() })} /></Field>
          <Field id="co-notes" label="Notes" className="col-span-2">
            <Textarea id="co-notes" value={draft.notes} placeholder="What they do, who decides, what they care about" onChange={(e) => setDraft({ ...draft, notes: e.target.value })} onBlur={() => commit({ notes: draft.notes })} className="min-h-20" />
          </Field>
        </div>
      </div>

      <section className="flex flex-col gap-3 border-t px-6 py-5">
        <div className="flex items-center justify-between">
          <span className="eyebrow text-muted-foreground">Deals <span className="font-mono tabular-nums">{deals.length}</span></span>
          <Button variant="ghost" size="sm" onClick={() => onNewDeal(shown.id)}><Plus /> New deal</Button>
        </div>
        <ul className="grid gap-2">
          {deals.map((d) => (
            <li key={d.id}>
              <button type="button" onClick={() => onOpenDeal(d.id)} className="flex w-full items-center gap-3 rounded-md border bg-card px-3 py-2 text-left transition-colors hover:border-input focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
                <StageBadge stage={d.stage} />
                <span className="min-w-0 flex-1 truncate text-sm">{d.contact}</span>
                <span className="font-mono text-xs tabular-nums">{money(d.value)}</span>
                <OwnerAvatar id={d.owner} className="size-5" />
              </button>
            </li>
          ))}
          {!deals.length ? <li className="text-sm text-muted-foreground">No deals yet.</li> : null}
        </ul>
      </section>

      <section className="flex flex-col gap-3 border-t px-6 pt-5 pb-10">
        <span className="eyebrow text-muted-foreground">People <span className="font-mono tabular-nums">{people.length}</span></span>
        <PeopleList companyId={shown.id} people={people} />
      </section>
    </Drawer>
  )
}

/** People at a company, with add and remove. Optionally attaches new people to a deal. */
export function PeopleList({
  companyId,
  people,
  dealId,
  primaryId,
  onMakePrimary,
  onUnlink,
}: {
  companyId: string
  people: Contact[]
  dealId?: string
  primaryId?: string
  onMakePrimary?: (id: string) => void
  onUnlink?: (id: string) => void
}) {
  const { saveContact, removeContact } = useStore()
  const [adding, setAdding] = React.useState(false)
  const [form, setForm] = React.useState({ name: "", role: "", email: "", phone: "" })

  return (
    <div className="flex flex-col gap-2">
      <ul className="grid gap-2">
        <AnimatePresence initial={false}>
          {people.map((p) => (
            <motion.li key={p.id} layout initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }} transition={spring.smooth} className="flex items-start gap-3 rounded-md border bg-surface p-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted font-mono text-[11px]">{p.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}</span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  {p.name}
                  {primaryId === p.id ? <span className="rounded-sm bg-brand/10 px-1.5 py-0.5 font-mono text-[10px] font-normal text-brand">Main contact</span> : null}
                </p>
                <p className="truncate text-xs text-muted-foreground">{p.role || "No role"}</p>
                <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-[11px] text-muted-foreground">
                  {p.email ? <span className="inline-flex items-center gap-1 select-all"><Mail className="size-3" />{p.email}</span> : null}
                  {p.phone ? <span className="inline-flex items-center gap-1 select-all"><Phone className="size-3" />{p.phone}</span> : null}
                </p>
                {onMakePrimary && primaryId !== p.id ? (
                  <button type="button" onClick={() => onMakePrimary(p.id)} className="mt-1.5 text-xs text-brand hover:underline">Make main contact</button>
                ) : null}
              </div>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={onUnlink ? `Remove ${p.name} from this deal` : `Delete ${p.name}`}
                className="text-muted-foreground"
                onClick={() => {
                  if (onUnlink) {
                    onUnlink(p.id)
                    toast(`${p.name} removed from this deal`)
                  } else {
                    removeContact(p.id)
                    toast(`Deleted ${p.name}`, { action: { label: "Undo", onClick: () => saveContact(p) } })
                  }
                }}
              >
                {onUnlink ? <X /> : <Trash2 />}
              </Button>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>

      <AnimatePresence initial={false}>
        {adding ? (
          <motion.form
            key="add"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={spring.smooth}
            onSubmit={(e) => {
              e.preventDefault()
              if (!form.name.trim()) return
              saveContact({ id: newId("ct"), companyId, name: form.name.trim(), role: form.role.trim(), email: form.email.trim(), phone: form.phone.trim(), createdAt: new Date().toISOString() }, dealId)
              toast.success(`Added ${form.name.trim()}`)
              setForm({ name: "", role: "", email: "", phone: "" })
              setAdding(false)
            }}
            className="grid grid-cols-2 gap-2 overflow-hidden rounded-md border p-3"
          >
            <Input aria-label="Name" placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
            <Input aria-label="Role" placeholder="Role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} />
            <Input aria-label="Email" type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <Input aria-label="Phone" type="tel" placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <div className="col-span-2 flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setAdding(false)}>Cancel</Button>
              <Button type="submit" size="sm" disabled={!form.name.trim()}>Add person</Button>
            </div>
          </motion.form>
        ) : (
          <Button key="btn" variant="ghost" size="sm" className="w-fit text-muted-foreground" onClick={() => setAdding(true)}>
            <Plus /> Add a person
          </Button>
        )}
      </AnimatePresence>
    </div>
  )
}

function Field({ id, label, className, children }: { id: string; label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`flex min-w-0 flex-col gap-1.5 ${className ?? ""}`}>
      <Label htmlFor={id} className="eyebrow text-[11px] leading-none font-normal text-muted-foreground">{label}</Label>
      {children}
    </div>
  )
}
