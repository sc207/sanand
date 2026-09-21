/* Optional starter data for the Mahotsav.
   Run once with:  npm run seed
   Safe to re-run — it skips anything that already exists. */
const db = require('./db');

const CATS = {
  maha_yagna: 'Maha Yagna',
  mandir_pooja: 'Mandir ni Pooja',
  bhagvat_katha: 'Bhagvat Saptah — Katha',
};

const POOJAS = [];   // the three categories are seeded from their own lists below

/* Bhagvat Saptah — Katha, 2 to 7 Feb 2027.
   Each entry is a sponsorable part of the katha. Unlike a yagna patla
   (held for all five days), each of these happens on ONE day of the
   saptah and the trust has not said which, so they are created
   undated — "Set dates" on a pooja once the day is fixed.
     seats: null  = no limit
     amount: null = not decided yet
   `note` keeps the distinction between "deliberately unlimited" and
   "nobody has decided yet", which both store as NULL. */
const KATHA_ITEMS = [
  { name: 'Pothi Yatra',            seats: null, amount: 151000 },
  { name: 'Pothi ni Aarti',         seats: null, amount: 21000  },
  { name: 'Tulsi Vivah',            seats: null, amount: null, note: 'Patla count and amount not decided' },
  { name: 'Shree Krishna Janmotsav', seats: null, amount: null, note: 'Patla count and amount not decided' },
  { name: 'Shree Ram Pragatya',     seats: null, amount: null, note: 'Patla count and amount not decided' },
  { name: 'Shree Goverdhan Pooja',  seats: null, amount: null, note: 'Patla count and amount not decided' },
  { name: 'Rukmani Vivah',          seats: null, amount: null, note: 'Patla count and amount not decided' },
  { name: 'Sudama Charitra',        seats: null, amount: null, note: 'Patla count and amount not decided' },
];

/* Maha Yagna — the patla tiers, 4 to 8 Feb 2027.
   `seats` is the TOTAL number of that patla for the whole yagna (one
   sevarthi holds a patla for all five days), so these are seated in
   'whole' mode, not per day. seats: null = no fixed count.
   amount: null = the trust has not decided it yet. */
const YAGNA_PATLA = [
  { name: 'Mukhya Patlo',                     seats: 1,    amount: 5100000 },
  { name: 'Dhaja Mate No Patlo',              seats: 1,    amount: null    },
  { name: 'Anya Mukhya Patla',                seats: 7,    amount: 2100000 },
  { name: 'Yagna Patla — ₹11,00,000',         seats: 16,   amount: 1100000 },
  { name: 'Yagna Patla — ₹5,51,000',          seats: null, amount: 551000  },
  { name: 'Yagna Patla — ₹1,00,000',          seats: null, amount: 100000  },
  { name: 'Yagna Patla — ₹51,000',            seats: null, amount: 51000   },
  { name: 'Yagna Patla — ₹31,000',            seats: null, amount: 31000   },
  { name: 'Yagna Patla — ₹11,000',            seats: null, amount: 11000   },
];

/* Held at the Sanand temple itself — neither count nor amount decided,
   and no date either, so it is created undated. */
const NAVCHANDI = {
  name: 'Navchandi Yagna — Sanand Nij Mandir', seats: null, amount: null,
  /* The other uncapped tiers are a deliberate "no limit"; this one is
     genuinely undecided, and the two must not read the same. */
  capacity_mode: 'not_decided',
};

const YAGNA_START = '2027-02-04';
const YAGNA_END = '2027-02-08';

const SAMAJ = ['Rabari Samaj', 'Marvadi Samaj', 'Patel Samaj', 'Thakor Samaj', 'Prajapati Samaj'];

/* Mandir ni Pooja — the individual rituals of the Pran Pratishtha.
   Each is sponsored by ONE sevarthi family, so the seat count is 1.
   Dates and amounts are not decided yet: they are left blank rather
   than guessed, and can be filled in from the app later. */
const MANDIR_POOJAS = [
  'Kalash Pooja',
  'Mataji First Aarti',
  "Samaran's Main Kalash Pooja",
  'Shri Yantra Pooja',
  'Shri Ganesh Pooja',
  'Shri Hanuman Pooja',
  'Four Chowki Kalash Pooja',
  'Garbha Gruh Na Ubra Ni Pooja',
  'Sukhanath Pooja',
  'Dharma Dhaja Pooja',
  'Ubra Ni Pooja',
  'Mataji First Shringar',
  'Four Directions Deities Pooja',
  'Six Elephants Pooja (Airavat)',
  'Dhwaja Stambha Pooja',
  'Main Dhwaja Pooja',
  'Stambh Murti Pooja',
];

