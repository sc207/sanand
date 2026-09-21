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
  /* Qualified with v. because the join brings a second `mobile` and
     `city` into scope. */
  if (status) { where.push(`v.status = @status`); params.status = status; }
  if (month) { where.push(`substr(v.visit_date,1,7) = @month`); params.month = month; }
  if (upcoming === '1') {
    where.push(`v.visit_date >= date('now','localtime') AND v.status <> 'cancelled'`);
  }
  if (search) {
    where.push(`(v.devotee_name LIKE @q OR v.mobile LIKE @q OR v.city LIKE @q
                 OR v.address LIKE @q OR d.full_name LIKE @q OR d.mobile LIKE @q
                 OR d.city LIKE @q)`);
    params.q = `%${String(search).trim()}%`;
  }

  /* A visit only stores mobile/city when this particular padhramni is
     somewhere other than the devotee's usual place. Picking a devotee
     from the register and leaving those blank is the normal case, so
     fall back to the register rather than showing a row with nothing
     on it but a date. `visit_*` keeps the visit's own value, which is
     what the edit form must not overwrite. */
  const rows = db.prepare(
    `SELECT v.id, v.devotee_id, v.purpose, v.address, v.visit_date, v.visit_time,
            v.status, v.notes, v.created_at, v.updated_at,
            COALESCE(d.full_name, v.devotee_name) AS devotee_name,
            COALESCE(v.mobile, d.mobile)          AS mobile,
            COALESCE(v.city,   d.city)            AS city,
            v.mobile AS visit_mobile, v.city AS visit_city,
            d.state, d.mul_vatan,
            (SELECT value FROM lookups WHERE id = d.samaj_id) AS samaj
       FROM visits v LEFT JOIN devotees d ON d.id = v.devotee_id
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ${/* A view of visits still to happen is a queue to work through,
            so it reads soonest first. Completed visits, and "all", are
            a record, so they read newest first. */''}
      ORDER BY v.visit_date ${
        upcoming === '1' || status === 'requested' || status === 'confirmed' ? 'ASC' : 'DESC'
      }, v.visit_time
      LIMIT 500`
  ).all(params);
  rows.forEach((r) => { r.escorts = escortsOf(r.id); });
  res.json(rows);
});

router.get('/:id', (req, res) => {
  /* The form edits the visit's own columns, so they come back raw —
     the devotee's details ride alongside as placeholders, so an
     operator can see what will be used without it being silently
     copied onto the visit. */
  const row = db.prepare(`
    SELECT v.*, d.mobile AS devotee_mobile, d.city AS devotee_city
      FROM visits v LEFT JOIN devotees d ON d.id = v.devotee_id
     WHERE v.id = ?`).get(req.params.id);
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
