/* ============================================================
   COMBINED / UNIVERSAL INVITATION — #inviteRoot
   ------------------------------------------------------------
   A second, additional way to send invitations: pick several poojas
   (from every pooja ever added) and build ONE invitation card listing
   all of them together (a festival-programme style card), instead of
   the existing one-card-per-pooja designer on each pooja's own
   workspace (public/js/pooja-ui.js — untouched by this file).

   Reuses pooja-ui.js's shared invitation machinery as-is: printInvitationHTML,
   downloadInvitationPDF, downloadInvitationZIP, invAudienceOptions,
   invAudienceRecipients, ivt/invLang/invDateLoc, inviteEmblemImg,
   inviteMandalaSVG. Only the card-body markup (combinedInvitationMarkup) and
   the pooja-selection UI are new — no existing pooja-ui.js function is
   modified. Loaded right after pooja-forms.js (index.html), so every one of
   those globals already exists by the time this file runs.
   ============================================================ */

if (typeof window !== 'undefined' && typeof window.t !== 'function') {
  window.t = function (k, f) { return f != null ? f : k; };
  window.onLanguageChange = function () {};
}

var CIV = {
  selectedIds: [],
  search: '',
  opts: { template: 'royal', accent: '#6B1F2A', lang: '', headline: '', inviteLine: '', blessing: '', audience: '', audienceCategory: '', showTime: true }
};

/* ---- pooja selection ---- */
function civFilteredPoojas() {
  var list = (typeof visiblePoojas === 'function' ? visiblePoojas() : []).slice();
  var q = (CIV.search || '').toLowerCase().trim();
  if (q) list = list.filter(function (p) { return (p.name || '').toLowerCase().indexOf(q) !== -1; });
  list.sort(function (a, b) {
    var fa = firstSession(a), fb = firstSession(b);
    if (!fa && !fb) return 0;
    if (!fa) return 1;
    if (!fb) return -1;
    return (fa.date + fa.startTime).localeCompare(fb.date + fb.startTime);
  });
  return list;
}

function civPoojaChecklistHTML() {
  var list = civFilteredPoojas();
  if (!list.length) {
    return '<div class="mg-pad-note">' + esc(window.t('civ_no_poojas', 'No poojas have been added yet.')) + '</div>';
  }
  return '<div style="max-height:420px;overflow-y:auto;display:flex;flex-direction:column;gap:0.4rem;">' +
    list.map(function (p) {
      var st = poojaStatus(p);
      var checked = CIV.selectedIds.indexOf(p.id) !== -1;
      return '<label class="mg-check-inline" style="align-items:flex-start;padding:0.4rem 0.5rem;border-radius:8px;border:1px solid var(--warm-border);">' +
        '<input type="checkbox" ' + (checked ? 'checked' : '') + ' onchange="toggleCivPooja(\'' + p.id + '\')">' +
        '<span style="display:flex;flex-direction:column;gap:2px;">' +
        '<strong>' + esc(pjLoc(p.name)) + '</strong>' +
        '<span class="mg-muted-xs">' + esc(dateRangeText(p)) +
        ' · <span class="badge ' + POOJA_STATUS_BADGE[st] + '">' + POOJA_STATUS_DOT[st] + ' ' + esc(poojaStatusLabel(st)) + '</span></span>' +
        '</span>' +
        '</label>';
    }).join('') +
    '</div>';
}

function civRefreshChecklist() {
  var box = document.getElementById('civChecklist');
  if (box) box.innerHTML = civPoojaChecklistHTML();
}

function civSetSearch(v) {
  CIV.search = v;
  civRefreshChecklist();
}

function toggleCivPooja(id) {
  var i = CIV.selectedIds.indexOf(id);
  if (i === -1) CIV.selectedIds.push(id); else CIV.selectedIds.splice(i, 1);
  updateCombinedInvitationPreview();
}

function civSelectAll() {
  civFilteredPoojas().forEach(function (p) {
    if (CIV.selectedIds.indexOf(p.id) === -1) CIV.selectedIds.push(p.id);
  });
  civRefreshChecklist();
  updateCombinedInvitationPreview();
}

