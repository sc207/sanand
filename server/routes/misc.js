/* Dashboard, Universal Calendar, Settings, Accounts & Access, Audit log. */
const express = require('express');
const db = require('../db');
const { log } = require('../middleware/audit');
const { CATEGORIES } = require('./poojas');
const { todayLocal, monthLocal } = require('../util/dates');

const router = express.Router();

/* ---------- Dashboard ---------- */
router.get('/dashboard', (req, res) => {
  const today = todayLocal();
  const month = today.slice(0, 7);

  const one = (sql, ...p) => db.prepare(sql).get(...p);

  const devotees = one(`SELECT COUNT(*) AS n FROM devotees`).n;
  const sevarthi = one(`SELECT COUNT(*) AS n FROM sevarthi_bookings WHERE status <> 'cancelled'`).n;
  const committed = one(`SELECT IFNULL(SUM(amount_committed),0) AS n FROM sevarthi_bookings WHERE status <> 'cancelled'`).n;
  const received = one(`SELECT IFNULL(SUM(amount),0) AS n FROM payments`).n;
  const receivedToday = one(`SELECT IFNULL(SUM(amount),0) AS n FROM payments WHERE payment_date = ?`, today).n;
  const receivedMonth = one(`SELECT IFNULL(SUM(amount),0) AS n FROM payments WHERE substr(payment_date,1,7) = ?`, month).n;
  const bhuvajiCovered = one(`SELECT IFNULL(SUM(amount),0) AS n FROM payments WHERE payer_type='bhuvaji'`).n;
  const pending = one(`SELECT COUNT(*) AS n FROM sevarthi_bookings WHERE status IN ('pending','partially_paid')`).n;
  const donationsTotal = one(`SELECT IFNULL(SUM(amount),0) AS n FROM donations`).n;
  const upcomingVisits = one(
    `SELECT COUNT(*) AS n FROM visits WHERE visit_date >= ? AND status <> 'cancelled'`, today).n;

  const categories = Object.values(CATEGORIES).map((c) => {
    const r = db.prepare(`
      SELECT IFNULL(SUM(ps.capacity),0) AS seats,
             IFNULL(SUM(ps.booked_count),0) AS booked,
             SUM(CASE WHEN ps.capacity IS NULL THEN 1 ELSE 0 END) AS open_days
        FROM pooja_slots ps JOIN pooja_events pe ON pe.id = ps.pooja_id
       WHERE pe.category = ?
    `).get(c.key);
    const money = db.prepare(`
      SELECT IFNULL(SUM(pe.target_amount),0) AS target FROM pooja_events pe WHERE pe.category = ?
    `).get(c.key);
    const got = db.prepare(`
      SELECT IFNULL(SUM(p.amount),0) AS n FROM payments p
        JOIN sevarthi_bookings b ON b.id = p.booking_id
        JOIN pooja_slots ps ON ps.id = b.slot_id
        JOIN pooja_events pe ON pe.id = ps.pooja_id
       WHERE pe.category = ?
    `).get(c.key).n;
    return {
      ...c,
      seats: r.open_days > 0 ? null : r.seats,
      booked: r.booked,
      seats_left: r.open_days > 0 ? null : Math.max(0, r.seats - r.booked),
      target: money.target,
      received: got,
    };
  });

  const todaySlots = db.prepare(`
    SELECT pe.name AS pooja_name, pe.category, ps.slot_date, ps.capacity, ps.booked_count
      FROM pooja_slots ps JOIN pooja_events pe ON pe.id = ps.pooja_id
     WHERE ps.slot_date = ? ORDER BY pe.name
  `).all(today);

  const recentActivity = db.prepare(
    `SELECT * FROM audit_log ORDER BY id DESC LIMIT 12`).all();

  res.json({
    today,
    stats: {
      devotees, sevarthi, committed, received, receivedToday, receivedMonth,
      bhuvajiCovered, pending, donationsTotal, upcomingVisits,
      outstanding: Math.max(0, committed - received),
    },
    categories,
    todaySlots,
    recentActivity,
  });
});

