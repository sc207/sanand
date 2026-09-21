# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install     # once
npm start       # run the server — http://localhost:3000
npm run dev     # same, but restarts automatically on file changes (node --watch)
npm run seed    # optional: seeds Maha Yagna + Bhagvat Saptah poojas with 100 patla/day
```

There is no build step, bundler, linter, or test suite in this repo — nothing beyond the
three scripts above to run. The frontend is served as-is from `public/`.

Backup: the whole app state is one file, `data/temple.db` (plus its `-wal`/`-shm`
siblings if the server is running). Stop the server first, or copy all three together.

Warm the local translator before an event so the first real use isn't slow:
`curl -X POST localhost:3000/api/translate/warmup`

## Architecture

Express + better-sqlite3 backend; a vanilla-JS frontend with **no framework and no build
step** (plain `<script>` tags, no bundler, no JSX/TS). `models/` holds the offline NLLB
translator (~870MB, downloaded on first use, not committed). `_legacy/` is a prior
prototype kept for reference only — not wired into the running app.

### Backend (`server/`)

- `server.js` mounts each `routes/*.js` under `/api/<resource>`, then serves `public/`
  as static with an SPA fallback: any non-`/api` GET returns `index.html`.
- `db.js` defines the schema with `CREATE TABLE IF NOT EXISTS` plus a handful of ad hoc
  `ALTER TABLE ... ADD COLUMN` checks run at require-time — there is no separate
  migration tool or migration files; schema changes go directly into `db.js`.
- Core tables and how they relate:
  - `lookups` — one generic table for every managed list (samaj / devotee_category /
    donation_category), disambiguated by a `type` column, so a new list needs no new
    table.
  - `devotees` — the permanent register. **Mobile number is the identity/dedup key**
    (see `upsertDevotee` in `devotees.js`) — creating a booking with a known mobile
    updates that devotee rather than duplicating them. Devotees are never deleted via
    the API.
  - `pooja_events` — one yagna/pooja/katha, always inside one of three hardcoded
    categories (`maha_yagna` | `mandir_pooja` | `bhagvat_katha`, defined in the
    `CATEGORIES` map in `poojas.js`). `start_date`/`end_date` and `seats_per_day` can
    all be `NULL` — see Domain context below for why.
  - `pooja_slots` — one row per calendar day of a pooja. `slot_date IS NULL` means the
    date isn't fixed yet; `capacity IS NULL` means unlimited seating for that day.
    Seats are booked against a slot, not the pooja.
  - `sevarthi_bookings` — a devotee's seat on one slot. **`status` is derived, never
    set directly** (except by cancel): `refreshStatus()` in `bookings.js` recomputes
    it from the payments ledger every time a payment is recorded.
  - `payments` — append-only cash ledger, read back FIFO by `created_at`. `payer_type`
    is `devotee` or `bhuvaji` (Bhuvaji Suresh Bapa can cover part or all of a seat's
    committed amount — see `sevarthi_bookings.bhuvaji_planned_amount`).
  - `donations`, `visits`, `users` / `audit_log`, `settings`.
- **Seat safety is a transaction, not a UI convention**: in `bookings.js` `POST /`, the
  fresh capacity check, the booking insert, and the `booked_count` increment all run
  inside one `db.transaction()`. That's what actually prevents overbooking — the
  frontend disabling full slots/poojas is a UX nicety on top of it, not the mechanism.
- Every create/update/delete/cancel/payment route calls `log(req, {...})` from
  `middleware/audit.js`, which writes an `audit_log` row using the acting user's name
  from the `X-User-Name` request header. There is **no real authentication** — that
  header is set client-side from whichever operator is picked in the "signed in as"
  switcher (`Forms.switchUser`, persisted in `localStorage`).

### Frontend (`public/`)

- Script load order in `index.html` matters and is intentional: `lang.js`, `api.js`,
  `ui.js`, `print.js`, then every `pages/*.js` (each registers itself as
  `window.Pages.<key> = { render(host, params) }`), then `forms.js`, then `app.js`
  last (the router, which reads `window.Pages`).
- `app.js` is a hash-based router: a `PAGES` registry (`{ key: { title } }`) maps a
  hash segment to a page module. **To add a new page**: create
  `public/js/pages/x.js` exporting `global.Pages.x = { render }`, add its `<script>`
  tag to `index.html`, add an entry to `app.js`'s `PAGES` map, and add a nav link
  (`data-page="x"`) in the sidebar/mobile-nav markup in `index.html`.
  `window.navigate(page, ...params)` and `window.refreshPage()` are the globals pages
  use to move around / re-render themselves after a mutation.
- `api.js` is the only place `fetch()` is called; every request carries `X-User-Name`
  for the audit log.
- `ui.js` is the shared UI kit: `openSheet`/`closeSheet` drive the **single** `#sheet`
  modal reused by the entire app — opening a sheet while one is already open replaces
  its content rather than stacking a second dialog, so a nested "+ add new X" flow
  (`bindLookupAdders`) discards the parent form's in-progress state. Also here:
  `readForm`/`showFieldError`/`clearFieldErrors`, `lookupSelect` (dropdown + inline
  "add new" for samaj/category-style lookups), and formatting helpers (`money`,
  `fmtDate`, `statusBadge`, `progressBar`).
- `forms.js` holds multi-step flows reachable from more than one place (Add Sevarthi,
  Add Payment, quick-add menu, global search, lookup adders, user switcher) — kept
  separate from `pages/` because they're invoked from many pages rather than routed.
- `pages/*.js` — one file per sidebar section, each exporting `{ render(host, params) }`.

### CSS — read this before changing styles

- `public/css/styles.css` is the mandir's own existing portal stylesheet, copied in
  **unchanged** (~4000 lines) — the design tokens (`--primary-maroon`, `--radius-md`,
  etc.), typography, and most component classes (`.card`, `.stat-card`, `.modal-*`,
  `.form-*`) live here.
- `public/css/app-extras.css` holds only what `styles.css` doesn't have (patla slot
  grid, sevarthi ledger, EN/ગુ switch, etc.). New app-specific styling belongs here,
  reusing `styles.css`'s existing custom properties rather than inventing new ones.
- `public/css/app.css` **exists on disk but is not linked from `index.html`.** It's a
  leftover, self-contained earlier design system (its own `--maroon` token set, its
  own `.stat`/`.stat-ico`/`.rail`/`.sheet`/`.topbar` classes) from before the app
  adopted `styles.css` as its base. Editing it has no visible effect. If a class a
  `pages/*.js` template renders appears completely unstyled, check whether it was only
  ever defined in this dead file before assuming the class name is wrong — this has
  happened at least once (`.stat`/`.stat-ico`, since ported into `app-extras.css`).

### Language

Two independent mechanisms, deliberately not unified:
- `public/js/lang.js` is a hand-written EN/Gujarati table for the app's own UI chrome
  (nav labels, buttons, headings) — instant, offline, exact temple vocabulary. It never
  touches devotee names, pooja names, or amounts.
- `server/translate.js` runs NLLB-200 locally (via `@huggingface/transformers`, model
  cached in `models/`) to translate **free text a person types** (notes, descriptions),
  with a glossary in that file protecting temple/place terms from being mistranslated.

When adding a translatable field, pick the mechanism based on whether it's static app
copy (`lang.js`) or user-entered text (the `data-translate` attribute + `translate.js`).

## Domain context — how the booking phase is meant to work

Per the trust, the priority order for this phase is: **(1)** get every devotee plus
their chosen seva and a committed amount into the system first — the exact date can be
decided later, once things are confirmed; **(2)** collect payment against what's
already been entered; **(3)** a sevarthi may later add to an existing commitment
(`PUT /api/bookings/:id` already supports raising `amount_committed` /
`bhuvaji_planned_amount`) or ask to change which seva they're on (there's no
reassign-slot endpoint yet — today that means cancelling the old booking and adding a
new one); **(4)** a "who hasn't paid yet" view and **(5)** arranging sitting by seva
date and headcount are both deliberately later concerns, not blockers for this phase —
the goal right now is getting every sevarthi recorded against every seva without
seating logistics getting in the way.

This is why the data model favors flexible entry over strict scheduling:
`pooja_slots.slot_date` and `capacity` can both be `NULL` (undated, open/unlimited
seating), so a pooja can take sevarthi before its date or headcount is finalized, and
`PUT /api/poojas/:id/dates` converts the placeholder slot into day one once a date is
fixed, carrying existing bookings over rather than disturbing them. When building
booking-related features, default to **not** introducing new hard blockers (required
dates, capacity caps) unless the trust has explicitly said that pooja's seating is
fixed — an unset date/capacity is the normal, expected state for a pooja early on, not
missing data to be validated against.

Relatedly, `pooja_events.coordinator_devotee_id` and the generic `lookups` table exist
now specifically so a later Phase 2 (Management Apps / Committee) can attach to them
without a schema rewrite — both are unused today and should stay that way until Phase 2.
