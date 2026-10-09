# Prospect

A prospecting CRM for OpenDraft Studio, built on the [opendraft design system](https://github.com/nuelmdesign/UI-System).

It runs in two modes:

- **Team workspace.** One shared pipeline for the whole team, live. Used when the app is published as a Claude artifact with shared data turned on.
- **Demo.** A sample workspace with realistic prospects, kept only in your browser. Used when running locally, or picked from the workspace menu.

## What it does

| Area | What you get |
|---|---|
| Today | Daily brief, your task queue, upcoming meetings, live automation activity, hot leads |
| Inbox | Tasks with time left on each, snoozing, and updates from automations |
| Pipeline | Drag-and-drop board by stage, with lead score on every card |
| Prospects | Sortable table, saved views (hot, due, cold), bulk stage changes |
| Companies | Organisations with several people and all their deals |
| Reports | Win rate, forecast by close month, stage conversion, time in stage, by owner and source |
| Automations | When / if / then rules, an AI rule builder with approval, run history, lead routing |
| Sequences | Multi-step outreach that queues each step and stops when a prospect replies |
| Booking | Pick a slot and, in the team workspace, book it on Google Calendar with a Meet link |
| Import and export | CSV import with column matching and duplicate checks, CSV export |
| Assistant | Ask about the pipeline or tell it to make changes (Claude when available, rules otherwise) |

## Run it locally

You need Node.js 20 or newer.

```bash
npm install
npm run dev
```

Then open the address it prints. Locally the app runs in demo mode.

## Build

```bash
npm run build            # normal web build into dist/
npm run build:artifact   # the publishable page, written to artifact/prospect-crm.html
npm run check:engine     # checks the automation engine still behaves
```

Working on this with Claude Code? `CLAUDE.md` holds the project's rules and context, and Claude reads it at the start of every session.

## How it is put together

- `src/crm/data.ts` holds the types, lead scoring and wording helpers.
- `src/crm/engine.ts` is the automation engine. Every change is an event; matching rules run their actions, can chain into other rules, and time-based rules fire once per condition.
- `src/crm/store.tsx` is the single place state changes. In the team workspace it writes only the records that changed, and listens for teammates' changes.
- `src/crm/seed.ts` is the demo data and the starter automations and sequences.
- `src/components/` are opendraft components installed from the `@opendraft` registry. Style only with opendraft tokens.

## Design system

Components come from the opendraft registry (see `components.json`). The rules are in the design system's [`llms.txt`](https://raw.githubusercontent.com/nuelmdesign/UI-System/HEAD/public/llms.txt): use opendraft components first, style only with its tokens, square corners, hairlines over shadows, blue for the main action.
