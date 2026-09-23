/* The mandir works in local (India) time. SQLite stamps rows with
   datetime('now','localtime'), so every JS-side "today" must be local
   too — toISOString() is UTC and would put an early-morning entry on
   the previous day. */
function todayLocal() {
  return new Date().toLocaleDateString('en-CA');   // YYYY-MM-DD, local
}

function monthLocal() {
  return todayLocal().slice(0, 7);
}

/* A pooja slot with no date yet is the normal early state, not missing
   data — but interpolated raw into a sentence it reads as
   "added as sevarthi — Pothi Yatra on null", which is what the audit
   trail was showing. Every message that names a slot's day goes
   through here. */
const slotWhen = (iso) => (iso ? String(iso) : 'a date not fixed yet');

module.exports = { todayLocal, monthLocal, slotWhen };