function civClearAll() {
  var visible = civFilteredPoojas().map(function (p) { return p.id; });
  CIV.selectedIds = CIV.selectedIds.filter(function (id) { return visible.indexOf(id) === -1; });
  civRefreshChecklist();
  updateCombinedInvitationPreview();
}

function selectedPoojasSorted() {
  var list = CIV.selectedIds.map(poojaById).filter(Boolean);
  list.sort(function (a, b) {
    var fa = firstSession(a), fb = firstSession(b);
    if (!fa && !fb) return 0;
    if (!fa) return 1;
    if (!fb) return -1;
    return (fa.date + fa.startTime).localeCompare(fb.date + fb.startTime);
  });
  return list;
}

/* ---- designer options (mirrors readInvitationOpts, no schedule/sevarthi/
   guest toggles — the combined card always shows its programme list and
   never a single pooja's sevarthi/guest block, which would be ambiguous
   across several selected poojas) ---- */
function readCombinedInvitationOpts() {
  var g = function (id) { return document.getElementById(id); };
  if (!g('civTemplate')) return Object.assign({}, CIV.opts);
  return {
    template: g('civTemplate').value,
    accent: g('civAccent').value,
    lang: g('civLangSel') ? g('civLangSel').value : '',
    audience: g('civAudience') ? g('civAudience').value : '',
    audienceCategory: g('civAudienceCategory') ? g('civAudienceCategory').value : '',
    headline: g('civHeadline').value,
    inviteLine: g('civLine').value,
    blessing: g('civBlessing').value,
    showTime: g('civShowTime') ? g('civShowTime').checked : true
  };
}

/* ---- combined card markup — sibling of invitationMarkup(p,opts) in
   pooja-ui.js, never edits it. One row per selected pooja (not per
   session): a single/one-session pooja shows its date+time+venue; a
   multi-session pooja shows a first–last date range (matching
   dateRangeText()'s style) so a card with several poojas stays a compact
   programme overview instead of an itemized per-session list — full
   session detail is what the per-pooja Invitation tab is for.

   Same A5 card as the per-pooja invitation (printInvitationHTML/
   downloadInvitationPDF, unmodified) — a programme listing several poojas
   needs to stay within that proven page size, so the two-per-row grid
   layout (no venue column: every pooja is at the temple itself) buys back
   the room instead. Callers chunk the selection into CIV_ROWS_PER_PAGE-sized
   groups (civChunk) so a long selection becomes several clean A5 pages
   instead of one overflowing/shrunk card — `opts.pageLabel` ('2 / 3') is
   stamped on continuation pages when there's more than one.

   Four capacities, empirically measured against the offscreen render's
   fixed A5 box: a personalised card carries the extra recipient block ("To
   Karan Chauhan સપરિવાર") above the programme, so it fits fewer rows than
   the open/public card; and each row is one line shorter when the time is
   turned off (opts.showTime), so more fit either way. */
var CIV_CAPACITY = {
  time: { personalized: 6, open: 8 },
  noTime: { personalized: 8, open: 12 }
};
function civCapacity(hasAudience, showTime) {
  var bucket = showTime ? CIV_CAPACITY.time : CIV_CAPACITY.noTime;
  return hasAudience ? bucket.personalized : bucket.open;
}

function civChunk(arr, n) {
  var out = [];
  for (var i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out.length ? out : [[]];
}

/* Compact date for the programme list ("Tue, 2 Feb 2027") — invDateLoc()
   (pooja-ui.js) spells the weekday/month out in full, which reads fine for
   a single-pooja card's one date but wraps every row of a long programme
   list onto two lines. Left as its own local helper so pooja-ui.js and the
   per-pooja invitation (still using the long form) stay untouched. */
function civDateLoc(iso, lang) {
  if (!iso) return '';
  var p = iso.split('-').map(Number);
  var d = new Date(p[0], p[1] - 1, p[2]);
  var loc = lang === 'gu' ? 'gu-IN' : lang === 'hi' ? 'hi-IN' : 'en-GB';
  try { return d.toLocaleDateString(loc, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }); }
  catch (e) { return iso; }
}

