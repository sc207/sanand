/* Payment Received — the money ledger.

   Payments are append-only. A booking's paid total is always the sum of
   its payment rows, so "pending → paid" is derived, never hand-set. */
const express = require('express');
const db = require('../db');
const { log } = require('../middleware/audit');
const { refreshStatus } = require('./bookings');
const { todayLocal, monthLocal } = require('../util/dates');

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

router.post('/', (req, res) => {
  const b = req.body;
  const booking = db.prepare(`SELECT * FROM sevarthi_bookings WHERE id = ?`).get(b.booking_id);
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  if (booking.status === 'cancelled') return res.status(400).json({ error: 'This booking is cancelled' });

  const amount = Number(b.amount || 0);
  if (!(amount > 0)) return res.status(400).json({ error: 'Enter an amount greater than zero' });

  const info = db.prepare(`
    INSERT INTO payments (booking_id, amount, payer_type, payment_date, receipt_no, notes, recorded_by)
    VALUES (@booking_id, @amount, @payer_type, @payment_date, @receipt_no, @notes, @recorded_by)
  `).run({
    booking_id: booking.id,
    amount,
    payer_type: b.payer_type === 'bhuvaji' ? 'bhuvaji' : 'devotee',
    payment_date: b.payment_date || todayLocal(),
    receipt_no: (b.receipt_no || '').trim() || null,
    notes: (b.notes || '').trim() || null,
    recorded_by: req.get('X-User-Name') ? decodeURIComponent(req.get('X-User-Name')) : 'Unknown',
  });

  const updated = refreshStatus(booking.id);
  const row = db.prepare(PAYMENT_SELECT + ` WHERE p.id = ?`).get(info.lastInsertRowid);
  log(req, {
    action: 'payment', entity: 'payment', entityId: Number(info.lastInsertRowid),
    summary: `₹${amount} cash received from ${row.payer_type === 'bhuvaji' ? 'Bapa (on behalf of ' + row.full_name + ')' : row.full_name}` +
             ` — ${row.pooja_name} ${row.slot_date} [${updated.status}]`,
    details: { amount, payer_type: row.payer_type, booking_id: booking.id },
  });
  res.status(201).json({ payment: row, booking_status: updated.status });
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

  db.prepare(`
    UPDATE payments SET amount=@amount, payer_type=@payer_type, payment_date=@payment_date,
           receipt_no=@receipt_no, notes=@notes
     WHERE id=@id
  `).run({
    id: p.id,
    amount,
    payer_type: (b.payer_type ?? p.payer_type) === 'bhuvaji' ? 'bhuvaji' : 'devotee',
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
