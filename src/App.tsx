import * as React from "react"
import {
  BarChart3,
  BellDot,
  Building2,
  Download,
  Upload,
  Columns3,
  Flame,
  Inbox,
  ListOrdered,
  Moon,
  PanelLeft,
  Plus,
  RotateCcw,
  Search,
  Snowflake,
  Sparkles,
  Sun,
  Sunrise,
  Users,
  Workflow,
  Zap,
} from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { toast } from "sonner"

import {
  AnimatedSidebar,
  AnimatedSidebarContent,
  AnimatedSidebarFooter,
  AnimatedSidebarGroup,
  AnimatedSidebarGroupContent,
  AnimatedSidebarGroupLabel,
  AnimatedSidebarHeader,
  AnimatedSidebarInset,
  AnimatedSidebarMenu,
  AnimatedSidebarMenuButton,
  AnimatedSidebarMenuItem,
  AnimatedSidebarProvider,
  AnimatedSidebarRail,
  AnimatedSidebarTrigger,
} from "@/components/motion/animated-sidebar"
import { CommandPalette, type CommandItem } from "@/components/motion/command-palette"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Kbd, KbdGroup } from "@/components/ui/kbd"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { ease, duration, spring } from "@/lib/motion"

import { AddProspectDialog } from "@/crm/add-prospect"
import { useAI } from "@/crm/ai"
import { AssistantDock, AssistantPanel } from "@/crm/assistant"
import { AutomationsView } from "@/crm/automations"
import { isCold, isOpen, leadScore, stageLabel } from "@/crm/data"
import { InboxView } from "@/crm/inbox"
import { PipelineView } from "@/crm/pipeline"
import { ProspectDrawer } from "@/crm/prospect-drawer"
import { ProspectsView, type ProspectFilter } from "@/crm/prospects"
import { SequencesView } from "@/crm/sequences"
import { ME, useStore } from "@/crm/store"
import { TodayView } from "@/crm/today"
import { CompaniesView, CompanyDrawer } from "@/crm/companies"
import { ImportDialog, exportDeals, useDownloads } from "@/crm/import-export"
import { ReportsView } from "@/crm/reports"
import { WorkspaceBanner, WorkspaceGate, WorkspaceSwitcher } from "@/crm/workspace"
import { FeatureEmpty, type FeatureKey } from "@/crm/empty-states"

type View = "today" | "inbox" | "pipeline" | "prospects" | "companies" | "reports" | "automations" | "sequences"

const VIEW_LABEL: Record<View, string> = {
  today: "Today",
  inbox: "Inbox",
  pipeline: "Pipeline",
  prospects: "Prospects",
  companies: "Companies",
  reports: "Reports",
  automations: "Automations",
  sequences: "Sequences",
}

function useTheme() {
  const [theme, setTheme] = React.useState<"light" | "dark">(() => {
    try {
      const saved = window.localStorage.getItem("prospect-crm:theme")
      if (saved === "light" || saved === "dark") return saved
    } catch {
      /* ignore */
    }
    const host = document.documentElement.getAttribute("data-theme")
    if (host === "light" || host === "dark") return host
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light"
  })
  React.useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark")
    try {
      window.localStorage.setItem("prospect-crm:theme", theme)
    } catch {
      /* ignore */
    }
  }, [theme])
  return [theme, () => setTheme((t) => (t === "dark" ? "light" : "dark"))] as const
}

