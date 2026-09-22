/* Receipt numbers, issued by the app rather than typed by an operator.
   ------------------------------------------------------------
   The trust asked not to have to think about these at all, which means
   two things beyond "generate a number":

     1. EVERY path that records money gets one — a collection, a payment
        taken at registration, the extra taken while raising a
        commitment, either half of a split, and a donation. A receipt
        book with holes in it is the thing they are trying to stop
        worrying about.
     2. A number, once on a row, never changes. Correcting a payment's
        amount keeps its receipt (`PUT /api/payments/:id` passes the
        stored value through), and moving a sevarthi to another seva
        keeps it too, because reassign never touches the ledger rows.

   The series is per kind and per CALENDAR YEAR OF THE ENTRY'S OWN DATE,
   not of today: an entry made in January for money taken in December
   belongs in December's book, and numbering it in the new year would
   put the books out of step with the receipts.

     P-2026-0001   payments
     D-2026-0001   donations

   `next()` must run inside the caller's transaction — the booking route
   writes the seat, the capacity increment and the payment as one, and a
   booking that fails must not burn a number. It does not open a
   transaction of its own, for the same reason insertPaymentRows does
   not.
*/
const db = require('../db');
const { todayLocal } = require('./dates');

const PEEK = db.prepare(`SELECT next_no FROM receipt_counters WHERE series = ?`);
const PUT = db.prepare(`
  INSERT INTO receipt_counters (series, next_no) VALUES (@series, @next_no)
  ON CONFLICT(series) DO UPDATE SET next_no = excluded.next_no`);

const seriesFor = (prefix, dateISO) =>
  `${prefix}-${String(dateISO || todayLocal()).slice(0, 4)}`;

const format = (series, n) => `${series}-${String(n).padStart(4, '0')}`;

/** The next number in the series for this date. Call inside a transaction. */
function next(prefix, dateISO) {
  const series = seriesFor(prefix, dateISO);
  const row = PEEK.get(series);
  const n = row ? row.next_no : 1;
  PUT.run({ series, next_no: n + 1 });
  return format(series, n);
}

/** What a caller should store: whatever was supplied, else a fresh one.
    A number typed by hand is still honoured — the trust may be carrying
    a paper book across — it simply is not required any more. */
function ensure(supplied, prefix, dateISO) {
  const given = String(supplied || '').trim();
  return given || next(prefix, dateISO);
}

/* ------------------------------------------------------------
   One-time repair, run at boot from server.js (not from db.js, which
   would mean requiring this module from the one it requires).

   Filling in a blank field is not the same as rewriting a fact: the
   audit log remains the record of what happened, and a ledger where
   half the rows have no receipt number is exactly what was asked to be
   fixed. Ordered by when each entry was made, so the numbers run in the
   order the money actually arrived.

   It also lifts each series past any hand-typed number already in the
   data, so an issued number can never collide with one the trust wrote
   itself.
   ------------------------------------------------------------ */
function backfillMissing() {
  let filled = 0;
  for (const [table, prefix, dateCol] of
       [['payments', 'P', 'payment_date'], ['donations', 'D', 'donation_date']]) {
    /* Start each series above whatever is already there. Only numbers
       this module's own format produced can be read back as a count;
       anything else is left alone and simply kept. */
    const seen = db.prepare(
      `SELECT receipt_no FROM ${table} WHERE receipt_no IS NOT NULL AND TRIM(receipt_no) <> ''`).all();
    const high = new Map();
    for (const { receipt_no } of seen) {
      const m = /^([PD]-\d{4})-(\d+)$/.exec(String(receipt_no).trim());
      if (!m) continue;
      const n = Number(m[2]);
      if (!high.has(m[1]) || high.get(m[1]) < n) high.set(m[1], n);
    }
    db.transaction(() => {
      for (const [series, n] of high) {
        const cur = PEEK.get(series);
        if (!cur || cur.next_no <= n) PUT.run({ series, next_no: n + 1 });
      }
      const rows = db.prepare(
        `SELECT id, ${dateCol} AS d FROM ${table}
          WHERE receipt_no IS NULL OR TRIM(receipt_no) = ''
          ORDER BY created_at, id`).all();
      const set = db.prepare(`UPDATE ${table} SET receipt_no = ? WHERE id = ?`);
      for (const r of rows) { set.run(next(prefix, r.d), r.id); filled++; }
    })();
  }
  if (filled) console.log(`[receipts] issued numbers for ${filled} entr${filled === 1 ? 'y' : 'ies'} that had none`);
  return filled;
}

module.exports = { next, ensure, backfillMissing };
