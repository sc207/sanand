/* ============================================================
   DEVOTEES 360°
   ------------------------------------------------------------
   A devotee is the one shared person record. This module is a
   read-across view: for each devotee it aggregates every link
   the app holds — committees & Management teams (with role +
   status), Bappa/Bhuvaji visits to their location, donations,
   poojas they run as sevarthi / coordinator, team volunteering,
   guest appearances, events led — each split UPCOMING vs
   COMPLETED, plus a chronological (FIFO, oldest-first) ledger.
   Single-file module, renders into #devoteesRoot, list <-> profile
   router (no URL routing), admin-only via accGuard().

   The list view filters combine four ways: free-text search, the
   derived Samaj label (devoteeSamajLabel — from committee membership,
   not a column), a genuine Committee filter (devoteeInCommittee — any
   committee, not just samaj-type ones), and Category (a real
   devotees.category column — Normal/VIP/Guest/Gurudev-Bhuvaji, see
   devotee-picker.js's DEVOTEE_CATEGORIES — filtered client-side over
   the already-hydrated state.devotees, same as every other filter
   here). Category and Committee can be combined with each other and
   with Samaj/search.
   ============================================================ */

if (typeof window !== 'undefined' && typeof window.t !== 'function') {
  window.t = function (k, f) { return f != null ? f : k; };
  window.onLanguageChange = function () {};
}

const DEVO = { view: 'list', activeId: null, search: '', samaj: 'all', committee: 'all', category: 'all' };

function devoToday() { return (typeof MG !== 'undefined' && MG.today) ? MG.today : '2026-09-06'; }
function devoToast(m) { if (typeof showToast === 'function') showToast(m); }
const devoteeById = id => (typeof state !== 'undefined' && Array.isArray(state.devotees))
  ? state.devotees.find(d => String(d.id) === String(id)) : null;
function devoDigits(v) { return String(v == null ? '' : v).replace(/\D/g, ''); }
function devoInitials(n) {
  return String(n || '?').trim().split(/\s+/).map(w => w.charAt(0)).slice(0, 2).join('') || '?';
}
function devoData(v) { return (typeof tData === 'function') ? tData(v) : v; }
function devoNum(n) { return (typeof locNum === 'function') ? locNum(n || 0) : String(n || 0); }
function devoDate(iso) {
  if (!iso) return '—';
  return (typeof fmtDate === 'function') ? fmtDate(iso) : String(iso);
}
function devoTime(t) {
  if (!t) return '';
  return (typeof fmtTime === 'function') ? fmtTime(t) : String(t);
}
/* VIP / Gurudev-Bhuvaji stand out (maroon); Guest is a neutral pending
   badge; Normal is deliberately unbadged — it's the default, not a
   distinction worth calling out on every single row. */
function devoCategoryBadge(cat) {
  const c = cat || 'normal';
  const label = (typeof devoteeCategoryLabel === 'function') ? devoteeCategoryLabel(c) : c;
  if (c === 'vip' || c === 'gurudev_bhuvaji') return '<span class="badge badge-maroon">' + esc(label) + '</span>';
  if (c === 'guest') return '<span class="badge badge-pending">' + esc(label) + '</span>';
  return '<span class="mg-muted-xs">' + esc(label) + '</span>';
}

/* ============================================================
   AGGREGATOR — devoteeProfile(devoteeId)
   Pure, no DOM. Returns every linked collection pre-split
   upcoming / past with totals.
   ============================================================ */