/** Shows a toast whenever an automation runs, so the engine's work is visible. */
function useAutomationFeedback() {
  const { state, mode } = useStore()
  const seen = React.useRef<Set<string> | null>(null)
  const lastMode = React.useRef(mode)
  const [pulse, setPulse] = React.useState(0)
  React.useEffect(() => {
    // Opening a workspace or switching modes loads history; only runs that
    // just happened (here or by a teammate) should announce themselves.
    if (!seen.current || lastMode.current !== mode) {
      seen.current = new Set(state.runs.map((r) => r.id))
      lastMode.current = mode
      return
    }
    const fresh = state.runs.filter((r) => !seen.current!.has(r.id))
    fresh.forEach((r) => seen.current!.add(r.id))
    const recent = fresh.filter((r) => Date.now() - new Date(r.at).getTime() < 20_000)
    if (!recent.length) return
    setPulse((n) => n + 1)
    if (recent.length === 1) {
      const r = recent[0]
      toast(r.automationName, {
        description: `${r.company}: ${r.steps.join(", ")}`,
        icon: <Zap className="size-4 text-brand" />,
      })
    } else {
      toast(`${recent.length} automations ran`, {
        description: recent.slice(0, 4).map((r) => `${r.automationName} on ${r.company}`).join(". "),
        icon: <Zap className="size-4 text-brand" />,
      })
    }
  }, [state.runs, mode])
  return pulse
}

