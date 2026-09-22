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
    /* Sorting is client-side and lives here: the filtered set is
       already in memory, and a collector flips between "who owes most"
       and "by name" constantly while working down a list. */
    sortKey: 'outstanding',
    sortDir: 'desc',
    /* A second axis, asked for by the trust: the status chips say what
       state a registration is in, these say which part of the Mahotsav
       it belongs to. They narrow together — "still to collect, on the
       Maha Yagna" is the question somebody actually has. */
    category: '',                          // '' = every category
    poojaId: '',                           // '' = every seva in it
  };

  /* The three categories are fixed in the schema (poojas.js CATEGORIES);
     these are the trust's words for them. */
  const CAT_LABEL = {
    maha_yagna: 'Maha Yagna',
    mandir_pooja: 'Mandir ni Pooja',
    bhagvat_katha: 'Bhagvat Saptah — Katha',
  };

  /** Category / seva scope. Kept apart from `matches` because the two
      are different questions and both have to hold. */
  function scoped(b) {
    if (state.category && b.category !== state.category) return false;
    if (state.poojaId && String(b.pooja_id) !== String(state.poojaId)) return false;
    return true;
  }

  /** The rows the page is actually about: state filter AND scope. */
  const visibleRows = () => state.bookings.filter((b) => matches(b, state.filter) && scoped(b));

  /* Both selects are built from the bookings in hand rather than from
     the full seva list, so they can only ever offer something that has
     sevarthi on it — a dropdown of seventy-five poojas, most of them
     empty, is a worse way to find one than the search box. Counts are
     of rows matching the status filter, which is what the operator is
     about to see. */
  function groupCounts(rows, keyOf, nameOf) {
    const map = new Map();
    rows.forEach((b) => {
      const k = String(keyOf(b));
      if (!map.has(k)) map.set(k, { key: k, label: nameOf(b), n: 0 });
      map.get(k).n++;
    });
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
  }

  function categoryOptions() {
    const base = state.bookings.filter((b) => matches(b, state.filter));
    return groupCounts(base, (b) => b.category, (b) => CAT_LABEL[b.category] || b.category);
  }

  function sevaOptions() {
    const base = state.bookings.filter((b) => matches(b, state.filter))
      .filter((b) => !state.category || b.category === state.category);
    const opts = groupCounts(base, (b) => b.pooja_id, (b) => b.pooja_name);
    /* A seva chosen before the status filter narrowed past it must stay
       in the list, or the select silently shows something else while
       the page is still filtered by it. */
    if (state.poojaId && !opts.some((o) => o.key === String(state.poojaId))) {
      const any = state.bookings.find((b) => String(b.pooja_id) === String(state.poojaId));
      if (any) opts.unshift({ key: String(state.poojaId), label: any.pooja_name, n: 0 });
    }
    return opts;
  }

  const scopeLabel = () => {
    if (state.poojaId) {
      const b = state.bookings.find((x) => String(x.pooja_id) === String(state.poojaId));
      return b ? b.pooja_name : '';
    }
    return state.category ? (CAT_LABEL[state.category] || state.category) : '';
  };

  /* One comparator per sortable column, each falling back to the name
     so a column of equal figures still comes out in a stable,
     meaningful order rather than whatever the query returned. */
  const byName = (a, b) => String(a.full_name || '').localeCompare(String(b.full_name || ''));
  const SORTERS = {
    full_name: byName,
    pooja_name: (a, b) => String(a.pooja_name || '').localeCompare(String(b.pooja_name || '')) || byName(a, b),
    committed: (a, b) => (a.amount_committed || 0) - (b.amount_committed || 0) || byName(a, b),
    devotee_paid: (a, b) => UI.coverage(a).devotee_paid - UI.coverage(b).devotee_paid || byName(a, b),
    bappa_paid: (a, b) => (a.bappa_paid || 0) - (b.bappa_paid || 0) || byName(a, b),
    outstanding: (a, b) => UI.coverage(a).outstanding - UI.coverage(b).outstanding || byName(a, b),
  };

  /* The sort keys are the table's, the export columns' keys are the
     spreadsheet's, and they do not line up (full_name vs name). Naming
     them here keeps the stamp on a printed sheet readable rather than
     leaking a field name. */
  const SORT_LABELS = {
    full_name: 'Sevarthi', pooja_name: 'Seva', committed: 'Contribution',
    devotee_paid: 'Sevarthi paid', bappa_paid: "Bapa's support", outstanding: 'Outstanding',
  };

  function sortRows(rows) {
    const cmp = SORTERS[state.sortKey] || SORTERS.outstanding;
    const out = [...rows].sort(cmp);
    return state.sortDir === 'desc' ? out.reverse() : out;
  }

  /** A repeat click on the column in force flips it; a new column
      starts descending for a figure and ascending for a name, which is
      what each is actually useful as. */
  function toggleSort(key) {
    if (state.sortKey === key) state.sortDir = state.sortDir === 'desc' ? 'asc' : 'desc';
    else { state.sortKey = key; state.sortDir = (key === 'full_name' || key === 'pooja_name') ? 'asc' : 'desc'; }
    state.page = 1;
  }

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
    /* A gift is its own thing, not a louder "Bappa supported": the
       trust reports on seva Bapa gave outright separately from seva
       Bapa helped with. It therefore gets its own chip rather than
       being buried inside that one. */
    ['gift', 'Gift from Bapa'],
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
      case 'bappa': return c.bappa_supported && !b.is_gift;
      case 'gift': return !!b.is_gift;
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
    /* UI.TBD, not a second phrase of its own: an undated pooja is the
       normal early state, and the export saying "Not fixed" where the
       screen says "Date to be announced" made one state look like two. */
    { key: 'date',     label: 'Seva date', type: 'date', value: (b) => b.slot_date || UI.TBD },
    { key: 'committed', label: 'Contribution', type: 'money', value: (b) => UI.coverage(b).committed },
    { key: 'devotee',  label: 'Paid by devotee', type: 'money', value: (b) => UI.coverage(b).devotee_paid },
    { key: 'bappa',    label: "Bapa's support",  type: 'money', value: (b) => UI.coverage(b).bappa_paid },
    { key: 'covered',  label: 'Covered', print: false, type: 'money', value: (b) => UI.coverage(b).covered },
    { key: 'outstanding', label: 'Outstanding', type: 'money', value: (b) => UI.coverage(b).outstanding },
    { key: 'excess',   label: 'Excess', print: false, type: 'money', value: (b) => UI.coverage(b).excess },
    { key: 'status',   label: 'Status', nowrap: true, value: (b) => STATUS_WORD[b.status] || b.status },
    /* A column, because the accountant will be asked how much of the
       Mahotsav Bapa gave outright, and that cannot be worked out from
       the money alone — "Bapa's support" of the full amount looks the
       same either way. */
    { key: 'gift',     label: 'Gift from Bapa', nowrap: true, value: (b) => (b.is_gift ? 'Yes' : '') },
    { key: 'lastpaid', label: 'Last paid', print: false, type: 'date', value: (b) => b.last_payment_date || '' },
    { key: 'entries',  label: 'Payments', print: false, type: 'num', value: (b) => b.payment_count || 0 },
    { key: 'registered', label: 'Registered', print: false, type: 'date', value: (b) => String(b.created_at || '').slice(0, 10) },
  ];

  const STATUS_WORD = { pending: 'Pending', partially_paid: 'Part paid',
                        paid: 'Covered', cancelled: 'Cancelled' };

  /* Built at click time, not at render time, so it always carries the
     filter and search as the operator has them now — and the whole
     filtered set, not the 25 rows currently on screen. */
  function exportSpec() {
    /* Sorted the same way the screen is. The rule was "export what the
       filter says, not what the page shows"; once a column can be
       sorted, the order the operator put the list in is part of what
       they are asking for, and a sheet that comes out in a different
       order than the screen cannot be checked against it. */
    const rows = sortRows(visibleRows());
    const label = (FILTERS.find((f) => f[0] === state.filter) || [])[1] || 'All';
    const sortLabel = SORT_LABELS[state.sortKey] || state.sortKey;
    const t = rows.reduce((a, b) => {
      const c = UI.coverage(b);
      a.committed += c.committed; a.devotee += c.devotee_paid; a.bappa += c.bappa_paid;
      a.covered += c.covered; a.outstanding += c.outstanding; a.excess += c.excess;
      return a;
    }, { committed: 0, devotee: 0, bappa: 0, covered: 0, outstanding: 0, excess: 0 });

    return {
      filename: 'Payments-' + label + (scopeLabel() ? '-' + scopeLabel() : ''),
      title: 'Payments — ' + label + (scopeLabel() ? ' · ' + scopeLabel() : ''),
      subtitle: 'Shri Vihat Meldi Dham (Sanand) · Murti Pran Pratishtha Mahotsav',
      columns: EXPORT_COLUMNS,
      rows,
      /* The filters are stamped on so a printed copy still says what it
         was a report OF, a month after it left the printer. */
      meta: [
        ['Filter', label],
        ...(state.category ? [['Category', CAT_LABEL[state.category] || state.category]] : []),
        ...(state.poojaId ? [['Seva', scopeLabel()]] : []),
        ['Sorted by', sortLabel + (state.sortDir === 'desc' ? ' (highest first)' : ' (A–Z / lowest first)')],
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
      <div class="filter-row" id="collectScope">
        <select class="form-select" id="collectCategory" aria-label="Mahotsav category"></select>
        <select class="form-select" id="collectSeva" aria-label="Seva"></select>
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

    host.querySelector('#collectCategory').addEventListener('change', (e) => {
      state.category = e.target.value;
      /* A seva belongs to one category, so a category change can leave
         the seva contradicting it. Clear it rather than filter to an
         impossible pair and show an empty page. */
      state.poojaId = '';
      state.page = 1;
      paintScope();
      paintSummary();
      paintCollect();
    });
    host.querySelector('#collectSeva').addEventListener('change', (e) => {
      state.poojaId = e.target.value;
      state.page = 1;
      paintSummary();
      paintCollect();
    });
    host.querySelector('#collectSearch').addEventListener('input',
      debounce((e) => { state.search = e.target.value.trim(); state.page = 1; loadCollect(); }, 280));

    await loadCollect();
  }

  /* Fetching and painting are separate, because sorting and paging
     change neither the rows nor the totals — only which of them are on
     screen and in what order. Going back to the API for a header click
     was both slower and a chance for the figures to shift under the
     operator mid-sort. */
  async function loadCollect() {
    const body = document.getElementById('collectBody');
    if (!body) return;
    body.innerHTML = UI.loading(4);
    try {
      state.bookings = await API.bookings({ search: state.search || undefined });
      paintScope();
      paintSummary();
      paintCollect();
    } catch (e) {
      body.innerHTML = UI.errorState(e.message);
    }
  }

  /** Fills both selects from the rows in hand. Called after a load and
      whenever the category changes; the seva list depends on it. */
  function paintScope() {
    const cat = document.getElementById('collectCategory');
    const seva = document.getElementById('collectSeva');
    if (!cat || !seva) return;
    const opt = (v, label, sel) =>
      `<option value="${attr(v)}"${String(v) === String(sel) ? ' selected' : ''}>${esc(label)}</option>`;

    const cats = categoryOptions();
    cat.innerHTML = opt('', 'All categories', state.category) +
      cats.map((c) => opt(c.key, `${c.label} (${UI.num(c.n)})`, state.category)).join('');

    const sevas = sevaOptions();
    seva.innerHTML = opt('', state.category ? 'All seva in this category' : 'All seva', state.poojaId) +
      sevas.map((o) => opt(o.key, `${o.label} (${UI.num(o.n)})`, state.poojaId)).join('');
    /* Nothing to choose between is not a choice — one seva in a
       category, or none at all, leaves the control disabled rather
       than pretending it does something. */
    seva.disabled = sevas.length === 0;
  }

  function paintSummary() {
    const summary = document.getElementById('collectSummary');
    if (!summary) return;
    const live = state.bookings.filter((b) => b.status !== 'cancelled' && scoped(b));

    /* Totals are for everything live, not just the current status
       filter — the operator wants the size of the job, then narrows to
       work through it. They DO follow the category/seva scope, because
       "how much is still to collect on the Maha Yagna" is the question
       that filter was asked for. Summed per booking, never netted. */
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
          <div class="mg-muted-xs">from ${esc(num(t.owing))} sevarthi${
            scopeLabel() ? ' · ' + esc(scopeLabel()) : ''}</div></div>
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
  }

  function paintCollect() {
    const body = document.getElementById('collectBody');
    if (!body) return;

    const rows = visibleRows();
    if (!rows.length) {
      /* Say which of the three narrowings emptied it, or the operator
         has to undo them one at a time to find out. */
      body.innerHTML = UI.empty(
        state.filter === 'due' ? 'Nothing outstanding' : 'Nothing here',
        state.search ? `No sevarthi matches that search${scopeLabel() ? ' in ' + scopeLabel() : ''}.`
          : scopeLabel() ? `No sevarthi in this state on ${scopeLabel()}.`
          : 'No sevarthi in this state.', 'rupee');
      return;
    }

    /* A Mahotsav runs to hundreds of sevarthi; one endless list is
       neither scannable nor quick to paint. UI.paginate clamps the
       page for us when a filter change leaves it past the end. */
    const pg = UI.paginate(sortRows(rows), state.page);
    state.page = pg.page;
    const shown = pg.slice;

    /* Columns, not a wall. The old row put a name and a mobile at the
       far left and one figure at the far right with ~800px of nothing
       between, so a screenful gave nothing to run your eye down and no
       way to compare two people. Every figure has its own right-aligned
       column now and the page sorts by whichever one matters — the
       difference between a list of people and a workbench. The panel
       underneath is unchanged; it still holds what only matters once a
       row has been chosen. */
    const money0 = (v) => (v ? esc(money(v)) : '<span class="muted">—</span>');

    const COLUMNS = [
      { key: 'full_name', label: 'Sevarthi', sortable: true, cell: (b) => `
          <div class="dt-name">${esc(b.full_name)} ${UI.coverageBadges(b)}</div>
          <div class="dt-sub">${b.mobile
            ? `<span class="dt-nw">${icon('phone','ico-sm')}${esc(b.mobile)}</span>`
            : `<span class="dt-nw is-missing">${icon('alert','ico-sm')}No mobile</span>`}${
            b.samaj ? ` · ${esc(b.samaj)}` : ''}</div>` },
      { key: 'pooja_name', label: 'Seva', sortable: true, hideOn: 'sm', cell: (b) => `
          <div>${esc(b.pooja_name)}</div>
          <div class="dt-sub">${esc(b.slot_date ? fmtDate(b.slot_date) : UI.TBD)}</div>` },
      { key: 'committed', label: 'Contribution', type: 'money', sortable: true,
        cell: (b) => esc(money(b.amount_committed)) },
      { key: 'devotee_paid', label: 'Paid', type: 'money', sortable: true,
        cell: (b) => money0(UI.coverage(b).devotee_paid) },
      { key: 'bappa_paid', label: 'Bapa', type: 'money', sortable: true, hideOn: 'sm',
        /* On a gift the figure alone would read as Bapa having helped
           with a large share. Naming it says which of the two it is,
           and what is still to come is in the Outstanding column
           anyway. */
        cell: (b) => (b.is_gift
          ? `<span class="dt-gift">${esc(money(UI.coverage(b).bappa_paid))}<span class="dt-gift-k">gift</span></span>`
          : money0(UI.coverage(b).bappa_paid)) },
      { key: 'outstanding', label: 'Outstanding', type: 'money', sortable: true, cell: (b) => {
          const c = UI.coverage(b);
          if (c.outstanding > 0) return `<span class="dt-due">${esc(money(c.outstanding))}</span>`;
          if (c.excess > 0) return `<span class="dt-extra">+${esc(money(c.excess))}</span>`;
          return `<span class="dt-ok">Covered</span>`;
        } },
    ];

    body.innerHTML = `
      <div class="card">
        <div class="card-header"><h2>${esc(num(rows.length))} sevarthi</h2>
          <span class="small muted">${esc((FILTERS.find((f) => f[0] === state.filter) || [])[1] || '')}${
            scopeLabel() ? ' · ' + esc(scopeLabel()) : ''}</span></div>
        <div class="card-body" style="padding:0">
          ${UI.dataTable({
            columns: COLUMNS,
            rows: shown,
            sort: { key: state.sortKey, dir: state.sortDir },
            label: 'Dates and actions',
            actions: (b) => (b.status !== 'cancelled' && UI.coverage(b).outstanding > 0
              ? `<button class="btn btn-primary mg-btn-xs" data-collect="${attr(b.id)}">Collect</button>` : ''),
            detail: (b) => {
              const c = UI.coverage(b);
              return `
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
            },
          })}
        </div>
        ${UI.pager(pg, 'sevarthi')}
      </div>`;

    UI.bindExpanders(body);
    UI.bindDataTable(body, (key) => { toggleSort(key); paintCollect(); });
    UI.bindPager(body, (d) => {
      state.page = pg.page + d;
      paintCollect();
      body.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
  }

  global.Pages = global.Pages || {};
  global.Pages.payments = { render };
})(window);
