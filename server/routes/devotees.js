/* Devotee register — the permanent asset. Every sevarthi booking,
   payment and donation hangs off one of these rows.

   Dedup rule: a mobile number is treated as the identity key. Saving a
   devotee whose mobile already exists updates that person instead of
   creating a second copy of them, so the register does not fragment. */
const express = require('express');
const db = require('../db');
const { log } = require('../middleware/audit');

const router = express.Router();

const SELECT = `
  SELECT d.*,
         s.value AS samaj,
         c.value AS category,
         (SELECT COUNT(*) FROM sevarthi_bookings b
            WHERE b.devotee_id = d.id AND b.status <> 'cancelled')       AS booking_count,
         (SELECT IFNULL(SUM(p.amount), 0) FROM payments p
            JOIN sevarthi_bookings b2 ON b2.id = p.booking_id
           WHERE b2.devotee_id = d.id)                                    AS total_paid
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
           (SELECT IFNULL(SUM(amount),0) FROM payments WHERE booking_id = b.id) AS amount_paid
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

/** Create, or update in place when the mobile number already exists. */
function upsertDevotee(req, body) {
  const full_name = String(body.full_name || '').trim();
  if (!full_name) throw Object.assign(new Error('Full name is required'), { status: 400 });

  const mobile = String(body.mobile || '').replace(/\s+/g, '').trim() || null;
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
    const { id, created } = upsertDevotee(req, req.body);
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
