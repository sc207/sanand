/* Murti Pran Pratishtha Mahotsav — the three pooja categories, the
   poojas inside them, and the per-day seating (patla) slots. */
const express = require('express');
const db = require('../db');
const { log } = require('../middleware/audit');

const router = express.Router();

/* `icon` is a sprite id — the frontend renders it as
   <svg><use href="/assets/icons.svg#<icon>"></use></svg>. No emoji. */
const CATEGORIES = {
  maha_yagna:    { key: 'maha_yagna',    label: 'Maha Yagna',             icon: 'flame' },
  mandir_pooja:  { key: 'mandir_pooja',  label: 'Mandir ni Pooja',        icon: 'diya' },
  bhagvat_katha: { key: 'bhagvat_katha', label: 'Bhagvat Saptah — Katha', icon: 'book' },
};

/** Live totals for one pooja: seats, bookings and money. */
function poojaStats(poojaId) {
  const s = db.prepare(`
    SELECT IFNULL(SUM(capacity), 0)     AS total_seats,
           IFNULL(SUM(booked_count), 0) AS booked_seats,
           SUM(CASE WHEN capacity IS NULL THEN 1 ELSE 0 END) AS open_days,
           COUNT(*) AS day_count
      FROM pooja_slots WHERE pooja_id = ?
  `).get(poojaId);

  const money = db.prepare(`
    SELECT IFNULL(SUM(b.amount_committed), 0) AS committed,
           IFNULL((SELECT SUM(p.amount) FROM payments p
                     JOIN sevarthi_bookings b2 ON b2.id = p.booking_id
                     JOIN pooja_slots ps2 ON ps2.id = b2.slot_id
                    WHERE ps2.pooja_id = ?), 0) AS received
      FROM sevarthi_bookings b
      JOIN pooja_slots ps ON ps.id = b.slot_id
     WHERE ps.pooja_id = ? AND b.status <> 'cancelled'
  `).get(poojaId, poojaId);

  const unlimited = s.open_days > 0;
  return {
    total_seats: unlimited ? null : s.total_seats,
    booked_seats: s.booked_seats,
    seats_left: unlimited ? null : Math.max(0, s.total_seats - s.booked_seats),
    day_count: s.day_count,
    is_full: !unlimited && s.total_seats > 0 && s.booked_seats >= s.total_seats,
    committed: money.committed,
    received: money.received,
  };
}

function withStats(row) {
  const stats = poojaStats(row.id);
  /* A 'whole' pooja has one pooled slot, so the slot count is not the
     number of days it runs — that comes from its own date range. */
  if (row.seating_mode === 'whole' && row.start_date && row.end_date) {
    stats.day_count = datesBetween(row.start_date, row.end_date).length;
  }
  return { ...row, ...stats, category_label: (CATEGORIES[row.category] || {}).label };
}

/** Category-level progress bars for the Mahotsav landing screen. */
router.get('/categories', (req, res) => {
  const out = Object.values(CATEGORIES).map((c) => {
    const poojas = db.prepare(`SELECT * FROM pooja_events WHERE category = ?`).all(c.key).map(withStats);
    const agg = poojas.reduce((a, p) => ({
      total_seats: p.total_seats === null ? a.total_seats : a.total_seats + p.total_seats,
      booked_seats: a.booked_seats + p.booked_seats,
      target: a.target + (p.target_amount || 0),
      received: a.received + p.received,
      committed: a.committed + p.committed,
      unlimited: a.unlimited || p.total_seats === null,
    }), { total_seats: 0, booked_seats: 0, target: 0, received: 0, committed: 0, unlimited: false });

    return {
      ...c,
      pooja_count: poojas.length,
      total_seats: agg.unlimited ? null : agg.total_seats,
      booked_seats: agg.booked_seats,
      seats_left: agg.unlimited ? null : Math.max(0, agg.total_seats - agg.booked_seats),
      target_amount: agg.target,
      committed: agg.committed,
      received: agg.received,
    };
  });
  res.json(out);
});

router.get('/', (req, res) => {
  const { category } = req.query;
  const rows = category
    ? db.prepare(`SELECT * FROM pooja_events WHERE category = ? ORDER BY start_date, name`).all(category)
    : db.prepare(`SELECT * FROM pooja_events ORDER BY category, start_date, name`).all();
  res.json(rows.map(withStats));
});

