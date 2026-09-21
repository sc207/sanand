/* ============================================================
   Shared people picker — one real source for every "assign a person"
   dropdown (event in-charge, committee leader, management lead, pooja
   coordinator). Aggregates from the central Devotees register plus any
   committee / management / sevarthi records, deduped by mobile, and offers
   each committee itself as an assignable entity. No hard-coded names.
   ============================================================ */
(function () {
  if (typeof window === 'undefined') return;

  function fullName(o) {
    if (!o) return '';
    return (o.name || ((o.firstName || '') + ' ' + (o.lastName || '')).trim()).trim();
  }

  /* → [{ id, name, mobile, city, kind:'person'|'committee' }] sorted by name */
  window.templePeople = function () {
    var seen = {};
    var out = [];
    function add(id, name, mobile, city, kind) {
      name = (name || '').trim();
      if (!name) return;
      var key = (kind === 'committee' ? 'c:' + id : (String(mobile || '').replace(/\D/g, '') || 'n:' + name.toLowerCase()));
      if (seen[key]) { if (id && !seen[key].id) seen[key].id = id; return; }
      var rec = { id: id || ('PP-' + key), name: name, mobile: mobile || '', city: city || '', kind: kind || 'person' };
      seen[key] = rec;
      out.push(rec);
    }

    if (typeof state !== 'undefined' && Array.isArray(state.devotees))
      state.devotees.forEach(function (d) { add(d.id, d.name, d.phone || d.mobile, d.city, 'person'); });
    if (typeof CMT !== 'undefined' && Array.isArray(CMT.members))
      CMT.members.forEach(function (m) { add(m.devoteeId || m.id, fullName(m), m.mobile, m.city, 'person'); });
    if (typeof MG !== 'undefined' && Array.isArray(MG.members))
      MG.members.forEach(function (m) { add(m.devoteeId || m.id, fullName(m), m.mobile, m.city, 'person'); });
    if (typeof POOJA !== 'undefined' && Array.isArray(POOJA.sevarthis))
      POOJA.sevarthis.forEach(function (s) { add(s.devoteeId || s.id, fullName(s), s.mobile, s.city, 'person'); });

    out.sort(function (a, b) { return a.name.localeCompare(b.name); });

    // committees as assignable entities (kept after the people, prefixed)
    if (typeof CMT !== 'undefined' && Array.isArray(CMT.committees)) {
      CMT.committees.forEach(function (c) {
        add('CMT:' + c.id, (typeof tData === 'function' ? tData(c.name) : c.name), '', '', 'committee');
      });
    }
    return out;
  };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* Card / calendar accent colours are assigned automatically in creation
     order — the user never picks one. Mirrors server/services/palette.js. */
  var CARD_PALETTE = ['#6B1F2A', '#C96A20', '#C9A24A', '#4C8B5A', '#7A3B62',
                      '#3B5C8A', '#A6432E', '#2E7D6B', '#8A6D3B', '#5A4B8A'];
  window.nextCardColor = function (existingCount) {
    var n = Number(existingCount) || 0;
    return CARD_PALETTE[((n % CARD_PALETTE.length) + CARD_PALETTE.length) % CARD_PALETTE.length];
  };

  /* Real committee names from the live store (kept in sync with the DB when
     hydration lands); a small fallback keeps the app usable offline. */
  window.committeeNames = function () {
    if (typeof CMT !== 'undefined' && Array.isArray(CMT.committees) && CMT.committees.length) {
      return CMT.committees.map(function (c) {
        return (typeof tData === 'function' ? tData(c.name) : c.name) || '';
      }).filter(Boolean);
    }
    return ['General Temple Committee', 'Rabari Samaj Committee', 'Marvadi Samaj Committee'];
  };
  window.teamNames = function () {
    if (typeof MG !== 'undefined' && Array.isArray(MG.managements) && MG.managements.length) {
      return MG.managements.map(function (m) {
        return (typeof tData === 'function' ? tData(m.name) : m.name) || '';
      }).filter(Boolean);
    }
    return ['VIP Guest Management', 'Parking Management', 'Prasad Management'];
  };

  /* Repopulate every entity-backed <select> / <datalist> from live data so a
     dropdown never carries a hard-coded name list. Safe to call any time.
     NOTE: there is no "samaj" text field any more — a devotee's samaj is their
     Samaj-type committee membership (committee_members), edited via the
     Committees checklist. So no donCommitteeList / sevCommitteeList fill. */
  window.syncEntitySelects = function () {
    var fillDatalist = function (id, items) {
      var el = document.getElementById(id);
      if (!el) return;
      el.innerHTML = items.map(function (x) { return '<option value="' + esc(x) + '"></option>'; }).join('');
    };
    // guest role suggestions — Pandit removed on request
    fillDatalist('gstRoleList', ['Chief Guest', 'Guest of Honour', 'Trust President', 'Trustee', 'Yagna Acharya', 'Path Acharya', 'Mahila Mandal Head']);
  };

  // run once the modules have loaded, on language change, and before any modal opens
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(window.syncEntitySelects, 0); });
  } else {
    setTimeout(window.syncEntitySelects, 0);
  }
  if (typeof window.onLanguageChange === 'function') window.onLanguageChange(window.syncEntitySelects);
  if (typeof window.openModal === 'function') {
    var _openModal = window.openModal;
    window.openModal = function (id) {
      try { window.syncEntitySelects(); } catch (e) {}
      return _openModal.apply(this, arguments);
    };
  }

  /** Resolve an id (person or 'CMT:<id>') to { id, name, mobile, ... } or null. */
  window.personById = function (id) {
    if (!id) return null;
    var all = window.templePeople();
    for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
    return null;
  };

  /** <option> string for a <select>. Keeps a previously-saved value even if the
      person is no longer in the list; nudges the admin when the list is empty. */
  window.personOptions = function (selectedId, placeholder, opts) {
    var all = window.templePeople();
    if (opts && opts.peopleOnly) all = all.filter(function (p) { return p.kind !== 'committee'; });
    var html = '<option value="">' + (placeholder || '— none —') + '</option>';
    var matched = false;
    all.forEach(function (p) {
      var sel = p.id === selectedId ? ' selected' : '';
      if (sel) matched = true;
      var label = (p.kind === 'committee' ? '👥 ' : '') + p.name + (p.mobile ? ' · ' + p.mobile : '');
      html += '<option value="' + p.id + '"' + sel + '>' + label + '</option>';
    });
    if (selectedId && !matched) html += '<option value="' + selectedId + '" selected>' + selectedId + '</option>';
    if (!all.length) html += '<option value="" disabled>' +
      (typeof window.t === 'function' ? window.t('pp_empty', 'Add people in Devotees / Committee first') : 'Add people in Devotees / Committee first') +
      '</option>';
    return html;
  };
})();
