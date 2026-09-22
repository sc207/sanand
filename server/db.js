/* ============================================================
   DATABASE — SQLite (better-sqlite3), single file at data/temple.db
   ------------------------------------------------------------
   BOOKING STATE MACHINE (decided up front — every capacity and
   money question in the app resolves to these rules):

     A seat is HELD the moment a booking row is created, not when
     it is paid. slot.booked_count increments inside the same
     transaction as the insert, so a seat can never be sold twice.

     status        when
     ------------- ------------------------------------------------
     pending       booking exists, nothing received yet (paid = 0)
     partially_paid 0 < received < committed
     paid          received >= committed (overpayment is allowed and
                   stays 'paid' — a pooja may exceed its target)
     cancelled     seat released back to the slot (booked_count--)

     `received` is never stored on the booking. It is always
     SUM(payments.amount) for that booking, so the ledger is the
     single source of truth and the two can never drift.

     A booking's committed amount may be funded by the devotee, by
     Bhuvaji (trust head) covering the shortfall, or both. The plan
     lives on the booking (bhuvaji_planned_amount); who actually
     paid lives on each payment row (payer_type).
   ============================================================ */
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

/* The mandir always runs the default file. TEMPLE_DB exists so a test
   run can be pointed at a throwaway database instead of the live one —
   several checks assert whole-database totals, which only hold on a
   fresh schema. */
