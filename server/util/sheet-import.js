/* Bringing a spreadsheet into the register.
   ------------------------------------------------------------
   THE SHAPE OF THE FEATURE, and why it is this shape:

   1. THE IMPORT FORMAT IS THE EXPORT FORMAT. Every list in the app
      already exports itself; the columns here are those columns, under
      the same headings. So the round trip works — export the register,
      fix a hundred cities in Excel, import it back — and there is one
      vocabulary to learn instead of two. Columns the app DERIVES
      (Outstanding, Covered, Status) are accepted and ignored rather
      than rejected, because the easiest file for an operator to hand
      us is the one the app just gave them.

   2. NOTHING IS WRITTEN UNTIL THE OPERATOR HAS SEEN WHAT WILL HAPPEN.
      `analyse()` is a dry run over the whole file and is what the
      preview screen shows: per row, what it would do and what is wrong
      with it. `commit()` runs the SAME analysis again — the client is
      never trusted to hand back its own verdict — and then writes.

   3. THE WHOLE FILE IS ONE TRANSACTION. A half-applied import is the
      worst outcome of the three: nobody can tell which rows landed, and
      re-running it doubles whatever did. Since the preview has already
      shown every error, refusing the file outright is the honest
      answer, and fixing the sheet and re-importing is cheap.

   4. IT REFUSES TO SEAT THE SAME PERSON TWICE. Importing the same file
      again is the single most likely operator mistake, and without a
      check it silently doubles every booking and every payment. A row
      whose devotee already holds that exact seva is reported as already
      present and skipped.

   The money and seating rules are NOT re-implemented here. Seats go
   through the same capacity-checked insert as the booking route, money
   through `insertPaymentRows`, receipts through `receipts.next`, gifts
   through `resolveGift`, and devotees through `upsertDevotee` — so the
   importer cannot drift from the counter.
*/
const db = require('../db');
const { readXlsx } = require('./xlsx-read');
const { todayLocal } = require('./dates');
const { insertPaymentRows } = require('./payment-entries');

/* ------------------------------------------------------------------
   Getting rows out of whatever they handed us
   ------------------------------------------------------------------ */
/** RFC-4180-ish: quoted fields, doubled quotes, newlines inside them,
    and both line endings. The app's own export is read back by this,
    so it has to cope with the quoting the export writes. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  let i = 0;
  /* Excel writes a UTF-8 BOM and so do we — left in place it becomes
     part of the first heading and that column stops matching. */
  if (text.charCodeAt(0) === 0xfeff) i = 1;

  for (; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else { quoted = false; }
      } else field += c;
      continue;
    }
    if (c === '"') { quoted = true; continue; }
    if (c === ',') { row.push(field); field = ''; continue; }
    if (c === '\r') continue;
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue; }
    field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.map((r) => r.map((v) => String(v).trim()));
}

/** Dispatch on the file's own first bytes, not on its name: an .xlsx
    is a zip and starts "PK". A file renamed from .csv to .xlsx (which
    happens, because Excel's Save As does not always do what the
    operator meant) is then read correctly rather than refused. */
function readAnySheet(buf, filename) {
  const isZip = buf.length > 3 && buf[0] === 0x50 && buf[1] === 0x4b;
  if (isZip) return readXlsx(buf);
  if (/\.xls$/i.test(filename || '')) {
    throw Object.assign(new Error(
      'This is the older .xls format. Open it in Excel and use File > Save As > "Excel Workbook (.xlsx)", then import that.'),
      { status: 400 });
  }
  let text = buf.toString('utf8');
  /* A sheet saved as "CSV (Comma delimited)" in a Gujarati Windows
     locale can come out tab- or semicolon-separated. Sniff the header
     line rather than making the operator care. */
  const head = text.split(/\r?\n/)[0] || '';
  const commas = (head.match(/,/g) || []).length;
  const semis = (head.match(/;/g) || []).length;
  const tabs = (head.match(/\t/g) || []).length;
  if (tabs > commas && tabs >= semis) text = text.replace(/\t/g, ',');
  else if (semis > commas) text = text.replace(/;/g, ',');
  return parseCsv(text);
}

/* ------------------------------------------------------------------
   Coercion
   ------------------------------------------------------------------ */
const norm = (s) => String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]/g, '');

