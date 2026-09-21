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
        <button class="btn btn-primary mg-btn-xs" data-add>${icon('plus','ico-sm')} Devotee</button>
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

    body.innerHTML = `
      <div class="card"><div class="card-header">
        <h2>${esc(num(rows.length))} devotee${rows.length === 1 ? '' : 's'}</h2>
        <span class="small muted">${esc((SORTS.find((s) => s[0] === state.sort) || [])[1] || '')}</span></div>
        <div class="card-body" style="padding:0"><div class="list">
        ${pg.slice.map((d) => {
          const place = [d.city, d.mul_vatan && d.mul_vatan !== d.city ? 'mul ' + d.mul_vatan : null]
            .filter(Boolean).join(' · ');
          const hasRecord = d.booking_count || d.total_paid || d.donation_total || d.visit_count;

          /* Collapsed: identifying a person, which is the job on this
             page — name, who they are (category/samaj), the mobile that
             *is* their identity key, and where they are from. Their
             money and history are one tap down, not gone. */
          const summary = `
            <div class="row-main">
              <div class="row-title">${esc(d.full_name)}
                ${d.category ? `<span class="badge badge-gold">${esc(d.category)}</span>` : ''}
                ${d.samaj ? `<span class="badge">${esc(d.samaj)}</span>` : ''}</div>
              <div class="collect-meta">
                ${d.mobile
                  ? `<span class="is-phone">${icon('phone','ico-sm')} ${esc(d.mobile)}</span>`
                  : `<span class="is-missing">${icon('alert','ico-sm')} No mobile</span>`}
                ${place ? `<span>${esc(place)}</span>` : ''}
                ${d.state && d.state !== 'Gujarat' ? `<span>${esc(d.state)}</span>` : ''}
                ${d.booking_count
                  ? `<span>${esc(num(d.booking_count))} seva</span>`
                  : d.donation_total ? '<span>Donor</span>' : ''}
              </div>
            </div>
            <div class="row-end collect-lead">
              ${/* One number, and it is whichever one would make an operator
                    act: what they still owe, else what they have given. */''}
              <div class="lead-fig ${d.outstanding > 0 ? 'is-due' : ''}">
                <span class="lead-k">${d.outstanding > 0 ? 'Outstanding'
                  : (d.total_paid || d.donation_total) ? 'Contributed' : 'On register'}</span>
                <span class="lead-v">${d.outstanding > 0 ? esc(money(d.outstanding))
                  : (d.total_paid || d.donation_total)
                    ? esc(money((d.total_paid || 0) + (d.donation_total || 0)))
                    : '—'}</span>
              </div>
              <button class="btn btn-outline mg-btn-xs" data-dev="${attr(d.id)}">Profile</button>
            </div>`;

          const detail = `
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
              ${d.notes ? `<span title="${attr(d.notes)}">Note on file</span>` : ''}
            </div>

            <div class="more-actions">
              <button class="btn btn-outline mg-btn-xs" data-seva="${attr(d.id)}">
                ${icon('plus','ico-sm')} Seva</button>
              <button class="btn btn-outline mg-btn-xs" data-edit="${attr(d.id)}">
                ${icon('edit','ico-sm')} Edit devotee</button>
            </div>`;

          return UI.expandableRow(summary, detail,
            { itemClass: 'devotee-row', label: 'Money, history and actions' });
        }).join('')}
        </div></div>
        ${UI.pager(pg, 'devotees')}
      </div>`;

    body.querySelectorAll('[data-dev]').forEach((b) =>
      b.addEventListener('click', () => openProfile(b.getAttribute('data-dev'))));
    body.querySelectorAll('[data-seva]').forEach((b) =>
      b.addEventListener('click', () => Forms.addSevarthi()));
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
        ${d.bookings.length ? `<div class="card"><div class="card-body" style="padding:0"><div class="list">
          ${d.bookings.map((b) => `
            <div class="row-item" style="cursor:default">
              <div class="row-main">
                <div class="row-title">${esc(b.pooja_name)} ${UI.coverageBadges(b)}</div>
                <div class="row-sub">${esc(fmtDate(b.slot_date))}</div>
              </div>
              <div class="row-end">
                <div class="row-amount">${esc(money(b.amount_paid))}</div>
                <div class="small muted">of ${esc(money(b.amount_committed))}</div>
              </div>
            </div>`).join('')}
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
        sheet.querySelector('[data-seva]').addEventListener('click', () => { closeSheet(); Forms.addSevarthi(); });
      },
    });
  }

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
          <div class="form-group"><label class="form-label req" for="f_full_name">Full Name</label>
            <input class="form-input" id="f_full_name" name="full_name" value="${attr(d.full_name || '')}" autocomplete="name"></div>
          <div class="form-row">
            <div class="form-group"><label class="form-label req" for="f_mobile">Mobile No.</label>
              <input class="form-input" id="f_mobile" name="mobile" value="${attr(d.mobile || '')}" inputmode="tel" autocomplete="tel">
              <div class="form-hint">How the trust reaches them — also what stops the same person being added twice.</div></div>
            <div class="form-group"><label class="form-label" for="f_city">City</label>
              <input class="form-input" id="f_city" name="city" value="${attr(d.city || '')}"></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label class="form-label" for="f_state">State</label>
              <input class="form-input" id="f_state" name="state" value="${attr(d.state || 'Gujarat')}"></div>
            <div class="form-group"><label class="form-label" for="f_mul_vatan">Mul Vatan</label>
              <input class="form-input" id="f_mul_vatan" name="mul_vatan" value="${attr(d.mul_vatan || '')}"></div>
          </div>
          ${samajField}
          ${catField}
          <div class="form-group"><label class="form-label" for="f_notes">Note</label>
            <input class="form-input" id="f_notes" name="notes" data-translate value="${attr(d.notes || '')}"></div>
        </form>`,
      footer: `<button class="btn btn-outline" data-sheet-close>Cancel</button>
               <button class="btn btn-primary" id="devSave">${d.id ? 'Save' : 'Add Devotee'}</button>`,
      onMount(sheet) {
        sheet.querySelector('[data-sheet-close]').addEventListener('click', closeSheet);
        const form = document.getElementById('devForm');
        bindLookupAdders(form); UI.bindTranslate(form);
        sheet.querySelector('#devSave').addEventListener('click', async (e) => {
          clearFieldErrors(form);
          const data = readForm(form);
          if (!data.full_name) return showFieldError(form, 'full_name', 'Please enter the name');
          const mobileMsg = UI.mobileError(data.mobile);
          if (mobileMsg) return showFieldError(form, 'mobile', mobileMsg);
          e.currentTarget.disabled = true;
          try {
            if (d.id) await API.put('/devotees/' + d.id, data);
            else await API.post('/devotees', data);
            closeSheet();
            toast(d.id ? 'Devotee updated' : 'Devotee added', 'ok');
            refreshPage();
          } catch (err) {
            e.currentTarget.disabled = false;
            toast(err.message, 'err');
          }
        });
      },
    });
  }

  global.Pages = global.Pages || {};
  global.Pages.devotees = { render, openForm, openProfile };
})(window);