/* ---------- Universal Calendar ---------- */
router.get('/calendar', (req, res) => {
  const month = req.query.month || monthLocal();
  const entries = [];

  /* per_day poojas put one entry on each day that has a slot. */
  db.prepare(`
    SELECT ps.slot_date, ps.capacity, ps.booked_count, pe.name, pe.category, pe.id AS pooja_id
      FROM pooja_slots ps JOIN pooja_events pe ON pe.id = ps.pooja_id
     WHERE substr(ps.slot_date,1,7) = ? AND pe.seating_mode = 'per_day'
  `).all(month).forEach((r) => {
    entries.push({
      date: r.slot_date, type: 'pooja', category: r.category, ref_id: r.pooja_id,
      title: r.name,
      sub: r.capacity === null
        ? `${r.booked_count} sevarthi`
        : `${r.booked_count}/${r.capacity} patla booked`,
    });
  });

  /* A 'whole' pooja has a single pooled slot but runs across its whole
     date range, so it is drawn from the event's own dates. */
  db.prepare(`
    SELECT pe.id, pe.name, pe.category, pe.start_date, pe.end_date,
           (SELECT IFNULL(SUM(capacity),0) FROM pooja_slots WHERE pooja_id = pe.id)     AS capacity,
           (SELECT IFNULL(SUM(booked_count),0) FROM pooja_slots WHERE pooja_id = pe.id) AS booked,
           (SELECT COUNT(*) FROM pooja_slots WHERE pooja_id = pe.id AND capacity IS NULL) AS open_seat
      FROM pooja_events pe
     WHERE pe.seating_mode = 'whole' AND pe.start_date IS NOT NULL
       AND substr(pe.start_date,1,7) <= ? AND substr(pe.end_date,1,7) >= ?
  `).all(month, month).forEach((p) => {
    const d = new Date(p.start_date + 'T00:00:00');
    const last = new Date(p.end_date + 'T00:00:00');
    while (d <= last) {
      const iso = d.toLocaleDateString('en-CA');
      if (iso.slice(0, 7) === month) {
        entries.push({
          date: iso, type: 'pooja', category: p.category, ref_id: p.id,
          title: p.name,
          sub: p.open_seat ? `${p.booked} sevarthi` : `${p.booked}/${p.capacity} patla booked`,
        });
      }
      d.setDate(d.getDate() + 1);
    }
  });

  db.prepare(`SELECT * FROM visits WHERE substr(visit_date,1,7) = ?`).all(month).forEach((v) => {
    entries.push({
      date: v.visit_date, type: 'visit', ref_id: v.id,
      title: `Padhramni — ${v.devotee_name}`,
      sub: [v.visit_time, v.city, v.status].filter(Boolean).join(' · '),
    });
  });

  db.prepare(`
    SELECT dn.*, l.value AS category FROM donations dn
      LEFT JOIN lookups l ON l.id = dn.category_id
     WHERE substr(dn.donation_date,1,7) = ?
  `).all(month).forEach((d) => {
    entries.push({
      date: d.donation_date, type: 'donation', ref_id: d.id,
      title: `Donation — ${d.donor_name}`,
      sub: (d.amount ? `₹${d.amount.toLocaleString('en-IN')}` : d.in_kind_item) +
           (d.category ? ` · ${d.category}` : ''),
    });
  });

  db.prepare(`
    SELECT p.payment_date, COUNT(*) AS n, SUM(p.amount) AS total
      FROM payments p WHERE substr(p.payment_date,1,7) = ? GROUP BY p.payment_date
  `).all(month).forEach((p) => {
    entries.push({
      date: p.payment_date, type: 'payment',
      title: `${p.n} payment${p.n > 1 ? 's' : ''} received`,
      sub: `₹${Number(p.total).toLocaleString('en-IN')}`,
    });
  });

  entries.sort((a, b) => a.date.localeCompare(b.date));
  res.json({ month, entries });
});

