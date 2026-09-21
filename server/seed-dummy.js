/* Dummy SEVARTHI data for testing — devotees + bookings + payments,
   deliberately covering every state the app can produce so each one
   can be checked by hand: pending / partially paid / paid / overpaid /
   cancelled, Bapa covering none / part / all, fixed-capacity poojas
   both full and partly full, undated and amount-not-decided poojas,
   a moved (reassigned) booking with real history, a devotee holding
   more than one seva, and several poojas left completely untouched so
   there's still room to test Add Sevarthi by hand.

   Does NOT touch pooja_events / pooja_slots — the seva list stays as
   seeded by `npm run seed`.

   NOT idempotent like seed.js — running this twice adds a second copy
   of everything. To redo it, truncate first (see the printed summary
   at the end, or SEED_DUMMY.md), then run again.

   Run with:  node server/seed-dummy.js
*/
const db = require('./db');

const CITIES = ['Sanand', 'Ahmedabad', 'Viramgam', 'Gandhinagar', 'Surat', 'Rajkot', 'Vadodara', 'Mehsana'];
const SAMAJ = { Rabari: 8, Marvadi: 9, Patel: 10, Thakor: 11, Prajapati: 12 };
const CAT = { Normal: 1, VIP: 2, Guest: 3, Bhuvaji: 4 };

/* full_name, mobile, city, samaj_id, category_id, mul_vatan — several
   entries deliberately leave mobile/samaj/category/mul_vatan blank to
   exercise the app's handling of incomplete devotee records. */
const DEVOTEES = [
  ['Rasikbhai Patel',      '9825010001', 'Ahmedabad',   SAMAJ.Patel,     CAT.VIP,    'Sanand'],
  ['Devshi Rabari',        '9825010002', 'Viramgam',    SAMAJ.Rabari,    CAT.Normal, 'Viramgam'],
  ['Bhachiben Rabari',     '9825010003', 'Sanand',      SAMAJ.Rabari,    CAT.Normal, null],
  ['Mohanlal Marvadi',     '9825010004', 'Rajkot',      SAMAJ.Marvadi,   CAT.Normal, null],
  ['Sunita Marvadi',       null,         'Rajkot',      SAMAJ.Marvadi,   CAT.Normal, null],
  ['Hansaben Patel',       '9825010006', 'Vadodara',    SAMAJ.Patel,     CAT.Normal, 'Sanand'],
  ['Jayeshbhai Patel',     '9825010007', 'Ahmedabad',   SAMAJ.Patel,     CAT.VIP,    'Sanand'],
  ['Kiranben Patel',       '9825010008', 'Sanand',      SAMAJ.Patel,     CAT.Normal, null],
  ['Nileshbhai Patel',     '9825010009', 'Surat',       SAMAJ.Patel,     CAT.Normal, 'Viramgam'],
  ['Bharatsinh Thakor',    '9825010010', 'Gandhinagar', SAMAJ.Thakor,    CAT.Normal, null],
  ['Meenaben Thakor',      '9825010011', 'Mehsana',     SAMAJ.Thakor,    CAT.Normal, null],
  ['Ramesh Prajapati',     '9825010012', 'Sanand',      SAMAJ.Prajapati, CAT.Normal, 'Sanand'],
  ['Geetaben Prajapati',   '9825010013', 'Ahmedabad',   SAMAJ.Prajapati, CAT.Normal, null],
  ['Kanjibhai Rabari',     '9825010014', 'Viramgam',    SAMAJ.Rabari,    CAT.Guest,  null],
  ['Vinodbhai Patel',      '9825010015', 'Sanand',      SAMAJ.Patel,     CAT.Normal, 'Sanand'],
  ['Ashaben Marvadi',      '9825010016', 'Rajkot',      SAMAJ.Marvadi,   CAT.Normal, null],
  ['Dineshbhai Thakor',    '9825010017', 'Sanand',      SAMAJ.Thakor,    CAT.Normal, null],
  ['Pravinbhai Prajapati', '9825010018', 'Mehsana',     SAMAJ.Prajapati, CAT.Normal, null],
  ['Rekhaben Patel',       '9825010019', 'Vadodara',    SAMAJ.Patel,     CAT.Normal, null],
  ['Anilbhai Rabari',      null,         null,          null,            null,       null],
  ['Suresh Bapa (Bhuvaji)','9825010021', 'Sanand',      null,            CAT.Bhuvaji, 'Sanand'],
  ['Chandrikaben Thakor',  '9825010022', 'Gandhinagar', SAMAJ.Thakor,    CAT.Normal, null],
  ['Manoj Marvadi',        '9825010023', 'Surat',       SAMAJ.Marvadi,   CAT.Normal, null],
  ['Hiraben Prajapati',    '9825010024', 'Sanand',      SAMAJ.Prajapati, CAT.Normal, null],
  ['Yogeshbhai Patel',     '9825010025', 'Ahmedabad',   SAMAJ.Patel,     CAT.VIP,    'Sanand'],
];

