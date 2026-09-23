# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install                  # once
npm start                    # run the server — http://localhost:3000
npm run dev                  # same, but restarts on file changes (node --watch)
npm run seed                 # seeds the real Mahotsav seva list (idempotent, safe to re-run)
npm run seed:demo            # ten devotees / seats / payments / donations / padhramni
npm run reset                # clear the entered data; keep seva, samaj and the categories
npm run reset -- --lists     # …and put those lists back to exactly what the seed creates
node server/seed-dummy.js    # NOT an npm script: dummy sevarthi/payments for testing.
                             # NOT idempotent — running it twice duplicates everything.
```

**The clean-start sequence is `npm run reset -- --lists && npm run seed && npm run
seed:demo`.** Reset clears everything the trust enters (devotees, bookings, payments,
donations, padhramni, the audit log, the receipt counters), keeps the reference data, and
takes a timestamped backup first, every time. Two things it does that are easy to forget
by hand and wrong to leave out: `pooja_slots.booked_count` goes back to 0 — it is a
running count, not derived, so clearing the bookings without it leaves every day claiming
to be full — and the receipt counters reset, so a fresh run starts at `P-<year>-0001`
rather than continuing a sequence whose receipts no longer exist.

`--lists` additionally drops any seva, samaj or category the seed did not create, which
is what a run of tests leaves behind: this database had picked up 66 seva called things
like "Redate Test 1790017245629" and 33 samaj called "Corrected Samaj 408269". It reads
the keepers out of `seed.js` and `db.js` rather than repeating them, so the two cannot
drift — **and it must match a whole quoted string per quote style**, not "anything
between two quote characters": one mandir pooja is written `"Samaran's Main Kalash
Pooja"` in double quotes because of the apostrophe, and a combined `[^'"]` class stops
dead there, which is how the first run of this deleted fifteen real poojas as junk.
`npm run seed` put them back, which is the whole reason that script is idempotent.

**Accounts are deliberately untouched by reset.** An account is a person, not test data.

`seed:demo` is small on purpose — `seed-dummy.js` covers every booking state at once and
makes a few hundred rows doing it, which is right for checking money logic and wrong for
looking at a screen. The ten it creates carry one of each state worth seeing (pending,
part paid, covered, overpaid, cancelled, Bapa covering part, a gift from Bapa, a dated
seva and an undated one, a devotee with no mobile and one with no seva).

There is **no build step, bundler, linter, or test suite** — nothing to run beyond the
above. The frontend is served as-is from `public/`, so a reload is the whole feedback
loop. Do not add a test command to this file unless a test runner is actually introduced.

`npm run seed` only creates `pooja_events` / `pooja_slots`; `seed-dummy.js` only creates
devotees, bookings and payments, and deliberately covers every booking state (pending /
partial / paid / overpaid / cancelled, Bapa covering none/part/all, full and undated
poojas, a reassigned booking). Use it before changing anything money- or status-related.

Backup: the whole app state is one file, `data/temple.db` (plus its `-wal`/`-shm`
siblings while the server runs). Stop the server first, or copy all three together.

`TEMPLE_DB=<path>` points the server (and `seed.js`) at a different database file, so a
test run can use a throwaway one. The mandir always runs the default. Several checks
assert whole-database totals and only hold on a freshly seeded schema, so run them like
this rather than against the working database:

```bash
TEMPLE_DB=/tmp/t.db node server/seed.js
TEMPLE_DB=/tmp/t.db PORT=3100 node server/server.js
```

**better-sqlite3 aborts the process if the database is still open at exit** — Node tears
the isolate down first and the native cleanup hook asserts (`Assertion failed: (env) !=
nullptr`) with a long native stack trace, exit code 134. This made `npm run dev` fail to
come back on every save and `npm run seed` print a crash after doing its work. Both now
call `db.close()` first (`seed.js` at the end; `server.js` on SIGINT/SIGTERM/SIGHUP/
SIGBREAK). Any new entry-point script that requires `./db` must do the same.

**Close it on a signal, never in `process.on('exit')`.** An exit handler looks like the
safe catch-all and is the opposite: it runs while the environment is already being torn
down, so destroying the prepared statements there triggers the very assertion it was
meant to prevent — the native trace points straight at `Statement::~destructor`. Adding
one turned an occasional crash into a reliable one.

Warm the local translator before an event so the first real use isn't slow:
`curl -X POST localhost:3000/api/translate/warmup`

## Architecture

Express + better-sqlite3 backend; a vanilla-JS frontend with **no framework and no build
step** (plain `<script>` tags, no bundler, no JSX/TS). `models/` holds the offline NLLB
translator (~870MB, downloaded on first use, not committed). `_legacy/` is a prior
prototype kept for reference only — not wired into the running app.

Nothing is fetched from the internet at runtime (fonts, icon sprite and the translator
all live on disk) — the app must keep working on a laptop at the mandir with no
connection. Don't introduce a CDN link, web font or remote API call.

### Backend (`server/`)

- `server.js` mounts each `routes/*.js` under `/api/<resource>`, then serves `public/`
  as static with an SPA fallback: any non-`/api` GET returns `index.html`. The static
  caching is deliberate — fonts/images cache for a week, HTML/CSS/JS are `no-cache` so
  an update never leaves an operator looking at a stale screen.
- `db.js` defines the schema with `CREATE TABLE IF NOT EXISTS`, plus a few ad hoc
  migrations run at require-time (full table rebuilds to drop `NOT NULL`, guarded
  `ALTER TABLE ... ADD COLUMN` for the rest, each behind a `PRAGMA table_info` check).
  There is **no migration tool and no migration files** — schema changes go directly
  into `db.js`, written as idempotent guarded blocks in that same style, because
  databases in the field are only ever upgraded in place.
- `util/dates.js` — `todayLocal()` / `monthLocal()` use `toLocaleDateString('en-CA')`.
  SQLite stamps rows with `datetime('now','localtime')`, so **never use
  `toISOString()`** for a date: it is UTC and files an early-morning entry under the
  previous day.

#### Core tables and how they relate

- `lookups` — one generic table for every managed list (samaj / devotee_category /
  donation_category), disambiguated by a `type` column, so a new list needs no new
  table. Deletes are soft (`active = 0`).
- `devotees` — the permanent register. **Mobile number is the identity/dedup key**
  (see `upsertDevotee` in `devotees.js`): creating a booking with a known mobile updates
  that devotee rather than duplicating them, and the update **merges** — a blank field
  in the incoming payload means "unchanged", never "erase what we already know".
  Devotees are never deleted via the API.
- `pooja_events` — one yagna/pooja/katha, always inside one of three hardcoded
  categories (`maha_yagna` | `mandir_pooja` | `bhagvat_katha`, defined in the
  `CATEGORIES` map in `poojas.js`). `start_date`/`end_date` and `seats_per_day` can all
  be `NULL` — see Domain context below for why.
- `pooja_slots` — one row per calendar day of a pooja. `slot_date IS NULL` means the
  date isn't fixed yet; `capacity IS NULL` means unlimited seating for that day.
  Seats are booked against a slot, not the pooja.
- `sevarthi_bookings` — a devotee's seat on one slot. **`status` is derived, never set
  directly** (except by cancel): `refreshStatus()` in `bookings.js` recomputes it from
  the payments ledger after every payment, edit and payment deletion.
- `payments` — append-only cash ledger, read back FIFO by `created_at`. `payer_type` is
  `devotee` or `bhuvaji` (Bhuvaji Suresh Bapa can cover part or all of a seat's
  committed amount — the *plan* lives on `sevarthi_bookings.bhuvaji_planned_amount`,
  who *actually* paid lives on each payment row).
- `donations`, `visits` + `visit_escorts`, `users` / `audit_log`, `settings`.
  A `visits` row keeps its **own** `mobile`/`city`, which are an *override* for a
  padhramni held somewhere other than the devotee's usual place — normally they are
  NULL. `GET /api/visits` therefore `LEFT JOIN`s `devotees` and returns
  `COALESCE(v.mobile, d.mobile)` (same for `city`, and the register's current
  `full_name`), keeping the raw values as `visit_mobile` / `visit_city`; without that
  fallback a row picked from the register showed nothing but a date. `GET
  /api/visits/:id` returns the raw columns instead, because the edit form must not
  silently copy the devotee's details onto the visit — it shows them as placeholders.
  The list is ordered **ascending** for anything still to happen (`upcoming=1`,
  `status=requested|confirmed`) because those are queues to work through, and
  descending for `completed` / all, which are a record.

#### Two rules everything else follows

1. **Seat safety is a transaction, not a UI convention.** In `bookings.js` `POST /` the
   fresh capacity re-read, the booking insert and the `booked_count` increment all run
   inside one `db.transaction()`; `POST /:id/reassign` does the same across two slots
   (release the old, re-check and increment the new). better-sqlite3 is synchronous and
   Node is single-threaded, so nothing can interleave. The frontend disabling full slots
   is a UX nicety on top, not the mechanism. Any new path that seats someone must do the
   same, re-reading the slot *inside* the transaction rather than trusting a row fetched
   earlier.
2. **Money is never stored as a total.** A booking's received amount is always
   `SUM(payments.amount)` computed at read time; there is no `amount_paid` column. Never
   add one, and never write a status by hand — record a payment row and call
   `refreshStatus()`.

#### Derived money, in one place

```
committed      sevarthi_bookings.amount_committed
paid           SUM(payments.amount)                        -- both payer types together
bappa support  SUM(payments.amount WHERE payer_type='bhuvaji')
outstanding    max(committed - paid, 0)
excess         max(paid - committed, 0)                    -- preserved, never clamped away
```

`status`: `pending` (paid = 0) · `partially_paid` (0 < paid < committed) · `paid`
(paid >= committed; overpayment stays `paid`) · `cancelled` (seat released,
`booked_count--`). The `paid` badge reads **"Covered"** in the UI (`ui.js` `statusBadge`),
which is the trust's word and the only honest one when Bapa covered the whole amount.

**Outstanding and excess are summed per booking, never netted globally.**
`SUM(max(committed − paid, 0))`, not `max(SUM(committed) − SUM(paid), 0)` — netting lets
one sevarthi's overpayment cancel another's shortfall and under-reports what is left to
collect. That bug was live on the dashboard and the pooja page before this was fixed;
don't reintroduce it by subtracting two totals.

Server-side these come from one query shape (see `poojaStats()` in `poojas.js` and the
`coverage` roll-up in `misc.js`); client-side every screen goes through `UI.coverage(row)`
and `UI.coverageBadges(row)` rather than doing its own `Math.max`. **Bappa Supported** and
**Excess** are indicators derived there — deliberately *not* statuses, so the booking
state machine stays as `db.js` defines it. Read paths that return `amount_paid` also
return `devotee_paid` and `bappa_paid`.

#### Audit

Every create/update/delete/cancel/payment route calls `log(req, {...})` from
`middleware/audit.js`, which writes an `audit_log` row using the acting user's name from
the `X-User-Name` request header.

**There is still no authentication, and the roles are a guard rail rather than security.**
That header is set client-side from whichever operator is picked in the "signed in as"
switcher (`Forms.switchUser`, persisted in `localStorage`), so anyone who can reach the
app can claim to be anyone. `middleware/roles.js` says so at the top, and any change here
must keep saying it: the rail stops an operator deleting a payment by accident on a busy
counter; it does not stop somebody who means to.

The trust's plan is Google Sign-In once the app is deployed with a real database — the
upstream portal (`sc207/svmds`, `_legacy/login.html`) already works that way, with an
administrator registering a Google account by email and no password. **That cannot be
ported while the app has to run offline**: `accounts.google.com/gsi/client` and the token
exchange at `POST /api/auth/google` both need the internet, and at the mandir with no
connection nobody could sign in at all — worse than no login. When it does land,
`middleware/roles.js` is where it plugs in and the route declarations do not change.

**What the roles guard** (`roles.needs(min, what)` — ranked
`operator < accountant < admin < superadmin`), chosen deliberately narrow so an operator
keeps every part of the daily job:

| Guarded | Kept for | Why |
|---|---|---|
| `PUT`/`DELETE /api/payments/:id`, `PUT`/`DELETE /api/donations/:id` | accountant+ | Correcting or removing money already recorded rewrites what the trust holds, rather than adding to it |
| `POST`/`PUT`/`DELETE /api/poojas/*` (including dates and slot seats) | admin+ | The seva list is the shape of the Mahotsav |
| `POST`/`PUT /api/users` | admin+ | Who has an account |

Registering a sevarthi, taking a payment, raising a commitment, changing seva, recording
a padhramni or a donation are all **open to an operator** and must stay that way.

Two rules for adding to this:
  - **A refusal names what to do instead.** A bare "not allowed" leaves someone stuck at
    a counter with a devotee waiting.
  - **Hide it client-side as well** (`UI.can(min)`, the mirror of the same ranks). Being
    offered a button that bounces is worse than never seeing it. The server is still what
    refuses — `UI.can` is only there so nobody meets that refusal.
  - An unknown name resolves to `operator`, the least it could be, rather than to nobody,
    so a fresh install with no `users` row still runs the daily job.

Do not name a middleware factory `require`: a function declaration by that name shadows
Node's own `require` for the whole module, and the requires at the top of `roles.js`
silently called the middleware instead, failing everything with
`userOf is not a function`.

#### API surface

| Mount | Endpoints |
|---|---|
| `/api/lookups` | `GET /` · `POST /` · `PUT /:id` (rename) · `DELETE /:id` (soft) |
| `/api/devotees` | `GET /` · `GET /:id` (profile: bookings + donations) · `POST /` (upsert by mobile) · `PUT /:id` |
| `/api/poojas` | `GET /categories` · `GET /` · `GET /:id` (slots + FIFO ledger) · `POST /` · `PUT /:id` · `PUT /:id/dates` · `PUT /:id/dates/clear` · `PUT /slots/:slotId` · `DELETE /:id` |
| `/api/bookings` | `GET /` · `GET /:id` · `POST /` (optional `payment`) · `PUT /:id` · `POST /:id/cancel` · `POST /:id/reassign` |
| `/api/payments` | `GET /` · `GET /by-day` · `GET /outstanding` · `POST /` (single **or** split) · `PUT /:id` · `DELETE /:id` |
| `/api/donations` | `GET /` · `POST /` · `PUT /:id` · `DELETE /:id` |
| `/api/visits` | list / create / update / delete |
| `/api` (`misc.js`) | `GET /dashboard` · `GET /calendar` · `GET`/`PUT` `/settings` · `GET`/`POST`/`PUT` `/users` · `GET /audit` · `GET /translate/status` · `POST /translate` · `POST /translate/warmup` |

`POST /api/bookings/:id/reassign` moves a booking to another slot/pooja while keeping
its payment history on the same booking id — prefer it over cancel-and-recreate when a
sevarthi changes seva.

**Everything you can do to a booking has to be reachable from the devotee too.** The
Payments page is organised around collecting, but the operator's other entry point is a
person walking in and asking by name, and that lands on the Devotee register. Its profile
listed a devotee's seva as rows with `cursor:default` and no actions at all — Change Seva,
Collect, Edit and the ledger existed only on Payments, so the natural route to "I want to
move my seva" was a dead end. A seva row in the profile now carries all four.
`paymentForm`, `editBooking` and `reassignBooking` take an `{ onSaved }` option
(`afterBookingChange` in `forms.js`): given one they call it instead of closing the sheet
and repainting the page behind, which is how the profile puts the operator back on the
profile rather than on whatever page happened to be underneath.

Related, and the same bug twice: **"+ Seva" carried the devotee id in its markup and the
handler ignored it**, so `Forms.addSevarthi()` opened blank and asked who it was for —
about the person whose row had just been clicked. One `sevaPreset(d)` in `devotees.js` now
feeds all three callers (list row, profile, "Save & add seva").

#### Everything the trust enters, the trust can correct

The operator must be able to fix any entry — a standing requirement, not a feature
request. What each correction has to preserve:

| Change | Route | Rule it must keep |
|---|---|---|
| Re-date a pooja, even a live one | `PUT /poojas/:id/dates` | Days re-date **by position**: old day one becomes new day one. Bookings hang off the slot id, so sevarthi travel with their day. Refuses to shorten a range over a day that still has bookings, naming those days. |
| Un-date a pooja | `PUT /poojas/:id/dates/clear` | Back to "not decided"; bookings pool onto the single undated slot. |
| Seating mode | `PUT /poojas/:id` | Rebuilds the slots, so only while nothing is seated. |
| Registration capacity | `PUT /poojas/:id` | Only rewrites slots when the decision actually changed (see the tri-state section). |
| Delete a pooja | `DELETE /poojas/:id` | Only while no bookings exist — otherwise close it, which keeps the history. |
| Correct a payment | `PUT /payments/:id` | Re-runs `refreshStatus()` and audits before/after. The ledger stays the source of truth; never hand-set a booking total. |
| Correct a donation | `PUT /donations/:id` | Keeps the receipt number and audit trail that delete-and-retype loses. |
| Rename a list entry | `PUT /lookups/:id` | Devotees reference the row by id, so one rename fixes every devotee. Refuses a name already in that list. |

When a correction genuinely cannot be allowed, the error says **what to do instead**
(move the sevarthi, close rather than delete). A bare refusal leaves the operator stuck.

Re-dating runs in one transaction that first NULLs every `slot_date`, because
`UNIQUE (pooja_id, slot_date)` would otherwise collide halfway through a one-day shift;
several NULLs never conflict in a SQLite unique index.

### Seating: `seating_mode` and `fixed_capacity`

Easy to get wrong, and it changes what a "day" means:

- `seating_mode = 'per_day'` — the patla count applies to **each** day, so a 6-day katha
  with 100 patla seats 600. One `pooja_slots` row per calendar day.
- `seating_mode = 'whole'` — the count is the total for the **entire** event; one
  sevarthi holds that patla every day. The Maha Yagna tiers work this way (there is one
  Mukhya Patlo, not one per day). A `whole` pooja keeps a **single pooled slot**, so its
  slot count is not its day count — `withStats()` in `poojas.js` recomputes `day_count`
  from the date range, and `GET /api/calendar` draws it across its range separately from
  per-day poojas.
- `fixed_capacity = 0` means open seating; its slots carry `capacity = NULL`.

### Frontend (`public/`)

- Script load order in `index.html` matters and is intentional: `lang.js`, `api.js`,
  `ui.js`, `print.js`, then every `pages/*.js` (each registers itself as
  `window.Pages.<key> = { render(host, params) }`), then `forms.js`, then `app.js` last
  (the router, which reads `window.Pages`).
- `app.js` is a hash-based router: a `PAGES` registry (`{ key: { title } }`) maps a hash
  segment to a page module. **To add a new page**: create `public/js/pages/x.js`
  exporting `global.Pages.x = { render }`, add its `<script>` tag to `index.html`, add
  an entry to `app.js`'s `PAGES` map, and add a nav link (`data-page="x"`) in the
  sidebar/mobile-nav markup in `index.html` (and, if it belongs there, the `moreMenu()`
  list in `app.js`). `window.navigate(page, ...params)` and `window.refreshPage()` are
  the globals pages use to move around / re-render themselves after a mutation.
  **There is ONE menu.** The sidebar is it, on every width — below 1200px as a drawer,
  reached from the hamburger *and* from "More" in the bottom bar. There used to be two:
  the drawer, and an "All sections" sheet behind More, with different labels for the same
  pages ("Padhramni" against "Bappa / Bhuvaji Padhramni"), a different order, and the
  **same hamburger glyph on both buttons** — so the app had two menus that disagreed and
  no way to tell them apart. `moreMenu()` is gone; a new page goes in the sidebar markup
  and nowhere else.
- **Every entry sheet follows the same four rules, and the kit that enforces them
  lives in `ui.js`.** The trust's verdict on the first version was that entering things
  felt congested and hard, and the screenshots agreed: Add Seva asked its eight devotee
  fields on step one *and again* on step four, its only footer button was "Close" (so
  the action that actually moved the flow on was a seva card below the fold), every
  optional field was as loud as the two required ones, and inputs were 0.9rem/40px —
  which mobile Safari zooms into on focus. The rules, each borrowed from where admin and
  ERP systems settled long ago:
    1. **The footer carries the one action that moves the flow on.** `UI.sheetFooter(html,
       binds)` replaces the footer between steps — a "next" that lives in the scrolling
       body reads as no next at all. It wires `[data-sheet-close]` for you.
    2. **A multi-step sheet says where you are.** `UI.steps(labels, current)` +
       `UI.bindSteps(root, goStep)`. A finished step is a real `<button>`: going back to
       fix a name must never mean starting over.
    3. **Ask the required fields; fold the rest away.** `UI.moreFields(label, inner,
       {open, count})` is a native `<details>`, so the fields stay in the DOM and
       `readForm` still collects them (`folded.js` proves every folded field round-trips
       to the API). A block that already holds an answer **opens itself** — a value the
       operator cannot see is a value they cannot check — which is why editing an
       existing record opens its detail and adding a new one does not.
    4. **Open with what the entry is against.** `UI.contextCard({title, badge, sub,
       rows})` — the header Record Payment always had, now on every sheet. `rows` take a
       `'is-due'` class for the figure that is owed.
  Also: `UI.bindEnterFlow(form, onLast)` walks Enter through the fields and fires the
  primary action on the last, and `#sheet` widens to 880px with 16px/48px inputs
  (`app-extras.css`, "DATA ENTRY"). Add Seva is the reference implementation — three
  steps, no field asked twice, and the day screen shown only when a seva really has a
  choice of days.
- **A picker inside a form previews, it does not dump.** Add Seva's matching-seva
  list is ranked best-fit first and shows eight with a "Show N more seva" button; all
  thirty-five buried the form's own fields under a wall of cards. (It was five while
  that list shared a screen with the devotee form; it is a step of its own now.)
  Collapse it again when the category filter changes. The same principle, different
  mechanism, applies to a long *selection* list like the invitation checklist: that
  scrolls in its own box rather than paging, because paging a multi-select means
  hunting for your ticks across pages.
- **Page-level forms pair their fields into `.form-row` columns** and put buttons in a
  `.form-actions` row at natural width. A card in the content column is ~1300px wide,
  so one field per line leaves it half empty and a `btn-block` Save spans the lot.
  Settings is the only page-level form; every other form lives in the sheet.
- **Two shapes of list, and which one a page gets depends on the job.**
  *Cards* (`UI.expandableRow`) suit a page you read one row at a time — Padhramni is a
  diary, Donations a receipt book. *A table* (`UI.dataTable` + `UI.bindDataTable`) suits
  a page you work down comparing rows, which is Payments and the Devotee register. Both
  keep the same disclosure panel underneath, and `UI.bindExpanders` drives both: a table
  row carries `dt-row row-item` and its panel `dt-more row-more`, so everything written
  against the card shape — the `[hidden]` rule, `is-open`, the checks that ask whether a
  row's panel is open — works unchanged. The panel is a **sibling `<tr>`**, not a child,
  which is the one thing that differs; `row.nextElementSibling` is how you reach it, and
  `bindExpanders` uses `(row.closest('.list-row') || row)` for the same reason.
  The trust asked for this in as many words — those two pages "feel hard to manage" —
  and the cause was structural, not decorative: their collapsed row put a name and a
  mobile at the far left and one figure at the far right with ~800px of nothing between,
  so a screenful gave no column to run an eye down and no way to compare two people. All
  the figures were in the panel, one row at a time. Padhramni reads well by contrast
  because it carries five things in fixed positions across the line — a table already.
  A column with `type: 'money'|'num'` is right-aligned and tabular and takes only the
  width its digits need (`width: 1%`), which hands the slack to the columns holding
  words; `sortable: true` makes the heading a button. Under 860px the same markup stacks
  and each cell prints its own heading from `data-k`, so the phone can never drift from
  the desktop. `hideOn: 'sm'` drops a column there rather than squeezing it.
- **Once a list can be sorted, the export follows the sort.** The rule was "export what
  the filter says, not what the screen shows"; the order the operator put the list in is
  part of what they are asking for, and a sheet that comes out in a different order than
  the screen cannot be checked against it. `exportSpec()` sorts, and stamps "Sorted by"
  into the meta alongside the filter. `parity.js` catches a regression here as a false
  "column not shown on screen", because it compares the CSV's first row against the
  screen's first row.
- **Busy list rows disclose progressively — `UI.expandableRow(summary, detail, opts)`
  plus `UI.bindExpanders(root)`.** Payments, the devotee register and Padhramni all use
  it. The collapsed strip carries only what the page's job needs in order to *choose* a
  row, and one primary action; everything else opens underneath. What each page leads
  with is a deliberate answer to "what is this operator doing":
    - **Payments** — collecting, and a table: Sevarthi (with badges and mobile), Seva,
      Contribution, Paid, Bapa, Outstanding, then `Collect`. Every figure sorts. The
      panel holds the registered/last-paid dates and Bapa support / ledger / edit.
    - **Devotee** — identifying a person, also a table: Devotee (badges + mobile), From,
      Seva, Contributed, Outstanding, then `Profile`. The panel holds the full money
      band, donations, padhramni count, register date, the note and + Seva / Edit. Its
      sort select stays: it offers "Recently added", which is not a column, and clicking
      a heading moves the select with it so the two can never disagree.
    - **Padhramni** — a diary, not a register. Name + status, mobile, place, purpose,
      and a `.lead-fig` toned by how soon (`UI.whenDay` → Today / Tomorrow / In 3 days /
      overdue), plus the single next step (`Confirm` → `Mark done`). The panel holds
      address, escorts, samaj and notes.
  The whole summary strip toggles, not just the chevron; `bindExpanders` ignores clicks
  that started on a `button`/`a`/`input`/`select` so row actions still act. Panels get
  unique generated ids, so re-bind after every repaint (a page change, a re-sort).
- **`[hidden] { display: none !important }` is set once at the top of `app-extras.css`,
  and must stay there.** Any class that sets `display` outranks the UA's own `[hidden]`
  rule, so `el.hidden = true` sets the attribute and changes nothing on screen — the
  "hidden" block renders alongside the visible one and the toggle looks broken for no
  reason a console would show. This caught the codebase four times before the rule went
  in (`.annc-overlay` and `.sheet` each patched it for themselves, then `.row-more`,
  then `.form-group` on the split-payment fields). Anything that must stay visible while
  carrying the attribute has to say so explicitly, the way `.dv-inline-form:not([hidden])`
  does. A toggle that "does nothing" is almost always this.
- **Row anatomy for the *card* list pages** (`.fig-band` + `.fig`/`.fig-k`/`.fig-v`,
  `.collect-meta`, `.collect-when`, `.lead-fig`/`.lead-k`/`.lead-v`, in
  `app-extras.css`): a title line, a wrapping meta line, a tinted band of *labelled*
  figure cells, then when it happened. Padhramni and Donations use this; Payments and
  the Devotee register moved their figures into table columns and keep only
  `.collect-when` and the actions in the panel.
  Three rules learned the hard way: never put figures on one run-on line (they become a
  wall of digits with no column to scan); never leave `.row-sub`'s ellipsis on a meta
  line that carries a mobile number or samaj — it cut off exactly what the operator
  rings; and `.lead-v` inherits `--font-heading` (Cinzel), which renders lowercase as
  small caps — right for a figure, wrong for a phrase like "In 3 days", so the padhramni
  lead overrides it back to `--font-body`.
- **The sidebar is an off-canvas drawer below 1200px, and `setDrawer` in `app.js` owns
  everything that follows from it being open.** It used to only know how to open: tapping
  a link inside it navigated and left the drawer sitting over the page you had just asked
  for, there was nothing to tap outside it (Escape worked, which is no help on the phone
  and tablet the layout exists for), and the page behind stayed scrollable. One function
  toggles the class, the `#sidebarScrim` and `body.drawer-open` together, and a
  `hashchange` listener closes it on *any* navigation — the drawer, the bottom bar, the
  More sheet or a card on the page.
- **A rule that neutralises a class for the table layout has to be scoped to it.**
  `.dt-row`/`.dt-more` also carry `.row-item`/`.row-more` so the shared disclosure
  machinery works on them, and those are styled for cards — so the card styling is undone
  in `app-extras.css`. The `display: table-row` half of that must sit inside
  `@media (min-width: 861px)`: left global it beat the stacking rules, because
  `table.dt tr.row-more` is the more specific selector, and the panel stayed a table-row
  inside a block-level table — shrinking to fit its own text at 250px of a 384px row,
  with the card's white showing down the side of it.
- **A grid of seven columns needs about 900px before a named chip reads as a word.** The
  Universal Calendar's day chips were "Pad…", "1 pa…", "Don…" at phone and tablet-portrait
  widths — a month of truncated text that says nothing. Below 900px the chips become
  coloured dots and the whole day cell jumps to that day in the agenda list already under
  the calendar, which is where the detail lives. Note the layout sweep walked past this
  and was right to: those chips truncate with `text-overflow: ellipsis`, which everywhere
  else means "cut on purpose". Some things only a pair of eyes finds.
- **An undated slot must never be interpolated raw into a sentence.** The audit trail read
  "added as sevarthi — Pothi Yatra on null", because `slot_date` is legitimately NULL
  before the trust fixes a date. `slotWhen()` in `util/dates.js` is the one place that
  turns it into words; every audit summary and error that names a slot's day goes through
  it.
- **Touch targets are raised under `@media (pointer: coarse)`, never globally.** Measured
  at 390 / 768 / 1024 / 1440, nothing scrolls sideways and nothing is clipped, but a lot
  of controls are 26–29px tall and several are 16px squares — right for a mouse on a
  dense list page, a miss under a thumb. The minimum (44px, width as well as height:
  an icon-only button is tall enough and still 39px across) applies only where the
  pointer is coarse, so a desktop keeps the density the list pages were designed around.
  It costs vertical room, which on a phone came straight out of the list, so the chrome
  above tightens at the same breakpoint to give it back.
  `responsive.js` is the sweep. Note that `Emulation.setDeviceMetricsOverride`'s `mobile`
  flag resizes the viewport but leaves the pointer **fine** — without
  `Emulation.setTouchEmulationEnabled` the coarse rules never match and the sweep quietly
  reports on rules it is not exercising.
- **A stacked table must undo the widths the table layout gave it.** `table.dt th.n/td.n`
  carry `width: 1%`, which is what shrinks a figure column to its digits while the table
  is a table. Below 860px every cell becomes a grid item and 1% of the row is two pixels;
  the figures still *showed*, because they overflow visibly, so nothing looked wrong —
  each simply sat in a 2px box and spilled across its neighbour's column.
- **A list page is opened to see the list, so the list has to be on the first screen.**
  Measured at 390×844, the first row of data sat at 900px on Payments, 1028 on the
  Devotee register, 965 on Padhramni and 871 on Donations — every one below the fold, so
  opening a page on a phone showed a title, two export buttons and a column of totals and
  not one sevarthi. Three things were eating it, and `app-extras.css` fixes each where it
  lives: the figure strip's `auto-fit minmax(220px)` collapsed to one column, so four
  figures became four ~100px cards each carrying a 40px disc (now a 2×2 compact grid
  under 560px, discs shrunk); the two export buttons took a whole row for words nobody
  reads (icon-only under 560px, names kept in `title`/`aria-label`); and the Devotee
  register's three filter selects stacked full-width (two to a row now). It is 682 / 752 /
  732 / 621 today. **When adding anything above a list, re-measure at 390px** — the
  numbers come from `pagescan.js`, which reports where the first row lands and whether it
  is above the fold.
- **A class that looks wrong may be one the theme already owns.** The `app.css` trap runs
  in both directions: a class can look *unstyled* because it was only ever defined in that
  dead file, and it can look *wrong* because `styles.css` already has a component of that
  name. Our two export buttons were `.export-bar`, which is the portal's own bordered
  CSV/Excel/PDF pill (`display:inline-flex`, white background, border, `width:100%` under
  its breakpoints, with `.export-bar-label` / `.export-bar-btn` children). Our plain row
  had been sitting inside that pill since it was written; nothing looked wrong while the
  buttons were full-width text and filled it edge to edge, and it appeared as an empty
  bordered slab the moment they shrank to icons. It is `.ex-bar` now. Before naming a new
  class, grep `styles.css` for it.
- **A devotee's money can exist without a live booking.** `booking_count` excludes
  cancelled seats but `total_paid` does not, so a devotee whose only seva was cancelled
  has payments and no bookings. Gating a row's figures on `booking_count` alone hides
  that money; gate on `total_paid` too, and `cancelled_count` says why it is there.
- **Long lists page through `UI.paginate` / `UI.pager` / `UI.bindPager`** (25 a page,
  `UI.PAGE_SIZE`) — the devotee register, a pooja's sevarthi ledger, the collections
  list and the audit trail all use the same helper so they behave alike. `paginate`
  clamps a page that a filter change left past the end; `pager` renders nothing when
  everything fits on one page, which is why it is invisible on short lists. Reset the
  page to 1 whenever the filter or search changes, and keep the fetched rows in module
  state so paging does not re-hit the API.
- **The splash loader is inline in `index.html`, deliberately.** Ported from the trust's
  portal (`sc207/svmds`): the mandala, the progress bar, the cycling invocations. It
  lives in a `<style id="loaderStyle">` and a `<script>` *before* the stylesheets and
  page scripts so it paints on the first byte, and the SVG is inline — nothing about it
  waits on a download, which is what makes it useful rather than decorative. `<html>` and
  `<body>` both ship `class="is-loading"` in the markup (the portal only sets `body`;
  putting it on `html` too closes the gap before the script runs) and the script removes
  both when it clears.
  Closing is gated on **three** things, one more than the portal: the window `load`
  event, the invocation cycle finishing naturally, and `window.__appReady()`. The third
  exists because this is a single page whose first screen is fetched *after* the scripts
  run — `load` fires while the dashboard is still skeletons, so the portal's two gates
  would lift the splash onto a half-drawn page. `app.js` calls `__appReady()` at the end
  of its first `render()`, on the error path as well as the success one, and nulls it so
  later navigations never re-arm it. A `setTimeout` guard lifts the splash regardless
  after ~8s, so a dead API or a throw in `app.js` can't trap the operator — that path is
  covered by a test that blocks `/api/dashboard` outright.
  `window.__boot(pct, msg)` is the progress hook; the `<script>` tags between the page
  bundles call it. It is defined by the loader, so always call it guarded
  (`window.__boot && window.__boot(...)`).
- **Every list exports itself — `export.js`, one column list, two outputs.** A page
  declares `EXPORT_COLUMNS` once (`{ key, label, value(row), type }`) and an
  `exportSpec()`, then calls `Export.toolbar(id)` in its heading and
  `Export.bindToolbar(host, exportSpec)` after render. Payments, the devotee register,
  Padhramni and Donations all do. `type` is `money` / `num` / `date`, plus `nowrap` for
  a short label; it decides both how a cell prints and whether the CSV writes it bare.
  Three rules the implementation exists to enforce:
    - **Export what the filter says, not what the screen shows.** Lists page at 25 rows;
      `exportSpec()` reads the page's own module state, so the file carries every
      filtered row. It is called at *click* time, not render time, so it always
      reflects the filter and search as they are now.
    - **Stamp the filters on.** `meta` becomes rows above the CSV header and a line
      under the printed title. A sheet that says "32 sevarthi" without saying "still to
      collect" cannot be checked a month later.
    - **Amounts are numbers in the spreadsheet, formatted only on the printed copy.**
      `₹21,00,000` in a CSV cell is a string Excel cannot sum.
  The CSV is the "Excel" export deliberately: no library is fetched at runtime, which
  the offline rule forbids. Two details that are not optional — the file is written with
  a **UTF-8 BOM** (without it Excel renders every Gujarati name as mojibake), and a cell
  beginning `= + - @` is prefixed with an apostrophe, because a devotee's note would
  otherwise be executed as a formula when the file is opened.
  The PDF is the browser's own print engine via `openPrintDoc` — jsPDF/html2canvas need
  a CDN, so there is no other option offline, and none is needed.
  **A sheet of paper is not a spreadsheet, and the printed copy says so.** A4 landscape
  is about 277mm; the devotee register's seventeen columns wanted half as much again,
  and an auto table layout cannot shrink below its min-content width, so the last
  columns were simply cut off the page with nothing to say they existed. Three things
  hold it together now, and all three are load-bearing: `table-layout: fixed` (the
  colgroup decides the width, so the table can never exceed the page); a colgroup whose
  weights are **measured from the widest unbreakable run in each column** rather than
  hand-tuned (hand-tuned weights were always one dataset away from being a pixel too
  narrow); and `print: false` on columns that stay in the CSV — the footer then names
  them, so nobody reads the sheet as the whole record. Two rules inside that: `nowrap`
  is decided **per cell, not per column** (`2027-02-04` must not break, but "Date to be
  announced" shares that column and must), and it never applies to a *heading* — "Paid
  by devotee" is a phrase that has to wrap, and forcing it onto one line ran it into the
  next column.
  **Check it in both directions.** `parity.js` asks "is every CSV column shown on
  screen"; `exportgap.js` asks the reverse — what does the API hand the page that the
  export never writes down. The second is the harder one to get right: matching field
  NAMES against column LABELS does not work, because the labels are the trust's words
  (`full_name` is "Sevarthi", `bappa_paid` is "Bapa's support"), so it matches by VALUE
  against the CSV the page actually produced. Two traps it fell into first, both worth
  keeping in mind for any check of this shape: a field that is null on every sampled row
  was never put to the test and must be reported as unchecked rather than absent, and a
  run that lined up no rows at all proves nothing — say so loudly instead of listing
  every field as missing.
  **The export doubles as a specification of what the page must show.** A column that
  carries a value the screen never displays is a gap between what the app knows and what
  it tells the operator, and comparing the two found four: the devotee's note existed
  only as a `title` tooltip (invisible on touch, and the text never on screen), the
  donation's note was not rendered at all, the donations CSV had a phantom `City` column
  (that table has no city and the list does not join the devotee, so it could never be
  anything but empty), and the payments CSV wrote "Not fixed" for an undated seva where
  the screen says `UI.TBD` — one state reading as two. When adding a column, add its
  home on the page in the same change.
- **A filter row marks its active choice with `btn-primary` against `btn-outline`** —
  solid maroon versus outline. Payments, Padhramni and Add Seva's "Matching seva" all
  use it; a new filter row should too. Add Seva's row used to be `.badge` pills whose
  selected state was `.badge-maroon`, which app-extras.css had (wrongly) redefined as
  the same cream as a plain badge — four identical chips with no way to tell which was
  in force. If a "selected" state is invisible, check whether this sheet has overridden
  the variant that was carrying it: it loads last, so anything it redefines wins.
- **`data-page` is reserved by the router.** `app.js` has a delegated
  `document.addEventListener('click')` that calls `e.target.closest('[data-page]')` and
  navigates, so *any* element carrying that attribute anywhere in the app becomes a nav
  link. A pager built with `data-page="next"` silently navigated to an unknown page and
  fell back to the dashboard — the list vanished mid-click with no console error. Name
  page-local hooks something else (`data-pager`, `data-filter`, `data-view`); the same
  applies to `data-action` and `data-sheet-close`, which are also globally delegated.
- `api.js` is the only place `fetch()` is called; every request carries `X-User-Name`
  for the audit log, and it exposes named domain shortcuts (`API.pooja(id)`,
  `API.outstanding(q)`, …) alongside raw `API.get/post/put/del`.
- `ui.js` is the shared UI kit: `openSheet`/`closeSheet` drive the **single** `#sheet`
  modal reused by the entire app — opening a sheet while one is already open replaces
  its content rather than stacking a second dialog, so a nested "+ add new X" flow
  (`bindLookupAdders`) discards the parent form's in-progress state.
  `#sheet` is a **native `<dialog>`** opened with `showModal()`, which is where the
  focus trap, Esc-to-close and top-layer stacking come from. Cleanup hangs off the
  dialog's own `close` event (`teardownSheet`), so Esc, light dismiss and `closeSheet()`
  all leave the same state — never put teardown in `closeSheet()` alone. `styles.css`
  still styles it as a full-viewport `.modal-overlay`, so `app-extras.css` resets the
  UA's dialog box (max-width/height, border, margin) and keeps `::backdrop` transparent
  to avoid dimming twice. Also here:
  `readForm`/`showFieldError`/`clearFieldErrors`, `lookupSelect`, `devoteeField` /
  `bindDevotees` (devotee autocomplete), `bindTranslate` (the `data-translate` button),
  and formatting helpers (`money`, `fmtDate`, `statusBadge`, `progressBar`, `esc`, `attr`).
  All markup is built as template strings — **always** pass interpolated values through
  `UI.esc()` (text) or `UI.attr()` (attribute values). And **never put a backtick inside
  one**, including in a CSS or JS comment: it ends the string there, and everything
  after it parses as code. A backtick around a class name in a comment inside
  `export.js`'s `PRINT_CSS` produced `ReferenceError: tight is not defined` at load and
  took the whole `Export` module with it — `node --check` passes, because the file is
  still valid JavaScript, just not the JavaScript you meant.
- `forms.js` holds multi-step flows reachable from more than one place (`addSevarthi`,
  `addPayment`, `editBooking`, `cancelBooking`, `reassignBooking`, `bookingHistory`,
  quick-add menu, global search, lookup adders, user switcher) — kept separate from
  `pages/` because they're invoked from many pages rather than routed.
- `print.js` (`openPrintDoc`) opens a print window that **links** the real stylesheets,
  so printed output matches the screen. It takes `{ title, wrapClass, inner, css }` —
  the same shape the portal's `printInvitationHTML` uses, which is why that print
  pipeline ported over unchanged.
  **It must undo the app shell's geometry, and that is not optional.** `styles.css`
  opens with `html, body { height: 100%; max-width: 100vw; overflow-x: hidden }` — right
  for an app shell, ruinous once the same sheet is linked into a print window:
  `height: 100%` is exactly one page box, so everything past the first page was clipped
  and Chrome reported "Total: 1 page" however many rows there were. A 50-row payments
  export printed as 1 page instead of 5, and the *invitation* was silently broken the
  same way — a whole samaj's cards came out as a single card. `openPrintDoc` now resets
  height/max-width/overflow before anything else, in both screen and print media.
  The viewport units are reset with it, so a print window opened from a phone does not
  size itself from that phone: the same report must produce the same PDF on any device,
  which `pdfparity.js` checks by rendering at 390 / 820 / 1440 and comparing page count,
  row count and laid-out height.
  Diagnosing this needs `Page.printToPDF` over CDP and a count of `/Type /Pages`, not
  the DOM — the clipping is invisible to `scrollHeight` in screen media, and the only
  honest question is how many pages the PDF actually has.
- `pages/invitation.js` is the **universal (combined) invitation**, ported from the
  portal's `public/js/invite-ui.js`: tick any number of poojas and it builds one
  certificate-grade A5 card listing them as a programme, split across further pages
  when the list is long, optionally addressed to every devotee in a samaj/category.
  The card design is **already in `styles.css` in full** (`.pj-invite--royal /
  --cream / --festival / --civ`, `.civ-layout`, `.inv-page`, the corner marks, mandala
  watermark and A5 print rules), so this file only emits the markup those rules
  expect. Don't restyle the card, and check `styles.css` before adding invitation CSS.
  Three adaptations to our data, each deliberate: the portal models sessions with
  clock times where we have only a date range, so its "show session time" switch is
  not carried over; its personalised cards address committee members and ours address
  devotees by samaj / devotee category, there being no committee module until Phase 2;
  and its PDF/ZIP export needs jsPDF + html2canvas from a CDN, which the offline rule
  forbids — the print window's "Save as PDF" writes the same A5 pages.

### CSS — read this before changing styles

- `public/css/styles.css` is the mandir's own existing portal stylesheet, copied in
  **unchanged** (~4000 lines) — the design tokens (`--primary-maroon`, `--radius-md`,
  etc.), typography, and most component classes (`.card`, `.stat-card`, `.modal-*`,
  `.form-*`) live here.
- `public/css/app-extras.css` holds only what `styles.css` doesn't have (patla slot
  grid, sevarthi ledger, EN/ગુ switch, etc.). New app-specific styling belongs here,
  reusing `styles.css`'s existing custom properties rather than inventing new ones.
- **`styles.css` is the upstream theme, and the trust wants it kept.** It is
  byte-identical to `public/css/styles.css` in
  [sc207/svmds](https://github.com/sc207/svmds) apart from one line: the Google Fonts
  `@import` is swapped for `/css/fonts.css`, because the app has to work with no
  internet at the mandir. Re-pulling from upstream means re-applying that one swap and
  nothing else. There was briefly a `theme.css` layer that restyled the type and
  shapes to a flatter, sans-headed look; the trust chose the original portal look, so
  it was **removed**, deliberately deleted rather than left unlinked — an unlinked
  stylesheet is exactly the `app.css` trap below. Only two sheets are linked:
  `styles.css` then `app-extras.css`.
- **A class that renders as a plain grey button is almost certainly undefined.** A bare
  `<button>` with no background rule shows the UA's own `buttonface` grey, which at 16px
  reads as a faint square nobody questions — `.icon-btn`, used twelve times across
  `forms.js`, `ui.js`, the calendar, donations and mahotsav, was defined only in the dead
  `app.css` and had looked like that all along. It only became obvious when touch targets
  took it to 44px and it turned into a grey slab beside every row. Now in
  `app-extras.css`, like the seven before it.
- `public/css/app.css` **exists on disk but is not linked from `index.html`.** It's a
  leftover, self-contained earlier design system (its own `--maroon` token set, its own
  `.stat`/`.stat-ico`/`.rail`/`.sheet`/`.topbar` classes) from before the app adopted
  `styles.css` as its base. Editing it has no visible effect. If a class a `pages/*.js`
  template renders appears completely unstyled, check whether it was only ever defined
  in this dead file before assuming the class name is wrong. This keeps happening:
  `.stat`/`.stat-ico`, then `.btn-danger` (so every destructive confirm button looked
  neutral), `.field-row`, `.cal-head`/`.cal-month`, `.badge-ico`, `.user-chip` and
  `.loading` — all since ported into `app-extras.css`. The failure is silent, because
  an undefined class is not an error: after adding markup, diff the classes the
  templates emit against the three linked sheets rather than trusting the page to look
  wrong in an obvious way.
- A related trap: parts of `styles.css` were written for **emoji** glyphs, which its
  `text-align: center` centred for free. This app renders SVG sprites instead and
  `.ico` is `display: block`, so such a rule leaves the mark hard left — that is what
  happened to `.mg-empty-mandala` on every empty state (fixed in `app-extras.css`).
- Nothing capped the content width until `app-extras.css` set `max-width` on
  `.content-wrapper`. Without it, list rows stretch the full monitor and their two ends
  drift apart — a date at the far left and its amount at the far right. Keep the cap.
- Icons are SVG sprite references (`/assets/icons.svg#name`, via `UI.icon()`), never emoji.
  **The sprite is served `no-cache`, and must stay that way.** It is app code wearing a
  picture's file extension: it changes whenever a screen gains an icon, and a `<use>`
  pointing at a symbol the browser's cached copy does not have paints a silent empty box
  — nothing on screen, nothing in the console. It was lumped in with photographs at
  `max-age=604800`, so when `wallet`, `user-check` and `trending-up` arrived in one
  commit, three of the dashboard's five figures showed blank discs for a week to anyone
  holding the older sprite. Fonts and images still cache hard, because those are replaced
  by adding a new file rather than by editing the old one.
  **Check icon names in BOTH directions, and include the server.** A name can reach the
  UI from the API — `CATEGORIES` in `poojas.js` gives each Mahotsav category an `icon` —
  so a scan of `public/` alone will call such a symbol unreferenced. That is exactly how
  `flame` came to be deleted as "never used once" while the Maha Yagna card sat empty.
  A live check is the other half: `getBBox()` is 0×0 on an unresolved `<use>`, whatever
  its computed colour, size and visibility say.

### Language

Two independent mechanisms, deliberately not unified:
- `public/js/lang.js` is a hand-written EN/Gujarati table for the app's own UI chrome
  (nav labels, buttons, headings), applied through `data-i18n` attributes and
  `Lang.translateTree(host)` after each page render — instant, offline, exact temple
  vocabulary. It never touches devotee names, pooja names, or amounts.
- `server/translate.js` runs NLLB-200 locally (via `@huggingface/transformers`, model
  cached in `models/`) to translate **free text a person types** (notes, descriptions),
  with a glossary in that file protecting temple/place terms from being mistranslated
  (without it સાનંદ came back as "serenity"). Its regexes deliberately omit `\b` — JS
  word boundaries only know Latin characters and never match around Gujarati text.

When adding a translatable field, pick the mechanism based on whether it's static app
copy (`lang.js`) or user-entered text (the `data-translate` attribute + `translate.js`).

## Domain context — Phase 1 is registration, not seating

The principle the trust has set: **first collect the truth, then use the truth to plan.**
Phase 1's job is getting every devotee and every sevarthi registration into the system,
with money tracked against it. Seating, dates and capacity planning are Phase 2.

Priority order for this phase: **(1)** get every devotee plus their chosen seva and a
committed amount in first — the exact date can be decided later, once things are
confirmed; **(2)** collect payment against what's already entered; **(3)** let a
sevarthi raise an existing commitment (`PUT /api/bookings/:id`) or move seva
(`POST /api/bookings/:id/reassign`); **(4)** the "who hasn't paid yet" view, which is
now the **Payments page's default tab** (see below); **(5)** arranging sitting by date
and headcount remains a later concern, not a blocker for this phase.

### The Payments page is a collections workbench, not a cash book

`pages/payments.js` has **one view**, and it answers "who still owes". It lists every
sevarthi with contribution / paid / Bapa / outstanding, filtered by Still to collect ·
All · Pending · Partial · Covered · Bappa supported · Excess, paginated at 25 rows,
with the actions that follow from a row on the row: Collect, Bapa support (opens the
payment sheet already pointed at Bapa via `Forms.paymentForm(id, { payer_type:
'bhuvaji' })`), ledger, edit registration, view devotee.

It used to be a month-by-day cash book, then that book as a second "Received" tab.
Both are gone at the trust's direction: the filters reach the same payments, the
Universal Calendar already shows each day's takings and the dashboard the daily and
monthly totals. **Don't rebuild it as the front door.** The one thing only the cash
book could do — correct or remove an individual payment entry — lives in
`Forms.bookingLedger(bookingId, onChanged)`, the per-sevarthi ledger on every row:
coverage summary, every payment with correct/remove, then the change history. If that
ledger is ever removed, `PUT`/`DELETE /api/payments/:id` lose their only caller and a
mistyped payment becomes uncorrectable.

Status (`pending`/`partially_paid`/`paid`) is the booking's own; *Covered*, *Bappa
supported* and *Excess* are derived per booking through `UI.coverage`, which is why
they are filters rather than statuses.

**Two axes, not one.** The status chips say what state a registration is in; two selects
beside them say which part of the Mahotsav it belongs to — category (`pooja_events
.category`, the three hardcoded keys) and then the seva within it (`pooja_id`). They
narrow together, because "still to collect, on the Maha Yagna" is a question the trust
actually asks. Three things make them usable rather than another two dropdowns:
  - **Both are built from the bookings in hand, with counts** — never from the full seva
    list. A dropdown of seventy-five poojas, most of them with nobody on them, is a worse
    way to find one than the search box. Everything is client-side: `GET /api/bookings`
    already returns `category`, `pooja_id` and `pooja_name` on every row, so no round
    trip and no API change.
  - **Changing the category clears the seva**, which belongs to exactly one category —
    otherwise the pair is unsatisfiable and the page just goes empty with no clue why.
    For the same reason the empty state names whichever narrowing emptied it.
  - **The headline totals follow the category/seva scope but not the status chips.** The
    chips are "which of these do I work through next", so the totals stay the size of the
    whole job; the scope is "which part of the Mahotsav am I looking at", so the totals
    have to move with it or the filter cannot be used to check anything. The strip says
    which scope it is for.
`exportSpec()` stamps Category and Seva alongside Filter and Sorted by.

**One handover is often split** — the sevarthi hands over part and Bapa covers the
rest — and that is **two ledger rows**, because `payer_type` lives on the row and the
two totals must never be merged into one. `POST /api/payments` therefore takes either
shape, and writes both rows in a single `db.transaction()` so a split can never land
half-recorded:

```
single: { booking_id, amount, payer_type }
split:  { booking_id, devotee_amount, bhuvaji_amount }      -- a zero side is omitted,
                                                            -- never written as a ₹0 row
```

It returns `{ payment, payments[], booking_status }`; `payment` is the first row, kept
for callers that expect one. Each row is audited separately and stays separately
correctable through `PUT /api/payments/:id`, so the trail reads the same whether the
money arrived in one visit or two. Both shapes are parsed by
`server/util/payment-entries.js` rather than by either route, so the two can never drift
on what a valid payment is; `insertPaymentRows` deliberately opens **no** transaction of
its own, because the booking route has to write the seat, the capacity increment and the
payment inside one. Don't collapse a split back to one amount plus a payer flag — that
is what forced the operator to save twice.

**Money is recorded where it is handed over, never "come back for it later".** Anywhere
a commitment is made or changed, the cash can go in with it:

| Flow | How |
|---|---|
| Add Seva | `POST /api/bookings` takes an optional `payment` (same two shapes) and writes it in the *same* transaction as the seat — a booking that kept the patla but lost the cash would be worse than either failing. Audited as a payment in its own right. |
| Edit Sevarthi | Raise the commitment and take the increase in one save. The `PUT` lands **first**, then the payment: money must never be recorded against a commitment the save then failed to raise. |
| Record Payment | Devotee / Bapa / **Both**, as above. |
| Add Devotee | "Save & add seva" hands the new devotee straight to Add Seva (via the `inquiry` preset) instead of stopping at the register. |

The shared UI for this is `paidNowField()` / `bindPaidNow(form, dueOf)` /
`readPaidNow(data)` / `stripPaidNow(data)` in `forms.js`. Its field names are prefixed
`paid_*` so the block can sit in a form that already has an `amount` of its own (Add
Seva's Total Contribution), and `stripPaidNow` keeps them out of the parent payload.
`dueOf()` is a callback, not a number, because in Add Seva the due is the contribution
field the operator is still typing into.

**A form that mentions Bapa twice has to say why.** The contribution step asks about
Bapa in two places and must: `bhuvaji_planned_amount` is what Bapa **agreed to cover**
— a promise on the booking, no money moved — and `payments.payer_type = 'bhuvaji'` is
what Bapa **handed over**, a ledger row. Different facts with different lifetimes: Bapa
can promise today and pay next month, or pay having never promised. But a checkbox
reading "Bapa is covering part of the amount" above a payer button reading "Bapa" looked
like one question asked twice, and the trust said so. Three things keep them apart, and
all three matter:
  - **The words name the difference** — "Bhuvaji Suresh Bapa has agreed to cover part of
    this" / "Bapa's agreed share" / "What was promised, not what has been handed over"
    against "Who handed it over". Each block carries `data-block="agreement"` or
    `"handover"`, which `app-extras.css` turns into a quiet eyebrow so the eye sees two
    questions before it reads either.
  - **The handover is derived from the agreement** (`bindPaidNow`): Bapa covering the
    whole contribution defaults the payer to Bapa, covering part defaults it to Both
    with each side prefilled, covering nothing leaves it on Devotee. `paymentForm` had
    always done this from `bhuvaji_planned_amount − bappa_paid`; the inline "paying now"
    block did not, so it defaulted to the devotee one line under an agreement saying
    Bapa would pay — the same two facts entered differently depending on the screen.
    Derivation **stops the moment the operator picks a payer**, because a plan is a plan
    and what happened at the counter may differ. Pass `{ bapaPaid }` when editing, so a
    share Bapa has already given is not offered a second time.
  - **A contradiction is named, never blocked.** Bapa promising the whole amount and the
    devotee handing it over is possible and usually a mistake, so the form says so in
    place rather than refusing the save.

**A seva can be a GIFT from Bhuvaji Suresh Bapa, and that is not a bigger version of
Bapa covering part of one.** `sevarthi_bookings.is_gift` is a flag, not something
inferred: "Bapa agreed to cover the whole amount" and "this seva is Bapa's gift" would
otherwise be the same row, and only one of them should refuse a devotee payment. The
money still reaches the ledger as `payer_type = 'bhuvaji'` — nothing about the two rules
in *Two rules everything else follows* changes. The invariant, re-asserted by
`resolveGift()` in `bookings.js` on create, edit and reassign, and repaired at boot in
`db.js`:

```
is_gift = 1  =>  bhuvaji_planned_amount = amount_committed
             AND no payment on the booking has payer_type 'devotee'
```

The trust's rule, in their words: **no half payment turns into a gift; only the full
amount can be one.** Four places enforce it, and all four are needed — the first three
stop a gift being *declared* over money already taken, and the fourth stops the money
arriving afterwards and making the flag a lie:
  - `POST /api/bookings`, `PUT /api/bookings/:id`, `POST /api/bookings/:id/reassign`
    refuse the flag when `devotee_paid > 0`, naming the figure and what to do instead.
  - **`POST /api/payments` and `PUT /api/payments/:id` refuse a devotee row on a gift.**
    The correction route matters as much as the create: re-labelling Bapa's money as the
    sevarthi's is the other way a gift could quietly stop being one.
Raising the contribution on a gift raises Bapa's share with it, and a gift travels
through a reassign still covering its new seva in full — otherwise a move to a dearer
seva would silently leave the sevarthi a balance on something they were given.

**The funding choice is three options, not a checkbox** (`bhuvajiField` /
`bindBhuvajiToggle`): *Sevarthi gives it* · *Bapa covers part* · *Gift from Bapa*. At
three, all of them stay visible — the choice is the point of that step. `fund_mode` is
the control; the two fields the server reads (`bhuvaji_enabled`, now a hidden input, and
`bhuvaji_planned_amount`) are written from it, so every existing caller still works.
Two things follow from the choice rather than being asked again:
  - **The "Who handed it over" row only appears for *Bapa covers part*.** The agreement
    above already says who is funding the seva; on the other two there is one possible
    answer, and asking again is a second, contradictory way of saying what was just
    said. The trust reported it as a duplicate, twice, and it was one. The block's own
    label carries the answer instead — "They are paying now" / "Bapa is handing it over
    now". Changing who pays means changing the agreement, which is the honest edit.
  - `bapaOwes()` reads the mode, **not** `bhuvaji_enabled.checked` — that field is a
    hidden input now, so `.checked` is `undefined` and reading it made every agreement
    look like nothing had been promised.

**Wherever an amount is split, the form does the arithmetic** (`bindSplitBalance`). Type
one side and the other fills with what is left of the due — "he's giving ten lakh, Bapa
covers the balance" is the whole conversation at the counter. The moment the operator
types into that second field it becomes theirs and the balancing stops; without that,
clearing Bapa's share to zero would silently rewrite the sevarthi's, which is how
two-way binding turns hostile. `autoFilledNote()` owns up to whichever side the form
filled in — its `labels` are in field order, `[what a is, what b is]`. The same
arithmetic is shown, one-way, under "Bapa is covering part of the amount": Bapa's share
and the sevarthi's are two halves of the contribution, so entering one displays the
other instead of leaving the operator to subtract.

**"Sevarthi" is the person; "seva" is what they take.** The action is therefore **Add
Seva** in every UI surface (dashboard tile, Mahotsav button, sheet title, quick-add) —
the function is still `Forms.addSevarthi` and `data-add-sevarthi`. Its first step also
carries `existingDevoteeSearch()` / `bindExistingDevotee()`: most seva after the first
are taken by someone already registered, and retyping a name and number the trust
already holds is both slower and a chance to create a near-duplicate. Picking a match
fills the devotee fields and leaves them editable — `upsertDevotee` merges by mobile, so
a correction made there updates the register rather than forking it.

There is deliberately **no date filter** on this page — one was built and then removed
at the trust's request. If it is asked for again, note that "filter by date" has two
honest answers here, because a row is a registration that also has payments against
it: *registered on* (`sevarthi_bookings.created_at`) and *paid on* (the `booking_id`
set from `GET /api/payments?from=&to=`). A January payment against a December
registration belongs in different results depending on which was meant, so the control
has to name its basis rather than offer one unlabelled date box. Any such control must
also render on the empty path — an early return on "no rows" removes the very control
needed to widen the period again.

This is why the data model favors flexible entry over strict scheduling:
`pooja_slots.slot_date` and `capacity` can both be `NULL` (undated, open/unlimited
seating), so a pooja can take sevarthi before its date or headcount is finalized, and
`PUT /api/poojas/:id/dates` converts the placeholder slot into day one once a date is
fixed, carrying existing bookings over rather than disturbing them.

**When building booking-related features, default to NOT introducing new hard blockers**
(required dates, capacity caps, required sitting allocation) unless the trust has
explicitly said that pooja's seating is fixed. An unset date/capacity is the normal,
expected state for a pooja early on, not missing data to be validated against.

### Registration capacity is a tri-state: `pooja_events.capacity_mode`

The trust distinguishes three things that must not be collapsed into two:

| `capacity_mode` | Registrations | Slot `capacity` | UI says |
|---|---|---|---|
| `not_decided` | allowed | `NULL` | "capacity not decided" |
| `limited` | blocked once reached | `seats_per_day` | "42 / 100 registered" |
| `unlimited` | always allowed | `NULL` | "unlimited" |

**The column is descriptive, not a second enforcement engine.** Enforcement is still the
slot capacity check inside the booking transaction — only `limited` ever puts a number
on a slot, so only `limited` can block anyone. `not_decided` and `unlimited` behave
identically; they differ in wording, because the app must not announce "unlimited" on
the trust's behalf. Never show "Capacity Full" for a pooja with no configured capacity.

The number for a `limited` pooja lives in `seats_per_day` only — deliberately **not**
duplicated into a second "limit" column, or the two would drift from what the slots
enforce. `fixed_capacity` is now derived (`1` iff `limited`) and kept only for
compatibility. The invariant is:

```
fixed_capacity = 1 AND seats_per_day IS NOT NULL   <=>   capacity_mode = 'limited'
```

`db.js` re-asserts that on every boot (a logged repair), because the seed scripts write
`pooja_events` with raw SQL and a direct INSERT that forgets the column would otherwise
have a screen saying "not decided" while the booking transaction turns people away.
**Any new code that inserts a pooja directly must set `capacity_mode` itself.**

`PUT /api/poojas/:id` applies a mode change to the event row and every slot in one
transaction, refusing a limit below what is already booked. It only rewrites slots when
the decision actually changed — the edit form posts the current mode back on every save,
and a blind rewrite would flatten a single day's hand-adjusted count from
`PUT /api/poojas/slots/:slotId`.

Keep these four concepts distinct — only the first belongs to Phase 1: **registration
capacity** (how many registrations a seva accepts) · **physical daily capacity** (how
many can sit in the mandir that day) · **patla capacity** (seat entitlement within a
yagna) · **sitting allocation** (who sits on which date).

### Vocabulary: the trust's words ↔ the code's

Use the schema's names in code and the trust's names in UI copy:

| Trust's term | Code |
|---|---|
| Contribution / commitment | `sevarthi_bookings.amount_committed` |
| Sevarthi Paid | `payments` where `payer_type = 'devotee'` |
| Bappa Support / Bhuvaji | `payments` where `payer_type = 'bhuvaji'`; the planned share is `bhuvaji_planned_amount` |
| Covered | sevarthi paid + bappa support |
| Pending / Partial / Covered | `pending` / `partially_paid` / `paid` |
| Bappa Supported, Excess Contribution | not statuses — separate indicators derived alongside the status |
| Gift from Bapa | `sevarthi_bookings.is_gift` — the whole seva given by Bapa, distinct from Bappa Support |

### Confirmed product decisions

- **Mobile number is required to register a devotee** — the trust contacts people by
  mobile, and it is the dedup key. Enforced by `assertMobile()` in `devotees.js`, but
  only on the registration paths: `POST`/`PUT /api/devotees` and `POST /api/bookings`
  (which passes `{ requireMobile: true }` to `upsertDevotee`). **Padhramni and walk-in
  donations deliberately still accept a devotee with no number** — a visit has to be
  recordable for someone nobody has a number for, and blocking that would stall
  event-day entry. `UI.mobileError()` mirrors the rule client-side.
  The check is loose on purpose (≥10 digits, so `+91`, dashes and landlines pass), and
  the stored form is unchanged — whitespace-stripped only — so dedup matching against
  existing rows behaves exactly as before. There is no `UNIQUE` index on
  `devotees.mobile`: older databases may hold duplicates and the migration would fail.
- The devotee form is **locked to its eight fields** (full name, mobile, city, state
  defaulting to Gujarat, mul vatan, samaj, devotee category, note). **Do not add**
  alternate mobile, full address or pincode — location is collected during padhramni,
  and the devotee master is an identity record, not an address book.
- One devotee, many registrations. Never duplicate a devotee row for a second seva.
- Donations are a separate financial concept from seva contributions — don't merge their
  totals or their screens.
- All collection is cash today; `payments` has no method column. Keep the ledger
  append-only, and add a method column only when another mode is actually introduced.
- **Receipt numbers are issued, never typed** (`server/util/receipts.js`). The trust
  asked not to have to think about them, which means more than generating one: *every*
  path that records money gets one — a collection, money taken at registration, the
  extra taken while raising a commitment, **each half of a split** (two ledger rows are
  two entries, each correctable on its own, so one number across both would leave the
  second uncorrectable on paper) and every donation. Series are `P-<year>-0001` and
  `D-<year>-0001`, counted per kind and per **calendar year of the entry's own date**,
  not of today: an entry made in January for money taken in December belongs in
  December's book. `next()` runs inside the caller's transaction, so a booking that
  fails to save never burns a number. A number typed by hand is still honoured, for a
  trust carrying a paper book across — the field is folded away, not removed.
  A receipt never changes once written: `PUT /api/payments/:id` passes the stored value
  through, and a reassign never touches the ledger rows at all.
  There is deliberately **no unique index** on `receipt_no` — databases in the field may
  hold hand-typed duplicates, and a migration that fails on real data is worse than one
  that cannot prove uniqueness (the same reasoning as `devotees.mobile`). The counter is
  the authority; `backfillMissing()`, called from `server.js` at boot, fills blanks and
  lifts each series past anything hand-typed so an issued number cannot collide.
- The existing modules (Dashboard, Mahotsav, Payments, Devotees, Padhramni, Calendar,
  Donations, Invitation, Settings, Accounts & Access) each have working behaviour behind
  them — read what a module does before changing or dropping it as part of UI work.

### Phase 2 seam — do not build it now

`pooja_events.coordinator_devotee_id` and the generic `lookups` table exist specifically
so a later Phase 2 (capacity planner, sitting allocation, patla assignment,
committee/management) can attach without a schema rewrite — both are otherwise unused
today and should stay that way. Do not add daily-capacity, auto-allocation, preferred
dates, bulk-move or optimization fields to the Phase 1 registration workflow; the schema
only needs to stay capable of growing into them.
