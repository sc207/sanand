/* Bappa / Bhuvaji Padhramni — home & shop visits.

   The person being visited links to the devotee register the same way a
   sevarthi booking does: pick an existing devotee, or type a new one and
   it upserts (mobile is the identity key). One or more devotees can be
   named as the escort leading the visit — a person, not a team, since
   there is no Management module in Phase 1 to hold a team roster. */
const express = require('express');
const db = require('../db');
const { log } = require('../middleware/audit');
const { upsertDevotee } = require('./devotees');

const router = express.Router();
const STATUSES = ['requested', 'confirmed', 'completed', 'cancelled'];

function escortsOf(visitId) {
  return db.prepare(`
    SELECT d.id, d.full_name, d.mobile, d.city
      FROM visit_escorts ve JOIN devotees d ON d.id = ve.devotee_id
     WHERE ve.visit_id = ? ORDER BY d.full_name
  `).all(visitId);
}

function setEscorts(visitId, ids) {
  db.prepare(`DELETE FROM visit_escorts WHERE visit_id = ?`).run(visitId);
  const add = db.prepare(`INSERT OR IGNORE INTO visit_escorts (visit_id, devotee_id) VALUES (?, ?)`);
  [...new Set((ids || []).filter(Boolean))].forEach((id) => add.run(visitId, id));
}

router.get('/', (req, res) => {
  const { status, month, search, upcoming } = req.query;
  const where = [];
  const params = {};
  if (status) { where.push(`status = @status`); params.status = status; }
  if (month) { where.push(`substr(visit_date,1,7) = @month`); params.month = month; }
  if (upcoming === '1') {
    where.push(`visit_date >= date('now','localtime') AND status <> 'cancelled'`);
  }
  if (search) {
    where.push(`(devotee_name LIKE @q OR mobile LIKE @q OR city LIKE @q OR address LIKE @q)`);
    params.q = `%${String(search).trim()}%`;
  }
  const rows = db.prepare(
    `SELECT * FROM visits ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY visit_date DESC, visit_time LIMIT 500`
  ).all(params);
  rows.forEach((r) => { r.escorts = escortsOf(r.id); });
  res.json(rows);
});

router.get('/:id', (req, res) => {
  const row = db.prepare(`SELECT * FROM visits WHERE id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  row.escorts = escortsOf(row.id);
  res.json(row);
});

router.post('/', (req, res) => {
  const b = req.body;
  let name = String(b.devotee_name || '').trim();
  if (!b.visit_date) return res.status(400).json({ error: 'Visit date is required' });

  // Pick an existing devotee, or upsert a new one from the typed name/mobile.
  let devoteeId = b.devotee_id || null;
  if (!devoteeId && name) {
    devoteeId = upsertDevotee(req, {
      full_name: name, mobile: b.mobile, city: b.city,
    }).id;
  }
  if (!name && devoteeId) {
    const d = db.prepare(`SELECT full_name FROM devotees WHERE id = ?`).get(devoteeId);
    name = d ? d.full_name : '';
  }
  if (!name) return res.status(400).json({ error: 'Pick or add the devotee being visited' });

  const create = db.transaction(() => {
    const info = db.prepare(`
      INSERT INTO visits (devotee_id, devotee_name, mobile, purpose, address, city, visit_date, visit_time, status, notes)
      VALUES (@devotee_id, @devotee_name, @mobile, @purpose, @address, @city, @visit_date, @visit_time, @status, @notes)
    `).run({
      devotee_id: devoteeId,
      devotee_name: name,
      mobile: (b.mobile || '').trim() || null,
      purpose: (b.purpose || '').trim() || null,
      address: (b.address || '').trim() || null,
      city: (b.city || '').trim() || null,
      visit_date: b.visit_date,
      visit_time: (b.visit_time || '').trim() || null,
      status: STATUSES.includes(b.status) ? b.status : 'requested',
      notes: (b.notes || '').trim() || null,
    });
    const id = Number(info.lastInsertRowid);
    setEscorts(id, b.escort_ids);
    return id;
  });

  const id = create();
  const row = db.prepare(`SELECT * FROM visits WHERE id = ?`).get(id);
  row.escorts = escortsOf(id);
  log(req, {
    action: 'create', entity: 'visit', entityId: row.id,
    summary: `Padhramni booked for ${name} on ${b.visit_date}` +
             (row.escorts.length ? ` — escort: ${row.escorts.map((e) => e.full_name).join(', ')}` : ''),
    details: row,
  });
  res.status(201).json(row);
});

router.put('/:id', (req, res) => {
  const row = db.prepare(`SELECT * FROM visits WHERE id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  const b = req.body;

  let devoteeId = b.devotee_id !== undefined ? b.devotee_id : row.devotee_id;
  let name = b.devotee_name !== undefined ? String(b.devotee_name).trim() : row.devotee_name;
  if (!devoteeId && name && b.devotee_name !== undefined) {
    devoteeId = upsertDevotee(req, { full_name: name, mobile: b.mobile, city: b.city }).id;
  }

  db.transaction(() => {
    db.prepare(`
      UPDATE visits SET devotee_id=@devotee_id, devotee_name=@devotee_name, mobile=@mobile, purpose=@purpose,
             address=@address, city=@city, visit_date=@visit_date, visit_time=@visit_time, status=@status,
             notes=@notes, updated_at=datetime('now','localtime')
       WHERE id=@id
    `).run({
      id: row.id,
      devotee_id: devoteeId,
      devotee_name: name,
      mobile: b.mobile ?? row.mobile,
      purpose: b.purpose ?? row.purpose,
      address: b.address ?? row.address,
      city: b.city ?? row.city,
      visit_date: b.visit_date ?? row.visit_date,
      visit_time: b.visit_time ?? row.visit_time,
      status: STATUSES.includes(b.status) ? b.status : row.status,
      notes: b.notes ?? row.notes,
    });
    if (b.escort_ids !== undefined) setEscorts(row.id, b.escort_ids);
  })();

  const updated = db.prepare(`SELECT * FROM visits WHERE id = ?`).get(row.id);
  updated.escorts = escortsOf(row.id);
  log(req, {
    action: 'update', entity: 'visit', entityId: row.id,
    summary: `Padhramni for ${updated.devotee_name} — ${updated.status} (${updated.visit_date})`,
  });
  res.json(updated);
});

router.delete('/:id', (req, res) => {
  const row = db.prepare(`SELECT * FROM visits WHERE id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  db.prepare(`DELETE FROM visits WHERE id = ?`).run(row.id);
  log(req, {
    action: 'delete', entity: 'visit', entityId: row.id,
    summary: `Deleted padhramni for ${row.devotee_name} (${row.visit_date})`, details: row,
  });
  res.json({ ok: true });
});

module.exports = router;