const insertDevotee = db.prepare(`
  INSERT INTO devotees (full_name, mobile, city, state, mul_vatan, samaj_id, category_id)
  VALUES (@full_name, @mobile, @city, 'Gujarat', @mul_vatan, @samaj_id, @category_id)
`);

const devoteeIds = DEVOTEES.map(([full_name, mobile, city, samaj_id, category_id, mul_vatan]) =>
  Number(insertDevotee.run({ full_name, mobile, city, samaj_id, category_id, mul_vatan }).lastInsertRowid));

console.log(`${devoteeIds.length} dummy devotees added`);

const insertAudit = db.prepare(`
  INSERT INTO audit_log (user_name, action, entity, entity_id, summary, details)
  VALUES ('Administrator', @action, 'booking', @entity_id, @summary, @details)
`);

/** Book a seat exactly like POST /bookings does: check capacity, insert,
    increment — inside one transaction, respecting real slot state. */
function book(devoteeIdx, poojaId, amountCommitted, bhuvajiPlanned = 0) {
  const devoteeId = devoteeIds[devoteeIdx];
  const slot = db.prepare(`SELECT * FROM pooja_slots WHERE pooja_id = ?`).get(poojaId);
  const pooja = db.prepare(`SELECT name, category FROM pooja_events WHERE id = ?`).get(poojaId);
  if (slot.capacity !== null && slot.booked_count >= slot.capacity) {
    throw new Error(`${pooja.name} is already full — pick another scenario slot`);
  }
  const bookingId = db.transaction(() => {
    const info = db.prepare(`
      INSERT INTO sevarthi_bookings (slot_id, devotee_id, amount_committed, bhuvaji_planned_amount, status)
      VALUES (?, ?, ?, ?, 'pending')
    `).run(slot.id, devoteeId, amountCommitted, bhuvajiPlanned);
    db.prepare(`UPDATE pooja_slots SET booked_count = booked_count + 1 WHERE id = ?`).run(slot.id);
    return Number(info.lastInsertRowid);
  })();
  const devotee = db.prepare(`SELECT full_name FROM devotees WHERE id = ?`).get(devoteeId);
  insertAudit.run({
    action: 'create', entity_id: bookingId,
    summary: `${devotee.full_name} added as sevarthi — ${pooja.name} (₹${amountCommitted})`,
    details: JSON.stringify({ amount_committed: amountCommitted, bhuvaji_planned: bhuvajiPlanned }),
  });
  return bookingId;
}

/** Record a payment exactly like POST /payments — refreshes status from
    the ledger afterward, never sets it directly. */
function pay(bookingId, amount, payerType = 'devotee', date = '2026-09-21', receiptNo = null) {
  db.prepare(`
    INSERT INTO payments (booking_id, amount, payer_type, payment_date, receipt_no, recorded_by)
    VALUES (?, ?, ?, ?, ?, 'Administrator')
  `).run(bookingId, amount, payerType, date, receiptNo);
  refreshStatus(bookingId);
}

function refreshStatus(bookingId) {
  const b = db.prepare(`SELECT * FROM sevarthi_bookings WHERE id = ?`).get(bookingId);
  if (b.status === 'cancelled') return;
  const paid = db.prepare(`SELECT IFNULL(SUM(amount),0) n FROM payments WHERE booking_id = ?`).get(bookingId).n;
  const status = paid <= 0 ? 'pending' : paid < b.amount_committed ? 'partially_paid' : 'paid';
  db.prepare(`UPDATE sevarthi_bookings SET status = ? WHERE id = ?`).run(status, bookingId);
}

/** Move a booking to a different pooja — mirrors POST /bookings/:id/reassign
    exactly, so it leaves a real "moved from A to B" audit trail behind
    for the Change History feature to show. */
