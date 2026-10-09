import * as React from "react"
import { Search, Trash2, X } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { toast } from "sonner"

import { Table, type TableColumn } from "@/components/motion/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { spring } from "@/lib/motion"

import { CompanyMark, FitScore, ScoreBadge, StageBadge } from "./bits"
import {
  INDUSTRIES,
  OPEN_STAGES,
  OWNERS,
  STAGES,
  daysFromToday,
  isCold,
  isDue,
  leadScore,
  money,
  relative,
  stageLabel,
  type Prospect,
  type StageId,
} from "./data"
import { useStore } from "./store"
import { FeatureEmpty } from "./empty-states"

export type ProspectFilter = "all" | "open" | "due" | "hot" | "cold" | "won"

const isOpenStage = (p: Prospect) => OPEN_STAGES.includes(p.stage)

const FILTERS: { id: ProspectFilter; label: string; test: (p: Prospect) => boolean }[] = [
  { id: "all", label: "All", test: () => true },
  { id: "open", label: "Open", test: (p) => OPEN_STAGES.includes(p.stage) },
  { id: "due", label: "Follow-up due", test: isDue },
  { id: "hot", label: "Hot", test: (p) => isOpenStage(p) && leadScore(p) >= 75 },
  { id: "cold", label: "Going cold", test: isCold },
  { id: "won", label: "Won", test: (p) => p.stage === "won" },
]

