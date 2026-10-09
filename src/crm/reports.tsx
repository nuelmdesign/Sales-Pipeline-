import * as React from "react"
import { Download } from "lucide-react"
import { motion } from "motion/react"

import { AnimatedNumber } from "@/components/motion/animated-number"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { spring, stagger } from "@/lib/motion"

import { OwnerAvatar, PageHeader, SectionLabel } from "./bits"
import { OPEN_STAGES, OWNERS, SOURCES, STAGES, compactMoney, isOpen, money, owner, stageLabel, stageProbability, type CRMState, type Prospect, type StageId } from "./data"
import { exportDeals, useDownloads } from "./import-export"
import { useStore } from "./store"
import { FeatureEmpty } from "./empty-states"

const DAY = 86_400_000
const days = (a: string, b: string) => Math.max(0, (new Date(b).getTime() - new Date(a).getTime()) / DAY)

function closedIn(p: Prospect, since: number) {
  return p.closedAt && new Date(p.closedAt).getTime() >= since
}

function stats(list: Prospect[], since: number) {
  const won = list.filter((p) => p.stage === "won" && closedIn(p, since))
  const lost = list.filter((p) => p.stage === "lost" && closedIn(p, since))
  const closed = won.length + lost.length
  return {
    won,
    lost,
    winRate: closed ? won.length / closed : null,
    wonValue: won.reduce((s, p) => s + p.value, 0),
    avgWon: won.length ? won.reduce((s, p) => s + p.value, 0) / won.length : null,
    cycle: won.length ? won.reduce((s, p) => s + days(p.createdAt, p.closedAt!), 0) / won.length : null,
  }
}

export function ReportsView({ onImport, onAdd }: { onImport: () => void; onAdd: () => void }) {
  const { state } = useStore()
  const dl = useDownloads()
  const [period, setPeriod] = React.useState("90")
  const since = period === "all" ? 0 : Date.now() - Number(period) * DAY

  const all = state.prospects
  const s = stats(all, since)
  const open = all.filter(isOpen)
  const pipeline = open.reduce((n, p) => n + p.value, 0)
  const weighted = open.reduce((n, p) => n + p.value * stageProbability(p.stage), 0)

  const empty = all.length === 0

  if (empty) return <FeatureEmpty feature="reports" onImport={onImport} onAdd={onAdd} />

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 md:px-8">
      <PageHeader eyebrow="Reports" title="How the pipeline is really doing">
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger aria-label="Period for closed deals" className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
            <SelectItem value="180">Last 6 months</SelectItem>
            <SelectItem value="all">All time</SelectItem>
          </SelectContent>
        </Select>
        {dl ? (
          <Button variant="outline" onClick={() => exportDeals(dl, state)} disabled={empty}>
            <Download /> Export CSV
          </Button>
        ) : null}
      </PageHeader>

      {empty ? (
        <Card className="items-center gap-2 py-16 text-center">
          <h2 className="font-display text-2xl font-light">Nothing to report yet.</h2>
          <p className="max-w-sm text-sm text-muted-foreground">Reports fill in as you add prospects and close deals. Win rate needs at least one closed deal.</p>
        </Card>
      ) : (
        <>
          <section aria-label="Headline numbers" className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border lg:grid-cols-4">
            <Tile label="Win rate" hint={`${s.won.length} won, ${s.lost.length} lost`}>
              {s.winRate === null ? <span className="text-muted-foreground">–</span> : <><AnimatedNumber value={Math.round(s.winRate * 100)} /><span className="text-base text-muted-foreground">%</span></>}
            </Tile>
            <Tile label="Average won deal" hint={`${money(s.wonValue)} won in total`}>
              {s.avgWon === null ? <span className="text-muted-foreground">–</span> : <AnimatedNumber value={Math.round(s.avgWon)} locale="en-US" format={{ style: "currency", currency: "USD", maximumFractionDigits: 0 }} />}
            </Tile>
            <Tile label="Days to close" hint="Average for won deals">
              {s.cycle === null ? <span className="text-muted-foreground">–</span> : <AnimatedNumber value={Math.round(s.cycle)} />}
            </Tile>
            <Tile label="Weighted forecast" hint={`of ${compactMoney(pipeline)} open`}>
              <AnimatedNumber value={Math.round(weighted)} locale="en-US" format={{ style: "currency", currency: "USD", maximumFractionDigits: 0 }} />
            </Tile>
          </section>

          <Forecast state={state} />

          <div className="grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
            <Funnel state={state} since={since} />
            <TimeInStage state={state} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
            <ByOwner state={state} since={since} />
            <BySource state={state} since={since} />
          </div>
        </>
      )}
    </div>
  )
}