/* pjLoc() (pooja-ui.js) always localizes against the app-wide language
   toggle. The combined card has its own per-card language selector
   (opts.lang / L below), so a pooja name must translate against THAT
   language even when the app itself is still in English — pass it through
   as tData's langOverride (i18n.js) instead. Falls back to pjLoc when
   tData's 2-arg form isn't available (older cached i18n.js). */
function civLoc(name, lang) {
  if (typeof tData === 'function') return tData(name == null ? '' : name, lang);
  return (typeof pjLoc === 'function') ? pjLoc(name) : (name || '');
}

function combinedInvitationMarkup(poojas, opts) {
  opts = Object.assign({ template: 'royal', accent: '#6B1F2A', headline: '', inviteLine: '', blessing: '', lang: '', showTime: true }, opts || {});
  var L = invLang(opts);
  // No venue per row: every pooja is at the temple itself, and the exact
  // hall/spot inside it isn't tracked yet — repeating "Shree Vihat Dham
  // Sanand" on every line was redundant and just as unreadable as it was
  // uninformative. civLoc() (not pjLoc — see below) so a pooja name
  // translates to the CARD's own chosen language even when the app-wide
  // language is still English. Time is optional (opts.showTime, default on)
  // — turning it off drops each row to a single line, so a page can fit
  // more poojas (combinedInvitationCardSet picks the right capacity for
  // whichever is on).
  var rows = (poojas || []).map(function (p) {
    var sess = poojaSessions(p);
    var first = sess[0], last = sess[sess.length - 1];
    var multi = p.scheduleMode === 'multi' && sess.length > 1;
    var dateTxt = !first ? ivt(L, 'tba')
      : multi ? (civDateLoc(first.date, L) + ' – ' + civDateLoc(last.date, L))
              : civDateLoc(first.date, L);
    var timeTxt = (opts.showTime && !multi && first && first.startTime) ? (fmtTime(first.startTime) + '–' + fmtTime(first.endTime)) : '';
    // Day+date and time as two explicit lines (not left to wrap naturally) —
    // natural wrapping could break mid-time-range ("9:00 AM–" / "12:00 PM"),
    // which read poorly; a forced break always lands between the two.
    return '<div class="pj-invite-schedule-row">' +
      '<strong>' + esc(civLoc(p.name, L)) + '</strong>' +
      '<span class="pj-invite-schedule-dt">' + dateTxt + '</span>' +
      (timeTxt ? '<span class="pj-invite-schedule-tm">' + timeTxt + '</span>' : '') +
      '</div>';
  }).join('');
  var pageNote = opts.pageLabel ? ' · ' + esc(opts.pageLabel) : '';
  var programme = '<div class="pj-invite-schedule">' +
    '<span class="pj-invite-schedule-h">' + esc(ivt(L, 'programme')) + pageNote + '</span>' +
    '<div class="pj-invite-schedule-grid">' +
      (rows || '<div class="pj-invite-schedule-row"><span>' + esc(ivt(L, 'tba')) + '</span></div>') +
    '</div></div>';

  return `
  <div class="pj-invite pj-invite--${esc(opts.template)} pj-invite--civ" style="--c:${esc(opts.accent)}" data-lang="${L}">
    <span class="pj-invite-corner c-tl"></span><span class="pj-invite-corner c-tr"></span>
    <span class="pj-invite-corner c-bl"></span><span class="pj-invite-corner c-br"></span>
    <img class="pj-invite-hero" src="${(typeof assetURL === 'function') ? assetURL('assets/temple.png') : 'assets/temple.png'}" alt="" aria-hidden="true" onerror="this.style.display='none'">
    <div class="pj-invite-watermark">${inviteMandalaSVG()}</div>
    <div class="pj-invite-frame">
      ${inviteEmblemImg()}
      <div class="pj-invite-temple">${esc(window.t('temple_name', 'Shri Vihat Meldi Dham'))}</div>
      <div class="pj-invite-temple-sub">${esc(window.t('temple_loc', 'Sanand, Gujarat'))}</div>
      <div class="pj-invite-ribbon">${esc(ivt(L, 'ribbon'))}</div>
      <div class="pj-invite-invocation">${esc(opts.inviteLine || ivt(L, 'invite'))}</div>
      ${opts.recipient ? `<div class="pj-invite-recipient">
        <span class="pj-invite-recipient-l">${esc(ivt(L, 'invitee'))}</span>
        <strong>${esc(opts.recipient.name)} <em>${esc(ivt(L, 'withfamily'))}</em></strong>
        ${opts.recipient.place ? `<span class="pj-invite-recipient-p">${esc(opts.recipient.place)}</span>` : ''}
      </div>` : ''}
      <h1 class="pj-invite-headline">${esc(opts.headline || window.t('civ_default_headline', 'Forthcoming Poojas & Seva'))}</h1>
      ${programme}
      <div class="pj-invite-blessing">${esc(opts.blessing || ivt(L, 'blessing'))}</div>
      <div class="pj-invite-foot">${esc(ivt(L, 'foot'))}</div>
    </div>
  </div>`;
}

