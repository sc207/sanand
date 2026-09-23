/* Donations — separate from sevarthi contributions. Categories come
   from the same lookup table, so "add new category" works inline. */
const express = require('express');
const db = require('../db');
const roles = require('../middleware/roles');
const receipts = require('../util/receipts');
const { log } = require('../middleware/audit');
const { upsertDevotee } = require('./devotees');
const { todayLocal, monthLocal } = require('../util/dates');

const router = express.Router();

const SELECT = `
  SELECT dn.*, l.value AS category, d.full_name AS devotee_name
    FROM donations dn
    LEFT JOIN lookups  l ON l.id = dn.category_id
    LEFT JOIN devotees d ON d.id = dn.devotee_id
`;

router.get('/', (req, res) => {
  const { month, date, search, category_id } = req.query;
  const where = [];
  const params = {};
  if (month) { where.push(`substr(dn.donation_date,1,7) = @month`); params.month = month; }
  if (date) { where.push(`dn.donation_date = @date`); params.date = date; }
  if (category_id) { where.push(`dn.category_id = @category_id`); params.category_id = category_id; }
  if (search) {
    where.push(`(dn.donor_name LIKE @q OR dn.mobile LIKE @q OR l.value LIKE @q OR dn.receipt_no LIKE @q)`);
    params.q = `%${String(search).trim()}%`;
  }
  const rows = db.prepare(
    SELECT + (where.length ? ` WHERE ${where.join(' AND ')}` : '') +
    ` ORDER BY dn.donation_date DESC, dn.created_at DESC LIMIT 500`
  ).all(params);
  const total = rows.reduce((a, r) => a + (r.amount || 0), 0);
  res.json({ donations: rows, totals: { total, count: rows.length } });
});

router.post('/', (req, res) => {
  const b = req.body;
  const donorName = String(b.donor_name || '').trim();
  if (!donorName) return res.status(400).json({ error: 'Donor name is required' });
  const amount = Number(b.amount || 0);
  if (!amount && !String(b.in_kind_item || '').trim()) {
    return res.status(400).json({ error: 'Enter an amount, or describe the in-kind item' });
  }

  // Optionally link/create the donor in the devotee register too.
  let devoteeId = b.devotee_id || null;
  if (!devoteeId && b.save_as_devotee) {
    devoteeId = upsertDevotee(req, {
      full_name: donorName, mobile: b.mobile, city: b.city,
      samaj_id: b.samaj_id, category_id: b.devotee_category_id,
    }).id;
  }

  const donationDate = b.donation_date || todayLocal();
  const info = db.prepare(`
    INSERT INTO donations (devotee_id, donor_name, mobile, category_id, amount, in_kind_item,
                           donation_date, receipt_no, notes, recorded_by)
    VALUES (@devotee_id, @donor_name, @mobile, @category_id, @amount, @in_kind_item,
            @donation_date, @receipt_no, @notes, @recorded_by)
  `).run({
    devotee_id: devoteeId,
    donor_name: donorName,
    mobile: (b.mobile || '').trim() || null,
    category_id: b.category_id || null,
    amount,
    in_kind_item: (b.in_kind_item || '').trim() || null,
    donation_date: donationDate,
    /* Issued, not typed — the same rule as a payment. A number the
       operator does type is still honoured, for a trust carrying a
       paper book across. */
    receipt_no: receipts.ensure(b.receipt_no, 'D', donationDate),
    notes: (b.notes || '').trim() || null,
    recorded_by: req.get('X-User-Name') ? decodeURIComponent(req.get('X-User-Name')) : 'Unknown',
  });

  const row = db.prepare(SELECT + ` WHERE dn.id = ?`).get(info.lastInsertRowid);
  log(req, {
    action: 'create', entity: 'donation', entityId: row.id,
    summary: `Donation ₹${amount || 0} from ${donorName}${row.category ? ' (' + row.category + ')' : ''}`,
    details: row,
  });
  res.status(201).json(row);
});

/** Correct a donation that was entered wrong — the whole row, because a
    mistyped amount, donor or date is exactly what needs fixing and
    delete-and-retype loses the receipt number and the audit trail. */
router.put('/:id', roles.needs('accountant', 'Correcting a donation'), (req, res) => {
  const row = db.prepare(`SELECT * FROM donations WHERE id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  const b = req.body;

  const donorName = String(b.donor_name ?? row.donor_name).trim();
  if (!donorName) return res.status(400).json({ error: 'Donor name is required' });
  const amount = Number(b.amount ?? row.amount);
  const inKind = ((b.in_kind_item ?? row.in_kind_item) || '').trim() || null;
  if (!amount && !inKind) {
    return res.status(400).json({ error: 'Enter an amount, or describe the in-kind item' });
  }

  db.prepare(`
    UPDATE donations SET donor_name=@donor_name, mobile=@mobile, category_id=@category_id,
           amount=@amount, in_kind_item=@in_kind_item, donation_date=@donation_date,
           receipt_no=@receipt_no, notes=@notes
     WHERE id=@id
  `).run({
    id: row.id,
    donor_name: donorName,
    mobile: ((b.mobile ?? row.mobile) || '').trim() || null,
    category_id: b.category_id ?? row.category_id,
    amount,
    in_kind_item: inKind,
    donation_date: b.donation_date || row.donation_date,
    receipt_no: ((b.receipt_no ?? row.receipt_no) || '').trim() || null,
    notes: ((b.notes ?? row.notes) || '').trim() || null,
  });

  const updated = db.prepare(SELECT + ` WHERE dn.id = ?`).get(row.id);
  log(req, {
    action: 'update', entity: 'donation', entityId: row.id,
    summary: `Updated donation from ${updated.donor_name}` +
             (row.amount !== amount ? ` (₹${row.amount} → ₹${amount})` : ''),
    details: { before: row, after: updated },
  });
  res.json(updated);
});

router.delete('/:id', roles.needs('accountant', 'Removing a donation'), (req, res) => {
  const row = db.prepare(`SELECT * FROM donations WHERE id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  db.prepare(`DELETE FROM donations WHERE id = ?`).run(row.id);
  log(req, {
    action: 'delete', entity: 'donation', entityId: row.id,
    summary: `Deleted donation of ₹${row.amount} from ${row.donor_name}`, details: row,
  });
  res.json({ ok: true });
});

module.exports = router;