function reassign(bookingId, newPoojaId, newAmount) {
  const booking = db.prepare(`SELECT * FROM sevarthi_bookings WHERE id = ?`).get(bookingId);
  const oldSlot = db.prepare(`
    SELECT ps.*, pe.name AS pooja_name FROM pooja_slots ps JOIN pooja_events pe ON pe.id = ps.pooja_id
     WHERE ps.id = ?`).get(booking.slot_id);
  const newSlot = db.prepare(`
    SELECT ps.*, pe.name AS pooja_name FROM pooja_slots ps JOIN pooja_events pe ON pe.id = ps.pooja_id
     WHERE ps.pooja_id = ?`).get(newPoojaId);

  db.transaction(() => {
    db.prepare(`UPDATE pooja_slots SET booked_count = MAX(0, booked_count - 1) WHERE id = ?`).run(oldSlot.id);
    db.prepare(`UPDATE pooja_slots SET booked_count = booked_count + 1 WHERE id = ?`).run(newSlot.id);
    db.prepare(`UPDATE sevarthi_bookings SET slot_id = ?, amount_committed = ? WHERE id = ?`)
      .run(newSlot.id, newAmount, bookingId);
  })();
  refreshStatus(bookingId);

  const devotee = db.prepare(`
    SELECT d.full_name FROM devotees d JOIN sevarthi_bookings b ON b.devotee_id = d.id WHERE b.id = ?
  `).get(bookingId);
  insertAudit.run({
    action: 'update', entity_id: bookingId,
    summary: `Moved ${devotee.full_name} from ${oldSlot.pooja_name} (${oldSlot.slot_date || 'date TBA'}) to ${newSlot.pooja_name} (${newSlot.slot_date || 'date TBA'})`,
    details: JSON.stringify({
      from_pooja: oldSlot.pooja_name, from_slot: oldSlot.slot_date,
      to_pooja: newSlot.pooja_name, to_slot: newSlot.slot_date, amount_committed: newAmount,
    }),
  });
}

/** Cancel exactly like POST /bookings/:id/cancel — releases the seat,
    keeps the row (and any payment already on it) on record. */
function cancel(bookingId, reason) {
  const booking = db.prepare(`SELECT * FROM sevarthi_bookings WHERE id = ?`).get(bookingId);
  const paid = db.prepare(`SELECT IFNULL(SUM(amount),0) n FROM payments WHERE booking_id = ?`).get(bookingId).n;
  db.transaction(() => {
    db.prepare(`UPDATE sevarthi_bookings SET status='cancelled', cancelled_at=datetime('now','localtime') WHERE id=?`)
      .run(bookingId);
    db.prepare(`UPDATE pooja_slots SET booked_count = MAX(0, booked_count - 1) WHERE id = ?`).run(booking.slot_id);
  })();
  const devotee = db.prepare(`
    SELECT d.full_name FROM devotees d JOIN sevarthi_bookings b ON b.devotee_id = d.id WHERE b.id = ?
  `).get(bookingId);
  insertAudit.run({
    action: 'cancel', entity_id: bookingId,
    summary: `Cancelled sevarthi booking for ${devotee.full_name}` +
             (paid > 0 ? ` (₹${paid} already received — refund to be settled)` : ''),
    details: JSON.stringify({ amount_paid: paid, reason }),
  });
}

const scenarios = [];   // { label, bookingId } — printed as the test checklist at the end

/* ---------------------------------------------------------------
   MAHA YAGNA — fixed-capacity tiers, all dated (4–8 Feb 2027)
   --------------------------------------------------------------- */
// 1. Mukhya Patlo (cap 1) — fill the single seat, paid in full → pooja
//    reads as fully booked/closed out.
{
  const id = book(0, 1, 5100000);
  pay(id, 5100000, 'devotee', '2026-09-05', 'R-1001');
  scenarios.push({ label: 'Fixed-capacity pooja FULL (1/1), paid in full', devotee: DEVOTEES[0][0], pooja: 'Mukhya Patlo' });
}

// 2. Anya Mukhya Patla (cap 7) — 4 of 7 seats taken, mixed states;
//    3 seats deliberately left open for manual Add Sevarthi testing.
{
  const id = book(1, 3, 2100000);
  scenarios.push({ label: 'PENDING — no payment at all', devotee: DEVOTEES[1][0], pooja: '7 Anya Mukhya Patla' });
}
{
  const id = book(2, 3, 2100000);
  pay(id, 1000000, 'devotee', '2026-09-10');
  scenarios.push({ label: 'PARTIALLY PAID', devotee: DEVOTEES[2][0], pooja: '7 Anya Mukhya Patla' });
}
{
  const id = book(3, 3, 2100000);
  pay(id, 2100000, 'devotee', '2026-09-12', 'R-1004');
  scenarios.push({ label: 'PAID — exact amount', devotee: DEVOTEES[3][0], pooja: '7 Anya Mukhya Patla' });
}
{
  // Bapa covers most, devotee gives the rest — two payment rows,
  // two different payer_type values on the same booking's FIFO ledger.
  const id = book(4, 3, 2100000, 1500000);
  pay(id, 600000, 'devotee', '2026-09-14');
  pay(id, 1500000, 'bhuvaji', '2026-09-15');
  scenarios.push({ label: 'PAID via two payers — devotee + Bapa (mixed FIFO ledger)', devotee: DEVOTEES[4][0], pooja: '7 Anya Mukhya Patla' });
}

