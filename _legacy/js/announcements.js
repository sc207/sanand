/* Opening announcement — one full-screen temple notification per user per day
   for upcoming activities relevant to their role & relationships.

   Source of truth: GET /api/reminders (server derives it live from the
   canonical pooja / meeting / session / event / annual-event / visit rows —
   NOT a separate notice store). This file only presents it and records
   "seen today" via POST /api/reminders/seen. localStorage is a same-device
   fast-path only; the server's per-user seenToday flag is authoritative
   across browsers / devices. */
(function () {
  if (typeof window === 'undefined') return;
  if (!(window.API && window.API.online)) return;      // demo / logged-out → nothing

  var LS_KEY = 'svmmm_annc_shown_on';
  var overlay, listEl, shownKeys = [], opened = false;

  // Defensively force the overlay out of view the moment this script runs — even
  // if a stale cached stylesheet is missing the `.annc-overlay[hidden]` rule,
  // inline display:none always wins. It is only un-set in open().
  (function forceHidden() {
    var el = document.getElementById('openingAnnounce');
    if (el) { el.hidden = true; el.style.display = 'none'; }
  })();

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function T(k, f) { return (typeof window.t === 'function') ? window.t(k, f) : (f != null ? f : k); }

  var ICON = { pooja: '🪔', meeting: '👥', session: '🤝', event: '🎪', annual: '📿', visit: '🙏', dhaja: '🚩' };

  function countdown(d) {
    if (d <= 0) return T('annc_today', 'Today');
    if (d === 1) return T('annc_tomorrow', 'Tomorrow');
    return T('annc_in_days', 'In {n} days').replace('{n}', d);
  }
  function fmtDate(iso) {
    if (typeof window.locDate === 'function') { try { return window.locDate(iso); } catch (e) {} }
    return iso;
  }
  function fmtTime(t) {
    if (!t) return '';
    if (typeof window.locTime === 'function') { try { return window.locTime(t); } catch (e) {} }
    return t;
  }

  function card(it) {
    var when = '<span class="annc-chip" style="--c:' + esc(it.color) + '">' + esc(countdown(it.daysUntil)) + '</span>';
    var line2 = [fmtDate(it.date), fmtTime(it.time), it.venue].filter(Boolean).map(esc).join(' &nbsp;·&nbsp; ');
    return '' +
      '<div class="annc-item" style="--c:' + esc(it.color) + '">' +
        '<div class="annc-ico" aria-hidden="true">' + (ICON[it.kind] || '🔔') + '</div>' +
        '<div class="annc-body">' +
          '<div class="annc-item-top">' + when + '<span class="annc-reason">' + esc(it.reasonRole || '') + '</span></div>' +
          '<div class="annc-name">' + esc(it.title) + '</div>' +
          '<div class="annc-sub">' + esc(it.subtitle) + '</div>' +
          (line2 ? '<div class="annc-meta">' + line2 + '</div>' : '') +
          (it.deepLink ? '<button type="button" class="annc-view" data-page="' + esc(it.deepLink) + '">' + esc(T('annc_view', 'View details')) + ' →</button>' : '') +
        '</div>' +
      '</div>';
  }

  function dismiss() {
    if (!overlay) return;
    overlay.hidden = true;
    overlay.style.display = 'none';            // beats a stale stylesheet
    document.body.classList.remove('annc-open');
    var keys = shownKeys;
    shownKeys = [];
    if (keys.length) {
      window.API.post('/reminders/seen', { keys: keys }).catch(function () {});
    }
  }

  function open(data) {
    if (opened) return;
    overlay = document.getElementById('openingAnnounce');
    listEl = document.getElementById('anncList');
    if (!overlay || !listEl) return;

    var items = (data.items || []).filter(function (it) { return !it.seenToday; });
    if (!items.length) return;                 // nothing to announce → never show the overlay
    opened = true;
    shownKeys = items.map(function (it) { return it.key; });

    var kicker = document.getElementById('anncKicker');
    if (kicker) kicker.textContent = T('annc_kicker', "Today's Temple Updates") +
      '  ·  ' + items.length + ' ' + (items.length === 1 ? T('annc_update', 'update') : T('annc_updates', 'updates'));

    listEl.innerHTML = items.map(card).join('');
    listEl.querySelectorAll('.annc-view').forEach(function (b) {
      b.addEventListener('click', function () {
        var page = b.getAttribute('data-page') || '';
        dismiss();
        if (page && typeof window.switchPage === 'function') {
          try { window.switchPage(page); } catch (e) {}
        }
      });
    });

    var cont = document.getElementById('anncContinue');
    var x = document.getElementById('anncClose');
    if (cont) { cont.textContent = T('annc_continue', 'Continue to Dashboard'); cont.onclick = dismiss; }
    if (x) x.onclick = dismiss;
    overlay.addEventListener('click', function (e) { if (e.target === overlay) dismiss(); });
    document.addEventListener('keydown', function esckey(e) {
      if (e.key === 'Escape' && !overlay.hidden) { dismiss(); document.removeEventListener('keydown', esckey); }
    });

    document.body.classList.add('annc-open');
    overlay.style.display = '';                // let the stylesheet place it (grid, centered)
    overlay.hidden = false;
    try { localStorage.setItem(LS_KEY, data.today); } catch (e) {}
  }

  // Ask the server what (if anything) to announce today. Fire it early so the
  // answer is usually ready by the time the app has painted — but NOTHING is
  // shown on screen until we KNOW there is a real, unseen item. A slow, failed
  // or empty response simply means no announcement: the overlay stays hidden and
  // the user goes straight to the dashboard.
  var pending = Promise.race([
    window.API.get('/reminders').catch(function () { return null; }),
    new Promise(function (res) { setTimeout(function () { res(null); }, 8000); }),
  ]);

  function maybeShow() {
    // this device already did today's announcement → nothing to do
    try {
      if (localStorage.getItem(LS_KEY) === (window.MG && window.MG.today)) return;
    } catch (e) {}

    pending.then(function (data) {
      if (!data || !data.showOpening) return;                     // nothing to announce
      try { if (localStorage.getItem(LS_KEY) === data.today) return; } catch (e) {}
      var unseen = (data.items || []).filter(function (it) { return !it.seenToday; });
      if (!unseen.length) return;                                 // nothing unseen → stay hidden
      open(data);                                                 // real content → show it over the dashboard
    }).catch(function () { /* never block the dashboard */ });
  }

  // The splash loader (#appLoader in index.html) must finish and be REMOVED
  // from the DOM before anything shows — the announcement is the second screen,
  // never layered over the loader. Wait for window.load, then poll until the
  // loader node is gone (it removes itself on load, with an 8s self-guard), then
  // a short beat for the dashboard's first paint. Capped so a broken loader
  // can't block the announcement forever.
  function afterLoader(cb) {
    var start = Date.now();
    (function tick() {
      var loaderGone = !document.getElementById('appLoader');
      if ((loaderGone && document.readyState === 'complete') || Date.now() - start > 12000) {
        setTimeout(cb, 250);
      } else {
        setTimeout(tick, 100);
      }
    })();
  }

  if (document.readyState === 'complete') afterLoader(maybeShow);
  else window.addEventListener('load', function () { afterLoader(maybeShow); });
})();
