/* Importing a spreadsheet.
   ------------------------------------------------------------
     GET  /api/import/kinds            what can be imported, and the
                                       columns each kind expects
     GET  /api/import/template/:kind   a ready-made sheet to fill in
     POST /api/import/preview?kind=    dry run — changes nothing
     POST /api/import/commit?kind=     writes, all or nothing

   The file arrives as raw bytes rather than multipart, so there is no
   upload middleware to add: `express.raw` is already in Express, and
   `fetch(file)` in the browser sends a File as its body unchanged.

   PREVIEW AND COMMIT ARE THE SAME ANALYSIS. The client sends the file
   twice rather than the server holding it between the two calls — no
   temporary files, no session state, nothing to expire, and no way for
   a client to hand back a verdict the server did not reach itself.

   Guarded at admin. A bulk import is every write an operator can make,
   at a scale nobody reviews row by row, and it is the one action here
   that can reshape the register in a single click. Everything an
   operator does at the counter stays open to them.
*/
const express = require('express');
const db = require('../db');
const { log } = require('../middleware/audit');
const { needs } = require('../middleware/roles');
const { SPECS, analyse, readAnySheet } = require('../util/sheet-import');
const { upsertDevotee } = require('./devotees');
const { refreshStatus, resolveGift } = require('./bookings');
const { insertPaymentRows, actingUser } = require('../util/payment-entries');
const receipts = require('../util/receipts');
const { todayLocal } = require('../util/dates');

const router = express.Router();

/* 8MB. A sheet of ten thousand registrations is well under one; the
   cap is here so a mis-drop of a video does not sit in memory. */
const raw = express.raw({ type: '*/*', limit: '8mb' });

/* ------------------------------------------------------------------
   What can be imported
   ------------------------------------------------------------------ */
router.get('/kinds', (req, res) => {
  res.json(Object.entries(SPECS).map(([key, spec]) => ({
    key, title: spec.title, what: spec.what,
    columns: spec.columns.map((c) => ({
      label: c.label, required: !!c.required, type: c.type,
      lookup: c.lookup || null,
    })),
  })));
});

/* ------------------------------------------------------------------
   The template
   ------------------------------------------------------------------
   A CSV, deliberately: Excel opens it, edits it and saves it back as
   .xlsx if the operator wants, and writing a real .xlsx would mean
   shipping a zip writer to solve a problem nobody has. It carries the
   UTF-8 BOM for the same reason the exports do — without it Excel
   renders every Gujarati name as mojibake.

   The example row is real data shaped like the mandir's own, because a
   template with "string, string, string" in it teaches nothing about
   what a date or an amount should look like.
*/
const EXAMPLES = {
  devotees: [
    ['Rasikbhai Patel', '9825110001', 'Ahmedabad', 'Gujarat', 'Sanand', 'Patel Samaj', 'VIP', 'Knows the trustees'],
    ['ભચીબેન રબારી', '9825110003', 'Sanand', 'Gujarat', '', 'Rabari Samaj', 'Normal', ''],
  ],
  sevarthi: [
    ['Rasikbhai Patel', '9825110001', 'Ahmedabad', 'Gujarat', 'Sanand', 'Patel Samaj', 'VIP', '',
      'Mukhya Patlo', '2027-02-04', '2100000', '500000', 'No', '1000000', '500000', '2026-09-20', '', 'Paid at the mandir'],
    ['Devshi Rabari', '9825110002', 'Viramgam', 'Gujarat', '', 'Rabari Samaj', 'Normal', '',
      'Bhagvat Saptah Katha', '', '21000', '', 'No', '', '', '', '', ''],
  ],
  donations: [
    ['2026-09-20', 'Hansaben Patel', '9825110006', 'Annadan', '11000', '', '', ''],
    ['2026-09-21', 'Ramesh Prajapati', '9825110008', 'Annadan', '', '51 kg ghee', '', 'Given at the mandir'],
  ],
  visits: [
    ['2026-10-02', '17:00', 'Rasikbhai Patel', '9825110001', 'Ahmedabad', '12, Temple Road', 'Griha shanti', 'requested', ''],
    ['2026-10-05', '10:30', 'Devshi Rabari', '9825110002', 'Viramgam', '', 'New house', 'confirmed', 'Ring the day before'],
  ],
};