// 3. Yagna Patla ₹11,00,000 (cap 16) — pending / partial / overpaid /
//    cancelled-with-payment / Bapa covers 100%. 11 seats left open.
{
  const id = book(5, 4, 1100000);
  scenarios.push({ label: 'PENDING', devotee: DEVOTEES[5][0], pooja: 'Yagna Patla — ₹11,00,000' });
}
{
  const id = book(6, 4, 1100000);
  pay(id, 300000, 'devotee', '2026-09-16');
  scenarios.push({ label: 'PARTIALLY PAID', devotee: DEVOTEES[6][0], pooja: 'Yagna Patla — ₹11,00,000' });
}
{
  // Gave more than committed — stays 'paid', never blocked.
  const id = book(7, 4, 1100000);
  pay(id, 1200000, 'devotee', '2026-09-17', 'R-1008');
  scenarios.push({ label: 'PAID — OVERPAID beyond committed (still just ‘paid’)', devotee: DEVOTEES[7][0], pooja: 'Yagna Patla — ₹11,00,000' });
}
{
  // Payment already received, then cancelled — "refund to be settled" wording.
  const id = book(8, 4, 1100000);
  pay(id, 500000, 'devotee', '2026-09-18');
  cancel(id, 'Family postponed to next year');
  scenarios.push({ label: 'CANCELLED with a payment already received (refund note)', devotee: DEVOTEES[8][0], pooja: 'Yagna Patla — ₹11,00,000' });
}
{
  const id = book(9, 4, 1100000, 1100000);
  pay(id, 1100000, 'bhuvaji', '2026-09-19', 'R-1010');
  scenarios.push({ label: 'PAID — Bapa covers 100% of the amount', devotee: DEVOTEES[9][0], pooja: 'Yagna Patla — ₹11,00,000' });
}

// 4–9. The open (no-limit) Yagna Patla tiers.
{
  const id = book(10, 5, 551000);
  scenarios.push({ label: 'PENDING, open-seating tier', devotee: DEVOTEES[10][0], pooja: 'Yagna Patla — ₹5,51,000' });
}
{
  const id = book(11, 5, 551000);
  pay(id, 551000, 'devotee', '2026-09-20', 'R-1012');
  scenarios.push({ label: 'PAID, open-seating tier', devotee: DEVOTEES[11][0], pooja: 'Yagna Patla — ₹5,51,000' });
}
{
  const id = book(12, 6, 100000);
  pay(id, 40000, 'devotee', '2026-09-05');
  scenarios.push({ label: 'PARTIALLY PAID', devotee: DEVOTEES[12][0], pooja: 'Yagna Patla — ₹1,00,000' });
}
{
  const id = book(14, 8, 31000, 11000);
  pay(id, 15000, 'devotee', '2026-09-21');
  scenarios.push({ label: 'PARTIALLY PAID with Bapa covering PART of the gap', devotee: DEVOTEES[14][0], pooja: 'Yagna Patla — ₹31,000' });
}
{
  const id = book(15, 9, 11000);
  scenarios.push({ label: 'PENDING, cheapest open tier', devotee: DEVOTEES[15][0], pooja: 'Yagna Patla — ₹11,000' });
}

// Reassignment: booked at ₹1,00,000 and paid in full, then downgraded to
// ₹31,000 — leaves a real "moved from A to B" audit entry AND a genuine
// overpaid-on-downgrade state (₹1,00,000 received vs ₹31,000 committed).
{
  const id = book(13, 6, 100000);
  pay(id, 100000, 'devotee', '2026-09-08', 'R-1014');
  reassign(id, 8, 31000);
  scenarios.push({ label: 'MOVED (Change Seva) — has real history, and now OVERPAID (₹1,00,000 received vs ₹31,000 committed)', devotee: DEVOTEES[13][0], pooja: 'Yagna Patla — ₹31,000 (moved from ₹1,00,000)' });
}

