/* Sevarthi bookings — the "Add Sevarthi" flow.

   Seat safety: the capacity check, the booking insert and the
   booked_count increment all happen inside ONE better-sqlite3
   transaction. better-sqlite3 is synchronous and Node is single
   threaded, so no second request can slip between the check and the
   increment — two operators tapping "Save" at the same instant can
   never take the same last patla. */
const express = require('express');
const db = require('../db');
const { slotWhen } = require('../util/dates');
const { log } = require('../middleware/audit');
const { upsertDevotee } = require('./devotees');
const { readPaymentEntries, insertPaymentRows, actingUser } = require('../util/payment-entries');

const router = express.Router();

/** Recompute a booking's status from its ledger. Cancelled stays cancelled. */
function refreshStatus(bookingId) {
  const b = db.prepare(`SELECT * FROM sevarthi_bookings WHERE id = ?`).get(bookingId);
  if (!b || b.status === 'cancelled') return b;
  const paid = db.prepare(`SELECT IFNULL(SUM(amount),0) AS n FROM payments WHERE booking_id = ?`)
    .get(bookingId).n;
  const status = paid <= 0 ? 'pending' : paid < b.amount_committed ? 'partially_paid' : 'paid';
  if (status !== b.status) {
    db.prepare(`UPDATE sevarthi_bookings SET status = ?, updated_at = datetime('now','localtime') WHERE id = ?`)
      .run(status, bookingId);
  }
  return db.prepare(`SELECT * FROM sevarthi_bookings WHERE id = ?`).get(bookingId);
}

/* ------------------------------------------------------------
   A GIFT FROM BHUVAJI SURESH BAPA
   ------------------------------------------------------------
   Bapa covering part of a contribution and Bapa giving the whole seva
   are different things, and the difference is not the size of the
   number. A gift means nothing is ever asked of the sevarthi, so the
   flag has to refuse the two states that would make that untrue:

     - a contribution the gift does not cover in full, and
     - a sevarthi who has already put money in.

   The trust's instruction was exact — no half payment turns into a
   gift; only the full amount can be one. Both checks live here so the
   three write paths (create, edit, reassign) cannot drift, and each
   refusal says what to do instead rather than just saying no.

   `wanted` is what the caller asked for, or undefined to keep whatever
   the booking already is. Returns the value to store, or an Error with
   a status, which the caller surfaces.
   ------------------------------------------------------------ */
function resolveGift(bookingId, wanted, current, amountCommitted, bhuvajiPlanned) {
  const gift = wanted === undefined ? !!current : !!wanted;
  if (!gift) return { gift: 0, bhuvaji: bhuvajiPlanned };

  if (!(amountCommitted > 0)) {
    return { error: 'Enter the contribution first — a gift covers the whole of it', status: 400 };
  }
  if (bookingId) {
    const devoteePaid = db.prepare(
      `SELECT IFNULL(SUM(amount),0) AS n FROM payments
        WHERE booking_id = ? AND payer_type = 'devotee'`).get(bookingId).n;
    if (devoteePaid > 0) {
      return {
        status: 400,
        error: `This sevarthi has already given ₹${devoteePaid}, so the seva cannot be recorded ` +
               `as a gift from Bapa. Remove that payment from the ledger first, or leave this ` +
               `as Bapa covering part of the amount.`,
      };
    }
  }
  /* A gift IS Bapa's whole share, so the planned figure is not a
     separate answer the operator can get wrong — it is set from the
     contribution. */
  return { gift: 1, bhuvaji: amountCommitted };
}

