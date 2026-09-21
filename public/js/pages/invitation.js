/* Invitation — the mandir's own card theme (.pj-invite, from styles.css),
   reused as-is: same emblem, mandala watermark, corner marks and print
   pipeline sk already built for pooja invitations. */
(function (global) {
  'use strict';
  const { esc, attr, money, icon, fmtDate } = UI;

  const INV_TXT = {
    invite: 'You are cordially invited to',
    blessing: 'Your presence will be our blessing.',
    foot: 'Jai Shri Vihat Meldi Dham',
    ribbon: '~  Invitation  ~',
    ldate: 'Date', ltime: 'Time', lvenue: 'Venue',
    tba: 'To be announced', atmandir: 'At the Mandir',
  };

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

  /** The themed card. `p` is a pooja row from the API; `settings` the temple identity. */
  function cardMarkup(p, settings, accent) {
    const dateKnown = !!p.start_date;
    const dateText = dateKnown
      ? (p.start_date === p.end_date ? fmtDate(p.start_date) : `${fmtDate(p.start_date)} – ${fmtDate(p.end_date)}`)
      : INV_TXT.tba;

    return `
    <div class="pj-invite pj-invite--royal" style="--c:${attr(accent || '#6B1F2A')}">
      <span class="pj-invite-corner c-tl"></span><span class="pj-invite-corner c-tr"></span>
      <span class="pj-invite-corner c-bl"></span><span class="pj-invite-corner c-br"></span>
      <img class="pj-invite-hero" src="/assets/temple.png" alt="" aria-hidden="true" onerror="this.style.display='none'">
      <div class="pj-invite-watermark">${mandalaSVG()}</div>
      <div class="pj-invite-frame">
        ${emblemImg()}
        <div class="pj-invite-temple">${esc(settings.temple_name || 'Shri Vihat Meldi Dham')}</div>
        <div class="pj-invite-temple-sub">${esc(settings.temple_location || 'Sanand, Gujarat')}</div>
        <div class="pj-invite-ribbon">${esc(INV_TXT.ribbon)}</div>
        <div class="pj-invite-invocation">${esc(settings.mahotsav_name || INV_TXT.invite)}</div>
        <h1 class="pj-invite-headline">${esc(p.name)}</h1>
        ${p.category_label ? `<div class="pj-invite-type">${esc(p.category_label)}</div>` : ''}
        <div class="pj-invite-details">
          <div><span class="pj-invite-dl">${esc(INV_TXT.ldate)}</span><strong>${esc(dateText)}</strong></div>
          <div><span class="pj-invite-dl">${esc(INV_TXT.lvenue)}</span><strong>${esc(INV_TXT.atmandir)}</strong></div>
          ${p.amount ? `<div><span class="pj-invite-dl">Sevarthi Contribution</span><strong>${esc(money(p.amount))}</strong></div>` : ''}
        </div>
        ${p.seats_left !== null ? `<div class="pj-invite-party">
          <span class="pj-invite-party-h">Seats</span>
          <div>${p.seats_left} of ${p.total_seats} still open</div>
        </div>` : ''}
        <div class="pj-invite-blessing">${esc(INV_TXT.blessing)}</div>
        <div class="pj-invite-foot">${esc(INV_TXT.foot)}</div>
      </div>
    </div>`;
  }

  async function render(host) {
    const [poojas, settings] = await Promise.all([API.poojas(), API.settings()]);

    host.innerHTML = `
      <div class="mg-page-head">
        <h1 class="banner-title mg-page-title">Invitation</h1>
        <p class="mg-page-sub">Pick a pooja to preview and print its invitation card</p>
      </div>

      ${poojas.length ? `<div class="card"><div class="card-body" style="padding:0"><div class="list">
        ${poojas.map((p) => `
          <button class="row-item" data-inv="${attr(p.id)}">
            <div class="row-main">
              <div class="item-name">${esc(p.name)}</div>
              <div class="row-sub">${esc(p.category_label || '')} · ${p.start_date ? esc(fmtDate(p.start_date)) : 'Date to be announced'}</div>
            </div>
            ${icon('chevron-right', 'ico-sm')}
          </button>`).join('')}
      </div></div></div>`
      : UI.empty('No pooja yet', 'Create a pooja in the Mahotsav section first.', 'mail')}`;

    host.querySelectorAll('[data-inv]').forEach((b) =>
      b.addEventListener('click', () => preview(b.getAttribute('data-inv'), settings)));
  }

  async function preview(poojaId, settings) {
    const p = await API.pooja(poojaId);
    const card = cardMarkup(p, settings);

    UI.openSheet({
      title: 'Invitation',
      body: `<div class="pj-invite-stage"><div class="pj-invite-single">${card}</div></div>`,
      footer: `<button class="btn btn-outline" data-sheet-close>Close</button>
               <button class="btn" id="invPrint">${icon('print', 'ico-sm')} Print</button>`,
      onMount(sheet) {
        sheet.querySelector('[data-sheet-close]').addEventListener('click', UI.closeSheet);
        sheet.querySelector('#invPrint').addEventListener('click', () => printCard(card, p.name));
      },
    });
  }

  /** Open a print window carrying styles.css, exactly like sk's pooja invitations. */
  function printCard(card, title) {
    if (typeof window.openPrintDoc !== 'function') { UI.toast('Print service unavailable', 'err'); return; }
    window.openPrintDoc({
      title: (title || 'Invitation').replace(/[\/\\:*?"<>|]+/g, ' ').trim(),
      wrapClass: 'pj-invite-print',
      inner: `<div class="inv-page">${card}</div>`,
      css: '.pj-invite-print{display:block;background:#efe7d7;padding:20px 0}' +
        '.inv-page{display:block;position:relative;width:402px;max-width:92vw;margin:0 auto 26px;box-sizing:border-box}' +
        '.inv-page .pj-invite{box-shadow:0 16px 44px rgba(107,31,42,.28)}' +
        '@media print{@page{size:A5 portrait;margin:0}' +
        'html,body{background:#fff !important;margin:0 !important;padding:0 !important}' +
        '.pj-invite-print{display:block !important;margin:0 !important;padding:0 !important;background:#fff !important}' +
        '.inv-page{width:148mm !important;height:210mm !important;margin:0 !important;padding:0 !important;overflow:hidden !important}}',
    });
  }

  global.Pages = global.Pages || {};
  global.Pages.invitation = { render };
})(window);
