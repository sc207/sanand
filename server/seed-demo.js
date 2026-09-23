/* Ten of everything, to work with.

     npm run seed:demo

   Small on purpose. `seed-dummy.js` exists to cover every booking state
   at once and makes a few hundred rows doing it, which is right for
   checking money logic and wrong for looking at a screen: a register of
   704 devotees is not something you can hold in your head while you
   decide whether a page reads well.

   So this makes ten devotees, ten seats, ten payments, ten donations
   and ten padhramni — few enough to check by eye, and chosen so the
   states worth seeing are all present exactly once:

     pending · partly paid · covered · overpaid · cancelled
     Bapa covering part · a gift from Bapa
     a dated seva and an undated one
     a devotee with no mobile, and one with no seva at all

   Devotees are idempotent — run it twice and you still have ten,
   because they are matched on the mobile number (and by name for the
   one person who has none). The seats, donations and padhramni are
   not: this is demo data, and a second run on top of a first is a
   thing to do after `npm run reset`, not instead of it.
*/
const db = require('./db');
const { todayLocal } = require('./util/dates');
const receipts = require('./util/receipts');

const BY = 'Demo seed';

function lookup(type, value) {
  const row = db.prepare(`SELECT id FROM lookups WHERE type = ? AND value = ? AND active = 1`).get(type, value);
  return row ? row.id : null;
}
const samaj = (v) => lookup('samaj', v);
const cat = (v) => lookup('devotee_category', v);

/* Ten people, with the shapes the register has to cope with: a missing
   mobile, a mul vatan that differs from the city, and a spread of
   samaj so the filters have something to bite on. */
const PEOPLE = [
  ['Rasikbhai Patel',    '9825110001', 'Ahmedabad',   'Patel Samaj',     'VIP',    'Sanand'],
  ['Devshi Rabari',      '9825110002', 'Viramgam',    'Rabari Samaj',    'Normal', 'Viramgam'],
  ['Bhachiben Rabari',   '9825110003', 'Sanand',      'Rabari Samaj',    'Normal', null],
  ['Mohanlal Marvadi',   '9825110004', 'Rajkot',      'Marvadi Samaj',   'Normal', null],
  ['Sunita Marvadi',     null,         'Rajkot',      'Marvadi Samaj',   'Normal', null],
  ['Hansaben Patel',     '9825110006', 'Vadodara',    'Patel Samaj',     'Normal', 'Sanand'],
  ['Bharatsinh Thakor',  '9825110007', 'Gandhinagar', 'Thakor Samaj',    'Normal', null],
  ['Ramesh Prajapati',   '9825110008', 'Sanand',      'Prajapati Samaj', 'Normal', 'Sanand'],
  ['Kanjibhai Rabari',   '9825110009', 'Viramgam',    'Rabari Samaj',    'Guest',  null],
  ['Ashaben Marvadi',    '9825110010', 'Rajkot',      'Marvadi Samaj',   'Normal', null],
];

const upsertDevotee = db.transaction((p) => {
  const [full_name, mobile, city, s, c, mul_vatan] = p;
  /* The mobile is the register's identity key, so that is what a
     re-run matches on. The one person here without a number is matched
     by name instead — the only handle she has — because otherwise a
     second run quietly added an eleventh devotee and the set stopped
     being ten of everything. */
  const found = mobile
    ? db.prepare(`SELECT id FROM devotees WHERE mobile = ?`).get(mobile)
    : db.prepare(`SELECT id FROM devotees WHERE full_name = ? AND mobile IS NULL`).get(full_name);
  if (found) return found.id;
  return Number(db.prepare(`
    INSERT INTO devotees (full_name, mobile, city, state, mul_vatan, samaj_id, category_id)
    VALUES (@full_name, @mobile, @city, 'Gujarat', @mul_vatan, @samaj_id, @category_id)
  `).run({ full_name, mobile, city, mul_vatan, samaj_id: samaj(s), category_id: cat(c) }).lastInsertRowid);
});

const devotees = PEOPLE.map(upsertDevotee);
console.log(`  ${devotees.length} devotees`);

/* Seats are taken on whatever the seed list actually holds, so this
   keeps working if the trust renames or re-prices a seva. A dated and
   an undated one are picked deliberately: "no date yet" is the normal
   early state and every screen has to show it. */
const slots = db.prepare(`
  SELECT ps.id, ps.slot_date, pe.name, pe.amount
    FROM pooja_slots ps JOIN pooja_events pe ON pe.id = ps.pooja_id
   WHERE pe.status <> 'closed'
   ORDER BY (ps.slot_date IS NULL), pe.id, ps.id
`).all();
if (!slots.length) {
  console.log('\n  No seva to book against. Run `npm run seed` first.\n');
  db.close();
  process.exit(1);
}
const dated = slots.filter((s) => s.slot_date);
const undated = slots.filter((s) => !s.slot_date);
const pick = (i) => (dated.length ? dated[i % dated.length] : slots[i % slots.length]);

/* Ten seats, one per state worth seeing. `gift` is Bapa giving the
   whole seva; `bapa` is Bapa covering part of one — different things,
   and the trust reports on them separately. */