const BOOKING_SELECT = `
  SELECT b.*, ps.slot_date, ps.pooja_id, pe.name AS pooja_name, pe.category, pe.amount AS suggested_amount,
         d.full_name, d.mobile, d.city, d.state, d.mul_vatan,
         s.value AS samaj, c.value AS category_name,
         (SELECT IFNULL(SUM(amount),0) FROM payments WHERE booking_id = b.id) AS amount_paid,
         (SELECT IFNULL(SUM(amount),0) FROM payments
           WHERE booking_id = b.id AND payer_type = 'bhuvaji')  AS bappa_paid,
         (SELECT IFNULL(SUM(amount),0) FROM payments
           WHERE booking_id = b.id AND payer_type <> 'bhuvaji') AS devotee_paid,
         /* When money last actually arrived, as distinct from the seva's
            own date — a collections list has to show when the entry
            happened, not only which day the pooja falls on. */
         (SELECT MAX(payment_date) FROM payments WHERE booking_id = b.id) AS last_payment_date,
         (SELECT COUNT(*) FROM payments WHERE booking_id = b.id)          AS payment_count,
         /* Every receipt this seat has been given, oldest first. The
            export carries them so a printed sheet can be checked
            against the receipt book without opening each row; the
            ledger is still where an individual entry is corrected. */
         (SELECT GROUP_CONCAT(receipt_no, ' ') FROM (
            SELECT receipt_no FROM payments
             WHERE booking_id = b.id AND receipt_no IS NOT NULL AND TRIM(receipt_no) <> ''
             ORDER BY created_at, id))                                     AS receipt_nos
    FROM sevarthi_bookings b
    JOIN pooja_slots  ps ON ps.id = b.slot_id
    JOIN pooja_events pe ON pe.id = ps.pooja_id
    JOIN devotees     d  ON d.id  = b.devotee_id
    LEFT JOIN lookups s ON s.id = d.samaj_id
    LEFT JOIN lookups c ON c.id = d.category_id
`;

router.get('/', (req, res) => {
  const { status, pooja_id, search, pending_only } = req.query;
  const where = [];
  const params = {};
  if (status) { where.push(`b.status = @status`); params.status = status; }
  if (pending_only === '1') where.push(`b.status IN ('pending','partially_paid')`);
  if (pooja_id) { where.push(`ps.pooja_id = @pooja_id`); params.pooja_id = pooja_id; }
  if (search) {
    where.push(`(d.full_name LIKE @q OR d.mobile LIKE @q OR s.value LIKE @q OR c.value LIKE @q OR pe.name LIKE @q)`);
    params.q = `%${String(search).trim()}%`;
  }
  const sql = BOOKING_SELECT + (where.length ? ` WHERE ${where.join(' AND ')}` : '') +
    ` ORDER BY b.created_at DESC LIMIT 500`;
  res.json(db.prepare(sql).all(params));
});

