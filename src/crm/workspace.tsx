import { Check, ChevronsUpDown, FlaskConical, Upload, UserPlus, Users } from "lucide-react"
import { motion } from "motion/react"
import * as React from "react"
import { toast } from "sonner"

import { PixelLoader } from "@/components/agents/pixel-loader"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { spring, stagger } from "@/lib/motion"

import { OWNERS } from "./data"
import { useStore } from "./store"

/** Workspace name in the sidebar, doubling as the switch between team and demo. */
export function WorkspaceSwitcher() {
  const { mode, setMode, workspace } = useStore()
  const teamOK = workspace !== "unavailable"
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="flex w-full items-center gap-2.5 rounded-md p-1 text-left outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring">
          <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-md bg-ink font-mono text-xs text-ink-foreground">P</span>
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block truncate text-sm font-medium">Prospect</span>
            <span className="block truncate font-mono text-[11px] text-muted-foreground">{mode === "demo" ? "Demo · sample data" : "Team workspace"}</span>
          </span>
          <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="eyebrow text-muted-foreground">Workspace</DropdownMenuLabel>
        <DropdownMenuItem disabled={!teamOK} onSelect={() => mode !== "workspace" && setMode("workspace")} className="items-start gap-2.5">
          <Users className="mt-0.5" />
          <span className="flex-1">
            <span className="block">Team workspace</span>
            <span className="block text-xs text-muted-foreground">{teamOK ? "Shared live with your team" : "Not available in this view"}</span>
          </span>
          {mode === "workspace" ? <Check className="mt-0.5" /> : null}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => mode !== "demo" && setMode("demo")} className="items-start gap-2.5">
          <FlaskConical className="mt-0.5" />
          <span className="flex-1">
            <span className="block">Demo</span>
            <span className="block text-xs text-muted-foreground">Sample data, only in this browser</span>
          </span>
          {mode === "demo" ? <Check className="mt-0.5" /> : null}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <p className="px-2 py-1.5 text-xs text-muted-foreground">Changes in the demo never touch the team workspace.</p>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Full-page states before the team workspace is usable. Returns null when ready. */
export function WorkspaceGate() {
  const { mode, workspace, canWrite, setupWorkspace, setMode } = useStore()
  const [busy, setBusy] = React.useState(false)

  React.useEffect(() => {
    if (mode === "workspace" && workspace === "unavailable") setMode("demo")
  }, [mode, workspace, setMode])

  if (mode !== "workspace" || workspace === "ready" || workspace === "unavailable") return null

  if (workspace === "loading")
    return (
      <div className="grid flex-1 place-items-center py-24">
        <PixelLoader variant="dots" label="Opening the team workspace" />
      </div>
    )

  const steps = [
    ["Your pipeline is shared", "Everyone you share this page with sees the same prospects, live."],
    ["Nine automations switch on", "Routing, hot lead alerts, cold deal revival and more, ready to edit."],
    ["Three sequences are ready", "Cold outreach, revive and proposal chaser."],
    ["You join the team", "New prospects start routing to you. Teammates join from this page."],
  ]
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-14 md:px-8">
      <div className="flex flex-col gap-3">
        <p className="eyebrow text-muted-foreground">Team workspace</p>
        <h1 className="font-display text-4xl font-light tracking-[-0.02em] text-balance md:text-5xl">Set up OpenDraft's shared pipeline.</h1>
        <p className="max-w-xl text-sm text-muted-foreground">
          This workspace is empty. Setting it up adds your automations, sequences and routing. No sample prospects go in, so it starts clean for real work.
        </p>
      </div>
      <ol className="grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-2">
        {steps.map(([t, d], i) => (
          <motion.li key={t} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring.smooth, delay: i * stagger.base }} className="flex flex-col gap-1.5 bg-card p-5">
            <span className="text-sm font-medium">{t}</span>
            <span className="text-xs text-muted-foreground">{d}</span>
          </motion.li>
        ))}
      </ol>
      <div className="flex flex-wrap items-center gap-3">
        {canWrite ? (
          <Button
            size="lg"
            loading={busy}
            onClick={async () => {
              setBusy(true)
              try {
                await setupWorkspace()
                toast.success("Workspace ready", { description: "Import a spreadsheet or add your first prospect." })
              } catch {
                toast("Setup did not finish. Try again.")
              } finally {
                setBusy(false)
              }
            }}
          >
            Set up the workspace
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">Ask the owner to set this workspace up, or for Contributor access.</p>
        )}
        <Button variant="ghost" size="lg" onClick={() => setMode("demo")}>
          Explore the demo first
        </Button>
      </div>
    </div>
  )
}

/** Slim banner for teammates who have not joined, or who can only view. */
export function WorkspaceBanner() {
  const { mode, workspace, isMember, canWrite, joinTeam } = useStore()
  if (mode !== "workspace" || workspace !== "ready") return null
  if (!canWrite)
    return <div className="border-b bg-surface px-4 py-2 text-center text-xs text-muted-foreground md:px-6">You can view this workspace. Ask the owner for Contributor access to make changes.</div>
  if (isMember) return null
  return (
    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} transition={spring.smooth} className="overflow-hidden border-b bg-brand/5">
      <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 md:px-6">
        <UserPlus className="size-4 text-brand" />
        <span className="flex-1 text-sm">Join the team to own deals and get prospects routed to you.</span>
        <Button size="sm" onClick={() => joinTeam()}>Join the team</Button>
      </div>
    </motion.div>
  )
}

/** First-run card for an empty pipeline. */
export function EmptyPipeline({ onImport, onAdd }: { onImport: () => void; onAdd: () => void }) {
  return (
    <Card className="relative gap-5 overflow-hidden p-6 md:p-8">
      <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 hidden w-48 border-l bg-dots md:block" />
      <div className="flex max-w-lg flex-col gap-2 md:pr-48">
        <h2 className="font-display text-3xl font-light tracking-[-0.02em]">Bring in your prospects.</h2>
        <p className="text-sm text-muted-foreground">
          Import the spreadsheet you use today, or add the first prospect by hand. Your routing rule assigns owners and queues research tasks as they arrive.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={onImport}><Upload /> Import a spreadsheet</Button>
        <Button variant="outline" onClick={onAdd}>Add a prospect</Button>
      </div>
      <p className={cn("font-mono text-[11px] text-muted-foreground")}>{OWNERS.length} on the team</p>
    </Card>
  )
}