/** "₹21,000.50" / "21000" / "" -> a number, or null when it is not one.
    Operators paste from all sorts of places, so the rupee sign, Indian
    grouping and a stray space are all just noise to strip. */
function money(v) {
  const s = String(v == null ? '' : v).replace(/[₹,\s]/g, '').replace(/^Rs\.?/i, '');
  if (s === '') return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

/** -> YYYY-MM-DD, or null if it is not a date.

    A cell Excel knows is a date arrives already normalised (the reader
    resolves the style), so this only has to cope with dates that were
    TYPED AS TEXT. Where that is ambiguous — 04/02/2027 — it is read
    DAY FIRST, which is what everyone here writes and what the template
    and the import screen both say. */
function date(v) {
  const s = String(v == null ? '' : v).trim();
  if (!s) return '';
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (m) return iso(+m[1], +m[2], +m[3]);
  m = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2}|\d{4})$/.exec(s);
  if (m) {
    const y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    return iso(y, +m[2], +m[1]);
  }
  m = /^(\d{1,2})[\s-]*([a-zA-Z]{3,})[\s-]*(\d{2}|\d{4})$/.exec(s);
  if (m) {
    const mo = MONTHS[m[2].slice(0, 3).toLowerCase()];
    const y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    if (mo) return iso(y, mo, +m[1]);
  }
  return null;
}

function iso(y, mo, d) {
  if (!(y >= 1900 && y <= 2200) || !(mo >= 1 && mo <= 12) || !(d >= 1 && d <= 31)) return null;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;   // 31 Feb
  const p = (x) => String(x).padStart(2, '0');
  return y + '-' + p(mo) + '-' + p(d);
}

const YES = new Set(['yes', 'y', 'true', '1', 'haa', 'ha', 'gift', 'x', 'હા']);
const NO = new Set(['', 'no', 'n', 'false', '0', '-', 'na', 'ના']);
/** -> true / false / null when it is neither. */
function yesno(v) {
  const s = String(v == null ? '' : v).trim().toLowerCase();
  if (YES.has(s)) return true;
  if (NO.has(s)) return false;
  return null;
}

const mobile = (v) => String(v == null ? '' : v).replace(/\s+/g, '').trim();
const text = (v) => String(v == null ? '' : v).trim();

/* ------------------------------------------------------------------
   What each kind of sheet looks like
   ------------------------------------------------------------------
   `label` is the heading the template writes and the export already
   uses. `aliases` are the other things an operator's own sheet is
   likely to call it — matching is on letters and digits only, so
   "Mul Vatan", "mul_vatan" and "MULVATAN" are one heading.
*/
const DEVOTEE_COLUMNS = [
  { key: 'full_name', label: 'Name', aliases: ['full name', 'devotee', 'sevarthi', 'donor', 'naam'], required: true, type: 'text' },
  { key: 'mobile', label: 'Mobile', aliases: ['mobile no', 'phone', 'contact', 'mobile number'], required: true, type: 'mobile' },
  { key: 'city', label: 'City', aliases: ['gaam', 'village', 'town'], type: 'text' },
  { key: 'state', label: 'State', type: 'text' },
  { key: 'mul_vatan', label: 'Mul vatan', aliases: ['native place', 'vatan'], type: 'text' },
  { key: 'samaj', label: 'Samaj', aliases: ['community'], type: 'lookup', lookup: 'samaj' },
  { key: 'category', label: 'Category', aliases: ['devotee category', 'type'], type: 'lookup', lookup: 'devotee_category' },
  { key: 'notes', label: 'Note', aliases: ['notes', 'remark', 'remarks'], type: 'text' },
];

