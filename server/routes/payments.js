/* Payment Received — the money ledger.

   Payments are append-only. A booking's paid total is always the sum of
   its payment rows, so "pending → paid" is derived, never hand-set. */
const express = require('express');
const db = require('../db');
const { log } = require('../middleware/audit');
const { refreshStatus } = require('./bookings');
const { todayLocal, monthLocal } = require('../util/dates');
const { readPaymentEntries, insertPaymentRows, actingUser } = require('../util/payment-entries');

const router = express.Router();

const PAYMENT_SELECT = `
  SELECT p.*, b.amount_committed, b.status AS booking_status,
         d.full_name, d.mobile, d.city, s.value AS samaj, c.value AS devotee_category,
         pe.name AS pooja_name, pe.category, ps.slot_date
    FROM payments p
    JOIN sevarthi_bookings b ON b.id = p.booking_id
    JOIN pooja_slots  ps ON ps.id = b.slot_id
    JOIN pooja_events pe ON pe.id = ps.pooja_id
    JOIN devotees     d  ON d.id  = b.devotee_id
    LEFT JOIN lookups s ON s.id = d.samaj_id
    LEFT JOIN lookups c ON c.id = d.category_id
`;

/* Filters: ?date=YYYY-MM-DD (day view) | ?month=YYYY-MM | ?from=&to= | ?search= */
router.get('/', (req, res) => {
  const { date, month, from, to, search, payer_type } = req.query;
  const where = [];
  const params = {};
  if (date) { where.push(`p.payment_date = @date`); params.date = date; }
  if (month) { where.push(`substr(p.payment_date, 1, 7) = @month`); params.month = month; }
  if (from) { where.push(`p.payment_date >= @from`); params.from = from; }
  if (to) { where.push(`p.payment_date <= @to`); params.to = to; }
  if (payer_type) { where.push(`p.payer_type = @payer_type`); params.payer_type = payer_type; }
  if (search) {
    where.push(`(d.full_name LIKE @q OR d.mobile LIKE @q OR s.value LIKE @q OR c.value LIKE @q
                 OR pe.name LIKE @q OR p.receipt_no LIKE @q)`);
    params.q = `%${String(search).trim()}%`;
  }
  const sql = PAYMENT_SELECT + (where.length ? ` WHERE ${where.join(' AND ')}` : '') +
    ` ORDER BY p.payment_date DESC, p.created_at DESC LIMIT 1000`;
  const rows = db.prepare(sql).all(params);

  const totals = rows.reduce((a, r) => {
    a.total += r.amount;
    if (r.payer_type === 'bhuvaji') a.bhuvaji += r.amount; else a.devotee += r.amount;
    return a;
  }, { total: 0, devotee: 0, bhuvaji: 0, count: rows.length });

  res.json({ payments: rows, totals });
});

/** Day-by-day roll-up for the Payment Received screen. */
router.get('/by-day', (req, res) => {
  const month = req.query.month || monthLocal();
  res.json(db.prepare(`
    SELECT payment_date,
           COUNT(*) AS entries,
           IFNULL(SUM(amount), 0) AS total,
           IFNULL(SUM(CASE WHEN payer_type='bhuvaji' THEN amount ELSE 0 END), 0) AS bhuvaji_total
      FROM payments
     WHERE substr(payment_date, 1, 7) = ?
     GROUP BY payment_date
     ORDER BY payment_date DESC
  `).all(month));
});

/** Sevarthi with money still outstanding — what the Payment screen searches. */
router.get('/outstanding', (req, res) => {
  const search = String(req.query.search || '').trim();
  const params = {};
  let filter = '';
  if (search) {
    filter = ` AND (d.full_name LIKE @q OR d.mobile LIKE @q OR s.value LIKE @q
                    OR c.value LIKE @q OR pe.name LIKE @q)`;
    params.q = `%${search}%`;
  }
  res.json(db.prepare(`
    SELECT b.id AS booking_id, b.amount_committed, b.bhuvaji_planned_amount, b.status,
           d.id AS devotee_id, d.full_name, d.mobile, d.city,
           s.value AS samaj, c.value AS devotee_category,
           pe.name AS pooja_name, pe.category, ps.slot_date,
           (SELECT IFNULL(SUM(amount),0) FROM payments WHERE booking_id = b.id) AS amount_paid,
           (SELECT IFNULL(SUM(amount),0) FROM payments
             WHERE booking_id = b.id AND payer_type = 'bhuvaji')  AS bappa_paid,
           (SELECT IFNULL(SUM(amount),0) FROM payments
             WHERE booking_id = b.id AND payer_type <> 'bhuvaji') AS devotee_paid
      FROM sevarthi_bookings b
      JOIN pooja_slots  ps ON ps.id = b.slot_id
      JOIN pooja_events pe ON pe.id = ps.pooja_id
      JOIN devotees     d  ON d.id  = b.devotee_id
      LEFT JOIN lookups s ON s.id = d.samaj_id
      LEFT JOIN lookups c ON c.id = d.category_id
     WHERE b.status IN ('pending','partially_paid') ${filter}
     ORDER BY b.created_at ASC
     LIMIT 200
  `).all(params));
});

/** Record cash against a booking.
 *
 *  One handover at the counter is often split — the sevarthi pays part
 *  and Bapa covers the rest — and that is two ledger rows, because
 *  `payer_type` lives on the row and the two totals must never be
 *  merged. Sending them as two requests left the booking half-recorded
 *  when the second failed, so both forms are accepted here and written
 *  inside one transaction:
 *
 *    single: { amount, payer_type }
 *    split:  { devotee_amount, bhuvaji_amount }
 *
 *  Each row stays separately correctable through PUT /payments/:id, and
 *  each is audited on its own, so the trail reads the same whether the
 *  money arrived in one visit or two.
 */
