/* ============================================================
   UNIVERSAL (COMBINED) INVITATION
   ------------------------------------------------------------
   Ported from the mandir's own portal (sc207/svmds, public/js/
   invite-ui.js): pick any number of poojas and build ONE card that
   lists them all as a programme, instead of one card per pooja.

   The card itself is the portal's certificate-grade .pj-invite design,
   which is already in styles.css in full (.pj-invite--royal / --cream /
   --festival / --civ, .civ-layout, .inv-page, the corner marks, the
   mandala watermark and the A5 print rules). Nothing was restyled —
   this file only produces the markup those rules expect, so the card
   here is the same object the portal prints.

   Adapted where our data differs from the portal's:
   • It models a pooja as sessions with start/end times; ours has a
     date range and no clock, so each programme row is name + date and
     the portal's "show session time" switch is not carried over.
   • Its personalised cards address committee members. We have no
     committee module (Phase 2), so the audience is drawn from what we
     do have — samaj and devotee category — giving one addressed card
     per matching devotee.
   • Its PDF/ZIP export needs jsPDF and html2canvas from a CDN. The app
     has to work with no internet at the mandir, so output is the print
     window, whose "Save as PDF" writes the same A5 pages.
   ============================================================ */
(function (global) {
  'use strict';
  const { esc, attr, icon } = UI;

  /* Fixed card phrases, per card language — verbatim from the portal so
     a card printed here reads identically to one printed there. */
  const INV_TXT = {
    en: { invite: 'You are cordially invited to', blessing: 'Your presence will be our blessing.',
          foot: 'Jai Shri Vihat Meldi Dham', ribbon: '~  Invitation  ~', programme: 'Programme',
          invitee: 'To', withfamily: 'and family', tba: 'To be announced',
          headline: 'Forthcoming Poojas & Seva' },
    hi: { invite: 'आप सादर आमंत्रित हैं', blessing: 'आपकी उपस्थिति ही हमारा आशीर्वाद है।',
          foot: 'जय श्री विहत मेलडी धाम', ribbon: '॥  आमंत्रण  ॥', programme: 'कार्यक्रम',
          invitee: 'सेवा में', withfamily: 'सपरिवार', tba: 'शीघ्र घोषित',
          headline: 'आगामी पूजा एवं सेवा' },
    gu: { invite: 'આપ સૌને સાદર આમંત્રણ છે', blessing: 'આપની ઉપસ્થિતિ એ જ અમારો આશીર્વાદ.',
          foot: 'જય શ્રી વિહત મેલડી ધામ', ribbon: '॥  સાદર આમંત્રણ  ॥', programme: 'કાર્યક્રમ',
          invitee: 'પ્રતિ', withfamily: 'સપરિવાર', tba: 'ટૂંક સમયમાં જાહેર',
          headline: 'આગામી પૂજા અને સેવા' },
  };

  const TEMPLATES = [['royal', 'Royal (ceremonial)'], ['cream', 'Cream (minimal)'], ['festival', 'Festival (celebratory)']];
  const LANGS = [['', 'Same as app'], ['en', 'English'], ['gu', 'ગુજરાતી'], ['hi', 'हिन्दी']];
  const ACCENTS = [
    ['#6B1F2A', 'Royal Maroon'], ['#C96A20', 'Saffron'], ['#C9A24A', 'Antique Gold'],
    ['#4C8B5A', 'Temple Green'], ['#7A3B62', 'Deep Plum'], ['#3B5C8A', 'Indigo'],
  ];

  /* How many programme rows fit on one A5 card before it needs a second
     page. An addressed card spends lines on the recipient block, so it
     holds fewer. (The portal's numbers for its no-time layout, which is
     the one we render.) */
  const CAPACITY = { personalized: 8, open: 12 };

  const state = {
    poojas: [], settings: {}, samaj: [], categories: [], recipients: [],
    selected: [], search: '',
    opts: {
      template: 'royal', accent: '#6B1F2A', lang: '',
      headline: '', inviteLine: '', blessing: '', samajId: '', categoryId: '',
    },
  };

  const ivt = (lang, k) => (INV_TXT[lang] || INV_TXT.en)[k] || INV_TXT.en[k];
  function cardLang() {
    const l = state.opts.lang || (global.Lang && Lang.lang ? Lang.lang() : 'en');
    return INV_TXT[l] ? l : 'en';
  }

  /* Compact date for a programme row ("Tue, 2 Feb 2027"). The long form
     the single-pooja card uses wraps every row onto two lines once a
     list gets long. */
  function dateLoc(iso, lang) {
    if (!iso) return '';
    const [y, m, d] = String(iso).split('-').map(Number);
    if (!y || !m || !d) return String(iso);
    const loc = lang === 'gu' ? 'gu-IN' : lang === 'hi' ? 'hi-IN' : 'en-GB';
    try {
      return new Date(y, m - 1, d).toLocaleDateString(loc,
        { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    } catch (e) { return iso; }
  }

  function mandalaSVG() {
    return `<svg viewBox="0 0 120 120" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="0.7">
      <circle cx="60" cy="60" r="54"/><circle cx="60" cy="60" r="42"/><circle cx="60" cy="60" r="30"/><circle cx="60" cy="60" r="18"/>
      <polygon points="60,4 76,40 116,60 76,80 60,116 44,80 4,60 44,40"/>
      <polygon points="60,16 92,60 60,104 28,60"/></g></svg>`;
  }
  function emblemImg() {
    return `<span class="pj-invite-emblem-wrap">
      <img class="pj-invite-emblem" src="/assets/icon.png" alt=""
           onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
      <span class="pj-invite-emblem-fallback" style="display:none">${mandalaSVG()}</span>
    </span>`;
  }

  /* ---------- the card ---------- */
  function cardMarkup(poojas, o) {
    const L = cardLang();
    const s = state.settings;

    const rows = (poojas || []).map((p) => {
      const dated = !!p.start_date;
      const dateTxt = !dated ? ivt(L, 'tba')
        : p.start_date === p.end_date ? dateLoc(p.start_date, L)
        : `${dateLoc(p.start_date, L)} – ${dateLoc(p.end_date, L)}`;
      return `<div class="pj-invite-schedule-row">
        <strong>${esc(p.name)}</strong>
        <span class="pj-invite-schedule-dt">${esc(dateTxt)}</span>
      </div>`;
    }).join('');

    const pageNote = o.pageLabel ? ' · ' + esc(o.pageLabel) : '';
    const programme = `<div class="pj-invite-schedule">
      <span class="pj-invite-schedule-h">${esc(ivt(L, 'programme'))}${pageNote}</span>
      <div class="pj-invite-schedule-grid">
        ${rows || `<div class="pj-invite-schedule-row"><span>${esc(ivt(L, 'tba'))}</span></div>`}
      </div></div>`;

    return `
    <div class="pj-invite pj-invite--${attr(o.template)} pj-invite--civ" style="--c:${attr(o.accent)}" data-lang="${attr(L)}">
      <span class="pj-invite-corner c-tl"></span><span class="pj-invite-corner c-tr"></span>
      <span class="pj-invite-corner c-bl"></span><span class="pj-invite-corner c-br"></span>
      <img class="pj-invite-hero" src="/assets/temple.png" alt="" aria-hidden="true" onerror="this.style.display='none'">
      <div class="pj-invite-watermark">${mandalaSVG()}</div>
      <div class="pj-invite-frame">
        ${emblemImg()}
        <div class="pj-invite-temple">${esc(s.temple_name || 'Shri Vihat Meldi Dham')}</div>
        <div class="pj-invite-temple-sub">${esc(s.temple_location || 'Sanand, Gujarat')}</div>
        <div class="pj-invite-ribbon">${esc(ivt(L, 'ribbon'))}</div>
        <div class="pj-invite-invocation">${esc(o.inviteLine || ivt(L, 'invite'))}</div>
        ${o.recipient ? `<div class="pj-invite-recipient">
          <span class="pj-invite-recipient-l">${esc(ivt(L, 'invitee'))}</span>
          <strong>${esc(o.recipient.full_name)} <em>${esc(ivt(L, 'withfamily'))}</em></strong>
          ${o.recipient.city ? `<span class="pj-invite-recipient-p">${esc(o.recipient.city)}</span>` : ''}
        </div>` : ''}
        <h1 class="pj-invite-headline">${esc(o.headline || ivt(L, 'headline'))}</h1>
        ${programme}
        <div class="pj-invite-blessing">${esc(o.blessing || ivt(L, 'blessing'))}</div>
        <div class="pj-invite-foot">${esc(ivt(L, 'foot'))}</div>
      </div>
    </div>`;
  }

  /* ---------- building the set of pages ---------- */
  const chunk = (arr, n) => {
    const out = [];
    for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
    return out.length ? out : [[]];
  };

  function selectedPoojasSorted() {
    const picked = state.poojas.filter((p) => state.selected.includes(String(p.id)));
    /* Dated poojas first in date order, undated last — the order the
       programme should read in, not the order they were ticked. */
    return picked.sort((a, b) => {
      if (!a.start_date && !b.start_date) return a.name.localeCompare(b.name);
      if (!a.start_date) return 1;
      if (!b.start_date) return -1;
      return a.start_date.localeCompare(b.start_date) || a.name.localeCompare(b.name);
    });
  }

  /** One source of truth for the preview and the print output, so what
      is on screen is exactly what comes out of the printer. */
  function buildCardSet() {
    const poojas = selectedPoojasSorted();
    if (!poojas.length) return null;

    const rcpts = state.recipients;
    const pages = chunk(poojas, rcpts.length ? CAPACITY.personalized : CAPACITY.open);
    const opts = state.opts;

    const page = (list, i, recipient) => cardMarkup(list, Object.assign({}, opts, {
      recipient: recipient || null,
      pageLabel: pages.length > 1 ? `${i + 1} / ${pages.length}` : '',
    }));

    if (rcpts.length) {
      const cards = [];
      rcpts.forEach((r) => pages.forEach((list, i) => cards.push(page(list, i, r))));
      return { cards, pagesEach: pages.length, recipientCount: rcpts.length };
    }
    return { cards: pages.map((list, i) => page(list, i, null)), pagesEach: pages.length, recipientCount: 0 };
  }

  /* ---------- rendering ---------- */
  function checklistHTML() {
    const q = state.search.toLowerCase().trim();
    const list = q ? state.poojas.filter((p) => (p.name || '').toLowerCase().includes(q)) : state.poojas;
    if (!list.length) return `<p class="small muted" style="margin:.6rem 0 0">No pooja matches that search.</p>`;
    return `<div class="list">${list.map((p) => `
      <label class="row-item" style="cursor:pointer">
        <input type="checkbox" data-pick="${attr(p.id)}" ${state.selected.includes(String(p.id)) ? 'checked' : ''}
               style="width:auto;min-height:0;margin-right:.6rem">
        <div class="row-main">
          <div class="row-title" style="font-weight:600">${esc(p.name)}</div>
          <div class="row-sub">${esc(p.category_label || '')}${p.start_date ? ' · ' + esc(UI.fmtDate(p.start_date)) : ' · ' + esc(UI.TBD)}</div>
        </div>
      </label>`).join('')}</div>`;
  }

  function paintPreview() {
    const set = buildCardSet();
    const host = document.getElementById('civPreview');
    const note = document.getElementById('civNote');
    if (!host) return;

    if (!set) {
      host.innerHTML = `<p class="small muted" style="text-align:center;padding:2rem 1rem">
        Tick one or more poojas to build the combined card.</p>`;
      if (note) { note.hidden = true; note.textContent = ''; }
      return;
    }
    host.innerHTML = set.cards.length === 1 ? set.cards[0]
      : set.cards.map((m, i) => `<div class="inv-pv"><span class="inv-pv-n">${i + 1} / ${set.cards.length}</span>${m}</div>`).join('');

    if (note) {
      if (set.recipientCount) {
        note.hidden = false;
        note.textContent = `${set.recipientCount} addressed card${set.recipientCount === 1 ? '' : 's'}` +
          (set.pagesEach > 1 ? ` × ${set.pagesEach} pages each` : '') +
          ` — ${set.cards.length} A5 page${set.cards.length === 1 ? '' : 's'} in total.`;
      } else if (set.pagesEach > 1) {
        note.hidden = false;
        note.textContent = `Too many poojas for one card — printed across ${set.pagesEach} A5 pages.`;
      } else { note.hidden = true; note.textContent = ''; }
    }
  }

  /** Reload the addressed-card list when the samaj/category changes. */
  async function refreshRecipients() {
    const { samajId, categoryId } = state.opts;
    if (!samajId && !categoryId) { state.recipients = []; return; }
    try {
      state.recipients = await API.devotees({ samaj_id: samajId || undefined, category_id: categoryId || undefined });
    } catch (e) {
      state.recipients = [];
      UI.toast(e.message, 'err');
    }
  }

  function printSet() {
    const set = buildCardSet();
    if (!set) { UI.toast('Pick at least one pooja first', 'err'); return; }
    if (typeof global.openPrintDoc !== 'function') { UI.toast('Print service unavailable', 'err'); return; }

    /* The portal's print CSS, carried over as-is: one A5 page per card,
       every rule !important so a card cannot be split or doubled up
       even before the linked stylesheet has parsed. */
    global.openPrintDoc({
      title: 'Invitation',
      wrapClass: 'pj-invite-print',
      inner: set.cards.map((c, i) =>
        `<div class="inv-page">${set.cards.length > 1 ? `<span class="inv-page-n">${i + 1} / ${set.cards.length}</span>` : ''}${c}</div>`).join(''),
      css:
        '.pj-invite-print{display:block;background:#efe7d7;padding:20px 0}' +
        '.inv-page{display:block;position:relative;width:402px;max-width:92vw;margin:0 auto 26px;box-sizing:border-box}' +
        '.inv-page .pj-invite{box-shadow:0 16px 44px rgba(107,31,42,.28)}' +
        '.inv-page-n{position:absolute;top:-15px;left:50%;transform:translateX(-50%);z-index:6;' +
          'font:600 11px/1 Inter,system-ui,sans-serif;letter-spacing:1px;color:#8a7a5c;background:#efe7d7;padding:2px 10px;border-radius:10px}' +
        '@media print{' +
          '@page{size:A5 portrait;margin:0}' +
          'html,body{background:#fff !important;margin:0 !important;padding:0 !important}' +
          '.pj-invite-print{display:block !important;margin:0 !important;padding:0 !important;background:#fff !important}' +
          '.inv-page{display:block !important;position:relative !important;' +
            'width:148mm !important;height:210mm !important;min-height:0 !important;max-height:210mm !important;' +
            'margin:0 !important;padding:0 !important;box-sizing:border-box !important;overflow:hidden !important;' +
            'break-inside:avoid !important;page-break-inside:avoid !important;' +
            'break-after:page !important;page-break-after:always !important}' +
          '.inv-page:last-child{break-after:auto !important;page-break-after:auto !important}' +
          '.inv-page-n{display:none !important}' +
          '.pj-invite{width:148mm !important;height:210mm !important;min-height:0 !important;max-height:210mm !important;' +
            'margin:0 !important;border:0 !important;border-radius:0 !important;box-shadow:none !important;overflow:hidden !important;' +
            'break-inside:avoid !important;page-break-inside:avoid !important;' +
            '-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important}' +
          '.pj-invite-frame{margin:8mm !important;min-height:calc(210mm - 16mm) !important}' +
        '}',
    });
  }

  const opt = (v, label, sel) => `<option value="${attr(v)}" ${String(v) === String(sel) ? 'selected' : ''}>${esc(label)}</option>`;

  async function render(host) {
    const [poojas, settings, samaj, categories] = await Promise.all([
      API.poojas(), API.settings(), API.lookups('samaj'), API.lookups('devotee_category'),
    ]);
    Object.assign(state, { poojas, settings, samaj, categories });
    state.selected = state.selected.filter((id) => poojas.some((p) => String(p.id) === id));
    await refreshRecipients();

    const o = state.opts;
    host.innerHTML = `
      <div class="mg-page-head">
        <div>
          <h1 class="banner-title mg-page-title">Invitation</h1>
          <p class="mg-page-sub">Pick any poojas and build one invitation card listing them all</p>
        </div>
      </div>

      <div class="civ-layout">
        <div class="card">
          <div class="card-body">
            <h3 class="mg-pane-title">Select poojas</h3>
            <input class="form-input mg-mt-sm" id="civSearch" placeholder="Search…" value="${attr(state.search)}" autocomplete="off">
            <div class="btn-row mg-mt-sm">
              <button class="btn btn-outline mg-btn-xs" type="button" id="civAll">Select all</button>
              <button class="btn btn-outline mg-btn-xs" type="button" id="civNone">Clear</button>
            </div>
            <div id="civChecklist" class="mg-mt-sm">${checklistHTML()}</div>
          </div>
        </div>

        <div class="pj-invite-controls">
          <div class="pj-invite-stage">
            <div id="civPreview"></div>
            <div id="civNote" class="pj-invite-batch-note" hidden></div>
          </div>

          <div class="card">
            <div class="card-body">
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label" for="f_template">Template</label>
                  <select class="form-select" id="f_template" data-opt="template">
                    ${TEMPLATES.map(([v, l]) => opt(v, l, o.template)).join('')}</select>
                </div>
                <div class="form-group">
                  <label class="form-label" for="f_lang">Card language</label>
                  <select class="form-select" id="f_lang" data-opt="lang">
                    ${LANGS.map(([v, l]) => opt(v, l, o.lang)).join('')}</select>
                </div>
              </div>

              <div class="form-group">
                <label class="form-label" for="f_accent">Accent colour</label>
                <select class="form-select" id="f_accent" data-opt="accent">
                  ${ACCENTS.map(([v, l]) => opt(v, l, o.accent)).join('')}</select>
              </div>

              <div class="divider"></div>
              <div class="section-title" style="margin:0 0 .6rem">Address the cards (optional)</div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label" for="f_samaj">Samaj</label>
                  <select class="form-select" id="f_samaj" data-opt="samajId">
                    ${opt('', 'Open / public — no name', o.samajId)}
                    ${state.samaj.map((s) => opt(s.id, s.value, o.samajId)).join('')}</select>
                </div>
                <div class="form-group">
                  <label class="form-label" for="f_category">Devotee category</label>
                  <select class="form-select" id="f_category" data-opt="categoryId">
                    ${opt('', 'All categories', o.categoryId)}
                    ${state.categories.map((c) => opt(c.id, c.value, o.categoryId)).join('')}</select>
                </div>
              </div>
              <div class="form-hint">Leave both open for one public card. Pick either and the app prints a
                personalised card — name, city, "and family" — for every matching devotee, one A5 page each.</div>

              <div class="divider"></div>
              <div class="form-group">
                <label class="form-label" for="f_headline">Headline</label>
                <input class="form-input" id="f_headline" data-opt="headline" value="${attr(o.headline)}"
                       placeholder="${attr(ivt(cardLang(), 'headline'))}">
              </div>
              <div class="form-group">
                <label class="form-label" for="f_line">Invitation line</label>
                <input class="form-input" id="f_line" data-opt="inviteLine" value="${attr(o.inviteLine)}"
                       placeholder="${attr(ivt(cardLang(), 'invite'))}">
              </div>
              <div class="form-group">
                <label class="form-label" for="f_blessing">Closing blessing</label>
                <input class="form-input" id="f_blessing" data-opt="blessing" value="${attr(o.blessing)}"
                       placeholder="${attr(ivt(cardLang(), 'blessing'))}">
              </div>

              <div class="btn-row mg-mt-sm">
                <button class="btn btn-primary" type="button" id="civPrint">${icon('print', 'ico-sm')} Print / Save as PDF</button>
              </div>
              <div class="form-hint">Prints A5, one page per card. Choose "Save as PDF" in the print dialog
                to keep a copy.</div>
            </div>
          </div>
        </div>
      </div>`;

    /* --- wiring --- */
    const checklist = host.querySelector('#civChecklist');
    const repaintList = () => { checklist.innerHTML = checklistHTML(); };

    host.querySelector('#civSearch').addEventListener('input', UI.debounce((e) => {
      state.search = e.target.value;
      repaintList();
    }, 200));

    checklist.addEventListener('change', (e) => {
      const box = e.target.closest('[data-pick]');
      if (!box) return;
      const id = box.getAttribute('data-pick');
      if (box.checked) { if (!state.selected.includes(id)) state.selected.push(id); }
      else state.selected = state.selected.filter((x) => x !== id);
      paintPreview();
    });

    host.querySelector('#civAll').addEventListener('click', () => {
      const q = state.search.toLowerCase().trim();
      const visible = q ? state.poojas.filter((p) => (p.name || '').toLowerCase().includes(q)) : state.poojas;
      visible.forEach((p) => { if (!state.selected.includes(String(p.id))) state.selected.push(String(p.id)); });
      repaintList(); paintPreview();
    });
    host.querySelector('#civNone').addEventListener('click', () => {
      state.selected = [];
      repaintList(); paintPreview();
    });

    host.querySelectorAll('[data-opt]').forEach((el) => {
      const key = el.getAttribute('data-opt');
      const isAudience = key === 'samajId' || key === 'categoryId';
      const handler = async () => {
        state.opts[key] = el.value;
        if (isAudience) await refreshRecipients();
        paintPreview();
      };
      el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input',
        el.tagName === 'SELECT' ? handler : UI.debounce(handler, 250));
    });

    host.querySelector('#civPrint').addEventListener('click', printSet);

    paintPreview();
  }

  global.Pages = global.Pages || {};
  global.Pages.invitation = { render };
})(window);
