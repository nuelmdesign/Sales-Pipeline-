import * as React from "react"
import { AlertTriangle, Building2, Check } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
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
import { cn } from "@/lib/utils"
import { spring } from "@/lib/motion"

import { INDUSTRIES, SOURCES, isOpen, stageLabel, type Company, type Industry, type Source } from "./data"
import { useStore } from "./store"

const EMPTY = {
  company: "",
  contact: "",
  role: "",
  email: "",
  city: "",
  value: "",
  close: "",
  industry: "Fintech" as Industry,
  source: "Referral" as Source,
}

export function AddProspectDialog({
  open,
  onOpenChange,
  onCreated,
  presetCompanyId,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  onCreated: (id: string) => void
  presetCompanyId?: string | null
}) {
  const { state, addProspect } = useStore()
  const [form, setForm] = React.useState(EMPTY)
  const [picked, setPicked] = React.useState<Company | null>(null)
  const [contactId, setContactId] = React.useState<string>("new")
  const [tried, setTried] = React.useState(false)
  const [focus, setFocus] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    const pre = presetCompanyId ? state.companies.find((c) => c.id === presetCompanyId) ?? null : null
    setForm(pre ? { ...EMPTY, company: pre.name, industry: pre.industry, city: pre.city } : EMPTY)
    setPicked(pre)
    setContactId("new")
    setTried(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const set = <K extends keyof typeof EMPTY>(k: K, v: (typeof EMPTY)[K]) => setForm((f) => ({ ...f, [k]: v }))

  const q = form.company.trim().toLowerCase()
  const suggestions = !picked && q.length >= 2 ? state.companies.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 5) : []
  const exact = !picked ? state.companies.find((c) => c.name.trim().toLowerCase() === q) : undefined
  const company = picked ?? exact ?? null
  const people = company ? state.contacts.filter((c) => c.companyId === company.id) : []
  const openDeals = company ? state.prospects.filter((p) => p.companyId === company.id && isOpen(p)) : []
  const emailOwner = form.email.trim() && contactId === "new" ? state.contacts.find((c) => c.email.toLowerCase() === form.email.trim().toLowerCase()) : undefined

  const companyMissing = !form.company.trim()
  const contactMissing = contactId === "new" && !form.contact.trim()

  const choose = (c: Company) => {
    setPicked(c)
    setForm((f) => ({ ...f, company: c.name, industry: c.industry, city: c.city }))
    setContactId(state.contacts.find((x) => x.companyId === c.id)?.id ?? "new")
    setFocus(false)
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (companyMissing || contactMissing) return
    const existing = contactId !== "new" ? state.contacts.find((c) => c.id === contactId) : undefined
    const p = addProspect({
      companyId: company?.id,
      companyName: form.company,
      industry: form.industry,
      city: form.city.trim(),
      contactId: existing?.id,
      contactName: existing?.name ?? form.contact,
      role: existing?.role ?? form.role.trim(),
      email: existing?.email ?? form.email.trim(),
      value: Number(form.value) || 0,
      source: form.source,
      expectedClose: form.close ? new Date(`${form.close}T12:00:00`).toISOString() : null,
    })
    if (!p) return
    onOpenChange(false)
    const pid = p.id
    toast.success(`${p.company} added`, {
      description: company ? "Linked to the existing company record." : "New company and contact created.",
      action: { label: "Open", onClick: () => onCreated(pid) },
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={submit} className="contents" noValidate>
          <DialogHeader>
            <DialogTitle className="font-display text-2xl font-light tracking-[-0.02em]">New prospect</DialogTitle>
            <DialogDescription>Starts in Researching. Your routing rule picks the owner and queues the research task.</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4">
            <div className="relative col-span-2 flex flex-col gap-1.5">
              <Label htmlFor="n-company">Company</Label>
              <div className="relative">
                <Input
                  id="n-company"
                  autoFocus={!presetCompanyId}
                  autoComplete="off"
                  value={form.company}
                  onFocus={() => setFocus(true)}
                  onBlur={() => window.setTimeout(() => setFocus(false), 150)}
                  onChange={(e) => {
                    set("company", e.target.value)
                    setPicked(null)
                    setContactId("new")
                  }}
                  aria-invalid={tried && companyMissing}
                  placeholder="Acme Payments"
                  className={cn(company && "pr-28")}
                />
                {company ? (
                  <span className="pointer-events-none absolute top-1/2 right-2 inline-flex -translate-y-1/2 items-center gap-1 rounded-sm bg-brand/10 px-1.5 py-0.5 font-mono text-[10px] text-brand">
                    <Check className="size-3" /> On file
                  </span>
                ) : null}
              </div>
              <AnimatePresence>
                {focus && suggestions.length > 0 && !exact ? (
                  <motion.ul
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={spring.snappy}
                    role="listbox"
                    aria-label="Matching companies"
                    className="absolute top-full right-0 left-0 z-20 mt-1 overflow-hidden rounded-md border bg-popover shadow-md"
                  >
                    {suggestions.map((c) => {
                      const n = state.contacts.filter((x) => x.companyId === c.id).length
                      return (
                        <li key={c.id}>
                          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => choose(c)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent focus-visible:bg-accent focus-visible:outline-none">
                            <Building2 className="size-3.5 text-muted-foreground" />
                            <span className="flex-1 truncate">{c.name}</span>
                            <span className="font-mono text-[11px] text-muted-foreground">{c.industry} · {n} {n === 1 ? "person" : "people"}</span>
                          </button>
                        </li>
                      )
                    })}
                  </motion.ul>
                ) : null}
              </AnimatePresence>
              {tried && companyMissing ? <p className="text-xs text-destructive">Add a company name.</p> : null}
              {openDeals.length ? (
                <p className="flex items-start gap-1.5 text-xs text-warning">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                  {company!.name} already has an open deal ({stageLabel(openDeals[0].stage)}). Saving adds a second deal for them.
                </p>
              ) : null}
            </div>

            {company && people.length ? (
              <div className="col-span-2 flex flex-col gap-1.5">
                <Label htmlFor="n-person">Contact</Label>
                <Select value={contactId} onValueChange={setContactId}>
                  <SelectTrigger id="n-person" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {people.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}{c.role ? `, ${c.role}` : ""}
                      </SelectItem>
                    ))}
                    <SelectItem value="new">Someone new</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            {contactId === "new" ? (
              <>
                <Row label="Contact" id="n-contact">
                  <Input id="n-contact" value={form.contact} onChange={(e) => set("contact", e.target.value)} aria-invalid={tried && contactMissing} placeholder="Full name" />
                  {tried && contactMissing ? <p className="text-xs text-destructive">Who are you reaching?</p> : null}
                </Row>
                <Row label="Role" id="n-role">
                  <Input id="n-role" value={form.role} onChange={(e) => set("role", e.target.value)} placeholder="Head of Product" />
                </Row>
                <Row label="Email" id="n-email" className="col-span-2">
                  <Input id="n-email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="name@company.com" />
                  {emailOwner ? (
                    <p className="text-xs text-warning">
                      {emailOwner.name} at {state.companies.find((c) => c.id === emailOwner.companyId)?.name ?? "another company"} already uses this address.
                    </p>
                  ) : null}
                </Row>
              </>
            ) : null}

            {!company ? (
              <>
                <Row label="Industry" id="n-industry">
                  <Select value={form.industry} onValueChange={(v) => set("industry", v as Industry)}>
                    <SelectTrigger id="n-industry" className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>{INDUSTRIES.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent>
                  </Select>
                </Row>
                <Row label="City" id="n-city">
                  <Input id="n-city" value={form.city} onChange={(e) => set("city", e.target.value)} placeholder="Lagos" />
                </Row>
              </>
            ) : null}

            <Row label="Source" id="n-source">
              <Select value={form.source} onValueChange={(v) => set("source", v as Source)}>
                <SelectTrigger id="n-source" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{SOURCES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </Row>
            <Row label="Est. value (USD)" id="n-value">
              <Input id="n-value" type="number" inputMode="numeric" min={0} step={1000} value={form.value} onChange={(e) => set("value", e.target.value)} placeholder="25000" className="font-mono tabular-nums" />
            </Row>
            <Row label="Expected close" id="n-close" className="col-span-2 sm:col-span-1">
              <Input id="n-close" type="date" value={form.close} onChange={(e) => set("close", e.target.value)} className="font-mono text-xs" />
            </Row>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">Cancel</Button>
            </DialogClose>
            <Button type="submit">Add prospect</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function Row({ label, id, className, children }: { label: string; id: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  )
}