const csvCell = (v) => {
  const s = String(v == null ? '' : v);
  /* The same guard the exports use: a cell starting with one of these
     is run as a formula when Excel opens the file. */
  const safe = /^[=+\-@]/.test(s) ? "'" + s : s;
  return /[",\n]/.test(safe) ? '"' + safe.replace(/"/g, '""') + '"' : safe;
};

router.get('/template/:kind', (req, res) => {
  const spec = SPECS[req.params.kind];
  if (!spec) return res.status(404).json({ error: 'No such import type' });
  const lines = [spec.columns.map((c) => csvCell(c.label)).join(',')];
  (EXAMPLES[req.params.kind] || []).forEach((r) => lines.push(r.map(csvCell).join(',')));
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition',
    'attachment; filename="svmds-import-' + req.params.kind + '.csv"');
  res.send('﻿' + lines.join('\r\n') + '\r\n');
});

/* The seva names, so the import screen can show exactly what the Seva
   column will accept instead of leaving the operator to guess at
   spelling. */
router.get('/seva-names', (req, res) => {
  res.json(db.prepare(`
    SELECT pe.name, pe.category, pe.status,
           (SELECT COUNT(*) FROM pooja_slots ps WHERE ps.pooja_id = pe.id) AS day_count,
           (SELECT GROUP_CONCAT(ps.slot_date, ', ') FROM pooja_slots ps
             WHERE ps.pooja_id = pe.id AND ps.slot_date IS NOT NULL) AS days
      FROM pooja_events pe ORDER BY pe.category, pe.name
  `).all());
});

/* ------------------------------------------------------------------
   Preview
   ------------------------------------------------------------------ */
function readBody(req) {
  const buf = req.body;
  if (!buf || !buf.length) {
    throw Object.assign(new Error('No file arrived. Pick a file and try again.'), { status: 400 });
  }
  return readAnySheet(Buffer.from(buf), req.get('X-File-Name') || '');
}

const optsOf = (req) => ({
  createLookups: String(req.query.create_lookups || '') === '1',
  allowDuplicates: String(req.query.allow_duplicates || '') === '1',
});

