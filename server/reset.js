/* Put the app back to a clean starting point.

     npm run reset             clear the data, keep the lists as they are
     npm run reset -- --lists  also put the lists back to the seeded set

   WHAT IT CLEARS — everything the trust enters day to day:
     devotees · sevarthi bookings · payments · donations · padhramni
     (and their escorts) · the audit log · the receipt counters

   WHAT IT KEEPS — the reference data the app is configured with, which
   is what you would otherwise have to set up again by hand:
     the seva list (pooja_events / pooja_slots)
     the managed lists (samaj, devotee categories, donation categories)
     the user accounts and the settings

   `--lists` additionally puts those managed lists back to exactly what
   the seed creates, which is what you want after a run of tests: this
   database had picked up 66 seva called things like "Redate Test
   1790017245629" and 33 samaj called "Corrected Samaj 408269", and
   picking those out by hand is nobody's afternoon. Anything the trust
   added deliberately through the UI goes with them, so it is a flag
   and not the default.

   Accounts are deliberately NOT touched, by either form. An account is
   a person, not test data, and quietly deleting one is a different
   kind of act from clearing a register.

   Two things it does that are easy to forget by hand, and wrong to
   leave out:

     - `pooja_slots.booked_count` is reset to 0. It is a running count,
       not something derived at read time, so deleting the bookings
       without it leaves every day claiming to be full and the booking
       transaction turning people away.
     - the receipt counters go back to zero, so a fresh run starts at
       P-<year>-0001 rather than continuing a sequence whose receipts
       no longer exist.

   It takes a timestamped backup of the database first, every time, and
   says where it put it. A reset is not something anyone should have to
   be brave about.
*/
const fs = require('fs');
const path = require('path');
const db = require('./db');

/* `--seva` still works: it was the first name for this and is what
   anyone who used it once will type again. */
const LISTS_TOO = process.argv.includes('--lists') || process.argv.includes('--seva');

/* Cleared in this order: children before the rows they point at, so
   nothing is ever orphaned even for the moment the transaction is
   open. */
const CLEAR = [
  ['visit_escorts', 'padhramni escorts'],
  ['visits', 'padhramni'],
  ['payments', 'payments'],
  ['sevarthi_bookings', 'sevarthi bookings'],
  ['donations', 'donations'],
  ['devotees', 'devotees'],
  ['audit_log', 'audit entries'],
  ['receipt_counters', 'receipt counters'],
];

const KEEP = [
  ['pooja_events', 'seva'],
  ['pooja_slots', 'seva days'],
  ['lookups', 'samaj / categories'],
  ['users', 'accounts'],
  ['settings', 'settings'],
];

const count = (t) => {
  try { return db.prepare(`SELECT COUNT(*) n FROM ${t}`).get().n; } catch (e) { return null; }
};

/* ---- backup first, always ---------------------------------- */
function backup() {
  const file = db.name || path.join(__dirname, '..', 'data', 'temple.db');
  if (!fs.existsSync(file)) return null;
  /* Fold the write-ahead log into the file before copying it, or the
     backup is the database as it was at the last checkpoint and
     silently misses everything since. */
  try { db.pragma('wal_checkpoint(TRUNCATE)'); } catch (e) { /* not in WAL mode */ }
  const stamp = new Date().toLocaleString('sv').replace(/[: ]/g, '-').slice(0, 19);
  const to = file.replace(/\.db$/, '') + `-before-reset-${stamp}.db`;
  fs.copyFileSync(file, to);
  return to;
}

console.log('\n  Before:');
[...CLEAR, ...KEEP].forEach(([t, label]) => {
  const n = count(t);
  if (n !== null) console.log(`    ${String(n).padStart(6)}  ${label}`);
});

const saved = backup();
console.log(`\n  Backup: ${saved || '(no database file yet)'}`);