router.get('/:id', (req, res) => {
  const row = db.prepare(BOOKING_SELECT + ` WHERE b.id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Booking not found' });
  row.payments = db.prepare(`SELECT * FROM payments WHERE booking_id = ? ORDER BY created_at`).all(row.id);
  res.json(row);
});

/* Create a sevarthi booking. Accepts either an existing devotee_id or a
   full devotee object, which is upserted by mobile number first. */
router.post('/', (req, res) => {
  const b = req.body;
  try {
    const slot = db.prepare(`
      SELECT ps.*, pe.name AS pooja_name, pe.category, pe.status AS pooja_status
        FROM pooja_slots ps JOIN pooja_events pe ON pe.id = ps.pooja_id
       WHERE ps.id = ?
    `).get(b.slot_id);
    if (!slot) return res.status(404).json({ error: 'Pick a date for the pooja' });
    if (slot.pooja_status === 'closed') return res.status(409).json({ error: 'This pooja is closed for new sevarthi' });

    const amountCommitted = Number(b.amount_committed || 0);
    let bhuvajiPlanned = Number(b.bhuvaji_planned_amount || 0);
    if (bhuvajiPlanned > amountCommitted) {
      return res.status(400).json({ error: "Bapa's share cannot exceed the total contribution" });
    }
    const g = resolveGift(null, b.is_gift, 0, amountCommitted, bhuvajiPlanned);
    if (g.error) return res.status(g.status).json({ error: g.error });
    bhuvajiPlanned = g.bhuvaji;
    const isGift = g.gift;
    /* A gift is Bapa's, end to end. Taking money from the sevarthi into
       one would contradict the thing the flag exists to promise, and a
       registration that half-succeeded is worse than one refused. */
    if (isGift && (b.payment || {}).devotee_amount > 0) {
      return res.status(400).json({ error: 'A gift from Bapa cannot take money from the sevarthi — record the whole amount as Bapa\'s' });
    }
    if (isGift && b.payment && b.payment.amount > 0 && b.payment.payer_type !== 'bhuvaji') {
      return res.status(400).json({ error: 'A gift from Bapa cannot take money from the sevarthi — record the whole amount as Bapa\'s' });
    }

    let devoteeId = b.devotee_id;
    if (!devoteeId) {
      const r = upsertDevotee(req, b.devotee || b, { requireMobile: true });
      devoteeId = r.id;
    }

    /* A sevarthi who hands the money over as they register should not
       have to be found again afterwards to record it, so `payment` is
       accepted here in the same shapes POST /api/payments takes
       (single or split). It goes in the *same* transaction as the seat:
       a booking that kept the patla but lost the cash would be worse
       than either failing outright. */
    const parsedPayment = readPaymentEntries(b.payment);
    if (parsedPayment.error) return res.status(400).json({ error: parsedPayment.error });
    const paymentEntries = parsedPayment.entries;

    const book = db.transaction(() => {
      const fresh = db.prepare(`SELECT * FROM pooja_slots WHERE id = ?`).get(slot.id);
      if (fresh.capacity !== null && fresh.booked_count >= fresh.capacity) {
        throw Object.assign(new Error(`${slotWhen(slot.slot_date)} is fully booked — please pick another day.`), { status: 409 });
      }
      const info = db.prepare(`
        INSERT INTO sevarthi_bookings (slot_id, devotee_id, amount_committed, bhuvaji_planned_amount, is_gift, notes, status)
        VALUES (@slot_id, @devotee_id, @amount_committed, @bhuvaji_planned_amount, @is_gift, @notes, 'pending')
      `).run({
        slot_id: slot.id,
        devotee_id: devoteeId,
        amount_committed: amountCommitted,
        bhuvaji_planned_amount: bhuvajiPlanned,
        is_gift: isGift,
        notes: (b.notes || '').trim() || null,
      });
      db.prepare(`UPDATE pooja_slots SET booked_count = booked_count + 1 WHERE id = ?`).run(slot.id);
      const id = Number(info.lastInsertRowid);
      const paymentIds = paymentEntries.length
        ? insertPaymentRows(id, paymentEntries, b.payment, actingUser(req)) : [];
      return { id, paymentIds };
    });

    const { id: bookingId, paymentIds } = book();
    // Status is always recomputed from the ledger, never set by hand.
    if (paymentIds.length) refreshStatus(bookingId);

    const row = db.prepare(BOOKING_SELECT + ` WHERE b.id = ?`).get(bookingId);
    log(req, {
      action: 'create', entity: 'booking', entityId: bookingId,
      summary: `${row.full_name} added as sevarthi — ${row.pooja_name} on ${slotWhen(row.slot_date)} (₹${amountCommitted})` +
               (isGift ? ' — a gift from Bhuvaji Suresh Bapa' : ''),
      details: { pooja: row.pooja_name, date: row.slot_date, amount_committed: amountCommitted,
                 bhuvaji_planned: bhuvajiPlanned, gift_from_bapa: !!isGift },
    });
    /* The payment is audited as a payment in its own right, so the cash
       trail reads the same whether it arrived at registration or later. */
    paymentEntries.forEach((e, i) => {
      log(req, {
        action: 'payment', entity: 'payment', entityId: paymentIds[i],
        summary: `₹${e.amount} cash received from ` +
                 `${e.payer_type === 'bhuvaji' ? 'Bapa (on behalf of ' + row.full_name + ')' : row.full_name}` +
                 ` at registration — ${row.pooja_name} ${slotWhen(row.slot_date)} [${row.status}]`,
        details: { amount: e.amount, payer_type: e.payer_type, booking_id: bookingId, at_registration: true },
      });
    });
    res.status(201).json(row);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

/** Cancel — releases the patla back to that day's pool. */
router.post('/:id/cancel', (req, res) => {
  const booking = db.prepare(`SELECT * FROM sevarthi_bookings WHERE id = ?`).get(req.params.id);
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  if (booking.status === 'cancelled') return res.status(400).json({ error: 'Already cancelled' });

  const paid = db.prepare(`SELECT IFNULL(SUM(amount),0) AS n FROM payments WHERE booking_id = ?`).get(booking.id).n;

  db.transaction(() => {
    db.prepare(`
      UPDATE sevarthi_bookings SET status='cancelled', cancelled_at=datetime('now','localtime'),
             updated_at=datetime('now','localtime'), notes = COALESCE(notes,'') || @reason
       WHERE id=@id
    `).run({ id: booking.id, reason: req.body.reason ? `\nCancelled: ${req.body.reason}` : '' });
    db.prepare(`UPDATE pooja_slots SET booked_count = MAX(0, booked_count - 1) WHERE id = ?`).run(booking.slot_id);
  })();

  const row = db.prepare(BOOKING_SELECT + ` WHERE b.id = ?`).get(booking.id);
  log(req, {
    action: 'cancel', entity: 'booking', entityId: booking.id,
    summary: `Cancelled sevarthi booking for ${row.full_name} — ${row.pooja_name} ${slotWhen(row.slot_date)}` +
             (paid > 0 ? ` (₹${paid} already received — refund to be settled)` : ''),
    details: { amount_paid: paid, reason: req.body.reason || null },
  });
  res.json({ ...row, refund_due: paid });
});

router.put('/:id', (req, res) => {
  const booking = db.prepare(`SELECT * FROM sevarthi_bookings WHERE id = ?`).get(req.params.id);
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  const amount = Number(req.body.amount_committed ?? booking.amount_committed);
  let bhuvaji = Number(req.body.bhuvaji_planned_amount ?? booking.bhuvaji_planned_amount);
  if (bhuvaji > amount) return res.status(400).json({ error: "Bapa's share cannot exceed the total contribution" });
  /* Raising the contribution on a gift raises Bapa's share with it —
     the whole point is that the sevarthi is never left a balance. */
  const g = resolveGift(booking.id, req.body.is_gift, booking.is_gift, amount, bhuvaji);
  if (g.error) return res.status(g.status).json({ error: g.error });
  bhuvaji = g.bhuvaji;

  db.prepare(`
    UPDATE sevarthi_bookings SET amount_committed=@amount, bhuvaji_planned_amount=@bhuvaji,
           is_gift=@is_gift, notes=@notes, updated_at=datetime('now','localtime') WHERE id=@id
  `).run({ id: booking.id, amount, bhuvaji, is_gift: g.gift, notes: req.body.notes ?? booking.notes });
  refreshStatus(booking.id);

  const row = db.prepare(BOOKING_SELECT + ` WHERE b.id = ?`).get(booking.id);
  log(req, {
    action: 'update', entity: 'booking', entityId: booking.id,
    summary: `Updated sevarthi booking for ${row.full_name} (₹${amount})` +
             (g.gift !== (booking.is_gift ? 1 : 0)
               ? (g.gift ? ' — now a gift from Bhuvaji Suresh Bapa' : ' — no longer a gift from Bapa')
               : ''),
    details: { amount_committed: amount, bhuvaji_planned_amount: bhuvaji, gift_from_bapa: !!g.gift },
  });
  res.json(row);
});

/** Move a booking to a different pooja/day — its payment history stays
    attached to the same booking id, only the seat (and, optionally, the
    committed amount) changes. Seat accounting is one transaction: the old
    slot's count is released and the new slot's capacity re-checked and
    incremented together, so this is as overbooking-safe as creating a
    fresh booking. */
router.post('/:id/reassign', (req, res) => {
  const booking = db.prepare(`SELECT * FROM sevarthi_bookings WHERE id = ?`).get(req.params.id);
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  if (booking.status === 'cancelled') {
    return res.status(400).json({ error: 'This sevarthi is cancelled — add a new booking instead of moving it' });
  }

  const newSlot = db.prepare(`
    SELECT ps.*, pe.name AS pooja_name, pe.status AS pooja_status
      FROM pooja_slots ps JOIN pooja_events pe ON pe.id = ps.pooja_id
     WHERE ps.id = ?
  `).get(req.body.slot_id);
  if (!newSlot) return res.status(404).json({ error: 'Pick a day for the new seva' });
  if (newSlot.pooja_status === 'closed') return res.status(409).json({ error: 'That seva is closed for new sevarthi' });

  const oldSlot = db.prepare(`
    SELECT ps.*, pe.name AS pooja_name
      FROM pooja_slots ps JOIN pooja_events pe ON pe.id = ps.pooja_id
     WHERE ps.id = ?
  `).get(booking.slot_id);

  const amount = Number(req.body.amount_committed ?? booking.amount_committed);
  let bhuvaji = Number(req.body.bhuvaji_planned_amount ?? booking.bhuvaji_planned_amount);
  if (bhuvaji > amount) return res.status(400).json({ error: "Bapa's share cannot exceed the total contribution" });
  /* A gift travels with the sevarthi, and re-covers the new
     contribution in full — moving to a dearer seva must not quietly
     leave them a balance on something they were given. */
  const g = resolveGift(booking.id, req.body.is_gift, booking.is_gift, amount, bhuvaji);
  if (g.error) return res.status(g.status).json({ error: g.error });
  bhuvaji = g.bhuvaji;

  const move = db.transaction(() => {
    if (newSlot.id !== oldSlot.id) {
      const fresh = db.prepare(`SELECT * FROM pooja_slots WHERE id = ?`).get(newSlot.id);
      if (fresh.capacity !== null && fresh.booked_count >= fresh.capacity) {
        throw Object.assign(
          new Error(`${newSlot.slot_date || 'That day'} is fully booked — pick another day.`),
          { status: 409 }
        );
      }
      db.prepare(`UPDATE pooja_slots SET booked_count = MAX(0, booked_count - 1) WHERE id = ?`).run(oldSlot.id);
      db.prepare(`UPDATE pooja_slots SET booked_count = booked_count + 1 WHERE id = ?`).run(newSlot.id);
    }
    db.prepare(`
      UPDATE sevarthi_bookings SET slot_id=@slot_id, amount_committed=@amount, bhuvaji_planned_amount=@bhuvaji,
             is_gift=@is_gift, updated_at=datetime('now','localtime') WHERE id=@id
    `).run({ id: booking.id, slot_id: newSlot.id, amount, bhuvaji, is_gift: g.gift });
  });

  try {
    move();
  } catch (e) {
    return res.status(e.status || 500).json({ error: e.message });
  }
  refreshStatus(booking.id);

  const row = db.prepare(BOOKING_SELECT + ` WHERE b.id = ?`).get(booking.id);
  log(req, {
    action: 'update', entity: 'booking', entityId: booking.id,
    summary: newSlot.id === oldSlot.id
      ? `Updated ${row.full_name}'s seva (₹${amount})`
      : `Moved ${row.full_name} from ${oldSlot.pooja_name} (${oldSlot.slot_date || 'date TBA'}) to ${row.pooja_name} (${row.slot_date || 'date TBA'})`,
    details: {
      from_pooja: oldSlot.pooja_name, from_slot: oldSlot.slot_date,
      to_pooja: row.pooja_name, to_slot: row.slot_date,
      amount_committed: amount, bhuvaji_planned_amount: bhuvaji, gift_from_bapa: !!g.gift,
    },
  });
  res.json(row);
});

module.exports = { router, refreshStatus, BOOKING_SELECT };
