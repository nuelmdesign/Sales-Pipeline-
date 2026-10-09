# Prospect CRM

A prospecting CRM for OpenDraft Studio, built on the opendraft design system. It runs as a published Claude artifact (shared team workspace) and locally (demo mode with sample data).

## Working with Emmanuel

- Emmanuel is a designer (Head of Design), not an engineer. Explain changes in plain, non-technical language, by what someone sees and does on screen. Avoid jargon; when a technical term is unavoidable, say what it means.
- Act as an art director: commit to one considered, well-reasoned direction. Do not offer grids of half-formed options to choose from.
- No em dashes anywhere: UI copy, docs, commit messages, replies. Use commas, full stops or parentheses.
- UI copy: short, plain sentences, written from the user's side ("Follow-ups due", not "Task queue entities"). Buttons say what happens ("Book and add to calendar"); toasts confirm it ("Booked").
- When a change is done, say what changed for the user in a sentence or two. No step-by-step recap.

## Design system: opendraft (required)

The rules live at https://raw.githubusercontent.com/nuelmdesign/UI-System/HEAD/public/llms.txt. Read it before building new UI. In short:

- **Components first.** Check opendraft's list before writing UI. Install with `npx shadcn@latest add @opendraft/<name>` (the registry is set in `components.json`). Core pieces land in `src/components/ui`, motion in `src/components/motion`, AI and data in `src/components/agents`. Do not copy a component's internals into a page.
- **Tokens only.** Never hard-code colours, shadows, radii or timings. Use `bg-background`, `bg-card`, `bg-surface`, `bg-muted`, `text-muted-foreground`, `bg-primary`, `text-brand`, `bg-ink`, `text-success/warning/destructive`, `border`, `bg-blue-50`…`950`. No Tailwind palette colours (`bg-gray-100`, `text-emerald-600`) and no `dark:` twins.
- **The look.** Square corners (`rounded-md` controls, `rounded-lg` cards at most, `rounded-full` only for avatars, dots, spinners). Hairline borders over shadows; shadows only on things that float. Blue only for the main action and focus. Texture is `bg-dots`, never gradients.
- **Type.** `font-display` (Newsreader, light) is for headings only, and only on real heading elements (`h1`, `h2`, `h3`, `DialogTitle`). Interface text is Geist. Numbers, labels and metadata use `font-mono`. Small uppercase labels use `eyebrow`.
- **Motion.** Timings from `@/lib/motion` (`spring.snappy`, `spring.smooth`, `spring.pop`, `ease.out`, `duration.*`). Animate transform and opacity. Keep it short. The app is wrapped in `MotionConfig reducedMotion="user"`.
- **Accessibility.** Keep Radix roles and focus rings. Icon-only buttons need `aria-label`.

### Project-specific fixes in `src/index.css` (do not undo)

- Tailwind v4 defaults borders to the text colour, so a base rule points every border at the `border` token.
- The body colour, background and font rules sit **outside** any `@layer` on purpose. The artifact host injects its own unlayered body styles (black text, system font); layered rules lose to them and dark mode text turns black.
- The three fonts are installed locally (`@fontsource-variable/*`) and wired to `--font-geist`, `--font-geist-mono`, `--font-newsreader`.
- Dark mode is the `.dark` class on `<html>`, toggled by the app, defaulting to the host's `data-theme` or the system setting.

## How the app is built

| Path | What it is |
|---|---|
| `src/App.tsx` | Shell: sidebar, header, view switching, command palette (⌘K), assistant (⌘J), dialogs |
| `src/crm/data.ts` | Types, stages, lead scoring, wording helpers, the live team directory (`OWNERS`, `owner()`) |
| `src/crm/engine.ts` | Automation engine. Changes become events; matching rules run their actions in order; actions can chain (depth 3); time-based rules fire once per condition via `fired` |
| `src/crm/store.tsx` | The only place state changes. Every change goes through `apply()`. Demo mode saves to the browser; team mode writes only changed records to the shared database and listens for teammates |
| `src/crm/seed.ts` | Demo data, the 9 starter automations and 3 starter sequences |
| `src/crm/ai.tsx` | Claude access (the artifact's `sample` capability), prompts, and rule-based fallbacks for every AI feature |
| `src/crm/*.tsx` | One file per screen or panel: today, inbox, pipeline, prospects, companies, reports, automations (+ editor), sequences, prospect drawer, booking, import/export, assistant, workspace, empty states |

Rules of the road:

- **Change state only through the store.** Add a method to `Store` in `store.tsx` that calls `apply()`. If the change should trigger automations, `dispatch()` the matching event (`prospect_created`, `stage_changed`, `meeting_booked`, `touched`).
- **Move stages with `applyStage()`** so stage history and close dates stay right (Reports depends on them).
- **People are stored as ids, never names.** In team mode owners are real users; names come from the platform at render time and fill `OWNERS`. `ME` (in `store.tsx`) is the current viewer.
- **Deals keep a copy of company and main-contact fields** for speed. After changing a company or contact, call `syncDeal()` (the store's `saveCompany` and `saveContact` already do).
- **Every screen needs an empty state.** Use `FeatureEmpty` from `src/crm/empty-states.tsx`. Before the team workspace is set up, every sidebar screen must explain itself and offer setup. Nothing should look unresponsive.
- **AI must degrade.** Every AI surface works without Claude, using the fallbacks in `ai.tsx`, and is labelled "Claude" or "Rules" with `AIMark`.

## Commands

```bash
npm install              # once
npm run dev              # preview locally (demo mode)
npx tsc -p tsconfig.app.json --noEmit   # type check
npm run check:engine     # automation engine checks, all must PASS
npm run build:artifact   # writes artifact/prospect-crm.html for publishing
```

## Publishing the live page

The team uses the published artifact at https://claude.ai/artifact/GVvGk9gj22WD9LQ8H7RKwk. To update it, run `npm run build:artifact` and republish `artifact/prospect-crm.html` to that same link, so the URL and the team's shared data stay the same.

The page relies on these artifact capabilities. Keep them declared: `sample` (Claude), `db` (shared data), `user` with `scopes: ["profile"]` (teammate names), `mcp` with server `Google Calendar` and tools `list_events`, `create_event` (booking), `downloads` (CSV export).

Shared data lives in collections `prospects`, `companies`, `contacts`, `tasks`, `notices`, `meetings`, `automations`, `runs`, `sequences`, `team`, plus `meta/routing`, `meta/fired`, `meta/workspace`. Changing a record's shape means old records in the live workspace still have the old shape, so read new fields defensively.

## Before you call a change done

1. Type check passes and `npm run check:engine` is all PASS.
2. Look at it in light and dark mode, and at phone width (about 390px) with no sideways scrolling.
3. Empty, loading and error states exist for anything new.
4. No hard-coded colours, palette classes, `dark:` twins or gradients in `src/App.tsx` or `src/crm` (`grep` for `#`, `rgb(`, `oklch(`, `dark:`, `gradient`).
5. No em dashes in any text you added.

## Known limits and likely next steps

- Sending email and tracking replies from inside the CRM needs a real backend; the artifact cannot do it. "Log as sent" records that an email went out.
- Locally, the app is always in demo mode; the team workspace exists only in the published page.
- Good next additions: custom fields on companies and deals, saved filters, and per-teammate notification settings.