// Navchandi Yagna — undated, amount not decided by the trust (0), but a
// devotee still offered a figure; Dhaja Mate No Patlo is left untouched.
{
  const id = book(16, 10, 25000);
  scenarios.push({ label: 'PENDING on an UNDATED pooja with amount not yet decided by the trust', devotee: DEVOTEES[16][0], pooja: 'Navchandi Yagna — Sanand Nij Mandir' });
}
scenarios.push({ label: 'UNTOUCHED — fixed-capacity (1), amount not decided, for manual Add Sevarthi testing', devotee: '(none)', pooja: 'Dhaja Mate No Patlo' });

/* ---------------------------------------------------------------
   BHAGVAT SAPTAH — KATHA
   --------------------------------------------------------------- */
{
  const id = book(17, 11, 151000);
  pay(id, 151000, 'devotee', '2026-09-11', 'R-1017');
  scenarios.push({ label: 'PAID, undated katha item', devotee: DEVOTEES[17][0], pooja: 'Pothi Yatra' });
}
{
  const id = book(18, 11, 151000);
  scenarios.push({ label: 'PENDING, same undated katha item (open seating)', devotee: DEVOTEES[18][0], pooja: 'Pothi Yatra' });
}
{
  const id = book(19, 12, 21000);
  pay(id, 10000, 'devotee', '2026-09-13');
  scenarios.push({ label: 'PARTIALLY PAID', devotee: DEVOTEES[19][0], pooja: 'Pothi ni Aarti' });
}
{
  const id = book(20, 13, 5000);
  scenarios.push({ label: 'PENDING on an item with amount not decided (Tulsi Vivah, ₹0 suggested)', devotee: DEVOTEES[20][0], pooja: 'Tulsi Vivah' });
}
scenarios.push({ label: 'UNTOUCHED katha items (Shree Krishna Janmotsav, Shree Ram Pragatya, Shree Goverdhan Pooja, Rukmani Vivah, Sudama Charitra)', devotee: '(none)', pooja: '5 more katha items' });

/* ---------------------------------------------------------------
   MANDIR NI POOJA — 1 seat each, undated
   --------------------------------------------------------------- */
{
  const id = book(21, 19, 2500000);
  pay(id, 2500000, 'devotee', '2026-09-06', 'R-1020');
  scenarios.push({ label: 'FULL (1/1) — paid in full', devotee: DEVOTEES[21][0], pooja: 'Kalash Pooja' });
}
{
  const id = book(22, 20, 1125000);
  scenarios.push({ label: 'FULL (1/1) — pending', devotee: DEVOTEES[22][0], pooja: 'Mataji First Aarti' });
}
{
  const id = book(23, 21, 1100000);
  pay(id, 400000, 'devotee', '2026-09-07');
  scenarios.push({ label: 'FULL (1/1) — partially paid', devotee: DEVOTEES[23][0], pooja: "Samaran's Main Kalash Pooja" });
}
{
  const id = book(24, 22, 751000, 751000);
  pay(id, 751000, 'bhuvaji', '2026-09-09', 'R-1023');
  scenarios.push({ label: 'FULL (1/1) — Bapa covers 100%', devotee: DEVOTEES[24][0], pooja: 'Shri Yantra Pooja' });
}
{
  const id = book(0, 23, 251000);   // reuses devotee 0 — second seva for the same person
  scenarios.push({ label: 'A DEVOTEE HOLDING TWO SEVA — check their profile lists both', devotee: DEVOTEES[0][0], pooja: 'Shri Ganesh Pooja (2nd seva for this devotee)' });
}
{
  const id = book(1, 24, 251000);   // reuses devotee 1 too
  cancel(id, 'Double-booked by mistake');
  scenarios.push({ label: 'CANCELLED with NO payment ever received', devotee: DEVOTEES[1][0], pooja: 'Shri Kalbhairav Pooja' });
}
scenarios.push({
  label: 'UNTOUCHED single-seat poojas, free to fully test Add Sevarthi end to end',
  devotee: '(none)',
  pooja: 'Four Chowki Kalash Pooja, Garbha Gruh Na Ubra Ni Pooja, Sukhanath Pooja, Dharma Dhaja Pooja, Ubra Ni Pooja, Mataji First Shringar, Four Directions Deities Pooja, Six Elephants Pooja (Airavat), Dhwaja Stambha Pooja, Main Dhwaja Pooja 108, Stambh Murti Pooja',
});

console.log('\nDummy data loaded. Checklist of what to look at:\n');
scenarios.forEach((s, i) => console.log(`${i + 1}. ${s.label}\n   ${s.devotee} — ${s.pooja}\n`));
console.log(`Total: ${devoteeIds.length} devotees, ${db.prepare("SELECT COUNT(*) c FROM sevarthi_bookings").get().c} bookings, ${db.prepare("SELECT COUNT(*) c FROM payments").get().c} payments.\n`);
