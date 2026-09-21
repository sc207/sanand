/* ============================================================
   GLOBAL COMMAND SEARCH  (⌘K / Ctrl-K)
   ------------------------------------------------------------
   A CRM-style spotlight: one box that finds any devotee, donor,
   sevarthi, pooja, committee, event, team, volunteer, visit or
   account across every in-memory store — and jumps you there.
   Also offers "quick actions" (Schedule a Pooja, Record a
   donation, …) the way Linear / Notion / HubSpot command bars do.
   Loads last so every module store is defined.
   ============================================================ */
(function () {
  'use strict';

  var box, input, panel, results = [], sel = -1;
  var RECENTS = [];                      // last opened, in-memory (resets on reload)

  function t(k, d) { return (typeof window.t === 'function') ? window.t(k, d) : (d != null ? d : k); }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function allowed(page) {
    return (typeof window.canOpenPage === 'function') ? window.canOpenPage(page) : true;
  }
  function nav(page, fn) {
    return function () {
      if (typeof window.switchPage === 'function') window.switchPage(page);
      if (typeof fn === 'function') { try { fn(); } catch (e) {} }
      try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { window.scrollTo(0, 0); }
    };
  }
  function nm(a, b) { return ((a || '') + ' ' + (b || '')).trim(); }

  /* ---- build a fresh index every keystroke (data is tiny + all in memory) ---- */
  function index() {
    var q = [];
    function add(o) { if (o.label) { o.kw = (o.label + ' ' + (o.sub || '') + ' ' + (o.extra || '')).toLowerCase(); q.push(o); } }

    if (typeof state !== 'undefined' && Array.isArray(state.devotees))
      state.devotees.forEach(function (d) {
        add({ type: 'Devotee', icon: '👤', page: 'devotees', label: d.name,
          sub: [d.phone || d.mobile, d.city].filter(Boolean).join(' · '),
          go: nav('devotees') });
      });

    if (typeof POOJA !== 'undefined') {
      (POOJA.poojas || []).forEach(function (p) {
        add({ type: 'Pooja / Seva', icon: '🪔', page: 'puja', label: p.name, extra: p.id,
          sub: (typeof typeById === 'function' && typeById(p.typeId) ? typeById(p.typeId).name : '') ,
          go: nav('puja', function () { if (typeof openPooja === 'function') openPooja(p.id); }) });
      });
      (POOJA.sevarthis || []).forEach(function (s) {
        add({ type: 'Sevarthi', icon: '🙏', page: 'puja', label: nm(s.firstName, s.lastName),
          sub: [s.mobile, s.city].filter(Boolean).join(' · '),
          go: nav('puja', function () { if (typeof openSevarthiProfile === 'function') openSevarthiProfile(s.id); }) });
      });
      (POOJA.people || []).forEach(function (g) {
        add({ type: 'Guest', icon: '🎫', page: 'puja', label: nm(g.firstName, g.lastName),
          sub: [g.role, g.mobile].filter(Boolean).join(' · '), go: nav('puja') });
      });
      (POOJA.poojaTypes || []).forEach(function (ty) {
        add({ type: 'Ritual type', icon: '📜', page: 'puja', label: ty.name, sub: ty.category || '', go: nav('puja') });
      });
    }

    if (typeof DON !== 'undefined') {
      (DON.donors || []).forEach(function (d) {
        add({ type: 'Donor', icon: '💗', page: 'donations', label: d.name || nm(d.firstName, d.lastName),
          sub: [d.mobile, d.type, d.pan].filter(Boolean).join(' · '), go: nav('donations') });
      });
      (DON.donations || []).forEach(function (x) {
        var who = (typeof donorName === 'function') ? donorName(x) : '';
        add({ type: 'Donation', icon: '💰', page: 'donations',
          label: (x.receiptNo || x.certNo || x.id) + (who ? ' — ' + who : ''),
          sub: [x.date, x.amount ? '₹' + x.amount : (x.item || ''), x.status].filter(Boolean).join(' · '),
          go: nav('donations') });
      });
    }

    if (typeof CMT !== 'undefined') {
      (CMT.committees || []).forEach(function (c) {
        add({ type: 'Committee', icon: '🏛️', page: 'committees', label: c.name, sub: c.samaj || '',
          go: nav('committees', function () { if (typeof openCommittee === 'function') openCommittee(c.id); }) });
      });
      (CMT.members || []).forEach(function (m) {
        add({ type: 'Committee member', icon: '👥', page: 'committees', label: nm(m.firstName, m.lastName),
          sub: [m.mobile, m.city].filter(Boolean).join(' · '), go: nav('committees') });
      });
      (CMT.meetings || []).forEach(function (m) {
        add({ type: 'Meeting', icon: '📋', page: 'committees', label: m.title || 'Meeting',
          sub: [m.date, m.startTime, m.venue].filter(Boolean).join(' · '), go: nav('committees') });
      });
    }

    if (typeof EV !== 'undefined')
      (EV.events || []).forEach(function (e) {
        var d0 = (e.days && e.days[0]) ? e.days[0].date : '';
        add({ type: 'Event', icon: '📅', page: 'events', label: e.name,
          sub: [d0, e.venue, e.status].filter(Boolean).join(' · '),
          go: nav('events', function () { if (typeof openEvent === 'function') openEvent(e.id); }) });
      });

    if (typeof MG !== 'undefined') {
      (MG.managements || []).forEach(function (m) {
        add({ type: 'Team', icon: '🗂️', page: 'management', label: m.name,
          sub: (typeof leadById === 'function' && m.leadId && leadById(m.leadId) ? 'Lead: ' + leadById(m.leadId).name : ''),
          go: nav('management', function () { if (typeof openManagement === 'function') openManagement(m.id); }) });
      });
      (MG.members || []).forEach(function (v) {
        add({ type: 'Volunteer', icon: '🧑', page: 'management', label: v.name || nm(v.firstName, v.lastName),
          sub: [v.mobile, v.city].filter(Boolean).join(' · '), go: nav('management') });
      });
    }

    if (typeof VISITS !== 'undefined')
      (VISITS.list || []).forEach(function (v) {
        var lbl = (typeof visitPurposeLabel === 'function' && v.purpose) ? visitPurposeLabel(v.purpose) : (v.purpose || '');
        add({ type: 'Bhuvaji visit', icon: '🛕', page: 'visits', label: v.devoteeName || 'Visit',
          sub: [lbl, v.date, v.status].filter(Boolean).join(' · '), go: nav('visits') });
      });

    if (typeof ACCOUNTS !== 'undefined')
      ACCOUNTS.forEach(function (a) {
        add({ type: 'Account', icon: '🛡️', page: 'admin', label: a.name,
          sub: [a.mobile, (a.roles || []).map(function (r) { return (typeof roleLabel === 'function') ? roleLabel(r) : r; }).join(', ')].filter(Boolean).join(' · '),
          go: nav('admin') });
      });

    /* section shortcuts — jump to any page by name */
    [['dashboard', '🏠', 'Dashboard'], ['calendar', '🗓️', 'Unified Calendar'],
     ['visits', '🛕', 'Bappa / Bhuvaji Visits'], ['devotees', '👥', 'Devotees'],
     ['donations', '💰', 'Donations'], ['reports', '📊', 'Reports & Analytics'],
     ['settings', '⚙️', 'Settings'], ['admin', '🛡️', 'Accounts & Access']
    ].forEach(function (p) { add({ type: 'Go to', icon: p[1], page: p[0], label: p[2], sub: 'Open section', go: nav(p[0]) }); });

    return q.filter(function (o) { return allowed(o.page); });
  }

  /* ---- quick actions (command-bar verbs) ---- */
  function quickActions() {
    var qa = [
      { icon: '💰', label: t('don_record', 'Record Donation'), page: 'donations', run: function () { if (typeof openRecordDonation === 'function') openRecordDonation(); else if (typeof switchPage === 'function') switchPage('donations'); } },
      { icon: '🛕', label: t('vis_add', 'Add Visit'), page: 'visits', run: function () { if (typeof openAddVisit === 'function') openAddVisit(); } },
      { icon: '👥', label: t('add_devotee', 'Register Devotee'), page: 'devotees', run: function () { if (typeof openDevoteeAdd === 'function') openDevoteeAdd(); } }
    ];
    return qa.filter(function (a) { return allowed(a.page); }).map(function (a) {
      return { type: 'Action', icon: a.icon, label: a.label, sub: t('search_action', 'Quick action'),
        go: function () { if (typeof switchPage === 'function') switchPage(a.page); setTimeout(a.run, 60); } };
    });
  }

  /* ---- scoring / filter ---- */
  function search(raw) {
    var query = raw.trim().toLowerCase();
    if (!query) return RECENTS.slice(0, 6).concat(quickActions());
    var terms = query.split(/\s+/);
    var scored = [];
    index().concat(quickActions()).forEach(function (o) {
      var hay = (o.kw || (o.label + ' ' + (o.sub || '')).toLowerCase());
      var ok = terms.every(function (tm) { return hay.indexOf(tm) !== -1; });
      if (!ok) return;
      var s = 0;
      if (o.label.toLowerCase().indexOf(query) === 0) s += 100;
      else if (o.label.toLowerCase().indexOf(query) !== -1) s += 40;
      if (o.type === 'Action') s += 25;
      if (o.type === 'Go to') s -= 10;
      scored.push({ o: o, s: s });
    });
    scored.sort(function (a, b) { return b.s - a.s; });
    var seen = {}, uniq = [];
    scored.forEach(function (x) {
      var k = x.o.type + '|' + x.o.label + '|' + (x.o.sub || '');
      if (seen[k]) return; seen[k] = 1; uniq.push(x.o);
    });
    return uniq.slice(0, 12);
  }

  /* ---- render ---- */
  function draw(list) {
    results = list; sel = list.length ? 0 : -1;
    place();
    if (!list.length) {
      panel.innerHTML = '<div class="gsearch-empty">' + esc(t('search_none', 'No matches. Try a name, receipt number or section.')) + '</div>';
      panel.hidden = false; return;
    }
    panel.innerHTML = list.map(function (o, i) {
      return '<button class="gsearch-row' + (i === sel ? ' is-sel' : '') + '" data-i="' + i + '">' +
        '<span class="gsearch-ico">' + esc(o.icon || '•') + '</span>' +
        '<span class="gsearch-tx"><span class="gsearch-lbl">' + esc(o.label) + '</span>' +
        (o.sub ? '<span class="gsearch-sub">' + esc(o.sub) + '</span>' : '') + '</span>' +
        '<span class="gsearch-tag">' + esc(o.type || '') + '</span></button>';
    }).join('');
    Array.prototype.forEach.call(panel.querySelectorAll('.gsearch-row'), function (r) {
      r.addEventListener('mousedown', function (e) { e.preventDefault(); pick(+r.dataset.i); });
      r.addEventListener('mouseenter', function () { sel = +r.dataset.i; paintSel(); });
    });
    panel.hidden = false;
  }
  function paintSel() {
    Array.prototype.forEach.call(panel.querySelectorAll('.gsearch-row'), function (r, i) {
      r.classList.toggle('is-sel', i === sel);
      if (i === sel) r.scrollIntoView({ block: 'nearest' });
    });
  }
  /* the panel lives on <body> (a portal) because .nav-left is overflow:hidden;
     position it under the input on every open. */
  function place() {
    if (!panel || !input) return;
    var r = input.getBoundingClientRect();
    panel.style.left = Math.round(r.left) + 'px';
    panel.style.top = Math.round(r.bottom + 8) + 'px';
    panel.style.width = Math.max(320, Math.round(r.width) + 120) + 'px';
  }
  function close() { if (panel) { panel.hidden = true; panel.innerHTML = ''; } sel = -1; }
  function pick(i) {
    var o = results[i]; if (!o) return;
    if (o.type !== 'Action' && o.type !== 'Go to') {
      RECENTS = [o].concat(RECENTS.filter(function (r) { return r.label !== o.label || r.type !== o.type; })).slice(0, 8);
    }
    close(); if (input) { input.value = ''; input.blur(); }
    if (typeof o.go === 'function') o.go();
  }

  /* ---- public: called from the input's oninput ---- */
  window.handleGlobalSearch = function (val) {
    if (!panel) return;
    draw(search(val || ''));
  };
  window.gsearchKeydown = function (e) {
    if (!panel) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); if (results.length) { sel = (sel + 1) % results.length; paintSel(); } }
    else if (e.key === 'ArrowUp') { e.preventDefault(); if (results.length) { sel = (sel - 1 + results.length) % results.length; paintSel(); } }
    else if (e.key === 'Enter') { e.preventDefault(); if (sel >= 0) pick(sel); }
    else if (e.key === 'Escape') { close(); input.blur(); }
  };

  document.addEventListener('DOMContentLoaded', function () {
    box = document.querySelector('.nav-search');
    input = document.getElementById('globalSearchInput');
    if (!box || !input) return;
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('onkeydown', 'gsearchKeydown(event)');
    input.addEventListener('keydown', window.gsearchKeydown);
    input.addEventListener('focus', function () { window.handleGlobalSearch(input.value); });
    panel = document.createElement('div');
    panel.className = 'gsearch-panel';
    panel.hidden = true;
    document.body.appendChild(panel);           // portal — escapes .nav-left overflow:hidden
    document.addEventListener('click', function (e) {
      if (!box.contains(e.target) && !panel.contains(e.target)) close();
    });
    window.addEventListener('resize', function () { if (!panel.hidden) place(); });
    document.addEventListener('scroll', function () { if (!panel.hidden) close(); }, true);
    document.addEventListener('keydown', function (e) {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        if (box.offsetParent === null) return;      // hidden on mobile
        input.focus(); input.select();
      }
    });
  });
})();