function datesBetween(start, end) {
  const out = [];
  const d = new Date(start + 'T00:00:00');
  const last = new Date(end + 'T00:00:00');
  while (d <= last) {
    out.push(d.toLocaleDateString('en-CA'));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

const addLookup = db.prepare(`INSERT OR IGNORE INTO lookups (type, value, sort_order) VALUES (?, ?, ?)`);
SAMAJ.forEach((s, i) => addLookup.run('samaj', s, i + 1));
console.log(`samaj list ready (${SAMAJ.length} entries)`);

for (const p of POOJAS) {
  const exists = db.prepare(`SELECT id FROM pooja_events WHERE name = ?`).get(p.name);
  if (exists) { console.log(`skipped (already there): ${p.name}`); continue; }

  const create = db.transaction(() => {
    const info = db.prepare(`
      INSERT INTO pooja_events (category, name, description, seats_per_day, fixed_capacity,
                                capacity_mode, amount, target_amount, start_date, end_date)
      VALUES (@category, @name, @description, @seats_per_day, 1,
              'limited', @amount, @target_amount, @start_date, @end_date)
    `).run(p);
    const id = Number(info.lastInsertRowid);
    const slot = db.prepare(`INSERT INTO pooja_slots (pooja_id, slot_date, capacity) VALUES (?, ?, ?)`);
    for (const d of datesBetween(p.start_date, p.end_date)) slot.run(id, d, p.seats_per_day);
    return id;
  });

  const id = create();
  const days = datesBetween(p.start_date, p.end_date).length;
  console.log(`created ${CATS[p.category]}: ${p.name} — ${days} days x ${p.seats_per_day} patla (id ${id})`);
}

/* ---- Maha Yagna patla tiers ---------------------------------- */
function addYagnaPatla(p, { start, end }) {
  if (db.prepare(`SELECT id FROM pooja_events WHERE name = ? AND category = 'maha_yagna'`).get(p.name)) {
    return false;
  }
  db.transaction(() => {
    const info = db.prepare(`
      INSERT INTO pooja_events (category, name, seats_per_day, fixed_capacity, capacity_mode,
                                seating_mode, amount, target_amount, start_date, end_date)
      VALUES ('maha_yagna', @name, @seats, @fixed, @cap_mode, 'whole', @amount, @target, @start, @end)
    `).run({
      name: p.name,
      seats: p.seats,
      fixed: p.seats == null ? 0 : 1,
      /* A tier with a fixed count really is capped, so it must say
         'limited' — the label has to agree with what the slot enforces.
         The open tiers are the trust's deliberate "no limit". */
      cap_mode: p.capacity_mode || (p.seats == null ? 'unlimited' : 'limited'),
      amount: p.amount || 0,
      // a known count at a known rate gives a real target; otherwise none
      target: p.seats != null && p.amount != null ? p.seats * p.amount : 0,
      start, end,
    });
    // one pooled slot: the patla is held for the whole yagna
    db.prepare(`INSERT INTO pooja_slots (pooja_id, slot_date, capacity) VALUES (?, ?, ?)`)
      .run(Number(info.lastInsertRowid), start, p.seats);
  })();
  return true;
}

let yAdded = 0, ySkipped = 0;
for (const p of YAGNA_PATLA) {
  addYagnaPatla(p, { start: YAGNA_START, end: YAGNA_END }) ? yAdded++ : ySkipped++;
}
addYagnaPatla(NAVCHANDI, { start: null, end: null }) ? yAdded++ : ySkipped++;
console.log(`Maha Yagna patla: ${yAdded} added, ${ySkipped} already present (${YAGNA_START} to ${YAGNA_END})`);

/* ---- Bhagvat Saptah Katha items ------------------------------ */
let kAdded = 0, kSkipped = 0;
for (const k of KATHA_ITEMS) {
  if (db.prepare(`SELECT id FROM pooja_events WHERE name = ? AND category = 'bhagvat_katha'`).get(k.name)) {
    kSkipped++;
    continue;
  }
  db.transaction(() => {
    const info = db.prepare(`
      INSERT INTO pooja_events (category, name, description, seats_per_day, fixed_capacity,
                                capacity_mode, seating_mode, amount, target_amount, start_date, end_date)
      VALUES ('bhagvat_katha', @name, @note, @seats, @fixed, @cap_mode, 'whole', @amount, @target, NULL, NULL)
    `).run({
      name: k.name,
      note: k.note || null,
      seats: k.seats,
      fixed: k.seats == null ? 0 : 1,
      /* The note is what distinguished "no limit" from "nobody has
         decided" before there was a column for it. */
      cap_mode: k.seats != null ? 'limited' : (k.note ? 'not_decided' : 'unlimited'),
      amount: k.amount || 0,
      target: k.seats != null && k.amount != null ? k.seats * k.amount : 0,
    });
    db.prepare(`INSERT INTO pooja_slots (pooja_id, slot_date, capacity) VALUES (?, NULL, ?)`)
      .run(Number(info.lastInsertRowid), k.seats);
  })();
  kAdded++;
}
console.log(`Bhagvat Saptah Katha: ${kAdded} added, ${kSkipped} already present (day within the saptah to be set)`);

/* ---- Mandir ni Pooja: 17 rituals, 1 seat each, dates/amounts TBD ---- */
let added = 0, skipped = 0;
for (const name of MANDIR_POOJAS) {
  if (db.prepare(`SELECT id FROM pooja_events WHERE name = ? AND category = 'mandir_pooja'`).get(name)) {
    skipped++;
    continue;
  }
  db.transaction(() => {
    const info = db.prepare(`
      INSERT INTO pooja_events (category, name, seats_per_day, fixed_capacity, capacity_mode,
                                amount, target_amount, start_date, end_date)
      VALUES ('mandir_pooja', ?, 1, 1, 'limited', 0, 0, NULL, NULL)
    `).run(name);
    // one undated slot — the date is announced later
    db.prepare(`INSERT INTO pooja_slots (pooja_id, slot_date, capacity) VALUES (?, NULL, 1)`)
      .run(Number(info.lastInsertRowid));
  })();
  added++;
}
console.log(`Mandir ni Pooja: ${added} added, ${skipped} already present (1 seat each, date & amount to be set)`);

console.log('\nSeed complete.\n');

/* Close the handle before the process exits. Leaving it to teardown
   trips better-sqlite3's cleanup hook against an already-disposed
   isolate ("Assertion failed: (env) != nullptr"), which printed a
   native stack trace after every otherwise-successful seed. */
db.close();