const SEATS = [
  { who: 0, slot: pick(0), amount: 21000,  pay: 0,                       label: 'pending' },
  { who: 1, slot: pick(1), amount: 21000,  pay: 5000,                    label: 'partly paid' },
  { who: 2, slot: pick(2), amount: 11000,  pay: 11000,                   label: 'covered' },
  { who: 3, slot: pick(3), amount: 11000,  pay: 15000,                   label: 'overpaid' },
  { who: 4, slot: pick(4), amount: 31000,  pay: 21000, bapa: 10000,      label: 'Bapa covering part' },
  { who: 5, slot: pick(5), amount: 51000,  pay: 51000, gift: true,       label: 'a gift from Bapa' },
  { who: 6, slot: pick(6), amount: 11000,  pay: 2000,                    label: 'partly paid' },
  { who: 7, slot: undated[0] || pick(7), amount: 21000, pay: 0,          label: 'pending, date not fixed' },
  { who: 8, slot: pick(8), amount: 11000,  pay: 11000,                   label: 'covered' },
  { who: 2, slot: pick(9), amount: 5000,   pay: 5000,  cancel: true,     label: 'cancelled after paying' },
];

let seats = 0, paid = 0;
db.transaction(() => {
  SEATS.forEach((s) => {
    const bapaShare = s.gift ? s.amount : (s.bapa || 0);
    const id = Number(db.prepare(`
      INSERT INTO sevarthi_bookings (slot_id, devotee_id, amount_committed, bhuvaji_planned_amount, is_gift, status)
      VALUES (?, ?, ?, ?, ?, 'pending')
    `).run(s.slot.id, devotees[s.who], s.amount, bapaShare, s.gift ? 1 : 0).lastInsertRowid);
    db.prepare(`UPDATE pooja_slots SET booked_count = booked_count + 1 WHERE id = ?`).run(s.slot.id);
    seats++;

    if (s.pay > 0) {
      /* A gift is Bapa's end to end; a shared contribution is two rows,
         because payer_type lives on the row and the two totals must
         stay separable. */
      const rows = s.gift ? [[s.pay, 'bhuvaji']]
        : s.bapa ? [[s.pay - s.bapa, 'devotee'], [s.bapa, 'bhuvaji']]
        : [[s.pay, 'devotee']];
      rows.forEach(([amount, payer]) => {
        if (amount <= 0) return;
        db.prepare(`
          INSERT INTO payments (booking_id, amount, payer_type, payment_date, receipt_no, recorded_by)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(id, amount, payer, todayLocal(), receipts.next('P', todayLocal()), BY);
        paid++;
      });
    }

    if (s.cancel) {
      db.prepare(`UPDATE sevarthi_bookings SET status = 'cancelled',
                   cancelled_at = datetime('now','localtime') WHERE id = ?`).run(id);
      db.prepare(`UPDATE pooja_slots SET booked_count = MAX(0, booked_count - 1) WHERE id = ?`).run(s.slot.id);
    }
  });
})();
console.log(`  ${seats} seats, ${paid} payments`);

/* Status is derived from the ledger and never written by hand, so it
   is recomputed here the same way every route does. */
const { refreshStatus } = require('./routes/bookings');
db.prepare(`SELECT id FROM sevarthi_bookings WHERE status <> 'cancelled'`).all()
  .forEach((b) => refreshStatus(b.id));

/* Ten donations, including one in kind, because a donation is not
   always money. */
const donCat = db.prepare(`SELECT id, value FROM lookups WHERE type = 'donation_category' AND active = 1`).all();
let dons = 0;
db.transaction(() => {
  for (let i = 0; i < 10; i++) {
    const d = devotees[i % devotees.length];
    const p = PEOPLE[i % PEOPLE.length];
    const inKind = i === 7;
    db.prepare(`
      INSERT INTO donations (devotee_id, donor_name, mobile, category_id, amount, in_kind_item,
                             donation_date, receipt_no, recorded_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(d, p[0], p[1], donCat.length ? donCat[i % donCat.length].id : null,
           inKind ? 0 : (i + 1) * 1100, inKind ? '51 kg ghee' : null,
           todayLocal(), receipts.next('D', todayLocal()), BY);
    dons++;
  }
})();
console.log(`  ${dons} donations`);

/* Ten padhramni across the states the diary actually holds, and spread
   around today so "Today", "In N days" and an overdue one all appear. */
const VISIT = [
  [-6, 'completed'], [-2, 'completed'], [-1, 'confirmed'], [0, 'confirmed'],
  [1, 'requested'], [3, 'requested'], [6, 'confirmed'], [12, 'requested'],
  [25, 'requested'], [40, 'requested'],
];
const day = (n) => {
  const d = new Date(); d.setDate(d.getDate() + n);
  return d.toLocaleDateString('en-CA');
};
let vis = 0;
db.transaction(() => {
  VISIT.forEach(([offset, status], i) => {
    /* `devotee_name` is NOT NULL and is the name as it was on the day
       — a visit keeps its own copy so re-reading the diary years later
       still says who was visited, even if the register has since been
       corrected. */
    db.prepare(`
      INSERT INTO visits (devotee_id, devotee_name, visit_date, visit_time, address, purpose, status, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(devotees[i % devotees.length], PEOPLE[i % PEOPLE.length][0],
           day(offset), i % 2 ? '10:30' : '17:00',
           i % 3 === 0 ? null : `${10 + i}, Temple Road`,
           ['Griha shanti', 'Padhramni before Mahotsav', 'Vastu pooja at the shop',
            'New house', 'Family requested a visit'][i % 5],
           status, i === 4 ? 'Ring the day before' : null);
    vis++;
  });
})();
console.log(`  ${vis} padhramni`);

console.log('\n  Ten of everything. Seva, samaj and the categories were left as they were.\n');
db.close();