function devoteeProfile(devoteeId) {
  const dev = devoteeById(devoteeId) || {};
  const per = (typeof personById === 'function' && personById(devoteeId)) || null;
  const id = String(dev.id != null ? dev.id : devoteeId);
  const name = dev.name || (per && per.name) || id;
  const mobile = devoDigits(dev.mobile || dev.phone || (per && per.mobile));
  const city = dev.city || (per && per.city) || '';
  const samaj = devoteeSamajLabel(id);   // derived from the Samaj-type committee
  const category = dev.category || 'normal';   // a real devotees.category column, not derived
  const status = (dev.status || 'active').toLowerCase() === 'inactive' ? 'inactive' : 'active';
  const now = devoToday();

  /* ---- B / C: committees & management teams ---- */
  const committees = ((typeof committeesOfDevotee === 'function' ? committeesOfDevotee(id) : []) || [])
    .map(function (x) {
      const m = x.member || {}, c = x.committee || null;
      return {
        committeeId: m.committeeId,
        name: c ? devoData(c.name) : (m.committeeId || '—'),
        role: m.role || 'Member',
        status: (m.status || 'active'),
        joinedDate: m.joinedDate || ''
      };
    });
  const committeeLead = (typeof CMT !== 'undefined' && Array.isArray(CMT.committees))
    ? CMT.committees.filter(c => String(c.leaderId) === String(id))
        .map(c => ({ committeeId: c.id, name: devoData(c.name) }))
    : [];

  const teams = ((typeof assignmentsOfDevotee === 'function' ? assignmentsOfDevotee(id) : []) || [])
    .map(function (x) {
      const m = x.member || {}, g = x.management || null;
      return {
        managementId: m.managementId,
        name: g ? devoData(g.name) : (m.managementId || '—'),
        role: m.role || 'Volunteer',
        status: (m.status || 'active'),
        joinedDate: m.joinedDate || '',
        color: g && g.color
      };
    });
  const teamLead = (typeof MG !== 'undefined' && Array.isArray(MG.managements))
    ? MG.managements.filter(m => String(m.leadId) === String(id))
        .map(m => ({ managementId: m.id, name: devoData(m.name) }))
    : [];

  /* ---- D: Bappa / Bhuvaji visits to their location ---- */
  const visRows = ((typeof VISITS !== 'undefined' && Array.isArray(VISITS.list)) ? VISITS.list : [])
    .filter(function (v) {
      if (v.devoteeId) return String(v.devoteeId) === String(id);
      if (mobile && devoDigits(v.mobile) === mobile) return true;
      return v.devoteeName && name && v.devoteeName.trim() === name.trim();
    })
    .map(function (v) {
      return {
        id: v.id, date: v.date || '', time: v.time || '',
        purpose: (typeof visitPurposeLabel === 'function') ? visitPurposeLabel(v.purpose) : (v.purpose || ''),
        status: v.status,
        statusLabel: (typeof visitStatusLabel === 'function') ? visitStatusLabel(v.status) : (v.status || ''),
        badge: (typeof VIS_STATUS_BADGE !== 'undefined' && VIS_STATUS_BADGE[v.status]) || 'badge-pending',
        address: v.address || '', city: v.city || '',
        escortTeam: v.escortMode === 'individual' ? (v.escortDevotees || []).map(d => d.name).join(', ') : (v.escortTeam || '')
      };
    });
  const visits = splitByDate(visRows,
    r => (r.status === 'completed' || r.status === 'cancelled'),
    r => r.date, now);

  /* ---- E: poojas / sevas as SEVARTHI ---- */
  const poojas = (typeof POOJA !== 'undefined' && Array.isArray(POOJA.poojas)) ? POOJA.poojas : [];
  const sevRows = [];
  poojas.forEach(function (p) {
    const svs = (typeof sevarthisOf === 'function') ? (sevarthisOf(p) || []) : [];
    const mine = svs.find(s => String(s.devoteeId) === String(id));
    if (mine) sevRows.push(poojaRow(p, { sevarthiId: mine.id, sevarthiStatus: mine.status, addedDate: mine.addedDate || '', committee: mine.committee || '' }));
  });
  const sevaPoojas = splitPooja(sevRows);

  /* ---- F: poojas as COORDINATOR ---- */
  const coordPoojaList = (typeof poojasOfCoordinator === 'function') ? (poojasOfCoordinator(id) || []) : [];
  const coordRows = coordPoojaList.map(p => poojaRow(p, {}));
  const coordPoojas = splitPooja(coordRows);

  /* ---- G: volunteer teams (same rows as C) ---- */
  const volunteerTeams = { count: teams.length, rows: teams };

  /* ---- H: guest appearances ---- */
  const myGuestIds = (typeof POOJA !== 'undefined' && Array.isArray(POOJA.people))
    ? POOJA.people.filter(g => String(g.devoteeId) === String(id)).map(g => g.id) : [];
  const guestRows = [];
  poojas.forEach(function (p) {
    const hit = (p.guestIds || []).some(x => myGuestIds.indexOf(x) !== -1);
    if (!hit) return;
    const gRec = (typeof POOJA !== 'undefined' && Array.isArray(POOJA.people))
      ? POOJA.people.find(g => String(g.devoteeId) === String(id) && (p.guestIds || []).indexOf(g.id) !== -1) : null;
    guestRows.push(poojaRow(p, { guestRole: (gRec && gRec.role) || 'Guest' }));
  });
  const guestAppearances = splitPooja(guestRows);

  /* ---- I: events led (in-charge) ---- */
  const evRows = ((typeof EV !== 'undefined' && Array.isArray(EV.events)) ? EV.events : [])
    .filter(e => String(e.inChargeId) === String(id))
    .map(function (e) {
      const st = (typeof evStatus === 'function') ? evStatus(e) : (e.status || 'planning');
      return {
        eventId: e.id,
        name: (typeof evTypeName === 'function') ? devoData(evTypeName(e)) : (e.name || '—'),
        dateRange: (typeof evDateRange === 'function') ? evDateRange(e) : '',
        firstDate: (typeof evDays === 'function' && (evDays(e)[0] || {}).date) || '',
        status: st,
        statusLabel: (typeof evStatusLabel === 'function') ? evStatusLabel(st) : st,
        badge: (typeof EV_STATUS_BADGE !== 'undefined' && EV_STATUS_BADGE[st]) || 'badge-pending'
      };
    });
  const events = splitByDate(evRows,
    r => (r.status === 'completed' || r.status === 'cancelled'),
    r => r.firstDate, now);

  /* ---- J: donations (donors joined by mobile digits) ---- */
  const donorIds = (typeof DON !== 'undefined' && Array.isArray(DON.donors) && mobile)
    ? DON.donors.filter(d => devoDigits(d.mobile) && devoDigits(d.mobile) === mobile).map(d => d.id) : [];
  let donAll = [];
  donorIds.forEach(function (did) {
    const list = (typeof donationsOfDonor === 'function') ? (donationsOfDonor(did) || []) : [];
    donAll = donAll.concat(list);
  });
  const donRow = x => ({
    id: x.id, date: x.date || '', receiptNo: x.receiptNo || '',
    category: (typeof donCatName === 'function') ? donCatName(x) : '—',
    given: (typeof donationGiven === 'function') ? donationGiven(x) : '',
    value: (typeof donationValue === 'function') ? donationValue(x) : (Number(x.amount) || 0),
    status: x.status, isKind: (typeof donationIsKind === 'function') ? donationIsKind(x) : false
  });
  const received = donAll.filter(x => x.status === 'received').map(donRow).sort(byDateDesc);
  const pledged = donAll.filter(x => x.status === 'pledged').map(donRow).sort(byDateDesc);
  const totalReceived = received.reduce((s, x) => s + (Number(x.value) || 0), 0);
  const totalPledged = pledged.reduce((s, x) => s + (Number(x.value) || 0), 0);
  const donations = { received, pledged, totalReceived, totalPledged, count: donAll.length, donorIds };

  const counts = {
    committees: committees.length,
    teams: teams.length,
    visitsUpcoming: visits.upcoming.length, visitsPast: visits.past.length,
    sevaUpcoming: sevaPoojas.upcoming.length, sevaPast: sevaPoojas.past.length,
    coordUpcoming: coordPoojas.upcoming.length, coordPast: coordPoojas.past.length,
    guestUpcoming: guestAppearances.upcoming.length, guestPast: guestAppearances.past.length,
    donationsCount: donAll.length
  };

  return {
    id, name, mobile, city, samaj, category, status,
    committees, committeeLead, teams, teamLead, volunteerTeams,
    visits, sevaPoojas, coordPoojas, guestAppearances, events, donations, counts
  };

  /* ---- local helpers ---- */
  function poojaRow(p, extra) {
    const sessions = (typeof poojaSessions === 'function') ? poojaSessions(p) : (p.sessions || []);
    const first = sessions[0] || null;
    const last = sessions[sessions.length - 1] || null;
    const st = (typeof poojaStatus === 'function') ? poojaStatus(p) : (p.status || 'planned');
    const tName = (typeof typeById === 'function' && typeById(p.typeId)) ? typeById(p.typeId).name : (p.category || '');
    return Object.assign({
      poojaId: p.id,
      name: devoData(p.name || tName || p.id),
      type: tName ? devoData(tName) : '—',
      sessions: sessions.map(s => ({ date: s.date, start: s.startTime, end: s.endTime, venue: s.venue || '' })),
      firstDate: (first && first.date) || '',
      lastDate: (last && last.date) || '',
      venue: (first && first.venue) || '',
      poojaStatus: st,
      statusLabel: (typeof poojaStatusLabel === 'function') ? poojaStatusLabel(st) : st,
      badge: (typeof POOJA_STATUS_BADGE !== 'undefined' && POOJA_STATUS_BADGE[st]) || 'badge-pending',
      done: (st === 'completed' || st === 'done' || st === 'cancelled')
    }, extra || {});
  }
  function splitPooja(rows) {
    const upcoming = rows.filter(r => !r.done).sort((a, b) => (a.firstDate || '9999').localeCompare(b.firstDate || '9999'));
    const past = rows.filter(r => r.done).sort((a, b) => (b.lastDate || '').localeCompare(a.lastDate || ''));
    return { upcoming, past, total: rows.length };
  }
}

function splitByDate(rows, isDone, dateOf, now) {
  const upcoming = [], past = [];
  rows.forEach(function (r) {
    const d = dateOf(r) || '';
    if (!isDone(r) && d && d >= now) upcoming.push(r); else past.push(r);
  });
  upcoming.sort((a, b) => (dateOf(a) || '9999').localeCompare(dateOf(b) || '9999'));
  past.sort((a, b) => (dateOf(b) || '').localeCompare(dateOf(a) || ''));
  return { upcoming, past, total: rows.length };
}
function byDateDesc(a, b) { return (b.date || '').localeCompare(a.date || ''); }

/* ============================================================
   LEDGER — devoteeLedger(devoteeId), FIFO (oldest-first)
   Derived entirely from devoteeProfile() so it can never
   disagree with the profile cards.
   ============================================================ */
