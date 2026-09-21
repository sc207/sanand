/* Samaj / Devotee category / Donation category / Payment method.
   One table, one `type` column — every "add new … " button in the UI
   comes back here, so a new kind of list never needs a new table. */
const express = require('express');
const db = require('../db');
const { log } = require('../middleware/audit');

const router = express.Router();

const LABEL = {
  samaj: 'Samaj',
  devotee_category: 'Devotee Category',
  donation_category: 'Donation Category',
};

router.get('/', (req, res) => {
  const { type } = req.query;
  const rows = type
    ? db.prepare(`SELECT * FROM lookups WHERE type = ? AND active = 1 ORDER BY sort_order, value`).all(type)
    : db.prepare(`SELECT * FROM lookups WHERE active = 1 ORDER BY type, sort_order, value`).all();
  res.json(rows);
});

router.post('/', (req, res) => {
  const type = String(req.body.type || '').trim();
  const value = String(req.body.value || '').trim();
  if (!LABEL[type]) return res.status(400).json({ error: 'Unknown list type' });
  if (!value) return res.status(400).json({ error: 'Value is required' });

  const existing = db.prepare(`SELECT * FROM lookups WHERE type = ? AND value = ?`).get(type, value);
  if (existing) {
    if (!existing.active) db.prepare(`UPDATE lookups SET active = 1 WHERE id = ?`).run(existing.id);
    return res.json({ ...existing, active: 1 });
  }

  const info = db.prepare(`INSERT INTO lookups (type, value) VALUES (?, ?)`).run(type, value);
  const row = db.prepare(`SELECT * FROM lookups WHERE id = ?`).get(info.lastInsertRowid);
  log(req, {
    action: 'create', entity: 'lookup', entityId: row.id,
    summary: `Added ${LABEL[type]} "${value}"`, details: row,
  });
  res.status(201).json(row);
});

router.delete('/:id', (req, res) => {
  const row = db.prepare(`SELECT * FROM lookups WHERE id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  db.prepare(`UPDATE lookups SET active = 0 WHERE id = ?`).run(row.id);
  log(req, {
    action: 'delete', entity: 'lookup', entityId: row.id,
    summary: `Removed ${LABEL[row.type] || row.type} "${row.value}"`,
  });
  res.json({ ok: true });
});

module.exports = router;
