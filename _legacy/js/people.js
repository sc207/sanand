/* ============================================================
   ACCOUNTS & AUTHORIZATION — the single source of truth for
   "who has an account and what can they open".
   Loaded right after i18n.js. Every module's leader / coordinator
   / in-charge picker and the topbar role selector are generated
   from this list, and the Accounts & Access page reports on it.
   ------------------------------------------------------------
   role keys:
     superadmin          - full platform + manages Admin/Super Admin accounts,
                           impersonation, backup import / wipe
     admin               - sees & does everything superadmin does EXCEPT the
                           four privileged operations above (a second tier)
     accountant          - donations, reports
   ============================================================ */

(function () {
  if (typeof window !== 'undefined' && typeof window.t !== 'function') {
    window.t = function (k, f) { return f != null ? f : k; };
  }

  /* Every role can open the Unified Calendar (it self-restricts to
     annual events for non-admins — see calendar.js).

     Devotees 360° and Combined Invitation ('invite') are deliberately
     absent from every scoped role's page list — admin-only by design, not
     an oversight from adding them without updating this list:
       - devotees   surfaces every devotee's full profile temple-wide
                     (donations, visits) — no scoping built.
       - invite     its audience picker isn't scoped to a per-role subset,
                     so opening it would leak devotee categories to a
                     scoped role.
       - visits     admin-only (explicit decision — see the matching
                     comment in server/middleware/authz.js). No role
                     currently owns the actual padhramani-scheduling
                     responsibility.
     Adding a new nav page? Decide its role visibility here deliberately —
     don't just leave it out and have it land here "by accident" again. */
  var ROLE_META = {
    superadmin:        { icon: '🛡️', pages: ['*'] },
    admin:             { icon: '🛡️', pages: ['*'] },
    accountant:        { icon: '💰', pages: ['dashboard', 'donations', 'reports', 'calendar'] }
  };

  /* Seeded from the people already referenced across the modules
     (same DEV-### ids the modules use, so everything cross-links). */
  var ACCOUNTS = [
    { id: 'DEV-001', name: 'Administrator', mobile: '', city: '', roles: ['superadmin'] }
  ];

  function accountById(id) { return ACCOUNTS.find(function (a) { return a.id === id; }); }
  function accountsWithRole(role) { return ACCOUNTS.filter(function (a) { return a.roles.indexOf(role) !== -1; }); }
  function accountName(id) { var a = accountById(id); return a ? a.name : id; }
  function accountRoles() { return Object.keys(ROLE_META); }
  function roleLabel(role) { return window.t('role_' + role, role.replace(/_/g, ' ')); }
  function roleIcon(role) { return (ROLE_META[role] || {}).icon || '👤'; }
  function rolePages(role) { return (ROLE_META[role] || {}).pages || []; }

  /** Pages this account may open (union of its roles). */
  function accountPages(id) {
    var a = accountById(id);
    if (!a) return [];
    if (a.roles.indexOf('superadmin') !== -1 || a.roles.indexOf('admin') !== -1) return ['*'];
    var set = {};
    a.roles.forEach(function (r) { rolePages(r).forEach(function (p) { set[p] = true; }); });
    return Object.keys(set);
  }

  /** { total, active, byRole: {role: count} } */
  function accessSummary() {
    var byRole = {};
    accountRoles().forEach(function (r) { byRole[r] = accountsWithRole(r).length; });
    return { total: ACCOUNTS.length, byRole: byRole };
  }

  /** Merge every module's activity log into one recent-first list. */
  function mergedActivity(limit) {
    var out = [];
    // stable-ish ordering: "Just now" first, then keep insertion order
    out.sort(function (a, b) {
      var rank = function (w) { return /just now/i.test(w) ? 0 : /today/i.test(w) ? 1 : 2; };
      return rank(a.when) - rank(b.when);
    });
    return limit ? out.slice(0, limit) : out;
  }

  window.ACCOUNTS = ACCOUNTS;
  window.ROLE_META = ROLE_META;
  window.accountById = accountById;
  window.accountsWithRole = accountsWithRole;
  window.accountName = accountName;
  window.accountRoles = accountRoles;
  window.roleLabel = roleLabel;
  window.roleIcon = roleIcon;
  window.rolePages = rolePages;
  window.accountPages = accountPages;
  window.accessSummary = accessSummary;
  window.mergedActivity = mergedActivity;
})();