const SPECS = {
  devotees: {
    title: 'Devotees',
    what: 'the register — one row per person',
    columns: DEVOTEE_COLUMNS,
  },

  sevarthi: {
    title: 'Sevarthi registrations',
    what: 'a person, the seva they have taken and what they committed',
    columns: [
      ...DEVOTEE_COLUMNS.map((c) => (c.key === 'notes' ? { ...c, key: 'devotee_notes', label: 'Devotee note' } : c)),
      { key: 'pooja', label: 'Seva', aliases: ['pooja', 'seva name', 'pooja name', 'yagna', 'katha'], required: true, type: 'text' },
      { key: 'slot_date', label: 'Seva date', aliases: ['date', 'pooja date', 'day'], type: 'date' },
      { key: 'amount_committed', label: 'Contribution', aliases: ['amount', 'committed', 'commitment', 'total contribution', 'rakam'], required: true, type: 'money' },
      { key: 'bhuvaji_planned_amount', label: "Bapa's agreed share", aliases: ['bapa share', 'bhuvaji', 'bappa support', 'bapa covers'], type: 'money' },
      { key: 'is_gift', label: 'Gift from Bapa', aliases: ['gift', 'bapa gift'], type: 'yesno' },
      { key: 'paid_devotee', label: 'Paid by devotee', aliases: ['paid', 'sevarthi paid', 'received', 'jama'], type: 'money' },
      { key: 'paid_bapa', label: 'Paid by Bapa', aliases: ['bapa paid', 'bhuvaji paid', 'bappa paid'], type: 'money' },
      { key: 'payment_date', label: 'Payment date', aliases: ['paid on', 'receipt date'], type: 'date' },
      { key: 'receipt_no', label: 'Receipt no.', aliases: ['receipt', 'pavti'], type: 'text' },
      { key: 'notes', label: 'Seva note', aliases: ['booking note'], type: 'text' },
    ],
  },

  donations: {
    title: 'Donations',
    what: 'money given outside a seva',
    columns: [
      { key: 'donation_date', label: 'Date', aliases: ['donation date', 'on'], type: 'date' },
      { key: 'donor_name', label: 'Donor', aliases: ['name', 'donor name', 'devotee'], required: true, type: 'text' },
      { key: 'mobile', label: 'Mobile', aliases: ['phone', 'contact'], type: 'mobile' },
      { key: 'category', label: 'Category', aliases: ['donation category', 'purpose'], type: 'lookup', lookup: 'donation_category' },
      { key: 'amount', label: 'Amount', aliases: ['rakam', 'rupees'], type: 'money' },
      { key: 'in_kind_item', label: 'In kind', aliases: ['in kind item', 'item', 'vastu'], type: 'text' },
      { key: 'receipt_no', label: 'Receipt no.', aliases: ['receipt', 'pavti'], type: 'text' },
      { key: 'notes', label: 'Note', aliases: ['notes', 'remark'], type: 'text' },
    ],
  },

  visits: {
    title: 'Padhramni',
    what: 'visits asked for, agreed or already done',
    columns: [
      { key: 'visit_date', label: 'Date', aliases: ['visit date', 'on'], required: true, type: 'date' },
      { key: 'visit_time', label: 'Time', aliases: ['visit time', 'samay'], type: 'text' },
      { key: 'devotee_name', label: 'Devotee', aliases: ['name', 'full name'], required: true, type: 'text' },
      { key: 'mobile', label: 'Mobile', aliases: ['phone', 'contact'], type: 'mobile' },
      { key: 'city', label: 'City', aliases: ['gaam', 'place'], type: 'text' },
      { key: 'address', label: 'Address', aliases: ['sarnamu'], type: 'text' },
      { key: 'purpose', label: 'Purpose', aliases: ['reason', 'hetu'], type: 'text' },
      { key: 'status', label: 'Status', aliases: ['state'], type: 'text' },
      { key: 'notes', label: 'Note', aliases: ['notes', 'remark'], type: 'text' },
    ],
  },
};

/* Columns the app works out for itself. Accepted silently so that a
   sheet exported from the app can be handed straight back, instead of
   the operator having to delete columns before they may use it. */
const DERIVED = new Set([
  'outstanding', 'covered', 'contributed', 'status', 'excess', 'committed',
  'paidbydevotee', 'lastpaid', 'payments', 'registered', 'receiptnos',
  'onregistersince', 'donations', 'padhramni', 'cancelledseva', 'seva',
  'howsoon', 'recordedby', 'mahotsavcategory', 'escort', 'devoteecategory',
].map(norm));

/* ------------------------------------------------------------------
   Headers
   ------------------------------------------------------------------ */