export function ProspectsView({
  onOpen,
  filter,
  onFilterChange,
  onImport,
  onAdd,
}: {
  onOpen: (id: string) => void
  filter: ProspectFilter
  onFilterChange: (f: ProspectFilter) => void
  onImport: () => void
  onAdd: () => void
}) {
  const { state, moveStage, remove } = useStore()
  const prospects = state.prospects
  const [query, setQuery] = React.useState("")
  const [ownerId, setOwnerId] = React.useState("any")
  const [industry, setIndustry] = React.useState("any")
  const [selected, setSelected] = React.useState<string[]>([])

  const rows = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    const test = FILTERS.find((f) => f.id === filter)!.test
    return prospects.filter(
      (p) =>
        test(p) &&
        (ownerId === "any" || p.owner === ownerId) &&
        (industry === "any" || p.industry === industry) &&
        (!q ||
          [p.company, p.contact, p.email, p.city, p.industry]
            .join(" ")
            .toLowerCase()
            .includes(q))
    )
  }, [prospects, filter, ownerId, industry, query])

  const counts = React.useMemo(
    () =>
      Object.fromEntries(
        FILTERS.map((f) => [f.id, prospects.filter(f.test).length])
      ) as Record<ProspectFilter, number>,
    [prospects]
  )

  const columns = React.useMemo<TableColumn<Prospect>[]>(
    () => [
      {
        key: "company",
        header: "Company",
        sortable: true,
        width: "1.6fr",
        cell: (p) => (
          <button
            type="button"
            onClick={() => onOpen(p.id)}
            className="flex min-w-0 items-center gap-2.5 rounded-md text-left outline-none hover:text-brand focus-visible:ring-2 focus-visible:ring-ring"
          >
            <CompanyMark name={p.company} className="size-7" />
            <span className="min-w-0">
              <span className="block truncate font-medium">{p.company}</span>
              <span className="block truncate font-mono text-[11px] text-muted-foreground">
                {p.industry} · {p.city}
              </span>
            </span>
          </button>
        ),
      },
      {
        key: "contact",
        header: "Contact",
        sortable: true,
        width: "1.3fr",
        cell: (p) => (
          <span className="min-w-0">
            <span className="block truncate">{p.contact}</span>
            <span className="block truncate text-xs text-muted-foreground">{p.role}</span>
          </span>
        ),
      },
      {
        key: "stage",
        header: "Stage",
        sortable: true,
        width: "140px",
        sortValue: (p) => STAGES.findIndex((s) => s.id === p.stage),
        cell: (p) => <StageBadge stage={p.stage} />,
      },
      {
        key: "score",
        header: "Score",
        sortable: true,
        width: "80px",
        sortValue: (p) => leadScore(p),
        cell: (p) => <ScoreBadge score={leadScore(p)} />,
      },
      {
        key: "fit",
        header: "Fit",
        sortable: true,
        width: "90px",
        cell: (p) => <FitScore value={p.fit} />,
      },
      {
        key: "value",
        header: "Value",
        sortable: true,
        align: "right",
        width: "110px",
        cell: (p) => <span className="font-mono tabular-nums">{money(p.value)}</span>,
      },
      {
        key: "lastTouch",
        header: "Last touch",
        sortable: true,
        width: "110px",
        cell: (p) => (
          <span
            className={cn(
              "font-mono text-xs",
              isCold(p) ? "text-warning" : "text-muted-foreground"
            )}
          >
            {relative(p.lastTouch)}
          </span>
        ),
      },
      {
        key: "nextStep",
        header: "Next step",
        width: "1.6fr",
        cell: (p) => (
          <span className="min-w-0">
            <span className="block truncate">{p.nextStep}</span>
            {p.nextDue ? (
              <span
                className={cn(
                  "block font-mono text-[11px]",
                  daysFromToday(p.nextDue) < 0 ? "text-destructive" : "text-muted-foreground"
                )}
              >
                {relative(p.nextDue)}
              </span>
            ) : null}
          </span>
        ),
      },
    ],
    [onOpen]
  )

  const bulkMove = (stage: StageId) => {
    selected.forEach((id) => moveStage(id, stage))
    toast.success(`${selected.length} moved to ${stageLabel(stage)}`)
    setSelected([])
  }

  const bulkDelete = () => {
    const n = selected.length
    remove(selected)
    setSelected([])
    toast(`${n} prospect${n === 1 ? "" : "s"} removed`)
  }

  if (!prospects.length) return <FeatureEmpty feature="prospects" onImport={onImport} onAdd={onAdd} />

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 md:px-8">
      <div className="flex flex-col gap-2">
        <p className="eyebrow text-muted-foreground">Prospects</p>
        <h1 className="font-display text-3xl font-light tracking-[-0.02em] md:text-4xl">
          Everyone you are courting
        </h1>
      </div>

      <Tabs
        value={filter}
        onValueChange={(v) => {
          onFilterChange(v as ProspectFilter)
          setSelected([])
        }}
        variant="underline"
      >
        <TabsList className="max-w-full overflow-x-auto scrollbar-hide">
          {FILTERS.map((f) => (
            <TabsTrigger key={f.id} value={f.id} className="gap-1.5">
              {f.label}
              <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                {counts[f.id]}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            aria-label="Search prospects"
            placeholder="Search company, contact, city"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={ownerId} onValueChange={setOwnerId}>
          <SelectTrigger aria-label="Owner" className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any owner</SelectItem>
            {OWNERS.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={industry} onValueChange={setIndustry}>
          <SelectTrigger aria-label="Industry" className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any industry</SelectItem>
            {INDUSTRIES.map((i) => (
              <SelectItem key={i} value={i}>
                {i}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(query || ownerId !== "any" || industry !== "any") && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setQuery("")
              setOwnerId("any")
              setIndustry("any")
            }}
          >
            <X /> Clear
          </Button>
        )}
        <span className="ml-auto font-mono text-[11px] text-muted-foreground">
          {rows.length} of {prospects.length}
        </span>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[1000px]">
          <Table
            data={rows}
            columns={columns}
            getRowId={(p) => p.id}
            selectable
            resizable
            selectedRowIds={selected}
            onSelectionChange={setSelected}
            defaultSort={{ key: "score", direction: "desc" }}
            rowHeight={56}
            height={Math.min(620, Math.max(240, rows.length * 56 + 44))}
            emptyState={
              <div className="flex flex-col items-center gap-2 py-12 text-sm text-muted-foreground">
                {filter === "hot" ? "No hot leads right now. Scores rise with fit, stage, recent contact and engagement." : filter === "cold" ? "Nothing is going cold. Every open deal has had contact in the last 14 days." : filter === "due" ? "No follow-ups are due. You are on top of it." : filter === "won" ? "No won deals yet. They will collect here." : "No prospects match these filters."}
              </div>
            }
          />
        </div>
      </div>

      {/* Bulk bar */}
      <AnimatePresence>
        {selected.length > 0 ? (
          <motion.div
            role="toolbar"
            aria-label="Bulk actions"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={spring.smooth}
            className="dark fixed inset-x-4 bottom-6 z-40 mx-auto flex max-w-xl flex-wrap items-center gap-2 rounded-lg border bg-popover p-2 pl-4 text-foreground shadow-md"
          >
            <span className="font-mono text-xs tabular-nums">{selected.length} selected</span>
            <div className="ml-auto flex items-center gap-2">
              <Select onValueChange={(v) => bulkMove(v as StageId)}>
                <SelectTrigger aria-label="Move selected to stage" className="h-8 w-40">
                  <SelectValue placeholder="Move to stage" />
                </SelectTrigger>
                <SelectContent>
                  {STAGES.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="ghost" size="sm" onClick={bulkDelete}>
                <Trash2 /> Remove
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Clear selection"
                onClick={() => setSelected([])}
              >
                <X />
              </Button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
