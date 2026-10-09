import * as React from "react"
import { ArrowLeft, ArrowRight, Check, FileSpreadsheet, Upload } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { toast } from "sonner"

import { AnimatedNumber } from "@/components/motion/animated-number"
import { ShimmerText } from "@/components/motion/shimmer-text"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { duration, ease, spring } from "@/lib/motion"

import { STAGES, isOpen, owner, stageLabel, type CRMState, type StageId } from "./data"
import { useStore, type ImportRow, type ImportSummary } from "./store"

/* ------------------------------------------------------------------ */
/* CSV                                                                  */
/* ------------------------------------------------------------------ */

/** Parses CSV or tab-separated text, honouring quotes and line breaks inside quotes. */
export function parseCSV(text: string): string[][] {
  const clean = text.replace(/^﻿/, "")
  const first = clean.split(/\r?\n/)[0] ?? ""
  const delim = [",", "\t", ";"].map((d) => [d, first.split(d).length] as const).sort((a, b) => b[1] - a[1])[0][0]
  const rows: string[][] = []
  let row: string[] = []
  let cell = ""
  let quoted = false
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i]
    if (quoted) {
      if (ch === '"' && clean[i + 1] === '"') {
        cell += '"'
        i++
      } else if (ch === '"') quoted = false
      else cell += ch
    } else if (ch === '"') quoted = true
    else if (ch === delim) {
      row.push(cell)
      cell = ""
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && clean[i + 1] === "\n") i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ""
    } else cell += ch
  }
  if (cell || row.length) {
    row.push(cell)
    rows.push(row)
  }
  return rows.map((r) => r.map((c) => c.trim())).filter((r) => r.some(Boolean))
}

function csvCell(v: unknown) {
  const s = String(v ?? "")
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s
}

export function toCSV(rows: unknown[][]) {
  return rows.map((r) => r.map(csvCell).join(",")).join("\n")
}

/* ------------------------------------------------------------------ */
/* Field mapping                                                        */
/* ------------------------------------------------------------------ */

type Field = keyof ImportRow
const FIELDS: { key: Field; label: string; match: RegExp; required?: boolean }[] = [
  { key: "company", label: "Company", match: /^(company|organi[sz]ation|account|business|company name|org)$/i, required: true },
  { key: "contact", label: "Contact name", match: /^(contact|name|full ?name|person|contact name|lead)$/i },
  { key: "role", label: "Role", match: /^(role|title|job ?title|position)$/i },
  { key: "email", label: "Email", match: /e-?mail/i },
  { key: "phone", label: "Phone", match: /phone|mobile|tel/i },
  { key: "domain", label: "Website", match: /^(website|domain|url|site)$/i },
  { key: "industry", label: "Industry", match: /industry|sector|vertical/i },
  { key: "city", label: "City", match: /^(city|location|town)$/i },
  { key: "value", label: "Deal value", match: /value|amount|budget|deal size|size/i },
  { key: "stage", label: "Stage", match: /stage|status/i },
  { key: "source", label: "Source", match: /source|channel|lead source/i },
  { key: "notes", label: "Notes", match: /note|comment|description/i },
]

function guessMap(headers: string[]) {
  const map: Partial<Record<Field, number>> = {}
  FIELDS.forEach((f) => {
    const i = headers.findIndex((h, idx) => f.match.test(h) && !Object.values(map).includes(idx))
    if (i >= 0) map[f.key] = i
  })
  return map
}

function parseValue(v: string) {
  const s = v.toLowerCase().replace(/[, ]/g, "")
  const n = parseFloat(s.replace(/[^0-9.]/g, ""))
  if (Number.isNaN(n)) return 0
  return Math.round(s.endsWith("k") ? n * 1000 : s.endsWith("m") ? n * 1_000_000 : n)
}

function parseStage(v: string): StageId | undefined {
  const q = v.trim().toLowerCase()
  if (!q) return undefined
  return STAGES.find((s) => s.id === q || s.label.toLowerCase() === q || q.includes(s.label.toLowerCase().split(" ")[0]))?.id
}

