import * as React from "react"
import { MoreHorizontal } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { spring } from "@/lib/motion"

import { OwnerAvatar, ScoreBadge } from "./bits"
import {
  STAGES,
  compactMoney,
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

export function PipelineView({ onOpen, onImport, onAdd }: { onOpen: (id: string) => void; onImport: () => void; onAdd: () => void }) {
  const { state, moveStage } = useStore()
  const prospects = state.prospects
  const [dragging, setDragging] = React.useState<string | null>(null)
  const [over, setOver] = React.useState<StageId | null>(null)

  const move = (id: string, stage: StageId) => {
    const p = prospects.find((x) => x.id === id)
    if (!p || p.stage === stage) return
    moveStage(id, stage)
    toast(`${p.company} moved to ${stageLabel(stage)}`, {
      action: { label: "Undo", onClick: () => moveStage(id, p.stage) },
    })
  }

  if (!prospects.length) return <FeatureEmpty feature="pipeline" onImport={onImport} onAdd={onAdd} />

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-end justify-between gap-3 px-4 pt-8 pb-5 md:px-8">
        <div className="flex flex-col gap-2">
          <p className="eyebrow text-muted-foreground">Pipeline</p>
          <h1 className="font-display text-3xl font-light tracking-[-0.02em] md:text-4xl">
            Every deal, by stage
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Drag a card to move it, or use its menu.
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-x-auto border-t bg-dots">
        <div className="flex h-full min-h-[560px] gap-3 p-4 md:px-8">
          {STAGES.map((stage) => {
            const list = prospects.filter((p) => p.stage === stage.id)
            const total = list.reduce((s, p) => s + p.value, 0)
            const isOver = over === stage.id && dragging !== null
            return (
              <section
                key={stage.id}
                aria-label={stage.label}
                onDragOver={(e) => {
                  e.preventDefault()
                  e.dataTransfer.dropEffect = "move"
                  if (over !== stage.id) setOver(stage.id)
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(null)
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  const id = e.dataTransfer.getData("text/plain")
                  if (id) move(id, stage.id)
                  setOver(null)
                  setDragging(null)
                }}
                className={cn(
                  "flex w-72 shrink-0 flex-col rounded-lg border bg-surface transition-colors",
                  isOver && "border-brand bg-brand/5"
                )}
              >
                <header className="flex items-center justify-between gap-2 border-b px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{stage.label}</span>
                    <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                      {list.length}
                    </span>
                  </div>
                  <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                    {compactMoney(total)}
                  </span>
                </header>
                <div className="flex flex-1 flex-col gap-2 p-2">
                  <AnimatePresence initial={false}>
                    {list.map((p) => (
                      <DealCard
                        key={p.id}
                        prospect={p}
                        dragging={dragging === p.id}
                        onOpen={() => onOpen(p.id)}
                        onMove={(s) => move(p.id, s)}
                        onDragStart={() => setDragging(p.id)}
                        onDragEnd={() => {
                          setDragging(null)
                          setOver(null)
                        }}
                      />
                    ))}
                  </AnimatePresence>
                  {list.length === 0 ? (
                    <p className="grid flex-1 place-items-center rounded-md border border-dashed px-3 py-8 text-center text-xs text-muted-foreground">
                      Drop a deal here
                    </p>
                  ) : null}
                </div>
              </section>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function DealCard({
  prospect: p,
  dragging,
  onOpen,
  onMove,
  onDragStart,
  onDragEnd,
}: {
  prospect: Prospect
  dragging: boolean
  onOpen: () => void
  onMove: (s: StageId) => void
  onDragStart: () => void
  onDragEnd: () => void
}) {
  const cold = isCold(p)
  const due = isDue(p)
  return (
    <motion.div
      layout
      layoutId={`deal-${p.id}`}
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: dragging ? 0.4 : 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={spring.smooth}
    >
      <div
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData("text/plain", p.id)
          e.dataTransfer.effectAllowed = "move"
          onDragStart()
        }}
        onDragEnd={onDragEnd}
        className="group relative flex cursor-grab flex-col gap-3 rounded-md border bg-card p-3 transition-colors hover:border-input active:cursor-grabbing"
      >
        <div className="flex items-start justify-between gap-2">
          <button
            type="button"
            onClick={onOpen}
            className="min-w-0 text-left outline-none after:absolute after:inset-0 after:rounded-md focus-visible:after:ring-2 focus-visible:after:ring-ring"
          >
            <span className="block truncate text-sm font-medium">{p.company}</span>
            <span className="block truncate text-xs text-muted-foreground">
              {p.contact}, {p.role}
            </span>
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={`Actions for ${p.company}`}
                className="relative z-10 -mt-1 -mr-1 text-muted-foreground"
              >
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onSelect={onOpen}>Open details</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="eyebrow text-muted-foreground">
                Move to
              </DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={p.stage}
                onValueChange={(v) => onMove(v as StageId)}
              >
                {STAGES.map((s) => (
                  <DropdownMenuRadioItem key={s.id} value={s.id}>
                    {s.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center justify-between">
          <span className="font-mono text-sm tabular-nums">{money(p.value)}</span>
          <ScoreBadge score={leadScore(p)} />
        </div>

        <div className="flex items-center justify-between gap-2 border-t pt-2.5">
          <span
            className={cn(
              "truncate font-mono text-[11px]",
              due && daysFromToday(p.nextDue!) < 0
                ? "text-destructive"
                : cold
                  ? "text-warning"
                  : "text-muted-foreground"
            )}
          >
            {due
              ? `Due ${relative(p.nextDue!).toLowerCase()}`
              : cold
                ? `Cold · ${-daysFromToday(p.lastTouch)}d`
                : `Touched ${relative(p.lastTouch).toLowerCase()}`}
          </span>
          <OwnerAvatar id={p.owner} className="size-5" />
        </div>
      </div>
    </motion.div>
  )
}
