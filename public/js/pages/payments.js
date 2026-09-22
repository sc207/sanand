/* ============================================================
   PAYMENTS — the collections workbench
   ------------------------------------------------------------
   One view, because the operator has one job here: find who still
   owes and act on it. Every sevarthi with their contribution, what
   they have paid, what Bapa covered and what is outstanding,
   filterable by state, with the actions that follow from a row
   (collect, Bapa support, ledger, edit, devotee) on the row itself.

   This page used to be a month-by-day cash book, and then that book
   as a second tab. Both are gone: the filters below reach the same
   payments, the Universal Calendar already shows each day's takings,
   and the dashboard carries the daily and monthly totals. The one
   thing only the cash book could do — correct or remove a payment
   entry — moved into the per-sevarthi ledger (Forms.bookingLedger),
   which is on every row, so nothing was lost with it.
   ============================================================ */
(function (global) {
  'use strict';
  const { esc, attr, money, num, icon, fmtDate, debounce } = UI;

  const state = {
    filter: 'due',                         // see FILTERS
    search: '',
    page: 1,
    bookings: [],
  };

  /* Status is the booking's own; the other three are derived from the
     ledger (UI.coverage), which is why they are filters and not
     statuses — the same distinction the trust drew. */
  const FILTERS = [
    ['due', 'Still to collect'],
    ['all', 'All'],
    ['pending', 'Pending'],
    ['partial', 'Partial'],
    ['covered', 'Covered'],
    ['bappa', 'Bappa supported'],
    ['excess', 'Excess'],
  ];

  function matches(b, key) {
    if (b.status === 'cancelled') return key === 'all';
    const c = UI.coverage(b);
    switch (key) {
      case 'all': return true;
      case 'due': return c.outstanding > 0;
      case 'pending': return b.status === 'pending';
      case 'partial': return b.status === 'partially_paid';
      case 'covered': return c.outstanding === 0;
      case 'bappa': return c.bappa_supported;
      case 'excess': return c.excess > 0;
      default: return true;
    }
  }

  /* One figure as a labelled cell. Run together on a single line
     ("Contribution ₹21,00,000 Paid ₹10,00,000 Outstanding ₹11,00,000")
     it was a wall of digits with no column to scan down the list. */
  const fig = (k, v, cls) => `<div class="fig ${cls || ''}">
    <span class="fig-k">${esc(k)}</span><span class="fig-v">${esc(money(v))}</span></div>`;

  /* One column list, used by the spreadsheet and the printed sheet
     alike. Money is handed over raw so a CSV cell can be summed; the
     formatting happens only on the printed copy. */
  const EXPORT_COLUMNS = [
    { key: 'name',     label: 'Sevarthi',     value: (b) => b.full_name },
    { key: 'mobile',   label: 'Mobile', nowrap: true, value: (b) => b.mobile || '' },
    { key: 'samaj',    label: 'Samaj',        value: (b) => b.samaj || '' },
    { key: 'pooja',    label: 'Seva',         value: (b) => b.pooja_name },
    { key: 'date',     label: 'Seva date', type: 'date', value: (b) => b.slot_date || 'Not fixed' },
    { key: 'committed', label: 'Contribution', type: 'money', value: (b) => UI.coverage(b).committed },
    { key: 'devotee',  label: 'Paid by devotee', type: 'money', value: (b) => UI.coverage(b).devotee_paid },
    { key: 'bappa',    label: "Bapa's support",  type: 'money', value: (b) => UI.coverage(b).bappa_paid },
    { key: 'covered',  label: 'Covered',      type: 'money', value: (b) => UI.coverage(b).covered },
    { key: 'outstanding', label: 'Outstanding', type: 'money', value: (b) => UI.coverage(b).outstanding },
    { key: 'excess',   label: 'Excess',       type: 'money', value: (b) => UI.coverage(b).excess },
    { key: 'status',   label: 'Status', nowrap: true, value: (b) => STATUS_WORD[b.status] || b.status },
    { key: 'lastpaid', label: 'Last paid', type: 'date', value: (b) => b.last_payment_date || '' },
    { key: 'entries',  label: 'Payments',     type: 'num', value: (b) => b.payment_count || 0 },
    { key: 'registered', label: 'Registered', type: 'date', value: (b) => String(b.created_at || '').slice(0, 10) },
  ];

  const STATUS_WORD = { pending: 'Pending', partially_paid: 'Part paid',
                        paid: 'Covered', cancelled: 'Cancelled' };

  /* Built at click time, not at render time, so it always carries the
     filter and search as the operator has them now — and the whole
     filtered set, not the 25 rows currently on screen. */
  function exportSpec() {
    const rows = state.bookings.filter((b) => matches(b, state.filter));
    const label = (FILTERS.find((f) => f[0] === state.filter) || [])[1] || 'All';
    const t = rows.reduce((a, b) => {
      const c = UI.coverage(b);
      a.committed += c.committed; a.devotee += c.devotee_paid; a.bappa += c.bappa_paid;
      a.covered += c.covered; a.outstanding += c.outstanding; a.excess += c.excess;
      return a;
    }, { committed: 0, devotee: 0, bappa: 0, covered: 0, outstanding: 0, excess: 0 });

    return {
      filename: 'Payments-' + label,
      title: 'Payments — ' + label,
      subtitle: 'Shri Vihat Meldi Dham (Sanand) · Murti Pran Pratishtha Mahotsav',
      columns: EXPORT_COLUMNS,
      rows,
      /* The filters are stamped on so a printed copy still says what it
         was a report OF, a month after it left the printer. */
      meta: [
        ['Filter', label],
        ...(state.search ? [['Search', state.search]] : []),
        ['Sevarthi', UI.num(rows.length)],
        ['Contribution', money(t.committed)],
        ['Covered', money(t.covered)],
        ['Outstanding', money(t.outstanding)],
        ['Taken', new Date().toLocaleString()],
      ],
      totals: {
        name: 'Total (' + UI.num(rows.length) + ')',
        committed: t.committed, devotee: t.devotee, bappa: t.bappa,
        covered: t.covered, outstanding: t.outstanding, excess: t.excess,
      },
    };
  }

  async function render(host) {
    host.innerHTML = `
      <div class="flex justify-between items-center mg-page-head">
        <div>
          <h1 class="banner-title mg-page-title">Payments</h1>
          <p class="mg-page-sub">Who still owes, and what to do about it</p>
        </div>
        <div class="mg-page-actions">
          ${Export.toolbar('payExport')}
          <button class="btn btn-primary mg-btn-xs" data-add>${icon('plus','ico-sm')} Payment</button>
        </div>
      </div>

      <div id="payView"></div>`;

    host.querySelector('[data-add]').addEventListener('click', () => Forms.addPayment());
    Export.bindToolbar(host, exportSpec);
    await renderCollect(document.getElementById('payView'));
  }

  async function renderCollect(host) {
    host.innerHTML = `
      <div id="collectSummary"></div>
      <div class="btn-row" style="margin:1rem 0">
        ${FILTERS.map(([k, label]) =>
          `<button type="button" class="btn mg-btn-xs ${state.filter === k ? 'btn-primary' : 'btn-outline'}"
                   data-filter="${attr(k)}">${esc(label)}</button>`).join('')}
      </div>
      <div class="search-bar">${icon('search')}
        <input class="form-input" id="collectSearch" placeholder="Search sevarthi, mobile, samaj, seva…"
               value="${attr(state.search)}" autocomplete="off"></div>
      <div id="collectBody">${UI.loading(4)}</div>`;

    host.querySelectorAll('[data-filter]').forEach((b) =>
      b.addEventListener('click', () => {
        state.filter = b.getAttribute('data-filter');
        state.page = 1;                     // a new filter starts at its own first page
        renderCollect(host);
      }));
    host.querySelector('#collectSearch').addEventListener('input',
      debounce((e) => { state.search = e.target.value.trim(); state.page = 1; loadCollect(); }, 280));

    await loadCollect();
  }

  async function loadCollect() {
    const body = document.getElementById('collectBody');
    const summary = document.getElementById('collectSummary');
    if (!body) return;
    body.innerHTML = UI.loading(4);

    try {
      state.bookings = await API.bookings({ search: state.search || undefined });
      const live = state.bookings.filter((b) => b.status !== 'cancelled');

      /* Totals are for everything live, not just the current filter —
         the operator wants the size of the job, then narrows to work
         through it. Summed per booking, never netted. */
      const t = live.reduce((a, b) => {
        const c = UI.coverage(b);
        a.committed += c.committed; a.covered += c.covered;
        a.bappa += c.bappa_paid; a.outstanding += c.outstanding; a.excess += c.excess;
        if (c.outstanding > 0) a.owing++;
        return a;
      }, { committed: 0, covered: 0, bappa: 0, outstanding: 0, excess: 0, owing: 0 });

      summary.innerHTML = `
        <div class="stats-grid">
          <div class="stat"><div class="stat-text">
            <div class="stat-card-title">Still to collect</div>
            <div class="stat-card-value" style="color:var(--warning)">${esc(money(t.outstanding))}</div>
            <div class="mg-muted-xs">from ${esc(num(t.owing))} sevarthi</div></div>
            <span class="stat-ico due">${icon('clock')}</span></div>
          <div class="stat"><div class="stat-text">
            <div class="stat-card-title">Covered</div>
            <div class="stat-card-value">${esc(money(t.covered))}</div>
            <div class="mg-muted-xs">of ${esc(money(t.committed))} committed</div></div>
            <span class="stat-ico grace">${icon('wallet')}</span></div>
          <div class="stat"><div class="stat-text">
            <div class="stat-card-title">Bapa's support</div>
            <div class="stat-card-value">${esc(money(t.bappa))}</div>
            <div class="mg-muted-xs">included in covered</div></div>
            <span class="stat-ico people">${icon('diya')}</span></div>
          <div class="stat"><div class="stat-text">
            <div class="stat-card-title">Excess</div>
            <div class="stat-card-value">${esc(money(t.excess))}</div>
            <div class="mg-muted-xs">given above commitment</div></div>
            <span class="stat-ico rupee">${icon('trending-up')}</span></div>
        </div>`;

      const rows = state.bookings.filter((b) => matches(b, state.filter));
      if (!rows.length) {
        body.innerHTML = UI.empty(
          state.filter === 'due' ? 'Nothing outstanding' : 'Nothing here',
          state.search ? 'No sevarthi matches that search.' : 'No sevarthi in this state.', 'rupee');
        return;
      }

      /* A Mahotsav runs to hundreds of sevarthi; one endless list is
         neither scannable nor quick to paint. UI.paginate clamps the
         page for us when a filter change leaves it past the end. */
      const pg = UI.paginate(rows, state.page);
      state.page = pg.page;
      const shown = pg.slice;

      body.innerHTML = `
        <div class="card">
          <div class="card-header"><h2>${esc(num(rows.length))} sevarthi</h2>
            <span class="small muted">${esc((FILTERS.find((f) => f[0] === state.filter) || [])[1] || '')}</span></div>
          <div class="card-body" style="padding:0"><div class="list">
            ${shown.map((b) => {
              const c = UI.coverage(b);

              /* Collapsed: the four things a collector needs to decide
                 whether to ring this person — who, their state, the
                 number to ring, and what is owed — plus the one button
                 that follows. Everything else is one tap down. */
              const summary = `
                <div class="row-main">
                  <div class="row-title">${esc(b.full_name)} ${UI.coverageBadges(b)}</div>
                  <div class="collect-meta">
                    ${b.mobile ? `<span class="is-phone">${icon('phone','ico-sm')} ${esc(b.mobile)}</span>`
                               : `<span class="is-missing">${icon('alert','ico-sm')} No mobile</span>`}
                  </div>
                </div>
                <div class="row-end collect-lead">
                  <div class="lead-fig ${c.outstanding > 0 ? 'is-due' : c.excess > 0 ? 'is-extra' : 'is-ok'}">
                    <span class="lead-k">${c.outstanding > 0 ? 'Outstanding' : c.excess > 0 ? 'Excess' : 'Covered'}</span>
                    <span class="lead-v">${esc(money(c.outstanding > 0 ? c.outstanding
                      : c.excess > 0 ? c.excess : c.committed))}</span>
                  </div>
                  ${b.status !== 'cancelled' && c.outstanding > 0
                    ? `<button class="btn btn-primary mg-btn-xs" data-collect="${attr(b.id)}">Collect</button>` : ''}
                </div>`;

              const detail = `
                <div class="collect-meta">
                  <span>${esc(b.pooja_name)}</span>
                  <span>Seva ${esc(fmtDate(b.slot_date))}</span>
                  ${b.samaj ? `<span>${esc(b.samaj)}</span>` : ''}
                </div>
                <div class="fig-band">
                  ${fig('Contribution', c.committed)}
                  ${fig('Paid', c.devotee_paid)}
                  ${c.bappa_paid ? fig("Bapa's support", c.bappa_paid, 'is-bapa') : ''}
                  ${c.outstanding > 0 ? fig('Outstanding', c.outstanding, 'is-due')
                    : c.excess > 0 ? fig('Excess', c.excess, 'is-extra')
                    : `<div class="fig is-ok"><span class="fig-k">Status</span>
                         <span class="fig-v">Fully covered</span></div>`}
                </div>
                <div class="collect-when">
                  ${icon('clock','ico-sm')}
                  <span>Registered ${esc(fmtDate(String(b.created_at || '').slice(0, 10)))}</span>
                  <span>${b.last_payment_date
                    ? `Last paid ${esc(fmtDate(b.last_payment_date))}` +
                      (b.payment_count > 1 ? ` · ${esc(num(b.payment_count))} entries` : '')
                    : 'No payment yet'}</span>
                </div>
                <div class="more-actions">
                  ${b.status !== 'cancelled' && c.outstanding > 0
                    ? `<button class="btn btn-outline mg-btn-xs" data-bapa="${attr(b.id)}">Bapa support</button>` : ''}
                  <button class="btn btn-outline mg-btn-xs" data-ledger="${attr(b.id)}">
                    ${icon('history','ico-sm')} Ledger</button>
                  ${b.status !== 'cancelled' ? `<button class="btn btn-outline mg-btn-xs" data-editb="${attr(b.id)}">
                    ${icon('edit','ico-sm')} Edit registration</button>` : ''}
                  <button class="btn btn-outline mg-btn-xs" data-dev="${attr(b.devotee_id)}">
                    ${icon('users','ico-sm')} Devotee</button>
                </div>`;

              return UI.expandableRow(summary, detail,
                { itemClass: 'collect-row', label: 'Seva, split and dates' });
            }).join('')}
          </div></div>
          ${UI.pager(pg, 'sevarthi')}
        </div>`;

      UI.bindExpanders(body);
      UI.bindPager(body, (d) => {
        state.page = pg.page + d;
        loadCollect().then(() => {
          const top = document.getElementById('collectBody');
          if (top) top.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      });

      body.querySelectorAll('[data-collect]').forEach((el) =>
        el.addEventListener('click', () => Forms.paymentForm(el.getAttribute('data-collect'))));
      body.querySelectorAll('[data-bapa]').forEach((el) =>
        el.addEventListener('click', () => Forms.paymentForm(el.getAttribute('data-bapa'), { payer_type: 'bhuvaji' })));
      body.querySelectorAll('[data-ledger]').forEach((el) =>
        el.addEventListener('click', () => Forms.bookingLedger(el.getAttribute('data-ledger'), loadCollect)));
      body.querySelectorAll('[data-editb]').forEach((el) =>
        el.addEventListener('click', () => Forms.editBooking(el.getAttribute('data-editb'))));
      body.querySelectorAll('[data-dev]').forEach((el) =>
        el.addEventListener('click', () => Pages.devotees.openProfile(el.getAttribute('data-dev'))));
    } catch (e) {
      body.innerHTML = UI.errorState(e.message);
    }
  }

  global.Pages = global.Pages || {};
  global.Pages.payments = { render };
})(window);
