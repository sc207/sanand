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

module.exports = { todayLocal, monthLocal };
