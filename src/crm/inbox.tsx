import * as React from "react"
import { AlarmClock, BellDot, CalendarCheck, CheckCheck, Plus, Sparkles, Zap, Info } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { spring } from "@/lib/motion"

import { CompanyMark, OwnerAvatar, PageHeader, SourceChip } from "./bits"
import { OWNERS, at, daysFromToday, timeAgo, type Notice, type OwnerId, type Task } from "./data"
import { ME, useStore } from "./store"
import { FeatureEmpty } from "./empty-states"

/** SLA-style label: how long until (or since) a task is due. */
export function slaLabel(due: string) {
  const ms = new Date(due).getTime() - Date.now()
  const abs = Math.abs(ms)
  const h = Math.floor(abs / 3_600_000)
  const d = Math.floor(h / 24)
  const text = d >= 1 ? `${d}d` : h >= 1 ? `${h}h` : `${Math.max(1, Math.round(abs / 60_000))}m`
  if (ms < 0) return { text: `${text} late`, tone: "late" as const }
  if (ms < 4 * 3_600_000) return { text: `${text} left`, tone: "soon" as const }
  return { text: daysFromToday(due) === 0 ? `${text} left` : `In ${daysFromToday(due)}d`, tone: "ok" as const }
}

type Group = { key: string; label: string; tasks: Task[] }

function group(tasks: Task[]): Group[] {
  const g: Record<string, Task[]> = { overdue: [], today: [], week: [], later: [] }
  for (const t of tasks) {
    const d = daysFromToday(t.due)
    const late = new Date(t.due).getTime() < Date.now()
    if (late && d < 0) g.overdue.push(t)
    else if (d <= 0) g.today.push(t)
    else if (d <= 7) g.week.push(t)
    else g.later.push(t)
  }
  const sort = (a: Task, b: Task) => (a.priority === b.priority ? a.due.localeCompare(b.due) : a.priority === "high" ? -1 : 1)
  return [
    { key: "overdue", label: "Overdue", tasks: g.overdue.sort(sort) },
    { key: "today", label: "Today", tasks: g.today.sort(sort) },
    { key: "week", label: "Next 7 days", tasks: g.week.sort(sort) },
    { key: "later", label: "Later", tasks: g.later.sort(sort) },
  ].filter((x) => x.tasks.length)
}