/* ---- output — reuses printInvitationHTML / downloadInvitationPDF verbatim,
   exactly like invitationCardSet() does for a single pooja, just built from
   the current multi-pooja selection chunked across as many A5 pages as it
   takes. combinedInvitationCardSet() is the single source of truth for both
   the live preview and every export path, so what's previewed is always
   exactly what prints/downloads. ---- */
function combinedInvitationCardSet() {
  var poojas = selectedPoojasSorted();
  if (!poojas.length) return null;
  var opts = readCombinedInvitationOpts();
  var rcpts = invAudienceRecipients(opts.audience, opts.audienceCategory);
  var baseTitle = window.t('civ_title', 'Combined Invitation');
  var chunks = civChunk(poojas, civCapacity(!!rcpts.length, opts.showTime));
  var pagesPerRecipient = chunks.length;

  function pageMarkup(chunk, pageIdx, recipient) {
    var o = Object.assign({}, opts, recipient ? { recipient: recipient } : {});
    if (pagesPerRecipient > 1) o.pageLabel = (pageIdx + 1) + ' / ' + pagesPerRecipient;
    return combinedInvitationMarkup(chunk, o);
  }

  if (rcpts.length) {
    // committee, category, or both — build a label naming whichever is set
    // (e.g. "VIP — Rabari Samaj Committee") instead of always saying
    // "Committee" even for a temple-wide category-only audience.
    var cmt = (opts.audience && typeof cmtById === 'function') ? cmtById(opts.audience) : null;
    var cmtOnlyName = cmt ? (cmt.name || cmt.samaj || 'Committee') : '';
    var catName = opts.audienceCategory
      ? ((typeof devoteeCategoryLabel === 'function') ? devoteeCategoryLabel(opts.audienceCategory) : opts.audienceCategory)
      : '';
    var cmtName = [catName, cmtOnlyName].filter(Boolean).join(' — ') || 'Committee';
    var items = rcpts.map(function (r) {
      var markups = chunks.map(function (chunk, i) { return pageMarkup(chunk, i, r); });
      return { markups: markups, recipient: r };
    });
    var cards = items.reduce(function (a, it) { return a.concat(it.markups); }, []);
    return {
      cards: cards, items: items,
      title: baseTitle + ' - ' + cmtName, poojaName: baseTitle,
      audienceCount: rcpts.length, pagesPerRecipient: pagesPerRecipient, cmtName: cmtName
    };
  }
  var markups = chunks.map(function (chunk, i) { return pageMarkup(chunk, i, null); });
  return {
    cards: markups, items: [{ markups: markups, recipient: null }],
    title: baseTitle, poojaName: baseTitle,
    audienceCount: 0, pagesPerRecipient: pagesPerRecipient, cmtName: ''
  };
}

function combinedInvitationPreviewHTML(set) {
  if (!set) {
    return '<div class="mg-pad-note">' + esc(window.t('civ_empty_preview', 'Select one or more poojas to build the combined card.')) + '</div>';
  }
  if (set.cards.length === 1) return set.cards[0];
  return set.cards.map(function (markup, i) {
    return '<div class="inv-pv"><span class="inv-pv-n">' + (i + 1) + ' / ' + set.cards.length + '</span>' + markup + '</div>';
  }).join('');
}

