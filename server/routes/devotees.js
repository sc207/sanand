/* Devotee register — the permanent asset. Every sevarthi booking,
   payment and donation hangs off one of these rows.

   Dedup rule: a mobile number is treated as the identity key. Saving a
   devotee whose mobile already exists updates that person instead of
   creating a second copy of them, so the register does not fragment. */
const express = require('express');
const db = require('../db');
const { log } = require('../middleware/audit');

const router = express.Router();

/* The register is the hub a devotee's whole relationship hangs off, so
   the list carries enough to judge them at a glance without opening
   each profile: how many seva, what they committed against what is
   covered, what is still outstanding, plus donations and padhramni.

   Outstanding is summed PER BOOKING (max(committed - paid, 0)) for the
   same reason it is everywhere else — netting one seat's overpayment
   against another's shortfall understates what is owed. */
const SELECT = `
  SELECT d.*,
         s.value AS samaj,
         c.value AS category,
         (SELECT COUNT(*) FROM sevarthi_bookings b
            WHERE b.devotee_id = d.id AND b.status <> 'cancelled')       AS booking_count,
         (SELECT IFNULL(SUM(p.amount), 0) FROM payments p
            JOIN sevarthi_bookings b2 ON b2.id = p.booking_id
           WHERE b2.devotee_id = d.id)                                    AS total_paid,
         (SELECT IFNULL(SUM(b.amount_committed), 0) FROM sevarthi_bookings b
            WHERE b.devotee_id = d.id AND b.status <> 'cancelled')        AS total_committed,
         (SELECT IFNULL(SUM(pb.amount), 0) FROM payments pb
            JOIN sevarthi_bookings b3 ON b3.id = pb.booking_id
           WHERE b3.devotee_id = d.id AND pb.payer_type = 'bhuvaji')      AS bappa_paid,
         (SELECT IFNULL(SUM(CASE WHEN b.amount_committed > IFNULL(pd.paid, 0)
                                 THEN b.amount_committed - IFNULL(pd.paid, 0) ELSE 0 END), 0)
            FROM sevarthi_bookings b
            LEFT JOIN (SELECT booking_id, SUM(amount) AS paid FROM payments GROUP BY booking_id) pd
                   ON pd.booking_id = b.id
           WHERE b.devotee_id = d.id AND b.status <> 'cancelled')         AS outstanding,
         /* Cancelled seats are excluded from booking_count but their
            payments still sit in total_paid — money the trust holds
            and owes back. Counted so a row can say so rather than
            showing a figure with no seva to explain it. */
         (SELECT COUNT(*) FROM sevarthi_bookings b
            WHERE b.devotee_id = d.id AND b.status = 'cancelled')         AS cancelled_count,
         (SELECT IFNULL(SUM(amount), 0) FROM donations WHERE devotee_id = d.id) AS donation_total,
         (SELECT COUNT(*) FROM visits WHERE devotee_id = d.id)            AS visit_count
    FROM devotees d
    LEFT JOIN lookups s ON s.id = d.samaj_id
    LEFT JOIN lookups c ON c.id = d.category_id
`;

router.get('/', (req, res) => {
  const q = String(req.query.search || '').trim();
  const samajId = req.query.samaj_id;
  const categoryId = req.query.category_id;

  const where = [];
  const params = {};
  if (q) {
    where.push(`(d.full_name LIKE @q OR d.mobile LIKE @q OR d.city LIKE @q OR d.mul_vatan LIKE @q
                 OR s.value LIKE @q OR c.value LIKE @q)`);
    params.q = `%${q}%`;
  }
  if (samajId) { where.push(`d.samaj_id = @samajId`); params.samajId = samajId; }
  if (categoryId) { where.push(`d.category_id = @categoryId`); params.categoryId = categoryId; }

  const sql = SELECT + (where.length ? ` WHERE ${where.join(' AND ')}` : '') +
    ` ORDER BY d.full_name COLLATE NOCASE LIMIT 500`;
  res.json(db.prepare(sql).all(params));
});