export function InboxView({ onOpen, onImport, onAdd }: { onOpen: (id: string) => void; onImport: () => void; onAdd: () => void }) {
  const { state, markRead, addTask } = useStore()
  const [who, setWho] = React.useState<OwnerId | "all">(ME)
  const [quick, setQuick] = React.useState("")
  const unread = state.notices.filter((n) => !n.read).length
  const open = state.tasks.filter((t) => !t.done && (who === "all" || t.owner === who))
  const groups = group(open)
  const doneToday = state.tasks.filter((t) => t.done && t.doneAt && daysFromToday(t.doneAt) === 0)

  if (!state.tasks.length && !state.notices.length && !state.prospects.length) return <FeatureEmpty feature="inbox" onImport={onImport} onAdd={onAdd} />

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 md:px-8">
      <PageHeader eyebrow="Inbox" title="Work that needs a person">
        <Select value={who} onValueChange={(v) => setWho(v as OwnerId | "all")}>
          <SelectTrigger aria-label="Whose tasks" className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Everyone</SelectItem>
            {OWNERS.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.id === ME ? "My tasks" : o.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </PageHeader>

      <Tabs defaultValue="tasks" variant="underline">
        <TabsList>
          <TabsTrigger value="tasks" className="gap-1.5">
            Tasks <span className="font-mono text-[11px] text-muted-foreground">{open.length}</span>
          </TabsTrigger>
          <TabsTrigger value="updates" className="gap-1.5">
            Updates
            {unread ? <span className="grid min-w-4 place-items-center rounded-full bg-primary px-1 font-mono text-[10px] text-primary-foreground">{unread}</span> : null}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tasks" className="flex flex-col gap-6 pt-5">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (!quick.trim()) return
              addTask({ prospectId: null, title: quick.trim(), due: at(0, 17), owner: who === "all" ? ME : who, priority: "normal", source: { kind: "manual" } })
              toast.success("Task added for today")
              setQuick("")
            }}
            className="flex items-center gap-2"
          >
            <Input id="quick-task" aria-label="Quick task" placeholder="Add a task for today and press Enter" value={quick} onChange={(e) => setQuick(e.target.value)} />
            <Button type="submit" variant="outline" disabled={!quick.trim()}>
              <Plus /> Add
            </Button>
          </form>

          {groups.length === 0 ? (
            <Card className="items-center gap-2 py-14 text-center">
              <CheckCheck className="size-6 text-success" />
              <h2 className="font-display text-2xl font-light">Inbox zero.</h2>
              <p className="text-sm text-muted-foreground">Your rules will drop new work here when it is needed.</p>
            </Card>
          ) : (
            groups.map((g) => (
              <section key={g.key} className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className={cn("eyebrow", g.key === "overdue" ? "text-destructive" : "text-muted-foreground")}>{g.label}</span>
                  <span className="font-mono text-[11px] tabular-nums text-muted-foreground">{g.tasks.length}</span>
                </div>
                <Card className="gap-0 py-0">
                  <ul className="divide-y">
                    <AnimatePresence initial={false}>
                      {g.tasks.map((t) => (
                        <TaskRow key={t.id} task={t} onOpen={onOpen} />
                      ))}
                    </AnimatePresence>
                  </ul>
                </Card>
              </section>
            ))
          )}

          {doneToday.length ? (
            <p className="font-mono text-[11px] text-muted-foreground">{doneToday.length} done today</p>
          ) : null}
        </TabsContent>

        <TabsContent value="updates" className="pt-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="font-mono text-[11px] text-muted-foreground">{state.notices.length} updates</span>
            <Button variant="ghost" size="sm" disabled={!unread} onClick={() => markRead()}>
              <CheckCheck /> Mark all read
            </Button>
          </div>
          <Card className="gap-0 py-0">
            <ol className="divide-y">
              <AnimatePresence initial={false}>
                {state.notices.slice(0, 50).map((n) => (
                  <NoticeRow key={n.id} notice={n} onOpen={onOpen} />
                ))}
              </AnimatePresence>
            </ol>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export function TaskRow({ task: t, onOpen, compact }: { task: Task; onOpen: (id: string) => void; compact?: boolean }) {
  const { state, setTaskDone, snoozeTask } = useStore()
  const p = t.prospectId ? state.prospects.find((x) => x.id === t.prospectId) : undefined
  const sla = slaLabel(t.due)
  const [leaving, setLeaving] = React.useState(false)

  const complete = () => {
    setLeaving(true)
    window.setTimeout(() => {
      setTaskDone(t.id, true)
      toast.success("Done", {
        description: t.title,
        action: { label: "Undo", onClick: () => setTaskDone(t.id, false) },
      })
    }, 260)
  }

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: leaving ? 0.45 : 1, y: 0 }}
      exit={{ opacity: 0, height: 0, transition: { duration: 0.2 } }}
      transition={spring.smooth}
      className={cn("group flex items-center gap-3 overflow-hidden px-4 py-3 md:px-5", compact && "px-4 py-2.5 md:px-5")}
    >
      <Checkbox checked={leaving} onCheckedChange={(v) => v === true && complete()} aria-label={`Complete ${t.title}`} />
      {p && !compact ? <CompanyMark name={p.company} className="hidden sm:inline-flex" /> : null}
      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-sm transition-colors", leaving && "text-muted-foreground line-through")}>
          {t.priority === "high" ? <span className="mr-1.5 inline-block size-1.5 -translate-y-0.5 bg-destructive" aria-label="High priority" /> : null}
          {t.title}
        </p>
        <div className="mt-0.5 flex min-w-0 items-center gap-2">
          {p ? (
            <button type="button" onClick={() => onOpen(p.id)} className="shrink-0 truncate text-xs text-muted-foreground hover:text-brand focus-visible:text-brand focus-visible:outline-none">
              {p.company}
            </button>
          ) : null}
          {!compact ? <SourceChip source={t.source} /> : null}
        </div>
      </div>
      <span
        className={cn(
          "shrink-0 font-mono text-[11px] tabular-nums",
          sla.tone === "late" ? "text-destructive" : sla.tone === "soon" ? "text-warning" : "text-muted-foreground"
        )}
      >
        {sla.text}
      </span>
      {!compact ? <OwnerAvatar id={t.owner} className="hidden sm:inline-flex" /> : null}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-xs" aria-label={`Snooze ${t.title}`} className="text-muted-foreground">
            <AlarmClock />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {[
            [1, "Tomorrow"],
            [3, "In 3 days"],
            [7, "Next week"],
          ].map(([d, label]) => (
            <DropdownMenuItem
              key={d}
              onSelect={() => {
                snoozeTask(t.id, d as number)
                toast(`Snoozed to ${String(label).toLowerCase()}`)
              }}
            >
              {label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </motion.li>
  )
}

const NOTICE_ICON = { automation: Zap, ai: Sparkles, system: Info, meeting: CalendarCheck } as const

function NoticeRow({ notice: n, onOpen }: { notice: Notice; onOpen: (id: string) => void }) {
  const { markRead } = useStore()
  const Icon = NOTICE_ICON[n.kind] ?? BellDot
  return (
    <motion.li layout initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} transition={spring.smooth}>
      <button
        type="button"
        onClick={() => {
          markRead(n.id)
          if (n.prospectId) onOpen(n.prospectId)
        }}
        className="flex w-full items-start gap-3 px-5 py-3 text-left transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
      >
        <span className={cn("mt-0.5 grid size-6 shrink-0 place-items-center rounded-md border bg-surface", n.kind === "automation" ? "text-brand" : "text-muted-foreground")}>
          <Icon aria-hidden className="size-3.5" />
        </span>
        <span className={cn("min-w-0 flex-1 text-sm", n.read ? "text-muted-foreground" : "text-foreground")}>{n.text}</span>
        <span className="flex shrink-0 items-center gap-2">
          <span className="font-mono text-[11px] text-muted-foreground">{timeAgo(n.at)}</span>
          <AnimatePresence>
            {!n.read ? (
              <motion.span
                key="dot"
                aria-label="Unread"
                className="size-1.5 rounded-full bg-primary"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                transition={spring.pop}
              />
            ) : null}
          </AnimatePresence>
        </span>
      </button>
    </motion.li>
  )
}