/* ---- the reset itself -------------------------------------- */
let removedSeva = 0;
let removedLookups = 0;
db.transaction(() => {
  CLEAR.forEach(([t]) => db.prepare(`DELETE FROM ${t}`).run());

  if (LISTS_TOO) {
    /* The seva list the seed creates is the Mahotsav the trust
       actually announced. Anything else in there arrived from a test
       run or a mistake, and --seva is how you get back to the
       announced list without editing rows by hand. The names are read
       from seed.js rather than repeated here, so the two cannot
       drift. */
    const src = fs.readFileSync(path.join(__dirname, 'seed.js'), 'utf8');
    const seeded = new Set([
      ...[...src.matchAll(/\{\s*name:\s*'([^']+)'/g)].map((m) => m[1]),
      ...(() => {
        const m = src.match(/const MANDIR_POOJAS = \[([\s\S]*?)\n\];/);
        if (!m) return [];
        /* Match a whole quoted string, each quote style on its own,
           rather than "anything between two quote characters": one of
           these names is "Samaran's Main Kalash Pooja", written in
           double quotes because it contains an apostrophe. A combined
           [^'"] class stops dead at that apostrophe and every name
           after it comes out as punctuation — which is how the first
           run of this deleted fifteen real poojas as junk. */
        return [...m[1].matchAll(/'([^']*)'|"([^"]*)"/g)]
          .map((x) => (x[1] !== undefined ? x[1] : x[2]))
          .filter((v) => v && v.trim() && !/^[,\s]+$/.test(v));
      })(),
    ]);
    const all = db.prepare(`SELECT id, name FROM pooja_events`).all();
    const kill = all.filter((p) => !seeded.has(p.name)).map((p) => p.id);
    if (kill.length) {
      const list = kill.join(',');
      db.prepare(`DELETE FROM pooja_slots WHERE pooja_id IN (${list})`).run();
      db.prepare(`DELETE FROM pooja_events WHERE id IN (${list})`).run();
      removedSeva = kill.length;
    }

    /* The samaj list comes from seed.js; the two category lists are
       first-run defaults in db.js. Read from the files for the same
       reason the seva names are — one definition, no drift. */
    const dbSrc = fs.readFileSync(path.join(__dirname, 'db.js'), 'utf8');
    const KEEPERS = {
      samaj: (() => {
        const m = src.match(/const SAMAJ = \[([^\]]*)\]/);
        return m ? [...m[1].matchAll(/'([^']*)'|"([^"]*)"/g)]
          .map((x) => (x[1] !== undefined ? x[1] : x[2])).filter(Boolean) : [];
      })(),
      devotee_category: [], donation_category: [],
    };
    const dm = dbSrc.match(/const defaults = \[([\s\S]*?)\n\];/);
    if (dm) {
      [...dm[1].matchAll(/\[\s*'(\w+)'\s*,\s*'([^']*)'/g)].forEach(([, type, value]) => {
        if (KEEPERS[type]) KEEPERS[type].push(value);
      });
    }
    Object.keys(KEEPERS).forEach((type) => {
      if (!KEEPERS[type].length) return;          // never empty a list we failed to read
      const rows = db.prepare(`SELECT id, value FROM lookups WHERE type = ?`).all(type);
      const drop = rows.filter((r) => !KEEPERS[type].includes(r.value)).map((r) => r.id);
      if (!drop.length) return;
      /* A devotee or a donation may point at one of these. The rows
         pointing at them are already gone by now — this runs after the
         clear — so the reference cannot be left dangling. */
      db.prepare(`DELETE FROM lookups WHERE id IN (${drop.join(',')})`).run();
      removedLookups += drop.length;
    });
  }

  /* A running count, not a derived one — see the note at the top. */
  db.prepare(`UPDATE pooja_slots SET booked_count = 0`).run();
})();

console.log('\n  After:');
[...CLEAR, ...KEEP].forEach(([t, label]) => {
  const n = count(t);
  if (n !== null) console.log(`    ${String(n).padStart(6)}  ${label}`);
});
if (LISTS_TOO) {
  console.log(`\n  Removed ${removedSeva} seva and ${removedLookups} samaj/category the seed did not create.` +
              ((removedSeva || removedLookups)
                ? '\n  Run `npm run seed` to put back anything real that went with them.' : ''));
  console.log('  Accounts were left alone — an account is a person, not test data.');
} else {
  console.log('\n  The lists were left alone. Add --lists to put them back to the seeded set.');
}
console.log('  Next:  npm run seed:demo   (ten of everything, to work with)\n');

/* better-sqlite3 aborts the process if the database is still open at
   exit — see CLAUDE.md. Any entry point that requires ./db must do
   this. */
db.close();