router.get('/:id', (req, res) => {
  const row = db.prepare(SELECT + ` WHERE d.id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Devotee not found' });

  row.bookings = db.prepare(`
    SELECT b.*, pe.name AS pooja_name, pe.category, ps.slot_date,
           (SELECT IFNULL(SUM(amount),0) FROM payments WHERE booking_id = b.id) AS amount_paid,
           (SELECT IFNULL(SUM(amount),0) FROM payments
             WHERE booking_id = b.id AND payer_type = 'bhuvaji')  AS bappa_paid,
           (SELECT IFNULL(SUM(amount),0) FROM payments
             WHERE booking_id = b.id AND payer_type <> 'bhuvaji') AS devotee_paid
      FROM sevarthi_bookings b
      JOIN pooja_slots  ps ON ps.id = b.slot_id
      JOIN pooja_events pe ON pe.id = ps.pooja_id
     WHERE b.devotee_id = ?
     ORDER BY ps.slot_date
  `).all(row.id);

  row.donations = db.prepare(`
    SELECT dn.*, l.value AS category
      FROM donations dn LEFT JOIN lookups l ON l.id = dn.category_id
     WHERE dn.devotee_id = ? ORDER BY dn.donation_date DESC
  `).all(row.id);

  res.json(row);
});

/* Mobile is how the trust reaches a sevarthi, and it is the dedup key,
   so the REGISTRATION paths (devotee register, sevarthi booking) require
   it. Padhramni and walk-in donations deliberately do not: a visit or an
   offering still has to be recordable for someone whose number nobody
   has, and blocking that would stall event-day entry.

   The check is loose on purpose — at least ten digits — so a +91 prefix,
   a landline or an out-of-state number is not rejected. The stored form
   is unchanged (whitespace stripped only), so existing dedup matching
   keeps behaving exactly as it did. */
function assertMobile(mobile) {
  const digits = String(mobile || '').replace(/\D/g, '');
  if (!digits) {
    throw Object.assign(new Error('Mobile number is required'), { status: 400 });
  }
  if (digits.length < 10) {
    throw Object.assign(new Error('Enter the full mobile number (at least 10 digits)'), { status: 400 });
  }
}

/** Create, or update in place when the mobile number already exists.
    Pass { requireMobile: true } from a registration path. */
function upsertDevotee(req, body, opts = {}) {
  const full_name = String(body.full_name || '').trim();
  if (!full_name) throw Object.assign(new Error('Full name is required'), { status: 400 });

  const mobile = String(body.mobile || '').replace(/\s+/g, '').trim() || null;
  if (opts.requireMobile) assertMobile(mobile);
  const payload = {
    full_name,
    mobile,
    city: (body.city || '').trim() || null,
    state: (body.state || 'Gujarat').trim() || null,
    mul_vatan: (body.mul_vatan || '').trim() || null,
    samaj_id: body.samaj_id || null,
    category_id: body.category_id || null,
    notes: (body.notes || '').trim() || null,
  };

  const existing = mobile
    ? db.prepare(`SELECT * FROM devotees WHERE mobile = ?`).get(mobile)
    : null;

  if (existing) {
    /* Merge, never clobber. The Add-Sevarthi form may not carry every
       field (e.g. samaj left blank on a repeat booking) — a blank there
       means "unchanged", not "erase what we already know". */
    const merged = {
      id: existing.id,
      full_name: payload.full_name || existing.full_name,
      mobile: payload.mobile || existing.mobile,
      city: payload.city ?? existing.city,
      state: payload.state || existing.state,
      mul_vatan: payload.mul_vatan ?? existing.mul_vatan,
      samaj_id: payload.samaj_id ?? existing.samaj_id,
      category_id: payload.category_id ?? existing.category_id,
      notes: payload.notes ?? existing.notes,
    };
    db.prepare(`
      UPDATE devotees SET full_name=@full_name, mobile=@mobile, city=@city, state=@state,
             mul_vatan=@mul_vatan, samaj_id=@samaj_id, category_id=@category_id, notes=@notes,
             updated_at=datetime('now','localtime')
       WHERE id=@id
    `).run(merged);
    log(req, {
      action: 'update', entity: 'devotee', entityId: existing.id,
      summary: `Updated devotee ${merged.full_name}`, details: merged,
    });
    return { id: existing.id, created: false };
  }

  const info = db.prepare(`
    INSERT INTO devotees (full_name, mobile, city, state, mul_vatan, samaj_id, category_id, notes)
    VALUES (@full_name, @mobile, @city, @state, @mul_vatan, @samaj_id, @category_id, @notes)
  `).run(payload);
  log(req, {
    action: 'create', entity: 'devotee', entityId: info.lastInsertRowid,
    summary: `Registered devotee ${full_name}`, details: payload,
  });
  return { id: Number(info.lastInsertRowid), created: true };
}

router.post('/', (req, res) => {
  try {
    const { id, created } = upsertDevotee(req, req.body, { requireMobile: true });
    const row = db.prepare(SELECT + ` WHERE d.id = ?`).get(id);
    res.status(created ? 201 : 200).json(row);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

router.put('/:id', (req, res) => {
  const existing = db.prepare(`SELECT * FROM devotees WHERE id = ?`).get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Devotee not found' });
  const b = req.body;
  /* Editing an older record without a number is where the register gets
     cleaned up, so the requirement applies here too. */
  try {
    assertMobile((b.mobile ?? existing.mobile));
  } catch (e) {
    return res.status(e.status || 400).json({ error: e.message });
  }
  db.prepare(`
    UPDATE devotees SET full_name=@full_name, mobile=@mobile, city=@city, state=@state,
           mul_vatan=@mul_vatan, samaj_id=@samaj_id, category_id=@category_id, notes=@notes,
           updated_at=datetime('now','localtime')
     WHERE id=@id
  `).run({
    id: existing.id,
    full_name: String(b.full_name || existing.full_name).trim(),
    mobile: (b.mobile || '').replace(/\s+/g, '').trim() || null,
    city: (b.city || '').trim() || null,
    state: (b.state || 'Gujarat').trim() || null,
    mul_vatan: (b.mul_vatan || '').trim() || null,
    samaj_id: b.samaj_id || null,
    category_id: b.category_id || null,
    notes: (b.notes || '').trim() || null,
  });
  log(req, {
    action: 'update', entity: 'devotee', entityId: existing.id,
    summary: `Updated devotee ${b.full_name || existing.full_name}`,
  });
  res.json(db.prepare(SELECT + ` WHERE d.id = ?`).get(existing.id));
});

module.exports = { router, upsertDevotee };
