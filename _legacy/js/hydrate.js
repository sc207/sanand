/* Boot-time hydration: when the backend is reachable (API.online), replace the
   in-memory seed data with real rows from the REST API and re-render.
   Runs on window.load, AFTER every module's own DOMContentLoaded render, so a
   failure here can never stop the app painting. Each store is hydrated in its
   own try/catch — one failing endpoint never blocks the others.

   The server keys people by a numeric devotees.id; the frontend keys them by
   the human DEV-### code. `devCode()` bridges the two using an index built from
   the hydrated devotee list, so every module ends up referencing the SAME real
   devotee identity. */
(function () {
  if (typeof window === 'undefined') return;

  function log(msg) { try { console.info('[hydrate] ' + msg); } catch (e) {} }

  var DEV_BY_ROW = {};        // numeric devotees.id  -> 'DEV-###'
  window.__devCodeByRow = DEV_BY_ROW;
  function devCode(rowId) {
    if (rowId == null || rowId === '') return '';
    return DEV_BY_ROW[rowId] || String(rowId);
  }

  function swap(arr, rows) {
    if (!Array.isArray(arr)) return;
    arr.length = 0;
    for (var i = 0; i < rows.length; i++) arr.push(rows[i]);
  }

  async function hydrateSettings() {
    var s = await window.API.get('/settings');
    if (!s) return;
    var overridden = false;
    try { overridden = !!localStorage.getItem('svmmm_clock'); } catch (e) {}
    if (!overridden && s.workingDate) {
      if (typeof MG !== 'undefined') {
        MG.today = s.workingDate;
        if (/^\d{2}:\d{2}$/.test(s.workingTime || '')) MG.nowTime = s.workingTime;
      }
    }
    try {
      var cur = JSON.parse(localStorage.getItem('svmmm_temple') || '{}');
      if ((!cur || !cur.name) && s.templeIdentity && s.templeIdentity.name) {
        localStorage.setItem('svmmm_temple', JSON.stringify(s.templeIdentity));
      }
    } catch (e) {}
    try {
      var langChosen = !!localStorage.getItem('svmmm_lang');
      if (!langChosen && s.defaultLanguage && typeof window.setLanguage === 'function') {
        window.setLanguage(s.defaultLanguage, { announce: false });
      }
    } catch (e) {}
    log('settings applied (clock ' + (overridden ? 'kept local override' : s.workingDate) + ')');
  }

  // just the people register — the one thing a scoped post-save refresh needs
  // so devCode() resolves any devotee the save created.
  //
  // An admin-tier session fetches the full record (status/notes/visit-count —
  // the admin-only Devotees 360° page needs these); every other role fetches
  // /devotees/directory, a lean id/name/mobile/city/state/category projection
  // — enough for the shared "pick a person" combobox (devotee-picker.js) and
  // the invitation audience-by-category filter, without downloading every
  // devotee's admin-only detail to a scoped role's browser just to populate a
  // search box. Both shapes land in the SAME state.devotees array; nothing
  // outside the admin-only Devotees page reads the fields the lean shape omits.
  async function hydrateDevotees() {
    if (typeof state === 'undefined') return;
    try {
      var isAdminTier = !!(window.API && typeof window.API.canOpen === 'function' && window.API.canOpen('admin'));
      var devotees = await window.API.get(isAdminTier ? '/devotees' : '/devotees/directory');
      for (var k in DEV_BY_ROW) delete DEV_BY_ROW[k];
      devotees.forEach(function (d) {
        if (d.rowId != null) DEV_BY_ROW[d.rowId] = d.code || d.id;
      });
      swap(state.devotees, devotees.map(function (d) {
        var mob = d.mobile || d.phone || '';
        return { id: d.code || d.id, rowId: d.rowId, code: d.code || d.id, name: d.name,
                 phone: mob, mobile: mob, city: d.city, status: d.status,
                 category: d.category || 'normal', visits: d.visits || 0 };
      }));
      if (typeof renderDevotees === 'function') renderDevotees();
      log('devotees: ' + state.devotees.length + (isAdminTier ? '' : ' (lean)'));
    } catch (e) { log('devotees failed: ' + e.message); }
  }

  async function hydrateCore() {
    if (typeof state === 'undefined') return;
    await hydrateDevotees();
  }

  /* ---- Visits ---- */
  async function hydrateVisits() {
    if (typeof VISITS === 'undefined') return;
    var rows = await window.API.get('/visits');
    if (!Array.isArray(rows)) return;
    swap(VISITS.list, rows.map(function (v) {
      return { id: v.id, code: v.code, devoteeName: v.devoteeName || '',
               devoteeId: v.devoteeCode || devCode(v.devoteeId),
               mobile: v.mobile || '', purpose: v.purpose || 'other', address: v.address || '',
               city: v.city || '', state: v.state || 'Gujarat', date: v.date, time: v.time || '',
               escortMode: v.escortMode || 'team',
               escortTeamId: v.escortTeamId || '', escortTeam: v.escortTeamName || v.escortTeam || '',
               escortDevotees: (Array.isArray(v.escortDevotees) ? v.escortDevotees : []).map(function (d) {
                 return { id: d.code || devCode(d.id), name: d.name || '', mobile: d.mobile || '', city: d.city || '' };
               }),
               status: v.status || 'requested', notes: v.notes || '' };
    }));
    if (typeof renderVisits === 'function') renderVisits();
    log('visits: ' + VISITS.list.length);
  }

  /* ---- Donations ---- */
  async function hydrateDonations() {
    if (typeof DON === 'undefined') return;
    var cats = [];
    try { cats = await window.API.get('/donation-categories'); } catch (e) {}
    if (Array.isArray(cats)) {
      swap(DON.categories, cats.map(function (c) {
        return { id: c.id, code: c.code, name: c.name, kind: c.kind, icon: c.icon || '🪙', description: c.description || '' };
      }));
    }
    var donors = [];
    try { donors = await window.API.get('/donors'); } catch (e) {}
    if (Array.isArray(donors)) {
      swap(DON.donors, donors.map(function (d) {
        return { id: d.id, code: d.code, type: d.type, firstName: d.firstName || '', lastName: d.lastName || '',
                 orgName: d.orgName || '', contactPerson: d.contactPerson || '', devoteeId: devCode(d.devoteeId),
                 mobile: d.mobile || '', pan: d.pan || '', city: d.city || '', state: d.state || 'Gujarat',
                 committee: d.committee || '', notes: d.notes || '', addedDate: d.addedDate || '' };
      }));
    }
    var rows = await window.API.get('/donations');
    if (!Array.isArray(rows)) return;
    swap(DON.donations, rows.map(function (x) {
      return { id: x.id, code: x.code, receiptNo: x.receiptNo || '', certNo: x.certNo || '',
               donorId: x.donorId, categoryId: x.categoryId, mode: x.mode || 'Cash',
               amount: x.amount || 0, item: x.item || '', qty: x.qty || '', valuation: x.valuation || 0,
               date: x.date, purpose: x.purpose || '', committee: x.committee || '',
               status: x.status || 'received', certificateIssued: !!x.certificateIssued,
               notes: x.notes || '', recordedBy: x.recordedBy || '' };
    }));
    if (typeof renderDonations === 'function') renderDonations();
    log('donations: ' + DON.donations.length + ' (' + DON.donors.length + ' donors, ' + DON.categories.length + ' categories)');
  }

  /* ---- Accounts (people.js's shared ACCOUNTS registry) ----
     Nothing ever hydrated this before: ACCOUNTS was seeded once with a
     single demo "Administrator" entry (people.js) and never touched again,
     so the Dashboard "Authorized Accounts" KPI and accessSummary() (both
     read ACCOUNTS.length) stayed stuck at 1 forever, even though the real
     Accounts & Access page correctly shows the live account list (it has
     its own separate fetch in access-api.js). Mutate ACCOUNTS in place —
     same array reference every existing consumer (dashboard.js, people.js,
     access.js's offline fallback) already holds — with the real, active
     accounts. */
  async function hydrateAccounts() {
    if (typeof window.ACCOUNTS === 'undefined' || !Array.isArray(window.ACCOUNTS)) return;
    // /users/directory — a name-resolution-only projection every signed-in
    // role may read (no email/mobile/city/rootOwner: those are PII that only
    // the admin-only Accounts & Access page needs, and it fetches the full
    // roster itself via access-api.js's own GET /users call).
    var rows = await window.API.get('/users/directory');
    if (!Array.isArray(rows)) return;
    swap(window.ACCOUNTS, rows.map(function (u) {
      return {
        id: u.devoteeCode || (u.devoteeId != null ? String(u.devoteeId) : String(u.id)),
        name: u.name || '',
        mobile: '',
        city: '',
        roles: u.roles || []
      };
    }));
    log('accounts: ' + window.ACCOUNTS.length);
  }

  async function refreshViews() {
    try { if (typeof renderDashboard === 'function') renderDashboard(); } catch (e) {}
    try { if (typeof renderUnifiedCalendar === 'function') renderUnifiedCalendar(); } catch (e) {}
    try { if (typeof syncEntitySelects === 'function') syncEntitySelects(); } catch (e) {}
    // "view as" preview dropdown's per-person optgroups — re-derive after any
    // hydration step, same reason renderDashboard() re-runs here: the data
    // they're built from (ACCOUNTS) only arrives async, so these stayed empty
    // until an unrelated save touched them for the first time.
    try { if (typeof populateAcctRoleOptions === 'function') populateAcctRoleOptions(); } catch (e) {}
  }

  // one hydrate step per module — used for both the full boot load and the
  // scoped post-save refresh.
  var STEPS = {
    devotees: hydrateDevotees, core: hydrateCore,
    visits: hydrateVisits, donations: hydrateDonations, accounts: hydrateAccounts,
  };
  // the full boot load runs `core` (devotees); a scoped refresh runs only `devotees`.
  var ALL = ['core', 'visits', 'donations', 'accounts'];

  // run(undefined)        → full boot load (every module + settings)
  // run('dhaja') / run(['poojas','donations']) → just those modules (+ core, so
  //   devCode() stays current for any devotee the save created) + refreshViews.
  // A failure in one step is logged and NEVER aborts the rest.
  async function run(only) {
    if (!window.API || !window.API.online) { log('offline — keeping seed data'); return; }
    var full = only == null;
    var mods = full ? ALL.slice()
      : (Array.isArray(only) ? only : [only]).filter(function (k) { return STEPS[k]; });
    if (!full && !mods.length) { full = true; mods = ALL.slice(); }        // unknown key → be safe
    if (!full && mods.indexOf('devotees') === -1 && mods.indexOf('core') === -1) mods = ['devotees'].concat(mods);

    log(full ? 'full hydrate' : 'refresh [' + mods.join(',') + ']');
    if (full) { try { await hydrateSettings(); } catch (e) { log('settings failed: ' + e.message); } }
    for (var i = 0; i < mods.length; i++) {
      try { await STEPS[mods[i]](); } catch (e) { log(mods[i] + ' failed: ' + e.message); }
    }
    try { await refreshViews(); } catch (e) { log('refreshViews failed: ' + e.message); }
    log('done' + (full ? '' : ' [' + mods.join(',') + ']'));
  }

  // Post-save calls are COALESCED: a save flow that fires several __rehydrate()
  // calls (create + link + link…) collapses into ONE refresh a beat later, so
  // the page never thrashes through a dozen API round-trips per entry. The
  // widest scope requested wins (any full request beats scoped).
  var _timer = null, _wantFull = false, _wantMods = {}, _waiters = [];
  function schedule(only) {
    if (only == null || (typeof only === 'string' && !STEPS[only])) _wantFull = true;
    else (Array.isArray(only) ? only : [only]).forEach(function (k) { if (STEPS[k]) _wantMods[k] = true; });
    if (_timer) clearTimeout(_timer);
    return new Promise(function (resolve) {
      _waiters.push(resolve);
      _timer = setTimeout(function () {
        _timer = null;
        var full = _wantFull, mods = Object.keys(_wantMods), w = _waiters;
        _wantFull = false; _wantMods = {}; _waiters = [];
        run(full ? undefined : mods).then(function () { w.forEach(function (r) { r(); }); },
                                          function () { w.forEach(function (r) { r(); }); });
      }, 200);
    });
  }

  window.__rehydrate = schedule;   // modules: window.__rehydrate('<module>') after a save
  window.__rehydrateNow = run;     // synchronous, un-debounced (rarely needed)

  if (document.readyState === 'complete') run();
  else window.addEventListener('load', run);
})();