router.post('/', (req, res) => {
  const b = req.body;
  const booking = db.prepare(`SELECT * FROM sevarthi_bookings WHERE id = ?`).get(b.booking_id);
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  if (booking.status === 'cancelled') return res.status(400).json({ error: 'This booking is cancelled' });

  const parsed = readPaymentEntries(b);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  const entries = parsed.entries;
  if (!entries.length) {
    return res.status(400).json({ error: 'Enter an amount for the devotee, for Bapa, or both' });
  }

  /* A gift from Bapa is the whole seva, so nothing is ever collected
     from the sevarthi against it. This is the check that actually
     holds the promise: the booking routes can refuse to *flag* a gift
     over money already taken, but without this one the money could
     simply arrive afterwards and the flag would be a lie. Named here
     rather than silently converting the payer, because which of the
     two the operator meant is not ours to guess. */
  if (booking.is_gift && entries.some((e) => e.payer_type === 'devotee')) {
    return res.status(400).json({
      error: 'This seva is a gift from Bhuvaji Suresh Bapa, so nothing is collected from the sevarthi. ' +
             "Record it as Bapa's, or clear the gift on Edit Sevarthi first.",
    });
  }

  /* Both rows land or neither does — a split that wrote only the
     devotee's half would understate what the trust actually holds. */
  const ids = db.transaction(() =>
    insertPaymentRows(booking.id, entries, b, actingUser(req)))();

  const updated = refreshStatus(booking.id);
  const rows = ids.map((id) => db.prepare(PAYMENT_SELECT + ` WHERE p.id = ?`).get(id));

  rows.forEach((row) => {
    log(req, {
      action: 'payment', entity: 'payment', entityId: row.id,
      summary: `₹${row.amount} cash received from ` +
               `${row.payer_type === 'bhuvaji' ? 'Bapa (on behalf of ' + row.full_name + ')' : row.full_name}` +
               `${rows.length > 1 ? ' [split payment]' : ''}` +
               ` — ${row.pooja_name} ${row.slot_date} [${updated.status}]`,
      details: { amount: row.amount, payer_type: row.payer_type, booking_id: booking.id,
                 split: rows.length > 1 },
    });
  });

  // `payment` is kept for callers that expect a single row.
  res.status(201).json({ payment: rows[0], payments: rows, booking_status: updated.status });
});

/** Correct a payment entry. The ledger is append-only in spirit — the
    booking's total is always the sum of its rows and is never hand-set
    — but an operator who typed 1000 for 10000, or picked yesterday by
    mistake, has to be able to fix it. Every change is audited with the
    before/after, and the booking status is recomputed from the ledger
    afterwards exactly as it is for a new payment. */
router.put('/:id', (req, res) => {
  const p = db.prepare(`SELECT * FROM payments WHERE id = ?`).get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Payment not found' });
  const b = req.body;

  const amount = Number(b.amount ?? p.amount);
  if (!(amount > 0)) return res.status(400).json({ error: 'Enter an amount greater than zero' });

  /* The same gift rule as a new payment, and it has to be here too: a
     correction can change who paid, and re-labelling Bapa's money as
     the sevarthi's is the other way a gift could quietly stop being
     one. */
  const payerNow = (b.payer_type ?? p.payer_type) === 'bhuvaji' ? 'bhuvaji' : 'devotee';
  const onBooking = db.prepare(`SELECT is_gift FROM sevarthi_bookings WHERE id = ?`).get(p.booking_id);
  if (onBooking && onBooking.is_gift && payerNow === 'devotee') {
    return res.status(400).json({
      error: 'This seva is a gift from Bhuvaji Suresh Bapa, so nothing is collected from the sevarthi. ' +
             "Leave this entry as Bapa's, or clear the gift on Edit Sevarthi first.",
    });
  }

  db.prepare(`
    UPDATE payments SET amount=@amount, payer_type=@payer_type, payment_date=@payment_date,
           receipt_no=@receipt_no, notes=@notes
     WHERE id=@id
  `).run({
    id: p.id,
    amount,
    payer_type: payerNow,
    payment_date: b.payment_date || p.payment_date,
    receipt_no: ((b.receipt_no ?? p.receipt_no) || '').trim() || null,
    notes: ((b.notes ?? p.notes) || '').trim() || null,
  });

  const updated = refreshStatus(p.booking_id);
  const row = db.prepare(PAYMENT_SELECT + ` WHERE p.id = ?`).get(p.id);
  log(req, {
    action: 'update', entity: 'payment', entityId: p.id,
    summary: `Corrected payment for ${row.full_name}` +
             (p.amount !== amount ? ` (₹${p.amount} → ₹${amount})` : '') +
             ` [${updated ? updated.status : 'cancelled'}]`,
    details: { before: p, after: row },
  });
  res.json({ payment: row, booking_status: updated ? updated.status : null });
});

router.delete('/:id', (req, res) => {
  const p = db.prepare(`SELECT * FROM payments WHERE id = ?`).get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Payment not found' });
  db.prepare(`DELETE FROM payments WHERE id = ?`).run(p.id);
  const updated = refreshStatus(p.booking_id);
  log(req, {
    action: 'delete', entity: 'payment', entityId: p.id,
    summary: `Removed payment entry of ₹${p.amount} (booking #${p.booking_id}) — now ${updated.status}`,
    details: p,
  });
  res.json({ ok: true, booking_status: updated.status });
});

module.exports = router;