function updateCombinedInvitationPreview() {
  var box = document.getElementById('civPreview');
  if (!box) return;
  var opts = readCombinedInvitationOpts();
  CIV.opts = opts;
  var set = combinedInvitationCardSet();
  box.innerHTML = combinedInvitationPreviewHTML(set);
  var zipBtn = document.getElementById('civZipBtn');
  if (zipBtn) zipBtn.hidden = !set || !set.audienceCount;
  var note = document.getElementById('civBatchNote');
  if (note) {
    var hasAudience = !!(set && set.audienceCount);
    note.hidden = !hasAudience;
    if (hasAudience) {
      var pages = set.pagesPerRecipient > 1 ? ' · ' + set.pagesPerRecipient + ' ' + window.t('civ_pages_total', 'pages') + ' ' + window.t('civ_pages_each', 'each') : '';
      note.textContent =
        set.audienceCount + ' ' + window.t('cmt_members', 'members') + pages + ' — ' +
        window.t('pj_inv_aud_pdf', 'Print / Save PDF generates all') + ' ' + set.cards.length +
        ' (' + window.t('pj_inv_aud_onepage', 'one invitation per page') + ')';
    }
  }
}

function printCombinedInvitation() {
  var set = combinedInvitationCardSet();
  if (!set) { pjToast(window.t('civ_need_pooja', 'Select at least one pooja first.')); return; }
  printInvitationHTML(set.cards, set.title);
}
function downloadCombinedInvitationPDF() {
  var set = combinedInvitationCardSet();
  if (!set) { pjToast(window.t('civ_need_pooja', 'Select at least one pooja first.')); return; }
  downloadInvitationPDF(set.cards, set.title);
}
/* One PDF per recipient (may itself be several A5 pages when the selection
   spans more than CIV_ROWS_PER_PAGE poojas) — downloadInvitationZIP()
   (pooja-ui.js) only ever builds a single-page PDF per recipient, so this
   composes its own multi-page-per-recipient version from the exact same
   shared PDF services (ensurePdfLibs/renderInvitationImages/invPdfDocDef/
   ensureZipLib) instead of editing that shared function. */
async function downloadCombinedInvitationZip() {
  var set = combinedInvitationCardSet();
  if (!set) { pjToast(window.t('civ_need_pooja', 'Select at least one pooja first.')); return; }
  if (!set.items.length || !set.audienceCount) return;

  invBusy('.js-inv-zip', true);
  var done = function () { invBusy('.js-inv-zip', false); };

  var libs, JSZip;
  try { libs = await ensurePdfLibs(); JSZip = await ensureZipLib(); }
  catch (e) {
    done();
    pjToast(window.t('pj_inv_dl_offline', 'PDF engine unavailable — opening print view instead.'));
    printInvitationHTML(set.cards, set.title);
    return;
  }

  try {
    var zip = new JSZip();
    var used = {};
    for (var i = 0; i < set.items.length; i++) {
      var it = set.items[i];
      var images = await renderInvitationImages(it.markups, function (n, tot) {
        if (set.items.length > 3) pjToast(window.t('pj_inv_zip_prog', 'Packing') + ' ' + (i + 1) + '/' + set.items.length + '…');
      });
      if (!images.length) continue;
      var blob = await new Promise(function (res) { libs.pdfMake.createPdf(invPdfDocDef(images)).getBlob(res); });
      var r = it.recipient;
      var base = invFileName([set.poojaName, r && r.name, r && r.mobile]) || (set.poojaName + ' ' + (i + 1));
      var name = base + '.pdf', k = 2;
      while (used[name.toLowerCase()]) name = base + ' (' + (k++) + ').pdf';
      used[name.toLowerCase()] = 1;
      zip.file(name, blob);
    }
    var zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
    var zipName = (invFileName([set.title]) || (set.poojaName + ' invitations')) + '.zip';
    invTriggerDownload(zipBlob, zipName);
    pjToast(set.items.length + ' ' + window.t('pj_inv_zip_ok', 'invitation PDFs saved as a ZIP.'));
  } catch (e) {
    console.error('combined invitation ZIP failed', e);
    pjToast(window.t('pj_inv_zip_fail', 'ZIP generation failed — opening print view instead.'));
    printInvitationHTML(set.cards, set.title);
  } finally {
    done();
  }
}

