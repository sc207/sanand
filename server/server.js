/* Shri Vihat Meldi Dham — Sanand
   Phase 1: Murti Pran Pratishtha Mahotsav sevarthi & contribution tracking. */
const path = require('path');
const express = require('express');
const db = require('./db');          // for an orderly close on shutdown

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// --- API ---------------------------------------------------------
app.use('/api/lookups', require('./routes/lookups'));
app.use('/api/devotees', require('./routes/devotees').router);
app.use('/api/poojas', require('./routes/poojas').router);
app.use('/api/bookings', require('./routes/bookings').router);
app.use('/api/payments', require('./routes/payments'));
app.use('/api/donations', require('./routes/donations'));
app.use('/api/visits', require('./routes/visits'));
app.use('/api', require('./routes/misc'));

app.use((err, req, res, next) => {          // eslint-disable-line no-unused-vars
  console.error('[api error]', err);
  res.status(err.status || 500).json({ error: err.message || 'Something went wrong' });
});

// --- static app --------------------------------------------------
/* Fonts and images are immutable enough to cache hard; the page, its CSS
   and its JS must revalidate every load, or an update leaves people
   looking at a stale screen until they clear the browser cache. */
const staticOpts = {
  etag: true,
  setHeaders(res, filePath) {
    if (/\.(woff2?|png|jpe?g|svg|ico)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=604800');
    } else {
      res.setHeader('Cache-Control', 'no-cache');
    }
  },
};
app.use('/assets', express.static(path.join(__dirname, '..', 'assets'), staticOpts));
app.use(express.static(path.join(__dirname, '..', 'public'), staticOpts));

// SPA fallback: any non-API route serves the shell.
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

const server = app.listen(PORT, () => {
  console.log(`\n  Shri Vihat Meldi Dham — running at http://localhost:${PORT}\n`);
});

/* `npm run dev` restarts this process on every save. Without closing
   the database first, better-sqlite3's cleanup hook fires against an
   already-disposed isolate and the process aborts with a native stack
   trace instead of restarting ("Assertion failed: (env) != nullptr").
   The same applies to a plain Ctrl-C. */
let closing = false;
function shutdown() {
  if (closing) return;
  closing = true;
  server.close(() => {
    try { db.close(); } catch { /* already closed */ }
    process.exit(0);
  });
  // Don't let a hung keep-alive connection block the restart.
  setTimeout(() => { try { db.close(); } catch { /* already closed */ } process.exit(0); }, 1500).unref();
}
/* SIGHUP too: a server started from a shell that then exits is hung up
   on, not interrupted, and an unhandled SIGHUP left the database open
   and aborted exactly as above. */
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('SIGHUP', shutdown);