function matchHeaders(spec, headerRow) {
  const map = {};
  const used = new Set();
  const unknown = [];

  const wanted = spec.columns.map((c) => ({
    col: c,
    names: new Set([c.label, c.key, ...(c.aliases || [])].map(norm)),
  }));

  (headerRow || []).forEach((raw, i) => {
    const n = norm(raw);
    if (!n) return;
    const hit = wanted.find((w) => !used.has(w.col.key) && w.names.has(n));
    if (hit) { map[hit.col.key] = i; used.add(hit.col.key); return; }
    if (!DERIVED.has(n)) unknown.push(String(raw).trim());
  });

  const missing = spec.columns.filter((c) => c.required && map[c.key] === undefined).map((c) => c.label);
  return { map, unknown, missing };
}

/* ------------------------------------------------------------------
   Reference data, read once per run
   ------------------------------------------------------------------ */
function reference() {
  const lookups = {};
  for (const type of ['samaj', 'devotee_category', 'donation_category']) {
    lookups[type] = new Map(
      db.prepare(`SELECT id, value FROM lookups WHERE type = ? AND active = 1`).all(type)
        .map((r) => [norm(r.value), r]));
  }
  const poojas = new Map();
  for (const p of db.prepare(
    `SELECT id, name, status, seating_mode FROM pooja_events`).all()) {
    poojas.set(norm(p.name), p);
  }
  const slots = new Map();
  for (const s of db.prepare(`SELECT id, pooja_id, slot_date, capacity, booked_count FROM pooja_slots
                               ORDER BY (slot_date IS NULL), slot_date, id`).all()) {
    if (!slots.has(s.pooja_id)) slots.set(s.pooja_id, []);
    slots.get(s.pooja_id).push(s);
  }
  const devoteesByMobile = new Map(
    db.prepare(`SELECT id, full_name, mobile FROM devotees WHERE mobile IS NOT NULL AND mobile <> ''`)
      .all().map((d) => [d.mobile, d]));
  return { lookups, poojas, slots, devoteesByMobile };
}

/* ------------------------------------------------------------------
   The dry run
   ------------------------------------------------------------------ */
/**
 * @param kind  one of SPECS
 * @param rows  the sheet, first row being the headings
 * @param opts  { createLookups, allowDuplicates }
 */
function analyse(kind, rows, opts = {}) {
  const spec = SPECS[kind];
  if (!spec) throw Object.assign(new Error('Unknown import type'), { status: 400 });

  const header = rows.findIndex((r) => r.some((c) => String(c).trim() !== ''));
  if (header < 0) {
    return { kind, ok: false, fatal: 'This file has nothing in it.', rows: [], columns: { matched: [], unknown: [], missing: [] } };
  }
  const { map, unknown, missing } = matchHeaders(spec, rows[header]);
  const matched = spec.columns.filter((c) => map[c.key] !== undefined).map((c) => c.label);

  if (missing.length) {
    return {
      kind, ok: false, rows: [],
      fatal: 'The sheet is missing ' + (missing.length === 1 ? 'a column it must have' : 'columns it must have') +
             ': ' + missing.join(', ') + '. Download the template below and copy your data into it.',
      columns: { matched, unknown, missing },
    };
  }

  const ref = reference();
  const newLookups = { samaj: new Set(), devotee_category: new Set(), donation_category: new Set() };
  const seenMobile = new Map();
  const seenSeat = new Map();
  const out = [];

  for (let i = header + 1; i < rows.length; i++) {
    const raw = rows[i];
    if (!raw || !raw.some((c) => String(c).trim() !== '')) continue;   // a blank spacer row is not an error

    const rec = {};
    const errors = [];
    const notes = [];
    const cell = (key) => (map[key] === undefined ? '' : (raw[map[key]] === undefined ? '' : raw[map[key]]));

    for (const c of spec.columns) {
      if (map[c.key] === undefined) continue;
      const v = cell(c.key);
      if (c.type === 'money') {
        const n = money(v);
        if (n === null) errors.push(c.label + ': "' + v + '" is not an amount');
        else rec[c.key] = n;
      } else if (c.type === 'date') {
        const d = date(v);
        if (d === null) errors.push(c.label + ': "' + v + '" is not a date — write it as 2027-02-04');
        else rec[c.key] = d;
      } else if (c.type === 'yesno') {
        const y = yesno(v);
        if (y === null) errors.push(c.label + ': write Yes or No, not "' + v + '"');
        else rec[c.key] = y;
      } else if (c.type === 'mobile') {
        rec[c.key] = mobile(v);
      } else if (c.type === 'lookup') {
        const t = text(v);
        rec[c.key] = t;
        if (t) {
          const hit = ref.lookups[c.lookup].get(norm(t));
          if (hit) rec[c.key + '_id'] = hit.id;
          else if (opts.createLookups) { newLookups[c.lookup].add(t); notes.push('will add "' + t + '" to ' + c.label); }
          else errors.push(c.label + ': "' + t + '" is not in the list yet — tick "add new values" below, or correct the spelling');
        }
      } else {
        rec[c.key] = text(v);
      }
    }

    for (const c of spec.columns) {
      if (c.required && !String(rec[c.key] === undefined ? '' : rec[c.key]).trim()) {
        errors.push(c.label + ' is required');
      }
    }

    const row = { line: i + 1, rec, errors, notes, action: 'create' };
    perKind[kind](row, ref, opts, { seenMobile, seenSeat });
    out.push(row);
  }

  const counts = { create: 0, update: 0, skip: 0, error: 0 };
  for (const r of out) {
    if (r.errors.length) counts.error++;
    else counts[r.action] = (counts[r.action] || 0) + 1;
  }

  return {
    kind, title: spec.title, ok: counts.error === 0 && out.length > 0,
    fatal: out.length === 0 ? 'The sheet has headings but no rows under them.' : null,
    columns: { matched, unknown, missing },
    newLookups: Object.fromEntries(Object.entries(newLookups).map(([k, v]) => [k, [...v]])),
    counts, total: out.length, rows: out,
  };
}

