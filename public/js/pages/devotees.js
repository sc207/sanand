/* Devotee register + 360° profile. */
(function (global) {
  'use strict';
  const { esc, attr, money, num, icon, fmtDate, debounce, statusBadge,
          openSheet, closeSheet, readForm, clearFieldErrors, showFieldError,
          toast, lookupSelect, bindLookupAdders } = UI;

  const state = { search: '', page: 1, samajId: '', categoryId: '', sort: 'name', rows: [] };

  /* Sorting is client-side: the register is fetched whole (LIMIT 500)
     and the operator flips between orders constantly while working
     through it — a round trip per click would be the slower answer. */
  const SORTS = [
    ['name', 'Name A–Z'],
    ['recent', 'Recently added'],
    ['contributed', 'Highest contribution'],
    ['outstanding', 'Most outstanding'],
    ['seva', 'Most seva'],
  ];

  const sorters = {
    name: (a, b) => a.full_name.localeCompare(b.full_name),
    recent: (a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')),
    contributed: (a, b) => (b.total_paid || 0) - (a.total_paid || 0) || a.full_name.localeCompare(b.full_name),
    outstanding: (a, b) => (b.outstanding || 0) - (a.outstanding || 0) || a.full_name.localeCompare(b.full_name),
    seva: (a, b) => (b.booking_count || 0) - (a.booking_count || 0) || a.full_name.localeCompare(b.full_name),
  };

  const fig = (k, v, cls) => `<div class="fig ${cls || ''}">
    <span class="fig-k">${esc(k)}</span><span class="fig-v">${esc(v)}</span></div>`;

  const opt = (v, label, cur) =>
    `<option value="${attr(v)}" ${String(v) === String(cur) ? 'selected' : ''}>${esc(label)}</option>`;

  /* The register as a file. Same eight fields the form is locked to,
     plus the money and activity the list shows — money raw, so the
     spreadsheet can total a samaj. */
  const EXPORT_COLUMNS = [
    { key: 'name',      label: 'Name',        value: (d) => d.full_name },
    { key: 'mobile',    label: 'Mobile', nowrap: true, value: (d) => d.mobile || '' },
    { key: 'city',      label: 'City',        value: (d) => d.city || '' },
    { key: 'state',     label: 'State', print: false, value: (d) => d.state || '' },
    { key: 'mul',       label: 'Mul vatan', print: false, value: (d) => d.mul_vatan || '' },
    { key: 'samaj',     label: 'Samaj',       value: (d) => d.samaj || '' },
    { key: 'category',  label: 'Category',    value: (d) => d.category || '' },
    { key: 'seva',      label: 'Seva',        type: 'num',   value: (d) => d.booking_count || 0 },
    { key: 'committed', label: 'Committed',   type: 'money', value: (d) => d.total_committed || 0 },
    { key: 'paid',      label: 'Contributed', type: 'money', value: (d) => d.total_paid || 0 },
    { key: 'bappa',     label: "Bapa's support", type: 'money', value: (d) => d.bappa_paid || 0 },
    { key: 'outstanding', label: 'Outstanding', type: 'money', value: (d) => d.outstanding || 0 },
    { key: 'donations', label: 'Donations', print: false, type: 'money', value: (d) => d.donation_total || 0 },
    { key: 'visits',    label: 'Padhramni', print: false, type: 'num',   value: (d) => d.visit_count || 0 },
    { key: 'cancelled', label: 'Cancelled seva', print: false, type: 'num', value: (d) => d.cancelled_count || 0 },
    { key: 'since',     label: 'On register since', print: false, type: 'date', value: (d) => String(d.created_at || '').slice(0, 10) },
    { key: 'notes',     label: 'Note', print: false, value: (d) => d.notes || '' },
  ];

  function exportSpec() {
    // Sorted as the operator left it, and the whole filtered set.
    const rows = [...state.rows].sort(sorters[state.sort] || sorters.name);
    const named = (sel, id) => {
      const el = document.getElementById(sel);
      if (!el || !id) return '';
      const o = [...el.options].find((x) => String(x.value) === String(id));
      return o ? o.textContent.trim() : '';
    };
    const t = rows.reduce((a, d) => {
      a.committed += d.total_committed || 0; a.paid += d.total_paid || 0;
      a.bappa += d.bappa_paid || 0; a.outstanding += d.outstanding || 0;
      a.donations += d.donation_total || 0;
      if (!d.mobile) a.noMobile++;
      return a;
    }, { committed: 0, paid: 0, bappa: 0, outstanding: 0, donations: 0, noMobile: 0 });

    const samaj = named('devSamaj', state.samajId);
    const category = named('devCategory', state.categoryId);
    return {
      filename: 'Devotee-Register' + (samaj ? '-' + samaj : ''),
      title: 'Devotee Register' + (samaj ? ' — ' + samaj : ''),
      subtitle: "Shri Vihat Meldi Dham (Sanand) · the temple's permanent register",
      columns: EXPORT_COLUMNS,
      rows,
      meta: [
        ...(samaj ? [['Samaj', samaj]] : []),
        ...(category ? [['Category', category]] : []),
        ...(state.search ? [['Search', state.search]] : []),
        ['Sorted by', (SORTS.find((s) => s[0] === state.sort) || [])[1] || ''],
        ['Devotees', UI.num(rows.length)],
        ['Contributed', money(t.paid)],
        ...(t.noMobile ? [['No mobile on record', UI.num(t.noMobile)]] : []),
        ['Taken', new Date().toLocaleString()],
      ],
      totals: {
        name: 'Total (' + UI.num(rows.length) + ')',
        committed: t.committed, paid: t.paid, bappa: t.bappa,
        outstanding: t.outstanding, donations: t.donations,
      },
    };
  }

  async function render(host) {
    const [samaj, categories] = await Promise.all([
      API.lookups('samaj'), API.lookups('devotee_category'),
    ]);

    host.innerHTML = `
      <div class="flex justify-between items-center mg-page-head">
        <div>
          <h1 class="banner-title mg-page-title">Devotee</h1>
          <p class="mg-page-sub">The temple's permanent register</p>
        </div>
        <div class="mg-page-actions">
          ${Export.toolbar('devExport')}
          <button class="btn btn-primary mg-btn-xs" data-add>${icon('plus','ico-sm')} Devotee</button>
        </div>
      </div>

      <div id="devSummary"></div>

      <div class="search-bar" style="margin-top:1rem">${icon('search')}
        <input class="form-input" id="devSearch" placeholder="Search name, mobile, city, samaj, category"
               value="${attr(state.search)}" autocomplete="off"></div>

      <div class="filter-row">
        <select class="form-select" id="devSamaj" aria-label="Samaj">
          ${opt('', 'All samaj', state.samajId)}
          ${samaj.map((s) => opt(s.id, s.value, state.samajId)).join('')}
        </select>
        <select class="form-select" id="devCategory" aria-label="Devotee category">
          ${opt('', 'All categories', state.categoryId)}
          ${categories.map((c) => opt(c.id, c.value, state.categoryId)).join('')}
        </select>
        <select class="form-select" id="devSort" aria-label="Sort by">
          ${SORTS.map(([v, l]) => opt(v, l, state.sort)).join('')}
        </select>
      </div>

      <div id="devBody">${UI.loading(4)}</div>`;

    host.querySelector('[data-add]').addEventListener('click', () => openForm());
    Export.bindToolbar(host, exportSpec);
    host.querySelector('#devSearch').addEventListener('input',
      debounce((e) => { state.search = e.target.value.trim(); state.page = 1; load(); }, 280));
    host.querySelector('#devSamaj').addEventListener('change', (e) => {
      state.samajId = e.target.value; state.page = 1; load();
    });
    host.querySelector('#devCategory').addEventListener('change', (e) => {
      state.categoryId = e.target.value; state.page = 1; load();
    });
    host.querySelector('#devSort').addEventListener('change', (e) => {
      state.sort = e.target.value; state.page = 1; paintList();
    });
    await load();
  }

  async function load() {
    const body = document.getElementById('devBody');
    body.innerHTML = UI.loading(3);
    try {
      /* samaj_id / category_id have always been supported by the API;
         the page simply never used them. */
      state.rows = await API.devotees({
        search: state.search || undefined,
        samaj_id: state.samajId || undefined,
        category_id: state.categoryId || undefined,
      });
      paintSummary();
      paintList();
    } catch (e) {
      body.innerHTML = UI.errorState(e.message);
    }
  }

  function paintSummary() {
    const host = document.getElementById('devSummary');
    if (!host) return;
    const t = state.rows.reduce((a, d) => {
      a.committed += d.total_committed || 0;
      a.paid += d.total_paid || 0;
      a.outstanding += d.outstanding || 0;
      a.donations += d.donation_total || 0;
      if (d.booking_count > 0) a.sevarthi++;
      if (!d.mobile) a.noMobile++;
      return a;
    }, { committed: 0, paid: 0, outstanding: 0, donations: 0, sevarthi: 0, noMobile: 0 });

    host.innerHTML = `
      <div class="stats-grid">
        <div class="stat"><div class="stat-text">
          <div class="stat-card-title">Devotees</div>
          <div class="stat-card-value">${esc(num(state.rows.length))}</div>
          <div class="mg-muted-xs">${esc(num(t.sevarthi))} have taken seva</div></div>
          <span class="stat-ico people">${icon('users')}</span></div>
        <div class="stat"><div class="stat-text">
          <div class="stat-card-title">Contributed</div>
          <div class="stat-card-value">${esc(money(t.paid))}</div>
          <div class="mg-muted-xs">of ${esc(money(t.committed))} committed</div></div>
          <span class="stat-ico rupee">${icon('wallet')}</span></div>
        <div class="stat"><div class="stat-text">
          <div class="stat-card-title">Outstanding</div>
          <div class="stat-card-value" style="color:var(--warning)">${esc(money(t.outstanding))}</div>
          <div class="mg-muted-xs">across their seva</div></div>
          <span class="stat-ico due">${icon('clock')}</span></div>
        <div class="stat"><div class="stat-text">
          <div class="stat-card-title">Donations</div>
          <div class="stat-card-value">${esc(money(t.donations))}</div>
          <div class="mg-muted-xs">separate from seva</div></div>
          <span class="stat-ico grace">${icon('gift')}</span></div>
      </div>
      ${t.noMobile ? `<p class="small" style="margin:.6rem 0 0;color:var(--warning)">
        ${icon('alert','ico-sm')} ${esc(num(t.noMobile))} devotee${t.noMobile === 1 ? ' has' : 's have'}
        no mobile number on record — the trust cannot reach them.</p>` : ''}`;
  }

  function paintList() {
    const body = document.getElementById('devBody');
    if (!body) return;

    if (!state.rows.length) {
      const filtered = state.search || state.samajId || state.categoryId;
      body.innerHTML = UI.empty(
        filtered ? 'No devotee found' : 'Register is empty',
        filtered ? 'Try another name, or widen the filters.' : 'Add the first devotee to begin.', 'users');
      return;
    }

    const rows = [...state.rows].sort(sorters[state.sort] || sorters.name);
    const pg = UI.paginate(rows, state.page);

    /* Columns, for the same reason Payments has them: the register is
       worked through a screen at a time, and a row that put a name at
       the far left and one figure at the far right gave nothing to run
       an eye down. Each heading sorts, and the sort select above stays
       — it holds "Recently added", which is not a column. The two are
       one piece of state, so clicking a heading moves the select with
       it and neither can contradict the other. */
    const money0 = (v) => (v ? esc(money(v)) : '<span class="muted">—</span>');

    const COLUMNS = [
      { key: 'name', label: 'Devotee', sortable: true, cell: (d) => `
          <div class="dt-name">${esc(d.full_name)}
            ${d.category ? `<span class="badge badge-gold">${esc(d.category)}</span>` : ''}
            ${d.samaj ? `<span class="badge">${esc(d.samaj)}</span>` : ''}</div>
          <div class="dt-sub">${d.mobile
            ? `<span class="dt-nw">${icon('phone','ico-sm')}${esc(d.mobile)}</span>`
            : `<span class="dt-nw is-missing">${icon('alert','ico-sm')}No mobile</span>`}</div>` },
      { key: 'place', label: 'From', hideOn: 'sm', cell: (d) => {
          const place = [d.city, d.mul_vatan && d.mul_vatan !== d.city ? 'mul ' + d.mul_vatan : null]
            .filter(Boolean).join(' · ');
          return place
            ? `${esc(place)}${d.state && d.state !== 'Gujarat' ? `<div class="dt-sub">${esc(d.state)}</div>` : ''}`
            : '<span class="muted">—</span>';
        } },
      { key: 'seva', label: 'Seva', type: 'num', sortable: true, cell: (d) => (d.booking_count
          ? esc(num(d.booking_count))
          : d.donation_total ? '<span class="muted">Donor</span>' : '<span class="muted">—</span>') },
      { key: 'contributed', label: 'Contributed', type: 'money', sortable: true,
        cell: (d) => money0((d.total_paid || 0) + (d.donation_total || 0)) },
      { key: 'outstanding', label: 'Outstanding', type: 'money', sortable: true, cell: (d) => (d.outstanding > 0
          ? `<span class="dt-due">${esc(money(d.outstanding))}</span>`
          : '<span class="muted">—</span>') },
    ];

    body.innerHTML = `
      <div class="card"><div class="card-header">
        <h2>${esc(num(rows.length))} devotee${rows.length === 1 ? '' : 's'}</h2>
        <span class="small muted">${esc((SORTS.find((s) => s[0] === state.sort) || [])[1] || '')}</span></div>
        <div class="card-body" style="padding:0">
        ${UI.dataTable({
          columns: COLUMNS,
          rows: pg.slice,
          sort: { key: state.sort, dir: state.sort === 'name' ? 'asc' : 'desc' },
          label: 'Money, history and actions',
          actions: (d) => `<button class="btn btn-outline mg-btn-xs" data-dev="${attr(d.id)}">Profile</button>`,
          detail: (d) => {
            const hasRecord = d.booking_count || d.total_paid || d.donation_total || d.visit_count;
            return `
            ${/* total_paid is in the test too: a devotee whose only seva
                  was cancelled has booking_count 0 but money on record,
                  and hiding the band there hid the money. */
              hasRecord ? `
            <div class="fig-band">
              ${fig('Seva', num(d.booking_count))}
              ${d.total_committed ? fig('Committed', money(d.total_committed)) : ''}
              ${fig('Contributed', money(d.total_paid))}
              ${d.bappa_paid ? fig("Bapa's support", money(d.bappa_paid), 'is-bapa') : ''}
              ${d.outstanding > 0 ? fig('Outstanding', money(d.outstanding), 'is-due') : ''}
              ${d.donation_total ? fig('Donations', money(d.donation_total)) : ''}
              ${d.visit_count ? fig('Padhramni', num(d.visit_count)) : ''}
            </div>
            ${d.cancelled_count && d.total_paid && !d.booking_count ? `
              <p class="small" style="margin:0;color:var(--warning)">
                ${icon('alert','ico-sm')} Money on record against a cancelled seva — refund to be settled.</p>` : ''}
            ` : `<p class="small muted" style="margin:0">No seva, donation or padhramni yet.</p>`}

            <div class="collect-when">
              ${icon('clock','ico-sm')}
              <span>On the register since ${esc(fmtDate(String(d.created_at || '').slice(0, 10)))}</span>
            </div>

            ${/* The note used to be a `title` tooltip reading "Note on
                  file" — invisible on a touch screen, and the text never
                  on screen at all, while the export carried it in full. */''}
            ${d.notes ? `<div class="vis-line" style="margin-top:.1rem">
              ${icon('edit','ico-sm')}<span>${esc(d.notes)}</span></div>` : ''}

            <div class="more-actions">
              <button class="btn btn-outline mg-btn-xs" data-seva="${attr(d.id)}">
                ${icon('plus','ico-sm')} Seva</button>
              <button class="btn btn-outline mg-btn-xs" data-edit="${attr(d.id)}">
                ${icon('edit','ico-sm')} Edit devotee</button>
            </div>`;
          },
        })}
        </div>
        ${UI.pager(pg, 'devotees')}
      </div>`;

    /* A heading and the sort select are the same state. The select also
       offers "Recently added", which no column shows, so it stays. */
    UI.bindDataTable(body, (key) => {
      state.sort = key; state.page = 1;
      const sel = document.getElementById('devSort');
      if (sel) sel.value = key;
      paintList();
    });

    body.querySelectorAll('[data-dev]').forEach((b) =>
      b.addEventListener('click', () => openProfile(b.getAttribute('data-dev'))));
    body.querySelectorAll('[data-seva]').forEach((b) =>
      b.addEventListener('click', () => {
        /* The id was already in the markup and was being thrown away:
           "+ Seva" on Rameshbhai's row opened a blank form and asked
           who it was for. */
        const d = state.rows.find((x) => String(x.id) === b.getAttribute('data-seva'));
        Forms.addSevarthi(d ? { inquiry: sevaPreset(d) } : undefined);
      }));
    body.querySelectorAll('[data-edit]').forEach((b) =>
      b.addEventListener('click', () => {
        const d = state.rows.find((x) => String(x.id) === b.getAttribute('data-edit'));
        openForm(d);
      }));
    UI.bindExpanders(body);
    UI.bindPager(body, (delta) => { state.page = pg.page + delta; paintList(); });
  }

  /* ---------- 360° profile ---------- */
  async function openProfile(id) {
    const d = await API.devotee(id);
    const totalCommitted = d.bookings.filter((b) => b.status !== 'cancelled')
      .reduce((a, b) => a + b.amount_committed, 0);

    openSheet({
      title: d.full_name,
      body: `
        <div class="card" style="margin-bottom:.8rem"><div class="card-body">
          <div class="row-sub">${[d.mobile, d.city, d.state].filter(Boolean).map(esc).join(' · ') || '—'}</div>
          <div class="row-sub">${d.mul_vatan ? 'Mul vatan: ' + esc(d.mul_vatan) : ''}</div>
          <div style="margin-top:.4rem;display:flex;gap:.35rem;flex-wrap:wrap">
            ${d.samaj ? `<span class="badge badge-maroon">${esc(d.samaj)}</span>` : ''}
            ${d.category ? `<span class="badge badge-gold">${esc(d.category)}</span>` : ''}
          </div>
        </div></div>

        <div class="stats-grid" style="grid-template-columns:repeat(2,1fr)">
          <div class="stat"><div class="stat-card-title">Contributed</div>
            <div class="stat-card-value">${esc(money(d.total_paid))}</div>
            <div class="mg-muted-xs">of ${esc(money(totalCommitted))} committed</div></div>
          <div class="stat"><div class="stat-card-title">Seva</div>
            <div class="stat-card-value">${esc(num(d.booking_count))}</div>
            <div class="mg-muted-xs">bookings</div></div>
        </div>

        <div class="section-title">Sevarthi bookings</div>
        ${/* These rows used to be cursor:default with no actions on
              them at all — a dead end. The devotee's profile is exactly
              where an operator lands when someone walks in and says
              "I want to move my seva" or hands over money, and every
              one of those actions existed only on the Payments page.
              A seva row now carries the same four it does there. */''}
        ${d.bookings.length ? `<div class="card"><div class="card-body" style="padding:0"><div class="list">
          ${d.bookings.map((b) => {
            const cov = UI.coverage(b);
            return `
            <div class="row-item dv-seva-row">
              <div class="row-main">
                <div class="row-title">${esc(b.pooja_name)} ${UI.coverageBadges(b)}</div>
                <div class="row-sub">${esc(b.slot_date ? fmtDate(b.slot_date) : UI.TBD)}
                  · ${esc(money(b.amount_paid))} of ${esc(money(b.amount_committed))}${
                  cov.outstanding > 0 ? ` · <strong style="color:var(--danger)">${esc(money(cov.outstanding))} due</strong>` : ''}</div>
                ${b.status === 'cancelled' ? '' : `
                <div class="btn-row" style="margin-top:.5rem">
                  ${cov.outstanding > 0 ? `<button class="btn btn-primary mg-btn-xs" data-bk-pay="${attr(b.id)}">
                    ${icon('rupee','ico-sm')} Collect</button>` : ''}
                  <button class="btn btn-outline mg-btn-xs" data-bk-move="${attr(b.id)}">
                    ${icon('seat','ico-sm')} Change Seva</button>
                  <button class="btn btn-outline mg-btn-xs" data-bk-edit="${attr(b.id)}">
                    ${icon('edit','ico-sm')} Edit</button>
                  <button class="btn btn-outline mg-btn-xs" data-bk-ledger="${attr(b.id)}">
                    ${icon('history','ico-sm')} Ledger</button>
                </div>`}
              </div>
            </div>`;
          }).join('')}
        </div></div></div>` : `<p class="small muted">No seva booked yet.</p>`}

        ${d.donations.length ? `<div class="section-title">Donations</div>
          <div class="card"><div class="card-body" style="padding:0"><div class="list">
          ${d.donations.map((x) => `
            <div class="row-item" style="cursor:default">
              <div class="row-main"><div class="row-title">${esc(x.category || 'Donation')}</div>
                <div class="row-sub">${esc(fmtDate(x.donation_date))}</div></div>
              <div class="row-end"><div class="row-amount">${esc(money(x.amount))}</div></div>
            </div>`).join('')}
        </div></div></div>` : ''}`,
      footer: `
        <button class="btn btn-outline" data-edit>Edit</button>
        <button class="btn btn-primary" data-seva>Add Seva</button>`,
      onMount(sheet) {
        sheet.querySelector('[data-edit]').addEventListener('click', () => openForm(d));
        /* Opening Add Seva from someone's own profile and then being
           asked who it is for was the same thrown-away id as on the
           list row. The sheet is reused, so no closeSheet() first. */
        sheet.querySelector('[data-seva]').addEventListener('click',
          () => Forms.addSevarthi({ inquiry: sevaPreset(d) }));

        /* Every action re-opens the profile when it finishes, so the
           operator is put back where they were rather than on whatever
           page happened to be behind the sheet. */
        const back = () => openProfile(id);
        const on = (attrName, fn) => sheet.querySelectorAll('[' + attrName + ']').forEach((b) =>
          b.addEventListener('click', () => fn(b.getAttribute(attrName))));
        on('data-bk-pay', (bid) => Forms.paymentForm(bid, { onSaved: back }));
        on('data-bk-move', (bid) => Forms.reassignBooking(bid, { onSaved: back }));
        on('data-bk-edit', (bid) => Forms.editBooking(bid, { onSaved: back }));
        on('data-bk-ledger', (bid) => Forms.bookingLedger(bid, back));
      },
    });
  }

  /** What Add Seva needs to know about someone already on the register.
      Spelled out in one place because three callers hand a devotee
      over — a list row, the profile, and "Save & add seva" — and two of
      them used to hand over nothing at all. */
  const sevaPreset = (d) => ({
    full_name: d.full_name, mobile: d.mobile, city: d.city,
    state: d.state, mul_vatan: d.mul_vatan,
    samaj_id: d.samaj_id, category_id: d.category_id,
  });

  /* ---------- add / edit form ---------- */
  async function openForm(existing) {
    const d = existing || {};
    const [samajField, catField] = await Promise.all([
      lookupSelect('samaj', 'samaj_id', d.samaj_id, 'Samaj'),
      lookupSelect('devotee_category', 'category_id', d.category_id, 'Devotee Category'),
    ]);

    openSheet({
      title: d.id ? 'Edit Devotee' : 'Add Devotee',
      body: `
        <form id="devForm" novalidate>
          ${/* The register's identity is a name and a number; everything
                else is detail the trust fills in when it has it. Asking
                all eight at once made adding one person look like a
                form to be dreaded rather than two boxes to type in. An
                existing devotee opens with their detail showing,
                because the reason to open an existing record is
                usually to correct one of those fields. */''}
          <div class="form-row">
            <div class="form-group"><label class="form-label req" for="f_full_name">Full Name</label>
              <input class="form-input" id="f_full_name" name="full_name" value="${attr(d.full_name || '')}"
                     autocomplete="name" enterkeyhint="next"></div>
            <div class="form-group"><label class="form-label req" for="f_mobile">Mobile No.</label>
              <input class="form-input" id="f_mobile" name="mobile" value="${attr(d.mobile || '')}"
                     inputmode="tel" autocomplete="tel" enterkeyhint="next">
              <div class="form-hint">How the trust reaches them — also what stops the same person being added twice.</div></div>
          </div>
          ${UI.moreFields('Address & samaj', `
            <div class="form-row">
              <div class="form-group"><label class="form-label" for="f_city">City</label>
                <input class="form-input" id="f_city" name="city" autocomplete="address-level2" value="${attr(d.city || '')}"></div>
              <div class="form-group"><label class="form-label" for="f_state">State</label>
                <input class="form-input" id="f_state" name="state" autocomplete="address-level1" value="${attr(d.state || 'Gujarat')}"></div>
            </div>
            <div class="form-row">
              <div class="form-group"><label class="form-label" for="f_mul_vatan">Mul Vatan</label>
                <input class="form-input" id="f_mul_vatan" name="mul_vatan" value="${attr(d.mul_vatan || '')}"></div>
              <div></div>
            </div>
            <div class="form-row">${samajField}${catField}</div>`,
            { open: !!d.id, count: 'optional' })}
          ${UI.moreFields('Note', `
            <div class="form-group"><label class="form-label" for="f_notes">Anything to record</label>
              <input class="form-input" id="f_notes" name="notes" data-translate value="${attr(d.notes || '')}"></div>`,
            { open: !!d.notes, count: 'optional' })}
        </form>`,
      /* Most people are put on the register *because* they are taking a
         seva, so a new devotee can go straight through to it rather than
         being saved, hunted down in the list and opened again. */
      footer: `<button class="btn btn-outline" data-sheet-close>Cancel</button>
               ${d.id ? '' : '<button class="btn btn-outline" id="devSaveSeva">Save &amp; add seva</button>'}
               <button class="btn btn-primary" id="devSave">${d.id ? 'Save' : 'Add Devotee'}</button>`,
      onMount(sheet) {
        sheet.querySelector('[data-sheet-close]').addEventListener('click', closeSheet);
        const form = document.getElementById('devForm');
        bindLookupAdders(form); UI.bindTranslate(form);
        UI.bindEnterFlow(form, () => document.getElementById('devSave').click());
        async function save(btn, thenSeva) {
          clearFieldErrors(form);
          const data = readForm(form);
          if (!data.full_name) return showFieldError(form, 'full_name', 'Please enter the name');
          const mobileMsg = UI.mobileError(data.mobile);
          if (mobileMsg) return showFieldError(form, 'mobile', mobileMsg);
          btn.disabled = true;
          try {
            const saved = d.id ? await API.put('/devotees/' + d.id, data)
                               : await API.post('/devotees', data);
            if (thenSeva) {
              /* Hand the new devotee straight to Add Sevarthi. It opens
                 into the same #sheet, so no closeSheet() first — that
                 would flash the list in between. */
              Forms.addSevarthi({ inquiry: sevaPreset(saved) });
              toast('Devotee added — now pick their seva', 'ok');
              return;
            }
            closeSheet();
            toast(d.id ? 'Devotee updated' : 'Devotee added', 'ok');
            refreshPage();
          } catch (err) {
            btn.disabled = false;
            toast(err.message, 'err');
          }
        }

        sheet.querySelector('#devSave')
          .addEventListener('click', (e) => save(e.currentTarget, false));
        const sevaBtn = sheet.querySelector('#devSaveSeva');
        if (sevaBtn) sevaBtn.addEventListener('click', (e) => save(e.currentTarget, true));
      },
    });
  }

  global.Pages = global.Pages || {};
  global.Pages.devotees = { render, openForm, openProfile };
})(window);
