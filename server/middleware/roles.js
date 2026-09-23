/* Who may do what.
   ------------------------------------------------------------
   READ THIS BEFORE TRUSTING IT. There is no login yet: the acting user
   arrives as the `X-User-Name` header the frontend sets from the
   "signed in as" switcher, so anyone who can reach the app can claim
   to be anyone. This is therefore a GUARD RAIL, not security. It stops
   an operator deleting a payment by accident on a busy counter; it
   does not stop somebody who means to. Real enforcement arrives with
   the login (the trust plans Google Sign-In once the app is deployed),
   and when it does this module is where it plugs in — the route
   declarations below do not have to change.

   The trust chose the narrow version deliberately: operators keep
   every part of the daily job — registering sevarthi, taking payments,
   recording padhramni and donations. Only three things are held back:

     money already recorded   correcting or removing a payment or a
                              donation, because that rewrites what the
                              trust holds rather than adding to it
     the seva list            creating, re-dating, re-pricing or
                              deleting a pooja
     the people               adding or changing who has an account

   A refusal always says what to do instead. A bare "not allowed"
   leaves an operator stuck at a counter with somebody waiting.
*/
const db = require('../db');
const { userOf } = require('./audit');

const RANK = { operator: 0, accountant: 1, admin: 2, superadmin: 3 };

/** The acting user's role, from the name the frontend claims.
    An unknown name is treated as an operator — the least privileged
    thing it could be — rather than as nobody, so a fresh install with
    no `users` row still runs the daily job. */
function roleOf(req) {
  const name = userOf(req);
  if (!name || name === 'Unknown') return 'operator';
  const row = db.prepare(
    `SELECT role FROM users WHERE name = ? AND active = 1 ORDER BY id LIMIT 1`).get(name);
  return (row && row.role) || 'operator';
}

/** True when the acting user is at least `min`. */
const atLeast = (req, min) => (RANK[roleOf(req)] || 0) >= (RANK[min] || 0);

const LABEL = {
  operator: 'an operator', accountant: 'the temple accountant',
  admin: 'an administrator', superadmin: 'the super admin',
};

/** Express middleware. `what` names the action in the refusal, so the
    message reads as an instruction rather than a policy.

    Called `needs`, not `require`: a function declaration by that name
    shadows Node's own `require` for the whole module, so the two
    requires at the top of this file silently called THIS function and
    handed back a middleware instead of a module. Everything then
    failed with "userOf is not a function". */
function needs(min, what) {
  return (req, res, next) => {
    if (atLeast(req, min)) return next();
    const who = LABEL[roleOf(req)] || 'this account';
    res.status(403).json({
      error: `${what} is kept for ${LABEL[min]}. You are signed in as ${who} — ` +
             `ask an administrator, or switch account from the name at the top right.`,
    });
  };
}

module.exports = { roleOf, atLeast, needs, RANK };