function toRows(data: string[][], map: Partial<Record<Field, number>>): ImportRow[] {
  return data.map((r) => {
    const g = (k: Field) => (map[k] !== undefined ? r[map[k]!] ?? "" : "")
    return {
      company: g("company"),
      contact: g("contact"),
      role: g("role"),
      email: g("email"),
      phone: g("phone"),
      domain: g("domain").replace(/^https?:\/\//, "").replace(/\/.*$/, ""),
      industry: g("industry"),
      city: g("city"),
      value: parseValue(g("value")),
      stage: parseStage(g("stage")),
      source: g("source"),
      notes: g("notes"),
    }
  })
}

function preview(state: CRMState, rows: ImportRow[]) {
  const seen = new Set<string>()
  let fresh = 0
  let existing = 0
  let missing = 0
  let dupes = 0
  for (const r of rows) {
    const name = r.company?.trim().toLowerCase()
    if (!name) {
      missing++
      continue
    }
    if (seen.has(name)) {
      dupes++
      continue
    }
    seen.add(name)
    const co = state.companies.find((c) => c.name.trim().toLowerCase() === name)
    if (co && state.prospects.some((p) => p.companyId === co.id && isOpen(p))) existing++
    else fresh++
  }
  return { fresh, existing, missing, dupes }
}

/* ------------------------------------------------------------------ */
/* Wizard                                                               */
/* ------------------------------------------------------------------ */

export function ImportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { state, importRows, canWrite } = useStore()
  const [step, setStep] = React.useState<0 | 1 | 2 | 3>(0)
  const [table, setTable] = React.useState<string[][]>([])
  const [fileName, setFileName] = React.useState("")
  const [paste, setPaste] = React.useState("")
  const [map, setMap] = React.useState<Partial<Record<Field, number>>>({})
  const [runAutomations, setRunAutomations] = React.useState(true)
  const [busy, setBusy] = React.useState(false)
  const [result, setResult] = React.useState<ImportSummary | null>(null)
  const [drag, setDrag] = React.useState(false)

  React.useEffect(() => {
    if (open) {
      setStep(0)
      setTable([])
      setFileName("")
      setPaste("")
      setMap({})
      setResult(null)
      setBusy(false)
    }
  }, [open])

  const headers = table[0] ?? []
  const body = table.slice(1)
  const rows = React.useMemo(() => toRows(body, map), [body, map])
  const check = React.useMemo(() => preview(state, rows), [state, rows])

  const load = (text: string, name: string) => {
    const t = parseCSV(text)
    if (t.length < 2) {
      toast("That file has no rows to import", { description: "The first row should be column names, with one prospect per row below it." })
      return
    }
    setTable(t)
    setFileName(name)
    setMap(guessMap(t[0]))
    setStep(1)
  }

  const readFile = async (f: File | undefined) => {
    if (!f) return
    if (!/\.(csv|tsv|txt)$/i.test(f.name)) {
      toast("Save the sheet as CSV first", { description: "In Excel or Google Sheets: File, then Download or Save as, then CSV." })
      return
    }
    load(await f.text(), f.name)
  }

  const doImport = () => {
    setBusy(true)
    setStep(3)
    window.setTimeout(() => {
      const s = importRows(rows, runAutomations)
      setResult(s)
      setBusy(false)
    }, 600)
  }

  const STEPS = ["Upload", "Match columns", "Review", "Done"]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl font-light tracking-[-0.02em]">Import prospects</DialogTitle>
          <DialogDescription>From a CSV exported from Excel, Google Sheets, HubSpot or anywhere else.</DialogDescription>
        </DialogHeader>

        <ol className="flex items-center gap-2" aria-label="Steps">
          {STEPS.map((label, i) => (
            <li key={label} className="flex items-center gap-2">
              <span className={cn("grid size-5 place-items-center rounded-full font-mono text-[10px] transition-colors", i < step ? "bg-primary text-primary-foreground" : i === step ? "border border-brand text-brand" : "border text-muted-foreground")}>
                {i < step ? <Check className="size-3" /> : i + 1}
              </span>
              <span className={cn("hidden text-xs sm:inline", i === step ? "text-foreground" : "text-muted-foreground")}>{label}</span>
              {i < STEPS.length - 1 ? <span aria-hidden className="h-px w-4 bg-border sm:w-8" /> : null}
            </li>
          ))}
        </ol>

        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: duration.fast, ease: ease.out }} className="flex min-w-0 flex-col gap-4">
            {step === 0 ? (
              <>
                <label
                  onDragOver={(e) => {
                    e.preventDefault()
                    setDrag(true)
                  }}
                  onDragLeave={() => setDrag(false)}
                  onDrop={(e) => {
                    e.preventDefault()
                    setDrag(false)
                    readFile(e.dataTransfer.files[0])
                  }}
                  className={cn("flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed bg-surface px-6 py-10 text-center transition-colors", drag && "border-brand bg-brand/5")}
                >
                  <Upload className="size-6 text-muted-foreground" />
                  <span className="text-sm font-medium">Drop a CSV here, or choose a file</span>
                  <span className="text-xs text-muted-foreground">First row is column names. One prospect per row.</span>
                  <input id="import-file" type="file" accept=".csv,.tsv,.txt,text/csv" className="sr-only" onChange={(e) => readFile(e.target.files?.[0])} />
                </label>
                <div className="flex flex-col gap-2">
                  <span className="eyebrow text-muted-foreground">Or paste from a spreadsheet</span>
                  <Textarea id="import-paste" aria-label="Paste rows" value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={"Company, Contact, Email, Value\nAcme, Ada Lovelace, ada@acme.com, 25000"} className="min-h-24 font-mono text-xs" />
                  <Button variant="outline" size="sm" className="w-fit" disabled={!paste.trim()} onClick={() => load(paste, "Pasted rows")}>Use pasted rows</Button>
                </div>
              </>
            ) : step === 1 ? (
              <>
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <FileSpreadsheet className="size-4" /> {fileName} · {body.length} rows · {headers.length} columns
                </p>
                <div className="overflow-hidden rounded-lg border">
                  <ul className="divide-y">
                    {FIELDS.map((f) => {
                      const idx = map[f.key]
                      const sample = idx !== undefined ? body.slice(0, 3).map((r) => r[idx]).filter(Boolean).join(" · ") : ""
                      return (
                        <li key={f.key} className="grid grid-cols-[8rem_1fr] items-center gap-3 px-3 py-2 sm:grid-cols-[9rem_12rem_1fr]">
                          <span className="text-sm">
                            {f.label}
                            {f.required ? <span className="text-destructive"> *</span> : null}
                          </span>
                          <Select value={idx === undefined ? "none" : String(idx)} onValueChange={(v) => setMap((m) => ({ ...m, [f.key]: v === "none" ? undefined : Number(v) }))}>
                            <SelectTrigger aria-label={`Column for ${f.label}`} className="h-8 w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Do not import</SelectItem>
                              {headers.map((h, i) => (
                                <SelectItem key={i} value={String(i)}>{h || `Column ${i + 1}`}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <span className="col-span-2 truncate font-mono text-[11px] text-muted-foreground sm:col-span-1">{sample || "–"}</span>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              </>
            ) : step === 2 ? (
              <>
                <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-4">
                  {[
                    ["New prospects", check.fresh, ""],
                    ["Already open", check.existing, "Skipped. New people are still added."],
                    ["Repeated rows", check.dupes, "Only the first is used."],
                    ["Missing company", check.missing, "Skipped."],
                  ].map(([label, n, hint]) => (
                    <div key={String(label)} className="flex flex-col gap-1.5 bg-card p-4">
                      <span className="eyebrow text-[10px] text-muted-foreground">{label}</span>
                      <span className={cn("font-mono text-2xl tabular-nums", label === "New prospects" && "text-brand")}>{n}</span>
                      {hint ? <span className="text-[11px] leading-snug text-muted-foreground">{hint}</span> : null}
                    </div>
                  ))}
                </div>
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full min-w-[520px] text-left text-xs">
                    <thead className="bg-surface text-muted-foreground">
                      <tr>{["Company", "Contact", "Email", "Value", "Stage"].map((h) => <th key={h} className="px-3 py-2 font-normal">{h}</th>)}</tr>
                    </thead>
                    <tbody className="divide-y">
                      {rows.slice(0, 5).map((r, i) => (
                        <tr key={i}>
                          <td className="px-3 py-2 font-medium">{r.company || <span className="text-destructive">Missing</span>}</td>
                          <td className="px-3 py-2">{r.contact}</td>
                          <td className="px-3 py-2 font-mono">{r.email}</td>
                          <td className="px-3 py-2 font-mono tabular-nums">{r.value ? r.value.toLocaleString() : ""}</td>
                          <td className="px-3 py-2">{r.stage ? stageLabel(r.stage) : "Researching"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <label className="flex items-start gap-3 rounded-md border bg-surface p-3 text-sm">
                  <Switch checked={runAutomations} onCheckedChange={setRunAutomations} aria-label="Run automations" className="mt-0.5" />
                  <span>
                    Run new-prospect automations
                    <span className="block text-xs text-muted-foreground">Routes each prospect to an owner and queues their research task. Turn off for a quiet import.</span>
                  </span>
                </label>
              </>
            ) : (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                {busy ? (
                  <ShimmerText className="text-sm">Importing {rows.length} rows…</ShimmerText>
                ) : result ? (
                  <>
                    <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={spring.pop} className="grid size-10 place-items-center rounded-full bg-success/10 text-success">
                      <Check className="size-5" />
                    </motion.span>
                    <h3 className="font-display text-2xl font-light">
                      <AnimatedNumber value={result.deals} /> prospects imported
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {result.companies} new companies, {result.contacts} new people{result.skipped ? `, ${result.skipped} rows skipped` : ""}.
                      {runAutomations ? " Your routing rule assigned owners." : ""}
                    </p>
                  </>
                ) : null}
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        <DialogFooter className="sm:justify-between">
          {step === 1 || step === 2 ? (
            <Button variant="ghost" onClick={() => setStep((s) => (s - 1) as 0 | 1)}>
              <ArrowLeft /> Back
            </Button>
          ) : (
            <span />
          )}
          {step === 1 ? (
            <Button disabled={map.company === undefined} onClick={() => setStep(2)}>
              Review <ArrowRight />
            </Button>
          ) : step === 2 ? (
            <Button disabled={!check.fresh || !canWrite} onClick={doImport}>
              Import {check.fresh} prospect{check.fresh === 1 ? "" : "s"}
            </Button>
          ) : step === 3 && !busy ? (
            <Button onClick={() => onOpenChange(false)}>Done</Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ------------------------------------------------------------------ */
/* Export                                                               */
/* ------------------------------------------------------------------ */

type DownloadsNS = { save(r: { filename: string; data: string }): Promise<unknown> }

export function useDownloads() {
  const [dl, setDl] = React.useState<DownloadsNS | null>(null)
  React.useEffect(() => {
    let alive = true
    window.claude?.use?.("downloads").then((d) => alive && setDl(d as DownloadsNS | null)).catch(() => {})
    return () => {
      alive = false
    }
  }, [])
  return dl
}

export async function exportDeals(dl: DownloadsNS, state: CRMState) {
  const header = ["Company", "Website", "Industry", "City", "Main contact", "Role", "Email", "Other contacts", "Stage", "Value (USD)", "Owner", "Source", "Expected close", "Closed", "Last touch", "Next step"]
  const rows = state.prospects.map((p) => {
    const others = p.contactIds.slice(1).map((id) => state.contacts.find((c) => c.id === id)?.name).filter(Boolean).join("; ")
    return [p.company, p.domain, p.industry, p.city, p.contact, p.role, p.email, others, stageLabel(p.stage), p.value, owner(p.owner).name, p.source, p.expectedClose?.slice(0, 10) ?? "", p.closedAt?.slice(0, 10) ?? "", p.lastTouch.slice(0, 10), p.nextStep]
  })
  const date = new Date().toISOString().slice(0, 10)
  try {
    await dl.save({ filename: `prospect-pipeline-${date}.csv`, data: toCSV([header, ...rows]) })
    toast.success("Export saved")
  } catch (e) {
    const code = (e as { code?: string })?.code
    if (code === "declined") return
    toast(code === "rate_limited" ? "A save is already waiting for you. Try again in a moment." : "Exporting is not available here.")
  }
}