router.post('/preview', needs('admin', 'Importing a spreadsheet'), raw, (req, res) => {
  try {
    const rows = readBody(req);
    const report = analyse(req.query.kind, rows, optsOf(req));
    /* The whole file is analysed — every error the operator has to fix
       is worth knowing at once — but only the first 200 rows travel
       back, because a preview table of ten thousand helps nobody and
       the errors are what they are reading. */
    res.json({ ...report, rows: report.rows.slice(0, 200), truncated: report.rows.length > 200 });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

/* ------------------------------------------------------------------
   Commit
   ------------------------------------------------------------------ */
router.post('/commit', needs('admin', 'Importing a spreadsheet'), raw, (req, res) => {
  try {
    const opts = optsOf(req);
    const rows = readBody(req);
    const report = analyse(req.query.kind, rows, opts);

    if (report.fatal) return res.status(400).json({ error: report.fatal });
    const bad = report.rows.filter((r) => r.errors.length);
    if (bad.length) {
      return res.status(400).json({
        error: 'Nothing was imported. ' + bad.length + ' row' + (bad.length === 1 ? '' : 's') +
               ' still need fixing — the first is line ' + bad[0].line + ': ' + bad[0].errors[0],
        rows: bad.slice(0, 20),
      });
    }

    const by = actingUser(req);
    const result = db.transaction(() => WRITE[report.kind](req, report, opts, by))();

    log(req, {
      action: 'create', entity: 'import', entityId: null,
      summary: 'Imported ' + report.title.toLowerCase() + ' from a spreadsheet — ' +
               result.summary,
      details: { kind: report.kind, ...result.counts, file: req.get('X-File-Name') || null },
    });
    res.json({ ok: true, ...result, kind: report.kind, title: report.title });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

/* ------------------------------------------------------------------
   The writes
   ------------------------------------------------------------------
   Each runs inside the one transaction opened above, and each goes
   through the same function the counter uses. Nothing here re-decides
   what a devotee is, what a seat costs or how money is recorded.
*/
function lookupId(type, value, cache) {
  const v = String(value || '').trim();
  if (!v) return null;
  const key = type + '|' + v.toLowerCase();
  if (cache.has(key)) return cache.get(key);
  const found = db.prepare(
    `SELECT id FROM lookups WHERE type = ? AND LOWER(value) = LOWER(?) AND active = 1`).get(type, v);
  const id = found ? found.id
    : Number(db.prepare(`INSERT INTO lookups (type, value) VALUES (?, ?)`).run(type, v).lastInsertRowid);
  cache.set(key, id);
  return id;
}

/** Devotee fields out of a row, with the samaj/category resolved (and
    created when the operator asked for that). */
function devoteeBody(rec, cache, opts) {
  return {
    full_name: rec.full_name,
    mobile: rec.mobile,
    city: rec.city,
    state: rec.state,
    mul_vatan: rec.mul_vatan,
    samaj_id: rec.samaj_id || (opts.createLookups ? lookupId('samaj', rec.samaj, cache) : null),
    category_id: rec.category_id ||
      (opts.createLookups ? lookupId('devotee_category', rec.category, cache) : null),
    notes: rec.devotee_notes !== undefined ? rec.devotee_notes : rec.notes,
  };
}

const WRITE = {
  devotees(req, report, opts, by) {
    const cache = new Map();
    let created = 0, updated = 0;
    for (const row of report.rows) {
      if (row.action === 'skip') continue;
      const r = upsertDevotee(req, devoteeBody(row.rec, cache, opts), { requireMobile: true });
      if (r.created) created++; else updated++;
    }
    return {
      counts: { created, updated, skipped: report.counts.skip || 0 },
      summary: created + ' added, ' + updated + ' updated',
    };
  },

  sevarthi(req, report, opts, by) {
    const cache = new Map();
    let devoteesNew = 0, seats = 0, payments = 0, skipped = 0, money = 0;

    for (const row of report.rows) {
      if (row.action === 'skip') { skipped++; continue; }
      const rec = row.rec;
      const d = upsertDevotee(req, devoteeBody(rec, cache, opts), { requireMobile: true });
      if (d.created) devoteesNew++;

      const committed = Number(rec.amount_committed || 0);
      /* The same gift rule as the counter, from the same function — a
         second copy of it here is exactly how the two would drift. */
      const g = resolveGift(null, rec.is_gift, 0, committed, Number(rec.bhuvaji_planned_amount || 0));
      if (g.error) throw Object.assign(new Error('Line ' + row.line + ': ' + g.error), { status: 400 });

      /* Re-read the slot INSIDE the transaction and check it here, the
         way every other path that seats someone does. The preview's
         count was taken before this ran and is a courtesy, not the
         mechanism. */
      const slot = db.prepare(`SELECT * FROM pooja_slots WHERE id = ?`).get(rec.slot_id);
      if (!slot) throw Object.assign(new Error('Line ' + row.line + ': that seva day no longer exists'), { status: 409 });
      if (slot.capacity !== null && slot.booked_count >= slot.capacity) {
        throw Object.assign(new Error('Line ' + row.line + ': ' + (row.poojaName || 'that seva') +
          ' filled up while the file was being imported. Nothing was saved.'), { status: 409 });
      }

      const bookingId = Number(db.prepare(`
        INSERT INTO sevarthi_bookings (slot_id, devotee_id, amount_committed,
                                       bhuvaji_planned_amount, is_gift, notes, status)
        VALUES (@slot_id, @devotee_id, @amount_committed, @bhuvaji_planned_amount, @is_gift, @notes, 'pending')
      `).run({
        slot_id: slot.id, devotee_id: d.id,
        amount_committed: committed,
        bhuvaji_planned_amount: g.bhuvaji,
        is_gift: g.gift,
        notes: (rec.notes || '').trim() || null,
      }).lastInsertRowid);
      db.prepare(`UPDATE pooja_slots SET booked_count = booked_count + 1 WHERE id = ?`).run(slot.id);
      seats++;

      const entries = [];
      if (Number(rec.paid_devotee || 0) > 0) entries.push({ amount: Number(rec.paid_devotee), payer_type: 'devotee' });
      if (Number(rec.paid_bapa || 0) > 0) entries.push({ amount: Number(rec.paid_bapa), payer_type: 'bhuvaji' });
      if (entries.length) {
        insertPaymentRows(bookingId, entries, {
          payment_date: rec.payment_date || todayLocal(),
          receipt_no: rec.receipt_no || '',
        }, by);
        payments += entries.length;
        money += entries.reduce((a, e) => a + e.amount, 0);
        refreshStatus(bookingId);           // never set by hand
      }

      log(req, {
        action: 'create', entity: 'booking', entityId: bookingId,
        summary: rec.full_name + ' added as sevarthi (imported) — ' + (row.poojaName || '') +
                 ' on ' + (row.slotLabel || 'date to be announced') + ' (₹' + committed + ')' +
                 (g.gift ? ' — a gift from Bhuvaji Suresh Bapa' : ''),
        details: { via: 'import', line: row.line, amount_committed: committed,
                   bhuvaji_planned: g.bhuvaji, gift_from_bapa: !!g.gift },
      });
    }
    return {
      counts: { devotees: devoteesNew, seats, payments, skipped, money },
      summary: seats + ' seva, ' + devoteesNew + ' new devotees, ₹' + money + ' recorded' +
               (skipped ? ', ' + skipped + ' already present' : ''),
    };
  },

  donations(req, report, opts, by) {
    const cache = new Map();
    let n = 0, money = 0;
    for (const row of report.rows) {
      if (row.action === 'skip') continue;
      const r = row.rec;
      const date = r.donation_date || todayLocal();
      const id = Number(db.prepare(`
        INSERT INTO donations (devotee_id, donor_name, mobile, category_id, amount, in_kind_item,
                               donation_date, receipt_no, notes, recorded_by)
        VALUES (@devotee_id, @donor_name, @mobile, @category_id, @amount, @in_kind_item,
                @donation_date, @receipt_no, @notes, @recorded_by)
      `).run({
        devotee_id: r.devotee_id || null,
        donor_name: r.donor_name,
        mobile: r.mobile || null,
        category_id: r.category_id ||
          (opts.createLookups ? lookupId('donation_category', r.category, cache) : null),
        amount: Number(r.amount || 0),
        in_kind_item: (r.in_kind_item || '').trim() || null,
        donation_date: date,
        receipt_no: receipts.ensure(r.receipt_no, 'D', date),
        notes: (r.notes || '').trim() || null,
        recorded_by: by,
      }).lastInsertRowid);
      n++; money += Number(r.amount || 0);
      log(req, {
        action: 'create', entity: 'donation', entityId: id,
        summary: 'Donation from ' + r.donor_name + ' (imported)' +
                 (Number(r.amount) ? ' — ₹' + Number(r.amount) : ' — ' + (r.in_kind_item || 'in kind')),
        details: { via: 'import', line: row.line },
      });
    }
    return { counts: { donations: n, money }, summary: n + ' donations, ₹' + money };
  },

  visits(req, report, opts, by) {
    let n = 0;
    for (const row of report.rows) {
      if (row.action === 'skip') continue;
      const r = row.rec;
      const id = Number(db.prepare(`
        INSERT INTO visits (devotee_id, devotee_name, mobile, city, visit_date, visit_time,
                            address, purpose, status, notes)
        VALUES (@devotee_id, @devotee_name, @mobile, @city, @visit_date, @visit_time,
                @address, @purpose, @status, @notes)
      `).run({
        devotee_id: r.devotee_id || null,
        devotee_name: r.devotee_name,
        /* A visit keeps its OWN mobile and city as an override, and
           they are normally NULL — a row picked from the register must
           not silently copy the devotee's details onto the visit. Only
           what the sheet actually said is stored. */
        mobile: r.mobile || null,
        city: (r.city || '').trim() || null,
        visit_date: r.visit_date,
        visit_time: (r.visit_time || '').trim() || null,
        address: (r.address || '').trim() || null,
        purpose: (r.purpose || '').trim() || null,
        status: r.status,
        notes: (r.notes || '').trim() || null,
      }).lastInsertRowid);
      n++;
      log(req, {
        action: 'create', entity: 'visit', entityId: id,
        summary: 'Padhramni for ' + r.devotee_name + ' on ' + r.visit_date + ' (imported)',
        details: { via: 'import', line: row.line },
      });
    }
    return { counts: { visits: n }, summary: n + ' padhramni' };
  },
};

module.exports = router;