function devoteeLedger(devoteeId) {
  const p = devoteeProfile(devoteeId);
  const rows = [];
  const push = (date, type, title, detail, status, amount) =>
    rows.push({ date: date || '', type, title: title || '', detail: detail || '', status: status || '', amount: (amount == null ? null : amount) });

  p.committees.forEach(c => push(c.joinedDate, 'Committee joined', c.name, 'Role: ' + c.role, c.status));
  p.teams.forEach(t => push(t.joinedDate, 'Team joined', t.name, 'Role: ' + t.role, t.status));

  const seva = p.sevaPoojas.upcoming.concat(p.sevaPoojas.past);
  seva.forEach(r => push(r.addedDate || r.firstDate, 'Sevarthi', r.name,
    [r.type, sessionLine(r)].filter(Boolean).join(' · '), r.statusLabel));

  const coord = p.coordPoojas.upcoming.concat(p.coordPoojas.past);
  coord.forEach(r => push(r.firstDate, 'Coordinator', r.name,
    [r.type, sessionLine(r)].filter(Boolean).join(' · '), r.statusLabel));

  const guest = p.guestAppearances.upcoming.concat(p.guestAppearances.past);
  guest.forEach(r => push(r.firstDate, 'Guest', r.name,
    [r.guestRole, sessionLine(r)].filter(Boolean).join(' · '), r.statusLabel));

  p.visits.upcoming.concat(p.visits.past).forEach(v => push(v.date, 'Padhramani visit', v.purpose,
    [v.address, v.escortTeam ? 'Escort: ' + v.escortTeam : ''].filter(Boolean).join(' · '), v.statusLabel));

  p.donations.received.forEach(d => push(d.date, 'Donation', d.category, d.given + (d.receiptNo ? ' · ' + d.receiptNo : ''), 'Received', d.value));
  p.donations.pledged.forEach(d => push(d.date, 'Pledge', d.category, d.given + (d.receiptNo ? ' · ' + d.receiptNo : ''), 'Pledged', d.value));

  p.events.upcoming.concat(p.events.past).forEach(e => push(e.firstDate, 'Event lead', e.name, e.dateRange, e.statusLabel));

  rows.sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'));
  return rows;

  function sessionLine(r) {
    if (!r.sessions || !r.sessions.length) return '';
    return r.sessions.map(s => devoDate(s.date) + (s.start ? ' ' + devoTime(s.start) : '')).join(', ');
  }
}
function devoLedgerBadge(row) {
  const s = String(row.status || '').toLowerCase();
  if (/(complete|received|confirm|active|done)/.test(s)) return 'badge-confirmed';
  if (/(cancel|inactive)/.test(s)) return 'badge-cancelled';
  return 'badge-pending';
}

/* ============================================================
   ROUTER
   ============================================================ */
