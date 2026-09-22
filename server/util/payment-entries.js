/* Turning a request body into payment ledger rows.
   ------------------------------------------------------------
   Money reaches the ledger from two directions — `POST /api/payments`
   for a collection, and `POST /api/bookings` when the sevarthi pays at
   the counter as they register — and both accept the same two shapes:

     single: { amount, payer_type }
     split:  { devotee_amount, bhuvaji_amount }

   A split is always two rows, never one merged row, because
   `payer_type` lives on the row and the devotee and Bapa totals must
   stay separable. This lives here, rather than in either route, so the
   two can never drift on what a valid payment is.

   `insertPaymentRows` deliberately does NOT open its own transaction:
   the booking route has to write the seat, the capacity increment and
   the payment inside one, and wrapping again would nest. Callers wrap.
*/
const db = require('../db');
const { todayLocal } = require('./dates');

/** @returns {{ entries: Array<{amount:number,payer_type:string}> }|{ error: string }} */
function readPaymentEntries(b) {
  if (!b) return { entries: [] };
  const isSplit = b.devotee_amount !== undefined || b.bhuvaji_amount !== undefined;

  if (!isSplit) {
    const amount = Number(b.amount || 0);
    if (!amount) return { entries: [] };          // nothing offered is not an error
    if (!(amount > 0)) return { error: 'Enter an amount greater than zero' };
    return { entries: [{ amount, payer_type: b.payer_type === 'bhuvaji' ? 'bhuvaji' : 'devotee' }] };
  }

  const fromDevotee = Number(b.devotee_amount || 0);
  const fromBapa = Number(b.bhuvaji_amount || 0);
  if (fromDevotee < 0 || fromBapa < 0) return { error: 'An amount cannot be negative' };
  if (!fromDevotee && !fromBapa) return { entries: [] };

  // A zero side is simply left out — never written as a ₹0 ledger row.
  const entries = [];
  if (fromDevotee > 0) entries.push({ amount: fromDevotee, payer_type: 'devotee' });
  if (fromBapa > 0) entries.push({ amount: fromBapa, payer_type: 'bhuvaji' });
  return { entries };
}

const INSERT = `
  INSERT INTO payments (booking_id, amount, payer_type, payment_date, receipt_no, notes, recorded_by)
  VALUES (@booking_id, @amount, @payer_type, @payment_date, @receipt_no, @notes, @recorded_by)`;

/** Write the rows. Call inside the caller's transaction. */
function insertPaymentRows(bookingId, entries, b, recordedBy) {
  const stmt = db.prepare(INSERT);
  const common = {
    booking_id: bookingId,
    payment_date: (b && b.payment_date) || todayLocal(),
    receipt_no: ((b && b.receipt_no) || '').trim() || null,
    notes: ((b && b.notes) || '').trim() || null,
    recorded_by: recordedBy || 'Unknown',
  };
  return entries.map((e) => Number(stmt.run({ ...common, ...e }).lastInsertRowid));
}

const actingUser = (req) =>
  (req.get('X-User-Name') ? decodeURIComponent(req.get('X-User-Name')) : 'Unknown');

module.exports = { readPaymentEntries, insertPaymentRows, actingUser };