/* ---------- Settings ---------- */
router.get('/settings', (req, res) => {
  const rows = db.prepare(`SELECT * FROM settings`).all();
  res.json(Object.fromEntries(rows.map((r) => [r.key, r.value])));
});

router.put('/settings', (req, res) => {
  const stmt = db.prepare(`INSERT INTO settings (key, value) VALUES (?, ?)
                           ON CONFLICT(key) DO UPDATE SET value = excluded.value`);
  const entries = Object.entries(req.body || {});
  db.transaction(() => { for (const [k, v] of entries) stmt.run(k, String(v ?? '')); })();
  log(req, { action: 'update', entity: 'settings', summary: `Updated settings (${entries.map(e => e[0]).join(', ')})` });
  res.json({ ok: true });
});

/* ---------- Accounts & Access ---------- */
router.get('/users', (req, res) => {
  res.json(db.prepare(`SELECT * FROM users ORDER BY active DESC, name`).all());
});

router.post('/users', (req, res) => {
  const name = String(req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Name is required' });
  const info = db.prepare(`INSERT INTO users (name, mobile, email, role) VALUES (?, ?, ?, ?)`)
    .run(name, req.body.mobile || null, req.body.email || null, req.body.role || 'operator');
  const row = db.prepare(`SELECT * FROM users WHERE id = ?`).get(info.lastInsertRowid);
  log(req, { action: 'create', entity: 'user', entityId: row.id, summary: `Added user ${name} (${row.role})` });
  res.status(201).json(row);
});

router.put('/users/:id', (req, res) => {
  const row = db.prepare(`SELECT * FROM users WHERE id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  const b = req.body;
  db.prepare(`UPDATE users SET name=?, mobile=?, email=?, role=?, active=? WHERE id=?`).run(
    String(b.name ?? row.name).trim(), b.mobile ?? row.mobile, b.email ?? row.email,
    b.role ?? row.role, b.active === undefined ? row.active : (b.active ? 1 : 0), row.id
  );
  const updated = db.prepare(`SELECT * FROM users WHERE id = ?`).get(row.id);
  log(req, { action: 'update', entity: 'user', entityId: row.id, summary: `Updated user ${updated.name}` });
  res.json(updated);
});

/* ---------- Offline translator (free text only) ----------
   The model loads lazily on first use — about 90s once, then fast. */
const translator = require('../translate');

router.get('/translate/status', (req, res) => res.json(translator.status()));

router.post('/translate/warmup', (req, res) => {
  translator.getPipeline().catch(() => {});   // fire and forget
  res.json({ started: true, ...translator.status() });
});

router.post('/translate', async (req, res) => {
  const text = String(req.body.text || '');
  if (!text.trim()) return res.json({ text: '', from: null, to: null });
  const from = req.body.from || translator.detect(text);
  const to = req.body.to || (from === 'gu' ? 'en' : 'gu');
  try {
    res.json({ text: await translator.translate(text, from, to), from, to });
  } catch (e) {
    res.status(503).json({ error: 'Translator is still preparing. Try again in a moment.' });
  }
});

/* ---------- Audit log ---------- */
router.get('/audit', (req, res) => {
  const { entity, entity_id, user, limit } = req.query;
  const where = [];
  const params = {};
  if (entity) { where.push(`entity = @entity`); params.entity = entity; }
  if (entity_id) { where.push(`entity_id = @entity_id`); params.entity_id = entity_id; }
  if (user) { where.push(`user_name LIKE @user`); params.user = `%${user}%`; }
  res.json(db.prepare(
    `SELECT * FROM audit_log ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY id DESC LIMIT ${Math.min(Number(limit) || 200, 1000)}`
  ).all(params));
});

module.exports = router;