router.get('/:id', (req, res) => {
  const row = db.prepare(`SELECT * FROM pooja_events WHERE id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Pooja not found' });

  const slots = db.prepare(`
    SELECT * FROM pooja_slots WHERE pooja_id = ? ORDER BY slot_date
  `).all(row.id).map((s) => ({
    ...s,
    seats_left: s.capacity === null ? null : Math.max(0, s.capacity - s.booked_count),
    is_full: s.capacity !== null && s.booked_count >= s.capacity,
  }));

  // FIFO ledger for this pooja — entries in the order they arrived.
  const ledger = db.prepare(`
    SELECT b.id AS booking_id, b.status, b.amount_committed, b.bhuvaji_planned_amount,
           b.created_at, ps.slot_date, d.full_name, d.mobile, d.city,
           s.value AS samaj,
           (SELECT IFNULL(SUM(amount),0) FROM payments WHERE booking_id = b.id) AS amount_paid
      FROM sevarthi_bookings b
      JOIN pooja_slots ps ON ps.id = b.slot_id
      JOIN devotees   d  ON d.id  = b.devotee_id
      LEFT JOIN lookups s ON s.id = d.samaj_id
     WHERE ps.pooja_id = ?
     ORDER BY b.created_at ASC, b.id ASC
  `).all(row.id);

  res.json({ ...withStats(row), slots, ledger });
});

function datesBetween(start, end) {
  const out = [];
  const d = new Date(start + 'T00:00:00');
  const last = new Date(end + 'T00:00:00');
  while (d <= last) {
    out.push(d.toLocaleDateString('en-CA'));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

router.post('/', (req, res) => {
  const b = req.body;
  const name = String(b.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Pooja name is required' });
  if (!CATEGORIES[b.category]) return res.status(400).json({ error: 'Pick a valid category' });

  /* Dates are optional. A pooja with no date still takes sevarthi — it
     gets one undated slot, and real day-slots are built once the trust
     fixes the date (PUT /poojas/:id/dates). */
  const dated = !!(b.start_date && b.end_date);
  if ((b.start_date && !b.end_date) || (!b.start_date && b.end_date)) {
    return res.status(400).json({ error: 'Give both a start and an end date, or leave both blank' });
  }
  if (dated && b.end_date < b.start_date) {
    return res.status(400).json({ error: 'End date cannot be before start date' });
  }

  const fixed = b.fixed_capacity === false || b.fixed_capacity === 0 ? 0 : 1;
  const seatsPerDay = fixed ? Number(b.seats_per_day || 0) : null;
  if (fixed && (!seatsPerDay || seatsPerDay < 1)) {
    return res.status(400).json({ error: 'Patla count is required when the seats are limited' });
  }
  const mode = b.seating_mode === 'whole' ? 'whole' : 'per_day';

  const create = db.transaction(() => {
    const info = db.prepare(`
      INSERT INTO pooja_events (category, name, description, seats_per_day, fixed_capacity,
                                seating_mode, amount, target_amount, start_date, end_date,
                                coordinator_devotee_id)
      VALUES (@category, @name, @description, @seats_per_day, @fixed_capacity,
              @seating_mode, @amount, @target_amount, @start_date, @end_date,
              @coordinator_devotee_id)
    `).run({
      category: b.category,
      name,
      description: (b.description || '').trim() || null,
      seats_per_day: seatsPerDay,
      fixed_capacity: fixed,
      seating_mode: mode,
      amount: Number(b.amount || 0),
      target_amount: Number(b.target_amount || 0),
      start_date: dated ? b.start_date : null,
      end_date: dated ? b.end_date : null,
      coordinator_devotee_id: b.coordinator_devotee_id || null,
    });
    const poojaId = Number(info.lastInsertRowid);
    const addSlot = db.prepare(
      `INSERT INTO pooja_slots (pooja_id, slot_date, capacity) VALUES (?, ?, ?)`
    );
    if (!dated) {
      addSlot.run(poojaId, null, seatsPerDay);          // date to be announced
    } else if (mode === 'whole') {
      addSlot.run(poojaId, b.start_date, seatsPerDay);  // one patla for the whole event
    } else {
      for (const date of datesBetween(b.start_date, b.end_date)) addSlot.run(poojaId, date, seatsPerDay);
    }
    return poojaId;
  });

  const id = create();
  log(req, {
    action: 'create', entity: 'pooja', entityId: id,
    summary: `Created ${CATEGORIES[b.category].label}: ${name}` + (dated ? '' : ' (date not fixed yet)'),
    details: { name, category: b.category, seats_per_day: seatsPerDay, amount: b.amount, dated },
  });
  res.status(201).json(db.prepare(`SELECT * FROM pooja_events WHERE id = ?`).get(id));
});

/** Fix the dates on a pooja that was created without them. The undated
    slot becomes the first day, so bookings already taken are kept. */
router.put('/:id/dates', (req, res) => {
  const p = db.prepare(`SELECT * FROM pooja_events WHERE id = ?`).get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Pooja not found' });

  const { start_date, end_date } = req.body;
  if (!start_date || !end_date) return res.status(400).json({ error: 'Give both a start and an end date' });
  if (end_date < start_date) return res.status(400).json({ error: 'End date cannot be before start date' });

  const dates = datesBetween(start_date, end_date);
  const undated = db.prepare(`SELECT * FROM pooja_slots WHERE pooja_id = ? AND slot_date IS NULL`).get(p.id);

  db.transaction(() => {
    db.prepare(`UPDATE pooja_events SET start_date=?, end_date=?, updated_at=datetime('now','localtime')
                 WHERE id=?`).run(start_date, end_date, p.id);

    // the undated slot (and anything booked on it) becomes day one
    if (undated) {
      db.prepare(`UPDATE pooja_slots SET slot_date = ? WHERE id = ?`).run(dates[0], undated.id);
    }
    // a 'whole' pooja keeps its single pooled slot; only per_day fans out
    if (p.seating_mode !== 'whole') {
      const addSlot = db.prepare(
        `INSERT OR IGNORE INTO pooja_slots (pooja_id, slot_date, capacity) VALUES (?, ?, ?)`
      );
      for (const d of dates) addSlot.run(p.id, d, p.seats_per_day);
    }

    // drop any day outside the new range that nobody has booked
    db.prepare(`DELETE FROM pooja_slots
                 WHERE pooja_id = ? AND booked_count = 0
                   AND (slot_date < ? OR slot_date > ?)`).run(p.id, start_date, end_date);
  })();

  log(req, {
    action: 'update', entity: 'pooja', entityId: p.id,
    summary: `Dates set for ${p.name}: ${start_date} to ${end_date}`,
  });
  res.json(withStats(db.prepare(`SELECT * FROM pooja_events WHERE id = ?`).get(p.id)));
});

/** Adjust one day's patla count (e.g. more mats arrived). Never below what is booked. */
router.put('/slots/:slotId', (req, res) => {
  const slot = db.prepare(`SELECT * FROM pooja_slots WHERE id = ?`).get(req.params.slotId);
  if (!slot) return res.status(404).json({ error: 'Slot not found' });

  const raw = req.body.capacity;
  const capacity = raw === null || raw === '' ? null : Number(raw);
  if (capacity !== null && capacity < slot.booked_count) {
    return res.status(400).json({
      error: `${slot.booked_count} sevarthi already booked on this day — capacity cannot be lower than that.`,
    });
  }
  db.prepare(`UPDATE pooja_slots SET capacity = ? WHERE id = ?`).run(capacity, slot.id);
  log(req, {
    action: 'update', entity: 'pooja_slot', entityId: slot.id,
    summary: `Seats for ${slot.slot_date} set to ${capacity === null ? 'unlimited' : capacity}`,
  });
  res.json(db.prepare(`SELECT * FROM pooja_slots WHERE id = ?`).get(slot.id));
});

router.put('/:id', (req, res) => {
  const row = db.prepare(`SELECT * FROM pooja_events WHERE id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Pooja not found' });
  const b = req.body;
  db.prepare(`
    UPDATE pooja_events SET name=@name, description=@description, amount=@amount,
           target_amount=@target_amount, status=@status, coordinator_devotee_id=@coordinator_devotee_id,
           updated_at=datetime('now','localtime')
     WHERE id=@id
  `).run({
    id: row.id,
    name: String(b.name || row.name).trim(),
    description: (b.description ?? row.description) || null,
    amount: Number(b.amount ?? row.amount),
    target_amount: Number(b.target_amount ?? row.target_amount),
    status: b.status || row.status,
    coordinator_devotee_id: b.coordinator_devotee_id ?? row.coordinator_devotee_id,
  });
  log(req, { action: 'update', entity: 'pooja', entityId: row.id, summary: `Updated pooja ${row.name}` });
  res.json(withStats(db.prepare(`SELECT * FROM pooja_events WHERE id = ?`).get(row.id)));
});

module.exports = { router, CATEGORIES };
