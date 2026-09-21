/* Audit trail. Every write path calls log() so the Accounts & Access
   page can answer "who did what, when". The acting user arrives as the
   X-User-Name header the frontend sets from the signed-in operator. */
const db = require('../db');

const insert = db.prepare(`
  INSERT INTO audit_log (user_name, action, entity, entity_id, summary, details)
  VALUES (@user_name, @action, @entity, @entity_id, @summary, @details)
`);

function userOf(req) {
  const raw = (req && req.get && req.get('X-User-Name')) || '';
  return decodeURIComponent(raw).trim() || 'Unknown';
}

function log(req, { action, entity, entityId = null, summary = '', details = null }) {
  insert.run({
    user_name: userOf(req),
    action,
    entity,
    entity_id: entityId,
    summary,
    details: details ? JSON.stringify(details) : null,
  });
}

module.exports = { log, userOf };