function renderDevotees() {
  const root = document.getElementById('devoteesRoot');
  if (!root) return;
  if (typeof accGuard === 'function' && !accGuard(root, 'devotees')) return;
  if (DEVO.view === 'profile' && devoteeById(DEVO.activeId)) {
    root.innerHTML = devoteeProfileView(DEVO.activeId);
  } else {
    DEVO.view = 'list';
    root.innerHTML = devoteeListView();
  }
}
function openDevotee(id) {
  DEVO.activeId = id; DEVO.view = 'profile';
  renderDevotees();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function backToDevotees() {
  DEVO.view = 'list'; DEVO.activeId = null;
  renderDevotees();
}

/* ============================================================
   LIST VIEW
   ============================================================ */
/* A devotee's "Samaj" is DERIVED — it is the samaj label of the Samaj-type
   committee they belong to (`committees.samaj` via committee_members).
   `devotees.samaj` is deprecated / dead (migration 011). */
function devoteeSamajLabel(devId) {
  if (typeof committeesOfDevotee !== 'function') return '';
  const links = committeesOfDevotee(devId) || [];
  for (const x of links) {
    const c = x.committee;
    if (c && c.samaj) return c.samaj;
  }
  return '';
}
function devoteeSamajOptions() {
  const set = {};
  if (typeof CMT !== 'undefined' && Array.isArray(CMT.committees)) {
    CMT.committees.forEach(c => { if (c && c.samaj) set[c.samaj] = 1; });
  }
  return Object.keys(set).sort();
}

/* Category is a real devotees.category column (migration 015) — a fixed
   4-value classification, unlike Samaj above which is derived from
   committee membership. List shared with devotee-picker.js's Add/Edit form
   (window.DEVOTEE_CATEGORIES) so the filter dropdown and the form option
   list can never drift apart. */
function devoteeCategoryFilterOptions() {
  const cats = (typeof window !== 'undefined' && window.DEVOTEE_CATEGORIES) || ['normal', 'vip', 'guest', 'gurudev_bhuvaji'];
  return cats.map(c => [c, (typeof devoteeCategoryLabel === 'function') ? devoteeCategoryLabel(c) : c]);
}

/* Committee filter — every committee (not just samaj-type ones), unlike the
   derived Samaj filter above. */
function devoteeCommitteeFilterOptions() {
  if (typeof CMT === 'undefined' || !Array.isArray(CMT.committees)) return [];
  return CMT.committees.map(c => ({ id: c.code || c.id, label: devoData(c.name) }));
}
function devoteeInCommittee(devId, committeeCode) {
  if (typeof committeesOfDevotee !== 'function') return false;
  return committeesOfDevotee(devId).some(function (x) {
    const c = x.committee;
    return c && (c.code || c.id) === committeeCode;
  });
}

/* ------------------------------------------------------------
   Committee membership from the devotee form
   ------------------------------------------------------------
   "Samaj / Category" on a devotee is just a community label. Real
   committee membership is a committee_members row. This lets the
   devotee Add/Edit form manage those rows directly so one shared
   person record stays wired everywhere it appears. */

/** Checkbox list of every committee, ticked where the devotee is an
    active member. `checkedCodes` overrides the ticked set (used on Add). */
function devoteeCommitteeChecklist(devId, checkedCodes) {
  if (typeof CMT === 'undefined' || !Array.isArray(CMT.committees) || !CMT.committees.length) return '';
  const cur = {};
  if (checkedCodes) { (checkedCodes || []).forEach(c => { if (c) cur[c] = 1; }); }
  else if (typeof committeesOfDevotee === 'function') {
    committeesOfDevotee(devId).forEach(x => {
      const code = x.committee && (x.committee.code || x.committee.id);
      if (code) cur[code] = 1;
    });
  }
  const rows = CMT.committees.map(c => {
    const code = c.code || c.id;
    const nm = (typeof tData === 'function') ? tData(c.name) : c.name;
    return '<label class="dv-cmt-opt"><input type="checkbox" class="dv-cmt-cb" value="' + esc(code) + '"' +
      (cur[code] ? ' checked' : '') + '> <span>' + esc(nm) + '</span></label>';
  }).join('');
  return '<div class="form-group" style="grid-column:1/-1">' +
    '<label class="form-label">' + window.t('dv_committees_pick', 'Committees') + '</label>' +
    '<div class="dv-cmt-list">' + rows + '</div></div>';
}

/** Read the ticked committee codes out of an open devotee form. */
function devoteeCommitteePicked(formId) {
  const f = document.getElementById(formId);
  if (!f) return null;
  const boxes = Array.prototype.slice.call(f.querySelectorAll('.dv-cmt-cb'));
  if (!boxes.length) return null;   // picker not rendered — never treat as "clear all"
  return boxes.filter(cb => cb.checked).map(cb => cb.value);
}

/** Make the devotee's committee memberships match `wantCodes` (committee
    codes): POST new links, soft-DELETE dropped ones. Returns a Promise. */
function syncDevoteeCommittees(devId, wantCodes, addOnly) {
  if (typeof CMT === 'undefined' || wantCodes == null) return Promise.resolve();
  const want = {}; (wantCodes || []).forEach(c => { if (c) want[c] = 1; });
  const curByCode = {};
  if (typeof committeesOfDevotee === 'function') {
    committeesOfDevotee(devId).forEach(x => {
      const code = x.committee && (x.committee.code || x.committee.id);
      if (code) curByCode[code] = x.member;
    });
  }
  const toAdd = Object.keys(want).filter(c => !curByCode[c]);
  const toRemove = addOnly ? [] : Object.keys(curByCode).filter(c => !want[c]);
  if (!toAdd.length && !toRemove.length) return Promise.resolve();

  const online = !!(window.API && window.API.online);
  if (!online) {
    const d = (typeof devoteeById === 'function' && devoteeById(devId)) || {};
    const parts = String(d.name || '').trim().split(/\s+/);
    toAdd.forEach(code => {
      const c = CMT.committees.find(x => (x.code || x.id) === code);
      if (!c) return;
      CMT.members.push({
        id: 'MEM-' + Date.now().toString().slice(-6) + Math.floor(Math.random() * 90 + 10),
        committeeId: c.id, devoteeId: devId,
        firstName: parts[0] || '', lastName: parts.slice(1).join(' '),
        mobile: d.mobile || d.phone || '', city: d.city || '', state: 'Gujarat',
        role: 'Member', status: 'active', notes: '', joinedDate: (typeof devoToday === 'function' ? devoToday() : '')
      });
    });
    toRemove.forEach(code => { const m = curByCode[code]; CMT.members = CMT.members.filter(x => x !== m); });
    if (typeof renderCommittee === 'function') renderCommittee();
    return Promise.resolve();
  }

  const jobs = []
    .concat(toAdd.map(code => () => window.API.post('/committees/' + code + '/members', { devoteeId: devId, role: 'Member' })
      .catch(e => { if (!(e && e.status === 409)) throw e; })))
    .concat(toRemove.map(code => () => {
      const m = curByCode[code];
      const mid = m && (m.code || m.id);
      return mid ? window.API.del('/committees/' + code + '/members/' + mid).catch(() => {}) : Promise.resolve();
    }));
  return jobs.reduce((p, j) => p.then(j), Promise.resolve())
    .then(() => { if (window.__rehydrate) return window.__rehydrate('committees'); })
    .catch(() => { if (typeof devoToast === 'function') devoToast(window.t('dv_cmt_sync_fail', 'Some committee changes did not sync.')); });
}
function devoteesSetSearch(v) {
  DEVO.search = v;
  renderDevotees();
  const el = document.getElementById('dvSearch');
  if (el) { el.focus(); const n = el.value.length; try { el.setSelectionRange(n, n); } catch (e) {} }
}
function devoteesSetSamaj(v) { DEVO.samaj = v; renderDevotees(); }
function devoteesSetCommittee(v) { DEVO.committee = v; renderDevotees(); }
function devoteesSetCategory(v) { DEVO.category = v; renderDevotees(); }

function devoteeListView() {
  const q = (DEVO.search || '').toLowerCase().trim();
  const all = (typeof state !== 'undefined' && Array.isArray(state.devotees)) ? state.devotees.slice() : [];
  const list = all.filter(function (d) {
    const samaj = devoteeSamajLabel(d.id);
    if (DEVO.samaj !== 'all' && samaj !== DEVO.samaj) return false;
    if (DEVO.committee !== 'all' && !devoteeInCommittee(d.id, DEVO.committee)) return false;
    if (DEVO.category !== 'all' && (d.category || 'normal') !== DEVO.category) return false;
    if (!q) return true;
    return [d.name, d.mobile, d.phone, d.city, samaj].join(' ').toLowerCase().indexOf(q) !== -1;
  });

  const profiles = list.map(d => devoteeProfile(d.id));
  const linked = profiles.filter(p =>
    p.counts.committees || p.counts.teams || p.sevaPoojas.total || p.coordPoojas.total ||
    p.visits.total || p.guestAppearances.total || p.donations.count).length;
  const totalReceived = profiles.reduce((s, p) => s + p.donations.totalReceived, 0);
  const upcomingEng = profiles.reduce((s, p) =>
    s + p.counts.sevaUpcoming + p.counts.coordUpcoming + p.counts.guestUpcoming + p.counts.visitsUpcoming, 0);

  const samajOpts = ['<option value="all">' + window.t('all', 'All') + ' ' + window.t('dv_samaj', 'Samaj') + '</option>']
    .concat(devoteeSamajOptions().map(n =>
      '<option value="' + esc(n) + '"' + (DEVO.samaj === n ? ' selected' : '') + '>' + esc(devoData(n)) + '</option>')).join('');
  const committeeOpts = ['<option value="all">' + window.t('dv_committee_all', 'All Committees') + '</option>']
    .concat(devoteeCommitteeFilterOptions().map(c =>
      '<option value="' + esc(c.id) + '"' + (DEVO.committee === c.id ? ' selected' : '') + '>' + esc(c.label) + '</option>')).join('');
  const categoryOpts = ['<option value="all">' + window.t('dv_category_all', 'All Categories') + '</option>']
    .concat(devoteeCategoryFilterOptions().map(c =>
      '<option value="' + esc(c[0]) + '"' + (DEVO.category === c[0] ? ' selected' : '') + '>' + esc(c[1]) + '</option>')).join('');

  const rows = list.length ? list.map(function (d) {
    const p = devoteeProfile(d.id);
    const seq = c => (c ? '<strong>' + c + '</strong>' : '<span class="mg-muted-xs">0</span>');
    const split = (u, done) =>
      (u ? '<span class="badge badge-pending" title="upcoming">▲ ' + u + '</span> ' : '') +
      (done ? '<span class="mg-muted-xs">✔ ' + done + '</span>' : (u ? '' : '<span class="mg-muted-xs">0</span>'));
    return '<tr style="cursor:pointer" onclick="openDevotee(\'' + jsq(d.id) + '\')">' +
      '<td><div class="mg-name-cell"><span class="mg-avatar">' + esc(devoInitials(d.name)) + '</span>' +
        '<div><strong>' + esc(d.name || '—') + '</strong><div class="mg-muted-xs">' + esc(d.id) + '</div></div></div></td>' +
      '<td>' + esc(d.mobile || d.phone || '—') + '</td>' +
      '<td>' + esc(d.city || '—') + '</td>' +
      '<td>' + (function () { const s = devoteeSamajLabel(d.id); return s ? '<span class="badge badge-maroon">' + esc(devoData(s)) + '</span>' : '<span class="mg-muted-xs">—</span>'; })() + '</td>' +
      '<td>' + devoCategoryBadge(d.category) + '</td>' +
      '<td>' + seq(p.counts.committees) + '</td>' +
      '<td>' + seq(p.counts.teams) + '</td>' +
      '<td>' + split(p.counts.sevaUpcoming, p.counts.sevaPast) + '</td>' +
      '<td>' + split(p.counts.coordUpcoming, p.counts.coordPast) + '</td>' +
      '<td>' + seq(p.volunteerTeams.count) + '</td>' +
      '<td>' + split(p.counts.guestUpcoming, p.counts.guestPast) + '</td>' +
      '<td>' + split(p.counts.visitsUpcoming, p.counts.visitsPast) + '</td>' +
      '<td><strong>₹' + devoNum(p.donations.totalReceived) + '</strong>' +
        (p.donations.totalPledged ? '<div class="mg-muted-xs">₹' + devoNum(p.donations.totalPledged) + ' pledged</div>' : '') + '</td>' +
      '<td><span class="badge ' + (p.status === 'active' ? 'badge-confirmed' : 'badge-cancelled') + '">' + esc(p.status) + '</span></td>' +
      '<td onclick="event.stopPropagation()"><div class="flex gap-1">' +
        '<button class="btn btn-outline mg-btn-xs" onclick="openDevotee(\'' + jsq(d.id) + '\')">' + window.t('view', 'Open') + '</button>' +
        '<button class="btn btn-outline mg-btn-xs" onclick="openDevoteeEdit(\'' + jsq(d.id) + '\')">' + window.t('edit', 'Edit') + '</button>' +
      '</div></td></tr>';
  }).join('') : '<tr><td colspan="15" class="mg-empty-cell">' + window.t('dv_none', 'No devotees match.') + '</td></tr>';

  return '' +
  '<div class="flex justify-between items-center mg-page-head">' +
    '<div>' +
      '<h1 class="banner-title mg-page-title">👥 ' + window.t('dv_title', 'Devotees 360°') + '</h1>' +
      '<p class="mg-page-sub">' + window.t('dv_sub', 'Every devotee and everything the temple links to them') + '</p>' +
    '</div>' +
    '<button class="btn btn-primary" onclick="openDevoteeAdd()">＋ ' + window.t('dv_add', 'Add devotee') + '</button>' +
  '</div>' +

  '<div class="stats-grid">' +
    kpiCard(window.t('dv_kpi_total', 'Registered Devotees'), all.length, '', '👥') +
    kpiCard(window.t('dv_kpi_linked', 'Actively Linked'), linked, window.t('dv_kpi_linked_meta', 'On a committee, team, seva, visit or donation'), '🔗') +
    kpiCard(window.t('dv_kpi_donated', 'Total Received (₹)'), '₹' + devoNum(totalReceived), '', '💰') +
    kpiCard(window.t('dv_kpi_upcoming', 'Upcoming Engagements'), upcomingEng, window.t('dv_kpi_upcoming_meta', 'Seva, coordination, guest & visits ahead'), '🗓️') +
  '</div>' +

  '<div class="card mg-mt">' +
    '<div class="card-header flex justify-between items-center" style="flex-wrap:wrap; gap:0.5rem;">' +
      '<div class="card-title">' + window.t('dv_register', 'Devotee Register') + ' <span class="mg-muted-xs">(' + list.length + ')</span></div>' +
      '<div class="flex gap-2" style="flex-wrap:wrap;">' +
        (typeof exportBar === 'function' ? exportBar('mod-devotees') : '') +
        '<select class="form-select mg-inline-select" onchange="devoteesSetSamaj(this.value)">' + samajOpts + '</select>' +
        '<select class="form-select mg-inline-select" onchange="devoteesSetCommittee(this.value)">' + committeeOpts + '</select>' +
        '<select class="form-select mg-inline-select" onchange="devoteesSetCategory(this.value)">' + categoryOpts + '</select>' +
        '<input id="dvSearch" class="form-input mg-inline-search" placeholder="' + window.t('search', 'Search') + '…" value="' + esc(DEVO.search) + '" oninput="devoteesSetSearch(this.value)">' +
      '</div>' +
    '</div>' +
    '<div class="card-body" style="padding:0;">' +
      '<div class="mg-table-scroll"><table class="custom-table" style="min-width:1280px;">' +
        '<thead><tr>' +
          '<th>' + window.t('dv_col_devotee', 'Devotee') + '</th>' +
          '<th>' + window.t('mobile', 'Mobile') + '</th>' +
          '<th>' + window.t('city', 'City') + '</th>' +
          '<th>' + window.t('dv_samaj', 'Samaj') + '</th>' +
          '<th>' + window.t('dv_category', 'Category') + '</th>' +
          '<th>' + window.t('dv_committees', 'Committees') + '</th>' +
          '<th>' + window.t('dv_teams', 'Teams') + '</th>' +
          '<th>' + window.t('dv_k_seva', 'Sevarthi') + '</th>' +
          '<th>' + window.t('dv_k_coord', 'Coordinator') + '</th>' +
          '<th>' + window.t('dv_k_vol', 'Volunteer') + '</th>' +
          '<th>' + window.t('dv_k_guest', 'Guest') + '</th>' +
          '<th>' + window.t('dv_visits', 'Visits') + '</th>' +
          '<th>' + window.t('dv_total_received', 'Total received') + '</th>' +
          '<th>' + window.t('status', 'Status') + '</th>' +
          '<th>' + window.t('actions', 'Actions') + '</th>' +
        '</tr></thead>' +
        '<tbody>' + rows + '</tbody>' +
      '</table></div>' +
    '</div>' +
  '</div>' +

  '<div class="mg-advice mg-mt-sm">' +
    window.t('dv_advice', 'A devotee is one shared person record — the same record is reused wherever the person appears (committee member, team volunteer, sevarthi, coordinator, guest, donor). Edits here reflect everywhere.') +
  '</div>';
}

function openDevoteeAdd() {
  if (typeof openDevoteeSheet !== 'function') { devoToast('Devotee form unavailable'); return; }
  openDevoteeSheet({
    title: window.t('dv_add', 'Add a new devotee'),
    committeePicker: true,
    onSaved: function (dev) {
      renderDevotees();
      if (dev && dev.id) openDevotee(dev.id);
    }
  });
}

/* ============================================================
   PROFILE VIEW
   ============================================================ */
function devoteeProfileView(id) {
  const p = devoteeProfile(id);
  const wa = p.mobile ? 'https://wa.me/91' + p.mobile : '';

  const badges = [
    '<span class="badge ' + (p.status === 'active' ? 'badge-confirmed' : 'badge-cancelled') + '">' + esc(p.status) + '</span>',
    '<span class="badge badge-confirmed">₹' + devoNum(p.donations.totalReceived) + ' ' + window.t('dv_donated', 'donated') + '</span>'
  ];
  if (p.committeeLead.length) badges.push('<span class="badge badge-maroon">' + window.t('dv_cmte_lead', 'Committee Lead') + '</span>');
  if (p.teamLead.length) badges.push('<span class="badge badge-maroon">' + window.t('dv_team_lead', 'Team Lead') + '</span>');
  if (p.category && p.category !== 'normal') badges.push(devoCategoryBadge(p.category));

  const grid = [
    kv(window.t('mobile', 'Mobile'), p.mobile || '—'),
    kv(window.t('city', 'City'), p.city || '—'),
    kv(window.t('dv_samaj', 'Samaj'), devoData(p.samaj) || '—'),
    kv(window.t('dv_category', 'Category'), devoteeCategoryLabel(p.category)),
    kv(window.t('dv_committees', 'Committees'), p.counts.committees),
    kv(window.t('dv_teams', 'Teams'), p.counts.teams),
    kv(window.t('dv_visits', 'Visits to location'), p.visits.total),
    kv(window.t('dv_total_received', 'Total received'), '₹' + devoNum(p.donations.totalReceived)),
    kv(window.t('dv_total_pledged', 'Pledged'), '₹' + devoNum(p.donations.totalPledged))
  ].join('');

  return '' +
  '<button class="btn btn-outline mg-back" onclick="backToDevotees()">← ' + window.t('dv_title', 'Devotees') + '</button>' +

  '<div class="card mg-profile-card">' +
    '<div class="mg-profile-head">' +
      '<div class="mg-profile-avatar" style="background:var(--primary-maroon)">' + esc(devoInitials(p.name)) + '</div>' +
      '<div class="mg-profile-id">' +
        '<h2>' + esc(p.name) + '</h2>' +
        '<div class="mg-muted-xs">' + esc(p.id) + ' · ' + esc(devoData(p.samaj) || window.t('dv_no_samaj', 'No samaj')) + '</div>' +
        '<div class="mg-profile-badges">' + badges.join('') + '</div>' +
      '</div>' +
      '<div class="mg-profile-actions">' +
        (p.mobile ? '<a class="btn btn-outline" href="tel:' + esc(p.mobile) + '">📞 ' + window.t('call', 'Call') + '</a>' +
                    '<a class="btn btn-outline" href="' + esc(wa) + '" target="_blank" rel="noopener">💬 WhatsApp</a>' : '') +
        '<button class="btn btn-outline" onclick="openDevoteeEdit(\'' + jsq(p.id) + '\')">' + window.t('edit', 'Edit') + '</button>' +
        '<button class="btn btn-secondary" onclick="printDevoteeLedger(\'' + jsq(p.id) + '\')">🧾 ' + window.t('dv_print_ledger', 'Print ledger PDF') + '</button>' +
      '</div>' +
    '</div>' +
    '<div class="mg-profile-grid">' + grid + '</div>' +
  '</div>' +

  '<div class="stats-grid">' +
    kpiCard(window.t('dv_k_seva', 'Sevarthi of'), p.sevaPoojas.total, p.counts.sevaUpcoming + ' ' + window.t('upcoming', 'upcoming'), '🪔') +
    kpiCard(window.t('dv_k_coord', 'Coordinates'), p.coordPoojas.total, p.counts.coordUpcoming + ' ' + window.t('upcoming', 'upcoming'), '🧭') +
    kpiCard(window.t('dv_k_vol', 'Volunteer in'), p.volunteerTeams.count, '', '🤝') +
    kpiCard(window.t('dv_k_guest', 'Guest at'), p.guestAppearances.total, p.counts.guestUpcoming + ' ' + window.t('upcoming', 'upcoming'), '🎗️') +
  '</div>' +

  dvRolesCard(p) +
  dvEngagementCard(p, 'upcoming') +
  dvEngagementCard(p, 'past') +
  dvDonationsCard(p) +
  dvLedgerCard(p);

  function kv(label, val) {
    return '<div><span>' + esc(label) + '</span><strong>' + esc(val) + '</strong></div>';
  }
}

function dvRolesCard(p) {
  const cRows = p.committeeLead.map(c =>
      '<tr><td><strong>' + esc(c.name) + '</strong></td><td><span class="badge badge-maroon">' + window.t('dv_leader', 'Leader') + '</span></td><td>—</td><td>—</td></tr>')
    .concat(p.committees.map(c =>
      '<tr><td>' + esc(c.name) + '</td><td>' + esc(c.role) + '</td>' +
      '<td><span class="badge ' + (c.status === 'active' ? 'badge-confirmed' : 'badge-cancelled') + '">' + esc(c.status) + '</span></td>' +
      '<td>' + devoDate(c.joinedDate) + '</td></tr>')).join('');
  const tRows = p.teamLead.map(t =>
      '<tr><td><strong>' + esc(t.name) + '</strong></td><td><span class="badge badge-maroon">' + window.t('dv_lead', 'Lead') + '</span></td><td>—</td><td>—</td></tr>')
    .concat(p.teams.map(t =>
      '<tr><td>' + esc(t.name) + '</td><td>' + esc(t.role) + '</td>' +
      '<td><span class="badge ' + (t.status === 'active' ? 'badge-confirmed' : 'badge-cancelled') + '">' + esc(t.status) + '</span></td>' +
      '<td>' + devoDate(t.joinedDate) + '</td></tr>')).join('');

  if (!cRows && !tRows) return '';
  const tbl = (title, head, body) => !body ? '' :
    '<div class="mg-mt-sm"><div class="mg-muted-xs" style="font-weight:700;margin-bottom:.35rem">' + esc(title) + '</div>' +
    '<div class="mg-table-scroll"><table class="custom-table" style="min-width:560px;"><thead><tr>' + head + '</tr></thead><tbody>' + body + '</tbody></table></div></div>';

  return '<div class="card mg-mt"><div class="card-header"><div class="card-title">' + window.t('dv_roles', 'Roles & Memberships') + '</div></div>' +
    '<div class="card-body">' +
      tbl(window.t('dv_committees', 'Committees'),
          '<th>' + window.t('committee', 'Committee') + '</th><th>' + window.t('role', 'Role') + '</th><th>' + window.t('status', 'Status') + '</th><th>' + window.t('dv_joined', 'Joined') + '</th>', cRows) +
      tbl(window.t('dv_teams', 'Management teams'),
          '<th>' + window.t('team', 'Team') + '</th><th>' + window.t('role', 'Role') + '</th><th>' + window.t('status', 'Status') + '</th><th>' + window.t('dv_joined', 'Joined') + '</th>', tRows) +
      (!cRows && !tRows ? '<div class="mg-pad-note">' + window.t('dv_no_roles', 'Not on any committee or team yet.') + '</div>' : '') +
    '</div></div>';
}

function dvEngagementCard(p, which) {
  const up = which === 'upcoming';
  const seva = up ? p.sevaPoojas.upcoming : p.sevaPoojas.past;
  const coord = up ? p.coordPoojas.upcoming : p.coordPoojas.past;
  const guest = up ? p.guestAppearances.upcoming : p.guestAppearances.past;
  const vis = up ? p.visits.upcoming : p.visits.past;
  const don = up ? p.donations.pledged : p.donations.received;
  const evs = up ? p.events.upcoming : p.events.past;
  const count = seva.length + coord.length + guest.length + vis.length + don.length + evs.length;

  const title = up ? window.t('upcoming', 'Upcoming') : window.t('dv_history', 'Completed & History');
  if (!count) {
    return '<div class="card mg-mt"><div class="card-header"><div class="card-title">' + title + '</div></div>' +
      '<div class="card-body"><div class="mg-pad-note">' + (up ? window.t('dv_no_upcoming', 'Nothing upcoming') : window.t('dv_no_history', 'No completed activity yet')) + '</div></div></div>';
  }

  const sessionsCell = r => (r.sessions && r.sessions.length)
    ? r.sessions.map(s => '<div class="mg-muted-xs">' + devoDate(s.date) + (s.start ? ' · ' + devoTime(s.start) + '–' + devoTime(s.end) : '') + (s.venue ? ' · ' + esc(s.venue) : '') + '</div>').join('')
    : '—';
  const stBadge = r => '<span class="badge ' + r.badge + '">' + esc(r.statusLabel) + '</span>';

  const poojaTbl = (heading, rows, extraHead, extraCell) => !rows.length ? '' :
    sub(heading, '<th>' + window.t('dv_col_pooja', 'Pooja / Seva') + '</th><th>' + window.t('dv_col_type', 'Type') + '</th><th>' + window.t('dv_col_sessions', 'Session date(s)') + '</th>' + (extraHead || '') + '<th>' + window.t('status', 'Status') + '</th>',
      rows.map(r => '<tr><td><strong>' + esc(r.name) + '</strong></td><td>' + esc(r.type) + '</td><td>' + sessionsCell(r) + '</td>' + (extraCell ? extraCell(r) : '') + '<td>' + stBadge(r) + '</td></tr>').join(''), 720);

  const visTbl = !vis.length ? '' : sub(window.t('dv_visits_sec', 'Padhramani visits'),
    '<th>' + window.t('date', 'Date') + '</th><th>' + window.t('time', 'Time') + '</th><th>' + window.t('vis_purpose', 'Purpose') + '</th><th>' + window.t('vis_address', 'Address') + '</th><th>' + window.t('vis_escort', 'Escort team') + '</th><th>' + window.t('status', 'Status') + '</th>',
    vis.map(v => '<tr><td>' + devoDate(v.date) + '</td><td>' + esc(devoTime(v.time)) + '</td><td>' + esc(v.purpose) + '</td><td>' + esc(v.address || '—') + '</td><td>' + esc(v.escortTeam || '—') + '</td><td><span class="badge ' + v.badge + '">' + esc(v.statusLabel) + '</span></td></tr>').join(''), 640);

  const donTbl = !don.length ? '' : sub(up ? window.t('dv_pledged_don', 'Pledged donations') : window.t('dv_received_don', 'Received donations'),
    '<th>' + window.t('date', 'Date') + '</th><th>' + window.t('don_category', 'Category') + '</th><th>' + window.t('don_given', 'Given') + '</th><th>' + window.t('dv_col_amount', 'Value (₹)') + '</th><th>' + window.t('don_receipt_no', 'Receipt') + '</th>',
    don.map(d => '<tr><td>' + devoDate(d.date) + '</td><td>' + esc(d.category) + '</td><td>' + esc(d.given) + '</td><td>₹' + devoNum(d.value) + '</td><td>' + esc(d.receiptNo || '—') + '</td></tr>').join(''), 560);

  const evTbl = !evs.length ? '' : sub(window.t('dv_events_led', 'Events led'),
    '<th>' + window.t('event', 'Event') + '</th><th>' + window.t('date', 'Dates') + '</th><th>' + window.t('status', 'Status') + '</th>',
    evs.map(e => '<tr><td><strong>' + esc(e.name) + '</strong></td><td>' + esc(e.dateRange) + '</td><td><span class="badge ' + e.badge + '">' + esc(e.statusLabel) + '</span></td></tr>').join(''), 420);

  return '<div class="card mg-mt"><div class="card-header"><div class="card-title">' + title + ' <span class="mg-muted-xs">(' + count + ')</span></div></div>' +
    '<div class="card-body">' +
      poojaTbl(window.t('dv_as_sevarthi', 'As Sevarthi'), seva,
        '<th>' + window.t('committee', 'Committee') + '</th><th>' + window.t('dv_sev_status', 'Sevarthi status') + '</th>',
        r => '<td>' + esc(devoData(r.committee) || '—') + '</td><td>' + esc(r.sevarthiStatus || '—') + '</td>') +
      poojaTbl(window.t('dv_as_coord', 'As Coordinator'), coord, '', null) +
      poojaTbl(window.t('dv_as_guest', 'Guest appearances'), guest,
        '<th>' + window.t('dv_guest_role', 'Guest role') + '</th>',
        r => '<td>' + esc(r.guestRole || 'Guest') + '</td>') +
      visTbl + donTbl + evTbl +
    '</div></div>';

  function sub(heading, head, body, minw) {
    return '<div class="mg-mt-sm"><div class="mg-muted-xs" style="font-weight:700;margin-bottom:.35rem">' + esc(heading) + '</div>' +
      '<div class="mg-table-scroll"><table class="custom-table" style="min-width:' + (minw || 560) + 'px;"><thead><tr>' + head + '</tr></thead><tbody>' + body + '</tbody></table></div></div>';
  }
}

function dvDonationsCard(p) {
  const all = p.donations.received.map(x => Object.assign({}, x, { _s: 'received' }))
    .concat(p.donations.pledged.map(x => Object.assign({}, x, { _s: 'pledged' })))
    .sort(byDateDesc);
  let body;
  if (!all.length) {
    body = '<div class="mg-pad-note">' + (p.mobile
      ? window.t('dv_no_don_match', 'No donation record matched this mobile number.')
      : window.t('dv_no_don_mobile', 'Add a mobile number to match this person to donation records.')) + '</div>';
  } else {
    body = '<div class="mg-table-scroll"><table class="custom-table" style="min-width:640px;"><thead><tr>' +
      '<th>' + window.t('date', 'Date') + '</th><th>' + window.t('don_receipt_no', 'Receipt') + '</th><th>' + window.t('don_category', 'Category') + '</th>' +
      '<th>' + window.t('don_given', 'Given') + '</th><th>' + window.t('dv_col_amount', 'Value (₹)') + '</th><th>' + window.t('status', 'Status') + '</th></tr></thead><tbody>' +
      all.map(d => '<tr><td>' + devoDate(d.date) + '</td><td>' + esc(d.receiptNo || '—') + '</td><td>' + esc(d.category) + '</td><td>' + esc(d.given) + '</td><td>₹' + devoNum(d.value) + '</td>' +
        '<td><span class="badge ' + (d._s === 'received' ? 'badge-confirmed' : 'badge-pending') + '">' + esc(d._s) + '</span></td></tr>').join('') +
      '</tbody><tfoot><tr><td colspan="4" style="text-align:right"><strong>' + window.t('dv_total_received', 'Total received') + '</strong></td>' +
        '<td colspan="2"><strong>₹' + devoNum(p.donations.totalReceived) + '</strong></td></tr>' +
      '<tr><td colspan="4" style="text-align:right"><strong>' + window.t('dv_total_pledged', 'Pledged') + '</strong></td>' +
        '<td colspan="2"><strong>₹' + devoNum(p.donations.totalPledged) + '</strong></td></tr></tfoot></table></div>';
  }
  return '<div class="card mg-mt"><div class="card-header"><div class="card-title">' + window.t('nav_donations', 'Donations') + ' <span class="mg-muted-xs">(' + p.donations.count + ')</span></div></div>' +
    '<div class="card-body" style="padding:0">' + body + '</div></div>';
}

function dvLedgerCard(p) {
  const rows = devoteeLedger(p.id);
  const body = rows.length ? '<div class="summary-list">' + rows.map(function (r) {
    return '<div class="summary-item">' +
      '<div><strong>' + esc(r.type) + (r.title ? ' — ' + esc(r.title) : '') + '</strong>' +
      (r.detail ? '<div class="mg-muted-xs">' + esc(r.detail) + '</div>' : '') + '</div>' +
      '<div style="text-align:right">' +
        '<span class="mg-muted-xs">' + (r.date ? devoDate(r.date) : '—') + '</span>' +
        (r.amount != null ? '<div><strong>₹' + devoNum(r.amount) + '</strong></div>' : '') +
        (r.status ? ' <span class="badge ' + devoLedgerBadge(r) + '">' + esc(r.status) + '</span>' : '') +
      '</div></div>';
  }).join('') + '</div>' : '<div class="mg-pad-note">' + window.t('dv_no_ledger', 'No linked activity yet.') + '</div>';

  return '<div class="card mg-mt"><div class="card-header flex justify-between items-center">' +
    '<div class="card-title">' + window.t('dv_ledger', 'Ledger — oldest first') + ' <span class="mg-muted-xs">(' + rows.length + ')</span></div>' +
    '<button class="btn btn-outline mg-btn-xs" onclick="printDevoteeLedger(\'' + jsq(p.id) + '\')">PDF</button>' +
    '</div><div class="card-body">' + body + '</div></div>';
}

/* ============================================================
   EDIT — local sheet (does NOT fork openDevoteeSheet)
   ============================================================ */
function openDevoteeEdit(id) {
  const d = devoteeById(id);
  if (!d) return;
  if (typeof openSheet !== 'function') { devoToast('UI not ready'); return; }
  openSheet({
    title: window.t('dv_edit', 'Edit devotee'),
    body:
      '<form id="dvEditForm" class="grid mg-2col-form" onsubmit="return false">' +
        '<div class="form-group" style="grid-column:1/-1"><label class="form-label">' + window.t('dv_full_name', 'Full name') + ' *</label>' +
          '<input class="form-input" id="dvE_name" value="' + esc(d.name || '') + '" placeholder="e.g. Rameshbhai Rabari"></div>' +
        '<div class="form-group"><label class="form-label">' + window.t('mobile', 'Mobile') + '</label>' +
          '<input class="form-input" id="dvE_mobile" maxlength="10" inputmode="numeric" value="' + esc(d.mobile || d.phone || '') + '"></div>' +
        '<div class="form-group"><label class="form-label">' + window.t('city', 'City') + '</label>' +
          '<input class="form-input" id="dvE_city" value="' + esc(d.city || '') + '"></div>' +
        '<div class="form-group"><label class="form-label">' + window.t('status', 'Status') + '</label>' +
          '<select class="form-select" id="dvE_status">' +
            '<option value="active"' + ((d.status || 'active').toLowerCase() !== 'inactive' ? ' selected' : '') + '>Active</option>' +
            '<option value="inactive"' + ((d.status || '').toLowerCase() === 'inactive' ? ' selected' : '') + '>Inactive</option>' +
          '</select></div>' +
        '<div class="form-group" style="grid-column:1/-1"><label class="form-label">' + window.t('dv_category', 'Category') + '</label>' +
          '<select class="form-select" id="dvE_category">' + window.devoteeCategoryFormOptionsHTML(d.category || 'normal') + '</select></div>' +
        devoteeCommitteeChecklist(id) +
      '</form>',
    footer:
      '<button class="btn btn-outline" onclick="closeSheet()">' + window.t('cancel', 'Cancel') + '</button>' +
      '<button class="btn btn-primary" onclick="saveDevoteeEdit(\'' + jsq(id) + '\')">' + window.t('save', 'Save') + '</button>'
  });
}
function saveDevoteeEdit(id) {
  const d = devoteeById(id);
  if (!d) return;
  const g = x => (document.getElementById(x) || {}).value || '';
  const mob = devoDigits(g('dvE_mobile')).slice(0, 10);
  const name = g('dvE_name').trim().replace(/\s+/g, ' ');
  if (!name) { devoToast(window.t('dv_need_name', 'Full name is required.')); return; }
  if (mob && mob.length !== 10) { devoToast(window.t('dv_need_mobile', 'Mobile must be 10 digits.')); return; }
  const wantCommittees = devoteeCommitteePicked('dvEditForm');
  const category = g('dvE_category') || 'normal';
  Object.assign(d, {
    name: name, mobile: mob, phone: mob,     // keep BOTH — templePeople() reads d.phone || d.mobile
    city: g('dvE_city').trim(), status: g('dvE_status'), category: category
  });
  try {
    if (window.API && window.API.online && typeof window.API.patch === 'function') {
      window.API.patch('/devotees/' + id, { name: d.name, mobile: mob, city: d.city, status: d.status, category: category }).catch(function () {});
    }
  } catch (e) {}
  // committee membership + the derived samaj label are owned by the checklist
  try { syncDevoteeCommittees(id, wantCommittees); } catch (e) {}
  try { if (typeof syncEntitySelects === 'function') syncEntitySelects(); } catch (e) {}
  if (typeof closeSheet === 'function') closeSheet();
  devoToast(name + ' — ' + window.t('save', 'Saved') + ' ✓');
  renderDevotees();
}

/* ============================================================
   EXPORT — list table + per-devotee ledger PDF
   ============================================================ */
function devoteesExport() {
  const rows = ((typeof state !== 'undefined' && Array.isArray(state.devotees)) ? state.devotees : []).map(function (d) {
    const p = devoteeProfile(d.id);
    return [
      d.name || '', d.mobile || d.phone || '', d.city || '', p.samaj || '', devoteeCategoryPlainLabel(p.category),
      p.counts.committees, p.counts.teams, p.sevaPoojas.total, p.coordPoojas.total,
      p.volunteerTeams.count, p.guestAppearances.total, p.visits.total,
      p.donations.totalReceived, p.donations.totalPledged, (d.status || 'active')
    ];
  });
  return {
    filename: 'devotees-360',
    title: window.t('dv_export_title', 'Devotees 360° — Register'),
    subtitle: window.t('dv_export_sub', 'All devotees with linked committees, teams, seva, visits and donations'),
    columns: ['Name', 'Mobile', 'City', 'Samaj', 'Category', 'Committees', 'Teams', 'Sevarthi', 'Coordinator',
      'Volunteer', 'Guest', 'Visits', 'Total Received (INR)', 'Pledged (INR)', 'Status'],
    rows: rows,
    meta: ['Devotees: ' + ((state.devotees || []).length), 'As of ' + devoToday()]
  };
}

function printDevoteeLedger(id) {
  const dev = devoteeById(id) || {};
  const rows = devoteeLedger(id).map(function (r, i) {
    return [
      String(i + 1),
      r.date ? devoDate(r.date) : '—',
      r.type,
      (r.title ? r.title + ' — ' : '') + (r.detail || ''),
      r.status || '',
      r.amount != null ? '₹' + Number(r.amount).toLocaleString('en-IN') : ''
    ];
  });
  if (typeof printReportPDF !== 'function') { devoToast('Print unavailable'); return; }
  printReportPDF({
    filename: 'devotee-ledger-' + String(id).replace(/\W/g, ''),
    title: (dev.name || 'Devotee') + ' — ' + window.t('dv_ledger', 'Ledger'),
    subtitle: window.t('dv_ledger_sub', 'Chronological record of every temple engagement'),
    columns: ['#', window.t('date', 'Date'), window.t('dv_col_type', 'Type'), window.t('dv_col_detail', 'Detail'), window.t('status', 'Status'), window.t('dv_col_amount', 'Amount (₹)')],
    rows: rows,
    meta: ['Devotee: ' + (dev.name || id), 'Samaj: ' + (devoteeSamajLabel(id) || '—'),
      'Category: ' + devoteeCategoryPlainLabel(dev.category), 'As of ' + devoToday()]
  });
}

/* ============================================================
   BOOTSTRAP
   ============================================================ */
if (typeof registerExport === 'function') registerExport('mod-devotees', devoteesExport);

document.addEventListener('DOMContentLoaded', function () {
  if (!document.getElementById('devoteesRoot')) return;
  renderDevotees();
  if (typeof onLanguageChange === 'function') onLanguageChange(function () { renderDevotees(); });
});