export default function App() {
  const { state, reset, mode, workspace } = useStore()
  const dl = useDownloads()
  const [importing, setImporting] = React.useState(false)
  const [companyId, setCompanyId] = React.useState<string | null>(null)
  const [presetCompany, setPresetCompany] = React.useState<string | null>(null)
  const gated = mode === "workspace" && (workspace === "loading" || workspace === "setup")
  const newDeal = (cid?: string) => {
    setPresetCompany(cid ?? null)
    setAdding(true)
  }
  const ai = useAI()
  const [view, setView] = React.useState<View>("today")
  const [filter, setFilter] = React.useState<ProspectFilter>("all")
  const [openId, setOpenId] = React.useState<string | null>(null)
  const [adding, setAdding] = React.useState(false)
  const [palette, setPalette] = React.useState(false)
  const [assistant, setAssistant] = React.useState(false)
  const [theme, toggleTheme] = useTheme()
  const pulse = useAutomationFeedback()

  const today = new Date().setHours(23, 59, 59, 999)
  const myDue = state.tasks.filter((t) => !t.done && t.owner === ME && new Date(t.due).getTime() <= today).length
  const unread = state.notices.filter((n) => !n.read).length
  const coldCount = state.prospects.filter(isCold).length
  const hotCount = state.prospects.filter((p) => isOpen(p) && leadScore(p) >= 75).length
  const activeRules = state.automations.filter((a) => a.enabled).length

  const go = (v: View) => {
    setView(v)
    if (v !== "prospects") setFilter("all")
  }
  const goFilter = (f: ProspectFilter) => {
    setFilter(f)
    setView("prospects")
  }

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      const typing = t.closest("input, textarea, select, [contenteditable], [role=dialog]")
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault()
        setAssistant((v) => !v)
        return
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key.toLowerCase() === "n") {
        e.preventDefault()
        setAdding(true)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const commands: CommandItem[] = [
    { id: "new", label: "New prospect", group: "Actions", icon: Plus, hint: "N", onSelect: () => setAdding(true) },
    { id: "import", label: "Import a spreadsheet", group: "Actions", icon: Upload, onSelect: () => setImporting(true) },
    ...(dl ? [{ id: "export", label: "Export pipeline as CSV", group: "Actions", icon: Download, onSelect: () => exportDeals(dl, state) } as CommandItem] : []),
    { id: "ask", label: "Ask the assistant", group: "Actions", icon: Sparkles, hint: "⌘J", onSelect: () => setAssistant(true) },
    { id: "theme", label: theme === "dark" ? "Switch to light mode" : "Switch to dark mode", group: "Actions", icon: theme === "dark" ? Sun : Moon, onSelect: toggleTheme },
    ...(mode === "demo" ? [{
      id: "reset",
      label: "Reset sample data",
      group: "Actions",
      icon: RotateCcw,
      onSelect: () => {
        reset()
        setOpenId(null)
        toast("Sample workspace restored")
      },
    } as CommandItem] : []),
    { id: "go-today", label: "Today", group: "Go to", icon: Sunrise, onSelect: () => go("today") },
    { id: "go-inbox", label: "Inbox", group: "Go to", icon: Inbox, onSelect: () => go("inbox") },
    { id: "go-pipeline", label: "Pipeline", group: "Go to", icon: Columns3, onSelect: () => go("pipeline") },
    { id: "go-prospects", label: "All prospects", group: "Go to", icon: Users, onSelect: () => goFilter("all") },
    { id: "go-companies", label: "Companies", group: "Go to", icon: Building2, onSelect: () => go("companies") },
    { id: "go-reports", label: "Reports", group: "Go to", icon: BarChart3, onSelect: () => go("reports") },
    { id: "go-auto", label: "Automations", group: "Go to", icon: Workflow, onSelect: () => go("automations") },
    { id: "go-seq", label: "Sequences", group: "Go to", icon: ListOrdered, onSelect: () => go("sequences") },
    { id: "go-hot", label: "Hot leads", group: "Go to", icon: Flame, onSelect: () => goFilter("hot") },
    { id: "go-cold", label: "Going cold", group: "Go to", icon: Snowflake, onSelect: () => goFilter("cold") },
    ...state.prospects.map<CommandItem>((p) => ({
      id: `p-${p.id}`,
      label: p.company,
      group: "Prospects",
      icon: Building2,
      hint: stageLabel(p.stage),
      keywords: [p.contact, p.city, p.industry, p.email],
      onSelect: () => setOpenId(p.id),
    })),
  ]

  const nav: { id: View; label: string; icon: typeof Users; badge?: React.ReactNode }[] = [
    { id: "today", label: "Today", icon: Sunrise },
    { id: "inbox", label: "Inbox", icon: Inbox, badge: myDue + unread || undefined },
    { id: "pipeline", label: "Pipeline", icon: Columns3 },
    { id: "prospects", label: "Prospects", icon: Users, badge: state.prospects.length },
    { id: "companies", label: "Companies", icon: Building2, badge: state.companies.length || undefined },
    { id: "reports", label: "Reports", icon: BarChart3 },
  ]
  const workflow: typeof nav = [
    { id: "automations", label: "Automations", icon: Workflow, badge: activeRules },
    { id: "sequences", label: "Sequences", icon: ListOrdered, badge: state.prospects.filter((p) => p.enrollment).length || undefined },
  ]
  const saved: { id: ProspectFilter; label: string; icon: typeof Users; count: number }[] = [
    { id: "hot", label: "Hot leads", icon: Flame, count: hotCount },
    { id: "due", label: "Follow-up due", icon: BellDot, count: state.prospects.filter((p) => isOpen(p) && p.nextDue && new Date(p.nextDue).getTime() <= today).length },
    { id: "cold", label: "Going cold", icon: Snowflake, count: coldCount },
  ]

  const badge = (n: React.ReactNode, key?: string) => (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.span key={`${key ?? ""}${String(n)}`} initial={{ y: -6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 6, opacity: 0 }} transition={spring.snappy} className="font-mono text-[10px] tabular-nums text-muted-foreground">
        {n}
      </motion.span>
    </AnimatePresence>
  )

  return (
    <AnimatedSidebarProvider style={{ "--sidebar-width": "15rem" }} className="h-full min-h-0 w-full overflow-hidden bg-background text-foreground">
      <AnimatedSidebar ariaLabel="Main navigation" collapsible="offcanvas" className="min-h-0" panelClassName="h-full border-r bg-surface">
        <AnimatedSidebarHeader className="px-3 pt-3 pb-1">
          <WorkspaceSwitcher />
        </AnimatedSidebarHeader>

        <AnimatedSidebarContent className="gap-4 px-2 py-3">
          <NavGroup label="Workspace">
            {nav.map(({ id, label, icon: Icon, badge: b }) => (
              <AnimatedSidebarMenuItem key={id}>
                <AnimatedSidebarMenuButton
                  icon={<Icon className="size-4" />}
                  isActive={view === id && !(id === "prospects" && filter !== "all")}
                  badge={b !== undefined ? badge(b) : undefined}
                  onSelect={() => (id === "prospects" ? goFilter("all") : go(id))}
                  className="font-normal"
                >
                  {label}
                </AnimatedSidebarMenuButton>
              </AnimatedSidebarMenuItem>
            ))}
          </NavGroup>

          <NavGroup label="Workflows">
            {workflow.map(({ id, label, icon: Icon, badge: b }) => (
              <AnimatedSidebarMenuItem key={id}>
                <AnimatedSidebarMenuButton
                  icon={
                    id === "automations" ? (
                      <span className="relative">
                        <Icon className="size-4" />
                        <AnimatePresence>
                          {pulse ? (
                            <motion.span
                              key={pulse}
                              aria-hidden
                              className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-primary"
                              initial={{ scale: 0, opacity: 1 }}
                              animate={{ scale: [0, 1.6, 1], opacity: [1, 1, 0] }}
                              transition={{ duration: 1.8, ease: ease.out }}
                            />
                          ) : null}
                        </AnimatePresence>
                      </span>
                    ) : (
                      <Icon className="size-4" />
                    )
                  }
                  isActive={view === id}
                  badge={b !== undefined ? badge(b, id) : undefined}
                  onSelect={() => go(id)}
                  className="font-normal"
                >
                  {label}
                </AnimatedSidebarMenuButton>
              </AnimatedSidebarMenuItem>
            ))}
          </NavGroup>

          <NavGroup label="Saved views">
            {saved.map(({ id, label, icon: Icon, count }) => (
              <AnimatedSidebarMenuItem key={id}>
                <AnimatedSidebarMenuButton icon={<Icon className="size-4" />} isActive={view === "prospects" && filter === id} badge={badge(count, id)} onSelect={() => goFilter(id)} className="font-normal">
                  {label}
                </AnimatedSidebarMenuButton>
              </AnimatedSidebarMenuItem>
            ))}
          </NavGroup>
        </AnimatedSidebarContent>

        <AnimatedSidebarFooter className="border-t px-3 py-3">
          <div className="flex items-center gap-2.5">
            <Avatar className="size-7">
              <AvatarFallback className="font-mono text-[10px]">EM</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-sm">Emmanuel Michael</p>
              <p className="truncate font-mono text-[11px] text-muted-foreground">Owner</p>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} onClick={toggleTheme} className="text-muted-foreground">
                  {theme === "dark" ? <Sun /> : <Moon />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{theme === "dark" ? "Light mode" : "Dark mode"}</TooltipContent>
            </Tooltip>
          </div>
        </AnimatedSidebarFooter>
        <AnimatedSidebarRail />
      </AnimatedSidebar>

      <AnimatedSidebarInset className="min-h-0 flex-row overflow-hidden">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-background px-3 md:px-4">
            <AnimatedSidebarTrigger aria-label="Toggle sidebar" className="grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
              <PanelLeft aria-hidden className="size-4" />
            </AnimatedSidebarTrigger>
            <span className="hidden text-sm text-muted-foreground sm:inline">{VIEW_LABEL[view]}</span>
            <div className="ml-auto flex items-center gap-2">
              <Button variant="outline" onClick={() => setPalette(true)} className="w-9 justify-center px-0 text-muted-foreground lg:w-56 lg:justify-between lg:px-3" aria-label="Search prospects and commands">
                <span className="flex items-center gap-2">
                  <Search />
                  <span className="hidden lg:inline">Search or jump to…</span>
                </span>
                <KbdGroup className="hidden lg:inline-flex">
                  <Kbd>⌘</Kbd>
                  <Kbd>K</Kbd>
                </KbdGroup>
              </Button>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={assistant ? "secondary" : "outline"}
                    onClick={() => setAssistant((v) => !v)}
                    aria-pressed={assistant}
                    aria-label="Assistant"
                    className={cn("gap-2", !assistant && "text-brand")}
                  >
                    <Sparkles />
                    <span className="hidden sm:inline">Ask AI</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {ai.status === "ready" ? "Assistant" : "Assistant (rules only)"} <KbdGroup><Kbd>⌘</Kbd><Kbd>J</Kbd></KbdGroup>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button onClick={() => newDeal()} aria-label="New prospect" disabled={gated}>
                    <Plus />
                    <span className="hidden sm:inline">New prospect</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  New prospect <Kbd>N</Kbd>
                </TooltipContent>
              </Tooltip>
            </div>
          </header>

          <WorkspaceBanner />
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={`${view}-${gated ? "gate" : "on"}`}
                className="flex min-h-0 flex-1 flex-col"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: duration.fast, ease: ease.out }}
              >
                {gated && (workspace === "loading" || view === "today") ? (
                  <WorkspaceGate />
                ) : gated ? (
                  <FeatureEmpty feature={view as FeatureKey} />
                ) : view === "today" ? (
                  <TodayView onOpen={setOpenId} onGo={go} onImport={() => setImporting(true)} onAdd={() => newDeal()} />
                ) : view === "inbox" ? (
                  <InboxView onOpen={setOpenId} onImport={() => setImporting(true)} onAdd={() => newDeal()} />
                ) : view === "pipeline" ? (
                  <PipelineView onOpen={setOpenId} onImport={() => setImporting(true)} onAdd={() => newDeal()} />
                ) : view === "automations" ? (
                  <AutomationsView onOpen={setOpenId} />
                ) : view === "sequences" ? (
                  <SequencesView onOpen={setOpenId} />
                ) : view === "companies" ? (
                  <CompaniesView onOpenDeal={setOpenId} onNewDeal={newDeal} onImport={() => setImporting(true)} />
                ) : view === "reports" ? (
                  <ReportsView onImport={() => setImporting(true)} onAdd={() => newDeal()} />
                ) : (
                  <ProspectsView onOpen={setOpenId} filter={filter} onFilterChange={setFilter} onImport={() => setImporting(true)} onAdd={() => newDeal()} />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        <AssistantDock open={assistant}>
          <AssistantPanel open={assistant} onClose={() => setAssistant(false)} onOpenProspect={setOpenId} />
        </AssistantDock>
      </AnimatedSidebarInset>

      <ProspectDrawer id={openId} onClose={() => setOpenId(null)} onOpenCompany={(cid) => { setOpenId(null); setCompanyId(cid) }} />
      <CompanyDrawer id={companyId} onClose={() => setCompanyId(null)} onOpenDeal={(id) => { setCompanyId(null); setOpenId(id) }} onNewDeal={(cid) => { setCompanyId(null); newDeal(cid) }} />
      <AddProspectDialog open={adding} onOpenChange={setAdding} onCreated={(id) => setOpenId(id)} presetCompanyId={presetCompany} />
      <ImportDialog open={importing} onOpenChange={setImporting} />
      <CommandPalette items={commands} open={palette} onOpenChange={setPalette} placeholder="Search prospects, views and actions…" emptyMessage="Nothing matches that." />
    </AnimatedSidebarProvider>
  )
}

function NavGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <AnimatedSidebarGroup className="px-1 py-0">
      <AnimatedSidebarGroupLabel className="mb-1 h-8 px-2 eyebrow">{label}</AnimatedSidebarGroupLabel>
      <AnimatedSidebarGroupContent>
        <AnimatedSidebarMenu className="gap-0.5">{children}</AnimatedSidebarMenu>
      </AnimatedSidebarGroupContent>
    </AnimatedSidebarGroup>
  )
}
