import * as React from "react"
import { CalendarCheck, CalendarX, Shuffle } from "lucide-react"
import { motion } from "motion/react"
import { toast } from "sonner"

import { ShimmerText } from "@/components/motion/shimmer-text"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
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

import { OwnerAvatar } from "./bits"
import { OWNERS, owner, type OwnerId, type Prospect } from "./data"
import { ME, useStore } from "./store"

const SERVER = "Google Calendar"
const HOURS = [9, 10, 11, 12, 14, 15, 16]

/* ---------------- calendar connector ---------------- */

type McpError = { code: string; message?: string }
type MCP = {
  callTool(server: string, tool: string, input?: unknown, options?: unknown): Promise<{ payload?: unknown }>
}

export function useCalendar() {
  const [mcp, setMcp] = React.useState<MCP | null>(null)
  React.useEffect(() => {
    let alive = true
    window.claude?.use?.("mcp").then((m) => alive && setMcp(m as MCP | null)).catch(() => {})
    return () => {
      alive = false
    }
  }, [])
  return mcp
}

/** Local wall-clock time without an offset, as the calendar tools expect. */
function localISO(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:00`
}

type Busy = { start: number; end: number }

function readBusy(payload: unknown): Busy[] {
  const events = (payload as { events?: unknown[] })?.events ?? []
  const out: Busy[] = []
  for (const e of events as Record<string, any>[]) {
    if (e?.status === "cancelled") continue
    if ((e?.attendees as { self?: boolean; responseStatus?: string }[] | undefined)?.some((a) => a.self && a.responseStatus === "declined")) continue
    const s = e?.start?.dateTime
    const en = e?.end?.dateTime
    if (s && en) out.push({ start: new Date(s).getTime(), end: new Date(en).getTime() })
    else if (e?.eventType === "OUT_OF_OFFICE" && e?.start?.date) {
      const d0 = new Date(`${e.start.date}T00:00:00`).getTime()
      const d1 = new Date(`${(e.end?.date ?? e.start.date)}T00:00:00`).getTime()
      out.push({ start: d0, end: Math.max(d1, d0 + 86_400_000) })
    }
  }
  return out
}

function calendarCopy(e: McpError) {
  switch (e?.code) {
    case "server_not_connected":
    case "selection_required":
      return "Add Google Calendar in claude.ai Settings, Connectors, to book against your real calendar."
    case "needs_reauth":
      return "Reconnect Google Calendar in claude.ai Settings, Connectors."
    case "not_in_manifest":
      return "Calendar access is off for this page. Turn it on from the page's permissions to sync bookings."
    case "blocked_by_policy":
      return "Your organisation does not allow this calendar action."
    case "approval_required":
      return "The calendar needs your approval for this. Try again and choose Allow."
    case "tool_error":
      return e.message ? `Google Calendar said: ${e.message}` : "Google Calendar could not do that."
    default:
      return "Google Calendar did not respond. Try again in a moment."
  }
}

/* ---------------- dialog ---------------- */

function businessDays(n: number) {
  const out: Date[] = []
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  while (out.length < n) {
    d.setDate(d.getDate() + 1)
    const day = d.getDay()
    if (day !== 0 && day !== 6) out.push(new Date(d))
  }
  return out
}

/** Sample-team availability for demo mode only, so the grid looks like a real week. */
function demoBusy(o: OwnerId, day: Date, hour: number) {
  const seed = o.charCodeAt(0) * 31 + (o.charCodeAt(1) || 0) * 7 + day.getDate() * 13 + hour * 17
  return seed % 5 === 0 || seed % 7 === 0
}

export function BookMeetingDialog({ prospect, onClose }: { prospect: Prospect | null; onClose: () => void }) {
  const { state, bookMeeting, mode } = useStore()
  const mcp = useCalendar()
  const days = React.useMemo(() => businessDays(5), [])
  const routed: OwnerId = React.useMemo(() => {
    if (!prospect) return ME
    const r = state.routing
    if (r.mode === "by_industry" && r.industryMap[prospect.industry]) return r.industryMap[prospect.industry]!
    return prospect.owner
  }, [prospect, state.routing])
  const [who, setWho] = React.useState<OwnerId>(routed)
  const [slot, setSlot] = React.useState<string | null>(null)
  const [minutes, setMinutes] = React.useState("30")
  const [title, setTitle] = React.useState("")
  const [toCalendar, setToCalendar] = React.useState(true)
  const [invite, setInvite] = React.useState(true)
  const [busy, setBusy] = React.useState<Busy[] | null>(null)
  const [calState, setCalState] = React.useState<"idle" | "loading" | "live" | "off">("idle")
  const [calNote, setCalNote] = React.useState("")
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    if (!prospect) return
    setWho(routed)
    setSlot(null)
    setMinutes(["researching", "contacted", "replied"].includes(prospect.stage) ? "30" : "45")
    setTitle(prospect.stage === "proposal" ? "Proposal walkthrough" : prospect.stage === "meeting" ? "Working session" : "Discovery call")
    setInvite(Boolean(prospect.email))
  }, [prospect, routed])

  const live = mode === "workspace" && Boolean(mcp) && who === ME

  // Read the host's real calendar when the host is the person booking.
  React.useEffect(() => {
    if (!prospect || !live || !mcp) {
      setBusy(null)
      setCalState(mode === "workspace" && mcp && who !== ME ? "off" : "idle")
      setCalNote(mode === "workspace" && who !== ME ? `${owner(who).first}'s calendar is private to them, so every slot shows as open.` : "")
      return
    }
    let alive = true
    setCalState("loading")
    const start = new Date(days[0])
    const end = new Date(days[days.length - 1])
    end.setHours(23, 59, 0, 0)
    mcp
      .callTool(SERVER, "list_events", { startTime: localISO(start), endTime: localISO(end), orderBy: "startTime", pageSize: 200 }, { cache: { staleTime: 60_000 } })
      .then((r) => {
        if (!alive) return
        setBusy(readBusy(r.payload))
        setCalState("live")
        setCalNote("")
      })
      .catch((e: McpError) => {
        if (!alive) return
        setBusy(null)
        setCalState("off")
        setCalNote(calendarCopy(e))
      })
    return () => {
      alive = false
    }
  }, [prospect, live, mcp, who, days, mode])

  const taken = (d: Date, h: number) => {
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h).getTime()
    const end = start + Number(minutes) * 60_000
    if (state.meetings.some((m) => m.owner === who && new Date(m.at).getTime() < end && new Date(m.at).getTime() + m.minutes * 60_000 > start)) return true
    if (busy) return busy.some((b) => b.start < end && b.end > start)
    return mode === "demo" ? demoBusy(who, d, h) : false
  }

  const confirm = async () => {
    if (!prospect || !slot) return
    const start = new Date(slot)
    const end = new Date(start.getTime() + Number(minutes) * 60_000)
    let calendarLink: string | undefined
    let meetUrl: string | undefined
    if (live && toCalendar && mcp) {
      setSaving(true)
      try {
        const r = await mcp.callTool(SERVER, "create_event", {
          summary: `${title.trim()}: ${prospect.company} and OpenDraft`,
          startTime: localISO(start),
          endTime: localISO(end),
          attendees: invite && prospect.email ? [{ email: prospect.email, displayName: prospect.contact }] : [],
          addGoogleMeetUrl: true,
          description: `Booked from Prospect CRM.\nWith ${prospect.contact}${prospect.role ? `, ${prospect.role}` : ""} at ${prospect.company}.`,
        })
        const ev = r.payload as Record<string, any> | undefined
        calendarLink = ev?.htmlLink
        meetUrl = ev?.conferenceUrl ?? ev?.hangoutLink ?? ev?.conferenceData?.videoEntryPoint?.uri
      } catch (e) {
        const err = e as McpError
        setSaving(false)
        if (err.code === "server_unavailable" || err.code === "upstream_error") {
          toast("Google Calendar did not confirm", { description: "Check your calendar before booking again, the event may already be there." })
        } else {
          toast("Not added to Google Calendar", { description: calendarCopy(err) })
        }
        return
      }
      setSaving(false)
    }
    bookMeeting(prospect.id, { owner: who, at: slot, minutes: Number(minutes), title: title.trim(), calendarLink, meetUrl })
    toast.success(`Booked "${title.trim()}"`, {
      description: calendarLink
        ? `On your Google Calendar${invite && prospect.email ? `, invite sent to ${prospect.email}` : ""}.`
        : `${prospect.contact} with ${owner(who).first}, ${start.toLocaleString("en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit" })}`,
      icon: <CalendarCheck className="size-4" />,
    })
    onClose()
  }

  return (
    <Dialog open={Boolean(prospect)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl font-light tracking-[-0.02em]">Book with {prospect?.contact}</DialogTitle>
          <DialogDescription>Routed to the right person, then pick an open slot. Booking fires your meeting automations.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-end gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="bk-owner">Host</Label>
            <Select value={who} onValueChange={(v) => { setWho(v); setSlot(null) }}>
              <SelectTrigger id="bk-owner" className="w-52"><SelectValue /></SelectTrigger>
              <SelectContent>
                {OWNERS.map((o) => (
                  <SelectItem key={o.id} value={o.id}>{o.id === ME ? `${o.name} (you)` : o.name}{o.id === routed ? " · routed" : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="bk-len">Length</Label>
            <Select value={minutes} onValueChange={setMinutes}>
              <SelectTrigger id="bk-len" className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>{["15", "30", "45", "60"].map((m) => <SelectItem key={m} value={m}>{m} min</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid min-w-0 flex-1 basis-48 gap-1.5">
            <Label htmlFor="bk-title">Title</Label>
            <Input id="bk-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Shuffle className="size-3.5" />
            {state.routing.mode === "by_industry" && prospect ? `${prospect.industry} goes to ${owner(routed).first} by industry routing.` : `Stays with the deal owner, ${owner(routed).first}.`}
          </span>
          {calState === "loading" ? <ShimmerText className="text-xs">Reading your Google Calendar…</ShimmerText> : null}
          {calState === "live" ? (
            <span className="flex items-center gap-1.5 text-success"><CalendarCheck className="size-3.5" /> Showing your real availability</span>
          ) : null}
          {calState === "off" && calNote ? <span className="flex items-center gap-1.5"><CalendarX className="size-3.5" /> {calNote}</span> : null}
          {mode === "demo" ? <span>Demo mode uses sample availability.</span> : null}
        </div>

        <div className="overflow-x-auto">
          <div className="grid min-w-[520px] grid-cols-5 gap-2">
            {days.map((d) => (
              <div key={d.toISOString()} className="flex flex-col gap-1.5">
                <p className="pb-1 text-center">
                  <span className="block eyebrow text-muted-foreground">{d.toLocaleDateString("en-GB", { weekday: "short" })}</span>
                  <span className="font-mono text-sm tabular-nums">{d.getDate()}</span>
                </p>
                {HOURS.map((h) => {
                  const iso = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h).toISOString()
                  const off = calState === "loading" || taken(d, h)
                  const on = slot === iso
                  return (
                    <button
                      key={h}
                      type="button"
                      disabled={off}
                      onClick={() => setSlot(iso)}
                      aria-pressed={on}
                      className={cn(
                        "relative h-8 rounded-md border font-mono text-xs tabular-nums transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                        off ? "cursor-not-allowed border-dashed text-muted-foreground/50 line-through" : "bg-card hover:border-brand hover:text-brand",
                        on && "text-primary-foreground hover:text-primary-foreground"
                      )}
                    >
                      {on ? <motion.span layoutId="slot" className="absolute inset-0 rounded-md bg-primary" transition={spring.snappy} /> : null}
                      <span className="relative">{String(h).padStart(2, "0")}:00</span>
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </div>

        {live && calState !== "off" ? (
          <div className="flex flex-col gap-2 rounded-md border bg-surface p-3 text-sm">
            <label className="flex items-center gap-3">
              <Checkbox checked={toCalendar} onCheckedChange={(v) => setToCalendar(v === true)} />
              Add to my Google Calendar with a Meet link
            </label>
            <label className={cn("flex items-center gap-3", (!toCalendar || !prospect?.email) && "opacity-50")}>
              <Checkbox checked={invite && toCalendar} disabled={!toCalendar || !prospect?.email} onCheckedChange={(v) => setInvite(v === true)} />
              {prospect?.email ? `Send an invite to ${prospect.email}` : "No email on file, so no invite will be sent"}
            </label>
          </div>
        ) : null}

        <DialogFooter className="items-center sm:justify-between">
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            <OwnerAvatar id={who} className="size-5" />
            {slot ? new Date(slot).toLocaleString("en-GB", { weekday: "long", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "Pick a time"}
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button disabled={!slot || !title.trim()} loading={saving} onClick={confirm}>
              {live && toCalendar ? "Book and add to calendar" : "Confirm booking"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