const db = new Database(process.env.TEMPLE_DB || path.join(DATA_DIR, 'temple.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS lookups (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  type       TEXT NOT NULL,          -- samaj | devotee_category | donation_category
  value      TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  active     INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  UNIQUE (type, value)
);

CREATE TABLE IF NOT EXISTS devotees (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name   TEXT NOT NULL,
  mobile      TEXT,
  city        TEXT,
  state       TEXT DEFAULT 'Gujarat',
  mul_vatan   TEXT,
  samaj_id    INTEGER REFERENCES lookups(id),
  category_id INTEGER REFERENCES lookups(id),
  notes       TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_devotees_mobile ON devotees(mobile);
CREATE INDEX IF NOT EXISTS idx_devotees_name   ON devotees(full_name);

-- A pooja / yagna / katha that sevarthis can be seated in.
CREATE TABLE IF NOT EXISTS pooja_events (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  category       TEXT NOT NULL,        -- maha_yagna | mandir_pooja | bhagvat_katha
  name           TEXT NOT NULL,
  description    TEXT,
  -- capacity is a PATLA COUNT: the number of physical sitting places
  -- available on the temple floor. NULL = no fixed limit.
  seats_per_day  INTEGER,
  fixed_capacity INTEGER NOT NULL DEFAULT 1,   -- 0 = open/unlimited seating
  -- REGISTRATION capacity, which is not the same question as the patla
  -- count above: not_decided | limited | unlimited. 'not_decided' and
  -- 'unlimited' both leave slot capacity NULL and both take sevarthi —
  -- the difference is only what the trust has actually decided, and the
  -- UI must not claim "unlimited" when nobody has said so.
  capacity_mode  TEXT NOT NULL DEFAULT 'not_decided',
  -- per_day: the count applies to each day | whole: it is the total
  seating_mode   TEXT NOT NULL DEFAULT 'per_day',
  amount         REAL NOT NULL DEFAULT 0,      -- suggested contribution per sevarthi seat
  target_amount  REAL NOT NULL DEFAULT 0,      -- what this pooja aims to raise overall
  -- NULL dates mean "not fixed yet" — the pooja can still take sevarthi.
  start_date     TEXT,
  end_date       TEXT,
  -- Phase 2 seam: a coordinator will be assigned here once the
  -- Management/Committee module exists. Nullable and unused for now.
  coordinator_devotee_id INTEGER REFERENCES devotees(id),
  status         TEXT NOT NULL DEFAULT 'open', -- open | closed
  created_at     TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

-- One row per calendar day of a pooja. Seats are booked against a DAY.
-- slot_date NULL = the date is not fixed yet; the seats still exist.
CREATE TABLE IF NOT EXISTS pooja_slots (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  pooja_id     INTEGER NOT NULL REFERENCES pooja_events(id) ON DELETE CASCADE,
  slot_date    TEXT,
  capacity     INTEGER,               -- NULL = unlimited for this day
  booked_count INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  UNIQUE (pooja_id, slot_date)
);
CREATE INDEX IF NOT EXISTS idx_slots_date ON pooja_slots(slot_date);

CREATE TABLE IF NOT EXISTS sevarthi_bookings (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  slot_id               INTEGER NOT NULL REFERENCES pooja_slots(id),
  devotee_id            INTEGER NOT NULL REFERENCES devotees(id),
  amount_committed      REAL NOT NULL DEFAULT 0,
  bhuvaji_planned_amount REAL NOT NULL DEFAULT 0,  -- shortfall Bapa agreed to cover
  status                TEXT NOT NULL DEFAULT 'pending',
  notes                 TEXT,
  created_at            TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at            TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  cancelled_at          TEXT,
  CHECK (status IN ('pending','partially_paid','paid','cancelled'))
);
CREATE INDEX IF NOT EXISTS idx_bookings_slot    ON sevarthi_bookings(slot_id);
CREATE INDEX IF NOT EXISTS idx_bookings_devotee ON sevarthi_bookings(devotee_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status  ON sevarthi_bookings(status);

-- Append-only money ledger. Read back in FIFO order by created_at.
-- All collections are cash, so there is no payment-method field.
CREATE TABLE IF NOT EXISTS payments (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_id   INTEGER NOT NULL REFERENCES sevarthi_bookings(id),
  amount       REAL NOT NULL,
  payer_type   TEXT NOT NULL DEFAULT 'devotee',  -- devotee | bhuvaji
  payment_date TEXT NOT NULL,
  receipt_no   TEXT,
  notes        TEXT,
  recorded_by  TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  CHECK (payer_type IN ('devotee','bhuvaji'))
);
CREATE INDEX IF NOT EXISTS idx_payments_booking ON payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_payments_date    ON payments(payment_date);

CREATE TABLE IF NOT EXISTS donations (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  devotee_id    INTEGER REFERENCES devotees(id),
  donor_name    TEXT NOT NULL,
  mobile        TEXT,
  category_id   INTEGER REFERENCES lookups(id),
  amount        REAL NOT NULL DEFAULT 0,
  in_kind_item  TEXT,
  donation_date TEXT NOT NULL,
  receipt_no    TEXT,
  notes         TEXT,
  recorded_by   TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_donations_date ON donations(donation_date);

CREATE TABLE IF NOT EXISTS visits (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  devotee_id   INTEGER REFERENCES devotees(id),
  devotee_name TEXT NOT NULL,
  mobile       TEXT,
  purpose      TEXT,
  address      TEXT,
  city         TEXT,
  visit_date   TEXT NOT NULL,
  visit_time   TEXT,
  status       TEXT NOT NULL DEFAULT 'requested', -- requested | confirmed | completed | cancelled
  notes        TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_visits_date ON visits(visit_date);

-- One or more devotees who accompany/lead a padhramni. A person, not a
-- team — there is no Management module in Phase 1 to hold a team roster.
CREATE TABLE IF NOT EXISTS visit_escorts (
  visit_id   INTEGER NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
  devotee_id INTEGER NOT NULL REFERENCES devotees(id),
  PRIMARY KEY (visit_id, devotee_id)
);

CREATE TABLE IF NOT EXISTS users (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  mobile     TEXT,
  email      TEXT,
  role       TEXT NOT NULL DEFAULT 'operator',  -- superadmin | admin | accountant | operator
  active     INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS audit_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_name  TEXT NOT NULL DEFAULT 'Unknown',
  action     TEXT NOT NULL,            -- create | update | delete | cancel | payment
  entity     TEXT NOT NULL,            -- table / module name
  entity_id  INTEGER,
  summary    TEXT,                     -- human-readable one-liner
  details    TEXT,                     -- JSON diff
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);
`);

/* ------------------------------------------------------------
   MIGRATION 1 — dates become optional.
   Some poojas (the Mandir ni Pooja items) are opened for sevarthi
   before the trust fixes their date. Those carry NULL dates and a
   single undated slot; the calendar simply skips them until a date
   is set. SQLite can't drop NOT NULL in place, so the table is
   rebuilt. Idempotent: it only runs while the old shape is present.
   ------------------------------------------------------------ */
function columnIsNotNull(table, column) {
  return db.prepare(`PRAGMA table_info(${table})`).all()
    .some((c) => c.name === column && c.notnull === 1);
}

if (columnIsNotNull('pooja_events', 'start_date')) {
  db.transaction(() => {
    db.exec(`
      CREATE TABLE pooja_events_new (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        category       TEXT NOT NULL,
        name           TEXT NOT NULL,
        description    TEXT,
        seats_per_day  INTEGER,
        fixed_capacity INTEGER NOT NULL DEFAULT 1,
        amount         REAL NOT NULL DEFAULT 0,
        target_amount  REAL NOT NULL DEFAULT 0,
        start_date     TEXT,
        end_date       TEXT,
        coordinator_devotee_id INTEGER REFERENCES devotees(id),
        status         TEXT NOT NULL DEFAULT 'open',
        created_at     TEXT NOT NULL DEFAULT (datetime('now','localtime')),
        updated_at     TEXT NOT NULL DEFAULT (datetime('now','localtime'))
      );
      INSERT INTO pooja_events_new SELECT id, category, name, description, seats_per_day,
             fixed_capacity, amount, target_amount, start_date, end_date,
             coordinator_devotee_id, status, created_at, updated_at FROM pooja_events;
      DROP TABLE pooja_events;
      ALTER TABLE pooja_events_new RENAME TO pooja_events;
    `);
  })();
  console.log('[db] migration 1a: pooja dates are now optional');
}

if (columnIsNotNull('pooja_slots', 'slot_date')) {
  db.transaction(() => {
    db.exec(`
      CREATE TABLE pooja_slots_new (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        pooja_id     INTEGER NOT NULL REFERENCES pooja_events(id) ON DELETE CASCADE,
        slot_date    TEXT,
        capacity     INTEGER,
        booked_count INTEGER NOT NULL DEFAULT 0,
        created_at   TEXT NOT NULL DEFAULT (datetime('now','localtime')),
        UNIQUE (pooja_id, slot_date)
      );
      INSERT INTO pooja_slots_new SELECT id, pooja_id, slot_date, capacity, booked_count, created_at
        FROM pooja_slots;
      DROP TABLE pooja_slots;
      ALTER TABLE pooja_slots_new RENAME TO pooja_slots;
      CREATE INDEX IF NOT EXISTS idx_slots_date ON pooja_slots(slot_date);
    `);
  })();
  console.log('[db] migration 1b: slot dates are now optional');
}

/* ------------------------------------------------------------
   MIGRATION 2 — how a pooja's seats are counted.

     per_day  the patla count applies to EACH day, so a 5-day pooja
              with 100 patla seats 500 people (Bhagvat Katha: people
              come each day).
     whole    the patla count is the TOTAL for the whole event — one
              sevarthi holds that patla for every day of the yagna.
              The Maha Yagna tiers work this way: there is one
              mukhya patlo, not one per day.
   ------------------------------------------------------------ */
const poojaCols = db.prepare(`PRAGMA table_info(pooja_events)`).all().map((c) => c.name);
if (!poojaCols.includes('seating_mode')) {
  db.exec(`ALTER TABLE pooja_events ADD COLUMN seating_mode TEXT NOT NULL DEFAULT 'per_day'`);
  console.log('[db] migration 2: added seating_mode (per_day | whole)');
}

/* ------------------------------------------------------------
   MIGRATION 3 — registration capacity becomes a real three-way
   choice instead of something inferred from a NULL.

     not_decided  the trust has not decided whether or how many
                  registrations to take. Registrations ARE allowed.
     limited      a known maximum; slot capacity enforces it.
     unlimited    deliberately no cap.

   'not_decided' and 'unlimited' are both stored as slot capacity
   NULL and behave identically — only the wording differs, and the
   app must never announce "unlimited" on the trust's behalf.

   Backfill is deliberately conservative: anything that already has
   a patla count is 'limited'; everything else becomes
   'not_decided', because nothing in the data says which of the
   uncapped poojas were a deliberate "no limit". The operator marks
   those Unlimited from the seva form. A wrong label here changes
   wording only — never whether someone can register.
   ------------------------------------------------------------ */
if (!poojaCols.includes('capacity_mode')) {
  db.transaction(() => {
    db.exec(`ALTER TABLE pooja_events ADD COLUMN capacity_mode TEXT NOT NULL DEFAULT 'not_decided'`);
    db.exec(`UPDATE pooja_events SET capacity_mode = 'limited'
              WHERE fixed_capacity = 1 AND seats_per_day IS NOT NULL`);
  })();
  console.log('[db] migration 3: added capacity_mode (not_decided | limited | unlimited)');
}

/* Invariant repair, checked every boot: a pooja whose slots carry a
   number IS capped, whatever its label says, so the label must read
   'limited'. Anything else would have the screen announce "capacity not
   decided" while the booking transaction turns people away. This cannot
   undo an operator's choice — clearing a limit through the API also
   clears fixed_capacity and the slot numbers, so such a row never
   matches here. It catches rows written by a direct INSERT, which is
   how the seed scripts load the real seva list. */
const capacityDrift = db.prepare(`
  UPDATE pooja_events SET capacity_mode = 'limited'
   WHERE capacity_mode <> 'limited' AND fixed_capacity = 1 AND seats_per_day IS NOT NULL
`).run();
if (capacityDrift.changes > 0) {
  console.log(`[db] capacity_mode repaired on ${capacityDrift.changes} pooja(s) with a real patla limit`);
}

/* ------------------------------------------------------------
   MIGRATION 4 — a seva can be a GIFT from Bhuvaji Suresh Bapa.

   Bapa covering part of a contribution already existed
   (bhuvaji_planned_amount). A gift is not a bigger version of that: it
   is the trust saying this whole seva is Bapa's, so nothing is ever
   collected from the sevarthi. The money reaches the ledger the same
   way — payer_type 'bhuvaji' — but the intent differs, the trust counts
   it separately, and the form must stop offering to take money from the
   sevarthi at all.

   So it is a flag, not something inferred. "Bapa agreed to cover the
   whole amount" and "this seva is a gift from Bapa" would otherwise be
   the same row, and only one of them should refuse a devotee payment.

   The invariant, re-asserted by bookings.js on every write:
     is_gift = 1  =>  bhuvaji_planned_amount = amount_committed
                  AND no payment on the booking has payer_type 'devotee'
   ------------------------------------------------------------ */
const bookingCols = db.prepare(`PRAGMA table_info(sevarthi_bookings)`).all().map((c) => c.name);
if (!bookingCols.includes('is_gift')) {
  db.exec(`ALTER TABLE sevarthi_bookings ADD COLUMN is_gift INTEGER NOT NULL DEFAULT 0`);
  console.log('[db] migration 4: added is_gift (a seva given entirely by Bapa)');
}

/* Invariant repair, checked every boot, for the same reason the
   capacity one is: the seed scripts write bookings with raw SQL, and a
   gift whose planned share drifted below the contribution would read
   "Gift from Bapa" on screen while the page still asked the sevarthi
   for the balance. A gift that has taken devotee money is no longer a
   gift and is demoted rather than quietly kept — the money is the fact,
   the label is not. */
const giftDrift = db.prepare(`
  UPDATE sevarthi_bookings SET bhuvaji_planned_amount = amount_committed
   WHERE is_gift = 1 AND IFNULL(bhuvaji_planned_amount, 0) <> amount_committed
`).run();
if (giftDrift.changes > 0) {
  console.log(`[db] gift share re-set to the full contribution on ${giftDrift.changes} booking(s)`);
}
const giftPaid = db.prepare(`
  UPDATE sevarthi_bookings SET is_gift = 0
   WHERE is_gift = 1 AND EXISTS (
     SELECT 1 FROM payments WHERE booking_id = sevarthi_bookings.id AND payer_type = 'devotee')
`).run();
if (giftPaid.changes > 0) {
  console.log(`[db] ${giftPaid.changes} booking(s) un-gifted: the sevarthi had paid into them`);
}

/* ------------------------------------------------------------
   MIGRATION 5 — receipt numbers are issued, not typed.

   Every payment and every donation gets one automatically, so nobody at
   the counter has to keep the receipt book in their head. The counter
   is per series and per calendar year of the entry's own date, which is
   what keeps the sequence matching the books when something is entered
   late. Issuing lives in util/receipts.js; only the table is here,
   because that is the schema. Numbers are handed out inside the
   caller's transaction, so a booking that fails to save never burns one.

   There is deliberately NO unique index on receipt_no: databases in the
   field may already hold hand-typed numbers, possibly duplicated, and a
   migration that fails on real data is worse than one that cannot prove
   uniqueness. The counter is the authority and only moves forward.
   ------------------------------------------------------------ */
db.exec(`
  CREATE TABLE IF NOT EXISTS receipt_counters (
    series   TEXT PRIMARY KEY,          -- 'P-2026', 'D-2026', …
    next_no  INTEGER NOT NULL
  );
`);

/* ---- first-run defaults ------------------------------------ */
const seedLookup = db.prepare(
  `INSERT OR IGNORE INTO lookups (type, value, sort_order) VALUES (?, ?, ?)`
);
const defaults = [
  ['devotee_category', 'Normal', 1],
  ['devotee_category', 'VIP', 2],
  ['devotee_category', 'Guest', 3],
  ['devotee_category', 'Gurudev / Bhuvaji', 4],
  ['donation_category', 'General Donation', 1],
  ['donation_category', 'Annadan', 2],
  ['donation_category', 'Construction', 3],
];
for (const [type, value, order] of defaults) seedLookup.run(type, value, order);

const seedSetting = db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`);
seedSetting.run('temple_name', 'શ્રી વિહત મેલડી ધામ');
seedSetting.run('temple_name_en', 'Shri Vihat Meldi Dham');
seedSetting.run('temple_location', 'Sanand, Gujarat');
seedSetting.run('trust_head', 'Bhuvaji Shri Suresh Bapa');
seedSetting.run('mahotsav_name', 'Murti Pran Pratishtha Mahotsav');

const userCount = db.prepare(`SELECT COUNT(*) AS n FROM users`).get().n;
if (userCount === 0) {
  db.prepare(`INSERT INTO users (name, role) VALUES (?, ?)`).run('Administrator', 'superadmin');
}

module.exports = db;