function Tile({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 bg-card p-5">
      <span className="eyebrow text-muted-foreground">{label}</span>
      <span className="font-mono text-2xl tabular-nums tracking-tight md:text-3xl">{children}</span>
      <span className="text-xs text-muted-foreground">{hint}</span>
    </div>
  )
}

function ChartCard({ title, label, legend, table, children }: { title: string; label: string; legend?: React.ReactNode; table: React.ReactNode; children: React.ReactNode }) {
  const [asTable, setAsTable] = React.useState(false)
  return (
    <Card className="gap-4 p-5">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <SectionLabel>{label}</SectionLabel>
          <h2 className="mt-2 text-base font-medium text-balance">{title}</h2>
        </div>
        <Button variant="ghost" size="sm" className="-mr-2 shrink-0 text-muted-foreground" onClick={() => setAsTable((v) => !v)} aria-pressed={asTable}>
          {asTable ? "Show chart" : "Show table"}
        </Button>
      </div>
      {legend && !asTable ? <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">{legend}</div> : null}
      {asTable ? <div className="overflow-x-auto">{table}</div> : children}
    </Card>
  )
}

function Key({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden className={cn("size-2.5", className)} />
      {children}
    </span>
  )
}

function DataTable({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <table className="w-full text-left text-xs">
      <thead className="text-muted-foreground">
        <tr className="border-b">{head.map((h, i) => <th key={h} className={cn("py-2 pr-3 font-normal", i > 0 && "text-right")}>{h}</th>)}</tr>
      </thead>
      <tbody className="divide-y">
        {rows.map((r, i) => (
          <tr key={i}>{r.map((c, j) => <td key={j} className={cn("py-2 pr-3", j > 0 && "text-right font-mono tabular-nums")}>{c}</td>)}</tr>
        ))}
      </tbody>
    </table>
  )
}

/* ---------------- forecast by expected close month ---------------- */

function Forecast({ state }: { state: CRMState }) {
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date()
    d.setDate(1)
    d.setMonth(d.getMonth() + i)
    return { key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString("en-GB", { month: "short" }), year: d.getFullYear(), month: d.getMonth() }
  })
  const open = state.prospects.filter((p) => isOpen(p))
  const undated = open.filter((p) => !p.expectedClose)
  const data = months.map((m) => {
    const deals = open.filter((p) => {
      if (!p.expectedClose) return false
      const d = new Date(p.expectedClose)
      // Overdue close dates count in the current month.
      if (m === months[0] && d.getTime() < new Date(m.year, m.month, 1).getTime()) return true
      return d.getFullYear() === m.year && d.getMonth() === m.month
    })
    return { ...m, deals, total: deals.reduce((s, p) => s + p.value, 0), weighted: deals.reduce((s, p) => s + p.value * stageProbability(p.stage), 0) }
  })
  const max = Math.max(1, ...data.map((d) => d.total))
  const best = [...data].sort((a, b) => b.weighted - a.weighted)[0]
  const next90 = data.slice(0, 3).reduce((s, d) => s + d.weighted, 0)

  return (
    <ChartCard
      label="Forecast by expected close"
      title={
        data.every((d) => !d.deals.length)
          ? "Add expected close dates to open deals to see the forecast."
          : `${money(Math.round(next90))} weighted is due to close in the next three months${best.weighted > 0 ? `, peaking in ${best.label}` : ""}.`
      }
      legend={
        <>
          <Key className="bg-primary">Weighted by stage</Key>
          <Key className="bg-primary/20">Full value</Key>
          {undated.length ? <span>{undated.length} open deal{undated.length === 1 ? "" : "s"} have no close date</span> : null}
        </>
      }
      table={<DataTable head={["Month", "Deals", "Full value", "Weighted"]} rows={data.map((d) => [`${d.label} ${d.year}`, d.deals.length, money(d.total), money(Math.round(d.weighted))])} />}
    >
      <div className="grid h-56 grid-cols-6 items-end gap-3 border-b">
        {data.map((d, i) => (
          <Tooltip key={d.key}>
            <TooltipTrigger asChild>
              <button type="button" className="group relative flex h-full flex-col justify-end outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`${d.label}: ${money(Math.round(d.weighted))} weighted of ${money(d.total)}`}>
                <span className="mb-1 text-center font-mono text-[11px] tabular-nums text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">{d.total ? compactMoney(d.weighted) : ""}</span>
                <motion.span
                  className="relative w-full origin-bottom bg-primary/20"
                  style={{ height: `${(d.total / max) * 100}%` }}
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={{ ...spring.smooth, delay: i * stagger.tight }}
                >
                  <span className="absolute inset-x-0 bottom-0 bg-primary transition-opacity group-hover:opacity-90" style={{ height: d.total ? `${(d.weighted / d.total) * 100}%` : 0 }} />
                </motion.span>
              </button>
            </TooltipTrigger>
            <TooltipContent className="flex flex-col items-start gap-1">
              <span className="font-medium">{d.label} {d.year}</span>
              <span className="font-mono tabular-nums">{money(Math.round(d.weighted))} weighted</span>
              <span className="font-mono tabular-nums text-muted-foreground">{money(d.total)} across {d.deals.length} deal{d.deals.length === 1 ? "" : "s"}</span>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
      <div className="-mt-2 grid grid-cols-6 gap-3">
        {data.map((d) => (
          <span key={d.key} className="text-center font-mono text-[11px] text-muted-foreground">{d.label}</span>
        ))}
      </div>
    </ChartCard>
  )
}

/* ---------------- stage conversion ---------------- */

function Funnel({ state, since }: { state: CRMState; since: number }) {
  const cohort = state.prospects.filter((p) => new Date(p.createdAt).getTime() >= since || (p.closedAt && new Date(p.closedAt).getTime() >= since))
  const order: StageId[] = [...OPEN_STAGES, "won"]
  const reached = (p: Prospect, st: StageId) => {
    const hist = new Set((p.stageHistory ?? []).map((h) => h.stage))
    if (hist.has(st)) return true
    if (p.stage === "won") return true // won deals passed every stage
    const idx = order.indexOf(p.stage)
    return idx >= 0 && idx >= order.indexOf(st)
  }
  const rows = order.map((st) => ({ st, n: cohort.filter((p) => reached(p, st)).length }))
  const top = Math.max(1, rows[0].n)
  const worst = rows.slice(1).reduce((a, r, i) => {
    const prev = rows[i].n || 1
    const drop = 1 - r.n / prev
    return drop > a.drop ? { st: r.st, drop } : a
  }, { st: rows[1].st, drop: -1 })

  return (
    <ChartCard
      label="Stage conversion"
      title={
        cohort.length < 5
          ? `Only ${cohort.length} deal${cohort.length === 1 ? "" : "s"} in this period, too few for a reliable read yet.`
          : `The biggest drop is into ${stageLabel(worst.st)}, where ${Math.round(Math.max(0, worst.drop) * 100)}% fall away.`
      }
      table={<DataTable head={["Stage", "Deals reaching it", "Of all"]} rows={rows.map((r) => [stageLabel(r.st), r.n, `${Math.round((r.n / top) * 100)}%`])} />}
    >
      <ul className="flex flex-col gap-2.5">
        {rows.map((r, i) => (
          <li key={r.st}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div tabIndex={0} className="grid grid-cols-[7.5rem_1fr_3.5rem] items-center gap-3 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <span className="truncate text-xs text-muted-foreground">{stageLabel(r.st)}</span>
                  <span className="h-3 bg-muted">
                    <motion.span className="block h-full origin-left bg-primary" initial={{ scaleX: 0 }} animate={{ scaleX: r.n / top }} transition={{ ...spring.smooth, delay: i * stagger.tight }} />
                  </span>
                  <span className="text-right font-mono text-[11px] tabular-nums text-muted-foreground">{Math.round((r.n / top) * 100)}%</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>{r.n} of {top} deals reached {stageLabel(r.st)}</TooltipContent>
            </Tooltip>
          </li>
        ))}
      </ul>
    </ChartCard>
  )
}

/* ---------------- time in stage ---------------- */

function TimeInStage({ state }: { state: CRMState }) {
  const totals = new Map<StageId, { sum: number; n: number }>()
  for (const p of state.prospects) {
    const h = p.stageHistory ?? []
    h.forEach((ev, i) => {
      if (ev.stage === "won" || ev.stage === "lost") return
      const end = h[i + 1]?.at ?? (isOpen(p) && p.stage === ev.stage ? new Date().toISOString() : null)
      if (!end) return
      const t = totals.get(ev.stage) ?? { sum: 0, n: 0 }
      t.sum += days(ev.at, end)
      t.n += 1
      totals.set(ev.stage, t)
    })
  }
  const rows = OPEN_STAGES.map((st) => {
    const t = totals.get(st)
    return { st, avg: t && t.n ? t.sum / t.n : 0, n: t?.n ?? 0 }
  })
  const max = Math.max(1, ...rows.map((r) => r.avg))
  const slow = [...rows].sort((a, b) => b.avg - a.avg)[0]

  return (
    <ChartCard
      label="Average days in stage"
      title={slow.avg < 1 ? "Too early to measure. Deals need a few days of history first." : `Deals sit longest in ${stageLabel(slow.st)}, about ${Math.round(slow.avg)} days.`}
      table={<DataTable head={["Stage", "Average days", "Deals measured"]} rows={rows.map((r) => [stageLabel(r.st), Math.round(r.avg), r.n])} />}
    >
      <ul className="flex flex-col gap-2.5">
        {rows.map((r, i) => (
          <li key={r.st}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div tabIndex={0} className="grid grid-cols-[7.5rem_1fr_3.5rem] items-center gap-3 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <span className="truncate text-xs text-muted-foreground">{stageLabel(r.st)}</span>
                  <span className="h-3 bg-muted">
                    <motion.span className={cn("block h-full origin-left", r.st === slow.st ? "bg-primary" : "bg-primary/45")} initial={{ scaleX: 0 }} animate={{ scaleX: r.avg / max }} transition={{ ...spring.smooth, delay: i * stagger.tight }} />
                  </span>
                  <span className="text-right font-mono text-[11px] tabular-nums text-muted-foreground">{Math.round(r.avg)}d</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>Averaged over {r.n} deal{r.n === 1 ? "" : "s"}</TooltipContent>
            </Tooltip>
          </li>
        ))}
      </ul>
    </ChartCard>
  )
}

/* ---------------- tables ---------------- */

function pct(v: number | null) {
  return v === null ? "–" : `${Math.round(v * 100)}%`
}

function ByOwner({ state, since }: { state: CRMState; since: number }) {
  const ids = [...new Set([...OWNERS.map((o) => o.id), ...state.prospects.map((p) => p.owner)])]
  const rows = ids
    .map((id) => {
      const mine = state.prospects.filter((p) => p.owner === id)
      const st = stats(mine, since)
      return { id, open: mine.filter(isOpen).length, pipeline: mine.filter(isOpen).reduce((s, p) => s + p.value, 0), ...st }
    })
    .filter((r) => r.open || r.won.length || r.lost.length)
    .sort((a, b) => b.pipeline - a.pipeline)
  return (
    <Card className="gap-0 py-0">
      <div className="border-b px-5 py-4"><SectionLabel>By owner</SectionLabel></div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[440px] text-left text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr className="border-b">{["Owner", "Open", "Pipeline", "Won", "Win rate"].map((h, i) => <th key={h} className={cn("px-5 py-2 font-normal", i > 0 && "text-right")}>{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-5 py-2.5"><span className="flex items-center gap-2"><OwnerAvatar id={r.id} className="size-5" />{owner(r.id).name}</span></td>
                <td className="px-5 py-2.5 text-right font-mono tabular-nums">{r.open}</td>
                <td className="px-5 py-2.5 text-right font-mono tabular-nums">{compactMoney(r.pipeline)}</td>
                <td className="px-5 py-2.5 text-right font-mono tabular-nums">{compactMoney(r.wonValue)}</td>
                <td className="px-5 py-2.5 text-right font-mono tabular-nums">{pct(r.winRate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function BySource({ state, since }: { state: CRMState; since: number }) {
  const rows = SOURCES.map((src) => {
    const list = state.prospects.filter((p) => p.source === src)
    const st = stats(list, since)
    return { src, deals: list.length, ...st }
  })
    .filter((r) => r.deals)
    .sort((a, b) => b.wonValue - a.wonValue)
  return (
    <Card className="gap-0 py-0">
      <div className="border-b px-5 py-4"><SectionLabel>By source</SectionLabel></div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[400px] text-left text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr className="border-b">{["Source", "Deals", "Won", "Win rate"].map((h, i) => <th key={h} className={cn("px-5 py-2 font-normal", i > 0 && "text-right")}>{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r) => (
              <tr key={r.src}>
                <td className="px-5 py-2.5">{r.src}</td>
                <td className="px-5 py-2.5 text-right font-mono tabular-nums">{r.deals}</td>
                <td className="px-5 py-2.5 text-right font-mono tabular-nums">{compactMoney(r.wonValue)}</td>
                <td className="px-5 py-2.5 text-right font-mono tabular-nums">{pct(r.winRate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