/* ---- page shell ---- */
function renderInvitePage() {
  var root = document.getElementById('inviteRoot');
  if (!root) return;
  if (typeof canOpenPage === 'function' && !canOpenPage('invite')) { root.innerHTML = ''; return; }

  var tplOpts = [
    ['royal', window.t('pj_inv_royal', 'Royal (ceremonial)')],
    ['cream', window.t('pj_inv_cream', 'Cream (minimal)')],
    ['festival', window.t('pj_inv_festival', 'Festival (celebratory)')]
  ];
  var langOpts = [['', window.t('pj_inv_lang_app', 'Same as app')], ['en', 'English'], ['gu', 'ગુજરાતી'], ['hi', 'हिन्दी']];
  var accentOpts = (typeof POOJA !== 'undefined' && POOJA.accentPalette ? POOJA.accentPalette : []).map(function (a) {
    return '<option value="' + a.hex + '" ' + (a.hex === CIV.opts.accent ? 'selected' : '') + '>' + esc(a.name) + '</option>';
  }).join('');
  var audOpts = invAudienceOptions();
  var catOpts = invCategoryOptions();
  var L0 = invLang(CIV.opts);

  root.innerHTML = `
  <div class="mg-page-head">
    <div>
      <h1 class="banner-title mg-page-title">🎴 ${window.t('civ_title', 'Combined Invitation')}</h1>
      <p class="mg-page-sub">${window.t('civ_sub', 'Select any poojas already added and build one combined invitation card listing all of them together.')}</p>
    </div>
  </div>

  <div class="civ-layout">
    <div class="card">
      <div class="card-body">
        <h3 class="mg-pane-title">${window.t('civ_pick_poojas', 'Select Poojas')}</h3>
        <input class="form-input mg-mt-sm" id="civSearch" placeholder="${window.t('search', 'Search')}…" oninput="civSetSearch(this.value)">
        <div class="flex gap-2 mg-mt-sm">
          <button class="btn btn-outline mg-btn-xs" type="button" onclick="civSelectAll()">${window.t('civ_select_all', 'Select all')}</button>
          <button class="btn btn-outline mg-btn-xs" type="button" onclick="civClearAll()">${window.t('civ_clear_all', 'Clear')}</button>
        </div>
        <div id="civChecklist" class="mg-mt-sm">${civPoojaChecklistHTML()}</div>
      </div>
    </div>

    <div class="pj-invite-controls">
      <div class="pj-invite-stage">
        <div id="civPreview"></div>
        <div id="civBatchNote" class="pj-invite-batch-note" hidden></div>
      </div>

      <div class="card">
        <div class="card-body">
          <div class="grid mg-2col-form">
            <div class="form-group">
              <label class="form-label" for="civTemplate">${window.t('pj_inv_template', 'Template')}</label>
              <select class="form-select" id="civTemplate" onchange="updateCombinedInvitationPreview()">
                ${tplOpts.map(function (o) { return '<option value="' + o[0] + '" ' + (o[0] === CIV.opts.template ? 'selected' : '') + '>' + o[1] + '</option>'; }).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" for="civLangSel">${window.t('pj_inv_language', 'Card Language')}</label>
              <select class="form-select" id="civLangSel" onchange="updateCombinedInvitationPreview()">
                ${langOpts.map(function (o) { return '<option value="' + o[0] + '" ' + (o[0] === CIV.opts.lang ? 'selected' : '') + '>' + o[1] + '</option>'; }).join('')}
              </select>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label" for="civAudience">${window.t('pj_inv_audience', 'Invite (audience)')}</label>
            <select class="form-select" id="civAudience" onchange="updateCombinedInvitationPreview()">
              <option value="">${window.t('pj_inv_aud_open', 'Open / public invitation (no name)')}</option>
              ${audOpts.length ? ('<optgroup label="' + window.t('pj_inv_aud_grp', 'One card per committee member') + '">' +
                audOpts.map(function (o) { return '<option value="' + o.id + '" ' + (o.id === CIV.opts.audience ? 'selected' : '') + '>' + esc(o.label) + ' — ' + o.count + ' ' + window.t('cmt_members', 'members') + '</option>'; }).join('') +
                '</optgroup>') : ''}
            </select>
            <span class="mg-muted-xs">${window.t('pj_inv_aud_hint', 'Pick a samaj / committee to generate a personalised card (name, city, state) for every member — one page each in the PDF.')}</span>
          </div>
          <div class="form-group">
            <label class="form-label" for="civAudienceCategory">${window.t('pj_inv_aud_category', 'Category')}</label>
            <select class="form-select" id="civAudienceCategory" onchange="updateCombinedInvitationPreview()">
              <option value="">${window.t('pj_inv_aud_category_all', 'All categories')}</option>
              ${catOpts.map(function (o) { return '<option value="' + o[0] + '" ' + (o[0] === CIV.opts.audienceCategory ? 'selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('')}
            </select>
            <span class="mg-muted-xs">${window.t('pj_inv_aud_cat_hint', 'Narrow the audience above to one devotee category — combine with a committee (e.g. "VIP members of Rabari Samaj Committee"), or leave the committee as Open/public and pick just a category to invite every matching devotee temple-wide.')}</span>
          </div>
          <div class="form-group">
            <label class="mg-check-inline">
              <input type="checkbox" id="civShowTime" ${CIV.opts.showTime ? 'checked' : ''} onchange="updateCombinedInvitationPreview()">
              <span>${window.t('civ_show_time', 'Show session time')}</span>
            </label>
            <span class="mg-muted-xs">${window.t('civ_show_time_hint', 'Turn off to fit more poojas per page — each row keeps just the day and date.')}</span>
          </div>
          <div class="form-group">
            <label class="form-label" for="civAccent">${window.t('pj_inv_accent', 'Accent Colour')}</label>
            <select class="form-select" id="civAccent" onchange="updateCombinedInvitationPreview()">${accentOpts}</select>
          </div>
          <div class="form-group">
            <label class="form-label" for="civHeadline">${window.t('pj_inv_headline', 'Headline')}</label>
            <input class="form-input" id="civHeadline" value="${esc(CIV.opts.headline || '')}" placeholder="${esc(window.t('civ_default_headline', 'Forthcoming Poojas & Seva'))}" oninput="updateCombinedInvitationPreview()">
          </div>
          <div class="form-group">
            <label class="form-label" for="civLine">${window.t('pj_inv_line', 'Invitation Line')}</label>
            <input class="form-input" id="civLine" value="${esc(CIV.opts.inviteLine || '')}" placeholder="${esc(ivt(L0, 'invite'))}" oninput="updateCombinedInvitationPreview()">
          </div>
          <div class="form-group">
            <label class="form-label" for="civBlessing">${window.t('pj_inv_blessing', 'Closing Blessing')}</label>
            <input class="form-input" id="civBlessing" value="${esc(CIV.opts.blessing || '')}" placeholder="${esc(ivt(L0, 'blessing'))}" oninput="updateCombinedInvitationPreview()">
          </div>
          <div class="flex gap-2 mg-mt-sm" style="flex-wrap:wrap">
            <button class="btn btn-secondary js-inv-dl" type="button" onclick="downloadCombinedInvitationPDF()">⬇ ${window.t('pj_inv_download', 'Download all (1 PDF)')}</button>
            <button class="btn btn-secondary js-inv-zip" id="civZipBtn" type="button" onclick="downloadCombinedInvitationZip()" hidden>🗂️ ${window.t('pj_inv_zip', 'Download ZIP (individual)')}</button>
            <button class="btn btn-outline" type="button" onclick="printCombinedInvitation()">${window.t('pj_inv_print_only', 'Print')}</button>
          </div>
        </div>
      </div>
    </div>
  </div>`;

  updateCombinedInvitationPreview();
}

document.addEventListener('DOMContentLoaded', function () {
  if (document.getElementById('inviteRoot')) renderInvitePage();
  document.querySelectorAll('.nav-item[data-page="invite"], .mobile-nav-item[data-page="invite"]')
    .forEach(function (el) { el.addEventListener('click', renderInvitePage); });
  if (typeof onLanguageChange === 'function') onLanguageChange(function () {
    if (document.getElementById('inviteRoot')) renderInvitePage();
  });
});