/* ------------------------------------------------------------------
   The per-kind checks, which is where the domain rules live
   ------------------------------------------------------------------ */
const perKind = {
  devotees(row, ref, opts, state) {
    const m = row.rec.mobile;
    if (m && String(m).replace(/\D/g, '').length < 10) {
      row.errors.push('Mobile: at least 10 digits are needed — the trust contacts people by mobile and it is how a devotee is recognised');
    }
    if (m && state.seenMobile.has(m)) {
      row.notes.push('same mobile as line ' + state.seenMobile.get(m) + ' — the later row wins');
    } else if (m) state.seenMobile.set(m, row.line);

    if (m && ref.devoteesByMobile.has(m)) {
      row.action = 'update';
      row.existing = ref.devoteesByMobile.get(m).full_name;
    }
  },

  sevarthi(row, ref, opts, state) {
    perKind.devotees(row, ref, opts, state);
    /* A second seva for the same person is normal and must not be
       reported as a clash the way a duplicate devotee row is. */
    row.notes = row.notes.filter((n) => !/same mobile as line/.test(n));

    const name = row.rec.pooja;
    if (!name) return;
    const pooja = ref.poojas.get(norm(name));
    if (!pooja) {
      row.errors.push('Seva: there is no seva called "' + name + '" — use the name exactly as it appears on the Mahotsav page');
      return;
    }
    if (pooja.status === 'closed') {
      row.errors.push('Seva: "' + pooja.name + '" is closed for new sevarthi');
      return;
    }
    const slots = ref.slots.get(pooja.id) || [];
    const wanted = row.rec.slot_date;
    let slot = null;
    if (wanted) {
      slot = slots.find((s) => s.slot_date === wanted);
      if (!slot) {
        const days = slots.map((s) => s.slot_date).filter(Boolean);
        row.errors.push('Seva date: "' + wanted + '" is not a day of ' + pooja.name +
          (days.length ? ' — its days are ' + days.join(', ') : ' — this seva has no dates fixed yet, so leave the date blank'));
        return;
      }
    } else if (slots.length === 1) {
      slot = slots[0];
    } else if (slots.length === 0) {
      row.errors.push('Seva: "' + pooja.name + '" has no days set up yet');
      return;
    } else {
      const days = slots.map((s) => s.slot_date).filter(Boolean);
      row.errors.push('Seva date is needed — ' + pooja.name + ' runs on ' + days.join(', '));
      return;
    }
    row.rec.slot_id = slot.id;
    row.slotLabel = slot.slot_date || 'date to be announced';
    row.poojaName = pooja.name;

    /* Capacity, counted across the file as well as the database: ten
       rows for a seva with three seats left is a fact the operator
       needs on the preview screen, not at row eight of the commit. */
    if (slot.capacity !== null) {
      if (slot.booked_count >= slot.capacity) {
        row.errors.push('Seva: ' + pooja.name + ' on ' + row.slotLabel + ' is full (' + slot.capacity + ' seats)');
        return;
      }
      slot.booked_count++;                 // provisional, for the rest of this run
    }

    const committed = Number(row.rec.amount_committed || 0);
    if (!(committed > 0)) row.errors.push('Contribution must be more than zero');

    let bapaPlanned = Number(row.rec.bhuvaji_planned_amount || 0);
    if (bapaPlanned > committed) {
      row.errors.push("Bapa's agreed share (" + bapaPlanned + ') is more than the contribution (' + committed + ')');
    }
    const paidDevotee = Number(row.rec.paid_devotee || 0);
    const paidBapa = Number(row.rec.paid_bapa || 0);
    if (paidDevotee < 0 || paidBapa < 0) row.errors.push('A paid amount cannot be negative');

    /* The gift rule, in the trust's words: no half payment turns into
       a gift; only the full amount can be one. Enforced here so the
       preview says it, and again by resolveGift on the way in. */
    if (row.rec.is_gift) {
      if (paidDevotee > 0) {
        row.errors.push('Gift from Bapa: this row also has ' + paidDevotee +
          ' paid by the devotee. A gift is Bapa\'s whole seva — put the amount under "Paid by Bapa", or set Gift to No');
      }
      if (bapaPlanned && bapaPlanned !== committed) {
        row.notes.push("a gift covers the whole contribution, so Bapa's share is set to " + committed);
      }
      bapaPlanned = committed;
      row.rec.bhuvaji_planned_amount = committed;
    }

    if (paidDevotee + paidBapa > committed) {
      row.notes.push('paid is more than the contribution — it will show as excess');
    }

    const key = row.rec.mobile + '|' + slot.id;
    if (state.seenSeat.has(key)) {
      row.action = 'skip';
      row.reason = 'the same seva for this person is already on line ' + state.seenSeat.get(key);
      return;
    }
    state.seenSeat.set(key, row.line);

    /* Re-importing the same file is the likeliest mistake there is,
       and without this it silently doubles every booking AND every
       payment against it. */
    const already = row.rec.mobile && db.prepare(`
      SELECT b.id FROM sevarthi_bookings b
        JOIN devotees d ON d.id = b.devotee_id
       WHERE d.mobile = ? AND b.slot_id = ? AND b.status <> 'cancelled' LIMIT 1
    `).get(row.rec.mobile, slot.id);
    if (already && !opts.allowDuplicates) {
      row.action = 'skip';
      row.reason = 'already registered for this seva';
      if (slot.capacity !== null) slot.booked_count--;     // the seat was not really taken
    }
  },

  donations(row, ref, opts, state) {
    const amount = Number(row.rec.amount || 0);
    const inKind = text(row.rec.in_kind_item);
    if (!(amount > 0) && !inKind) {
      row.errors.push('Give an Amount, or name what was given under "In kind"');
    }
    if (!row.rec.donation_date) row.notes.push("dated today, as the sheet did not say");
    const m = row.rec.mobile;
    if (m && ref.devoteesByMobile.has(m)) {
      row.rec.devotee_id = ref.devoteesByMobile.get(m).id;
      row.existing = ref.devoteesByMobile.get(m).full_name;
    } else if (m) {
      row.notes.push('no devotee with this mobile — recorded as a walk-in donation');
    }
  },

  visits(row, ref, opts, state) {
    const s = String(row.rec.status || '').trim().toLowerCase();
    const ALLOWED = ['requested', 'confirmed', 'completed', 'cancelled'];
    if (s && !ALLOWED.includes(s)) {
      row.errors.push('Status: write one of ' + ALLOWED.join(' / ') + ', not "' + row.rec.status + '"');
    }
    row.rec.status = s || 'requested';
    const m = row.rec.mobile;
    if (m && ref.devoteesByMobile.has(m)) {
      row.rec.devotee_id = ref.devoteesByMobile.get(m).id;
      row.existing = ref.devoteesByMobile.get(m).full_name;
    }
  },
};

module.exports = { SPECS, DERIVED, analyse, readAnySheet, parseCsv, money, date, yesno, norm, matchHeaders };
