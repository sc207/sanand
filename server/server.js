/* Shri Vihat Meldi Dham — Sanand
   Phase 1: Murti Pran Pratishtha Mahotsav sevarthi & contribution tracking. */
const path = require('path');
const express = require('express');

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

app.listen(PORT, () => {
  console.log(`\n  Shri Vihat Meldi Dham — running at http://localhost:${PORT}\n`);
});
