/* ============================================================
   BAPPA / BHUVAJI PADHRAMNI — home and shop visits
   ------------------------------------------------------------
   This page is a diary, not a register: the question it answers is
   "where are we going, and when". So a row leads with how soon the
   visit is, who it is for, and the two things you cannot set out
   without — a number to ring ahead on and a place to go. Purpose,
   address, escorts and notes open underneath.

   The person visited and the escort both go through the devotee
   register (search existing, or add new inline) rather than free text.
   A visit only stores its own mobile/city when the padhramni is
   somewhere other than that devotee's usual place; otherwise the
   server falls back to the register, so a row is never just a date.
   ============================================================ */
(function (global) {
  'use strict';
  const { esc, attr, icon, fmtDate, fmtDateLong, debounce, statusBadge, todayISO,
          openSheet, closeSheet, readForm, clearFieldErrors, showFieldError, toast,
          devoteeField, devoteeMultiField, bindDevotees, multiIds } = UI;

  const state = { search: '', filter: 'upcoming', page: 1, rows: [] };
  const STATUSES = ['requested', 'confirmed', 'completed', 'cancelled'];

  const FILTERS = [
    ['upcoming', 'Upcoming'],
    ['all', 'All'],
    ['requested', 'To confirm'],
    ['confirmed', 'Confirmed'],
    ['completed', 'Completed'],
  ];

  /* The one action that follows from a visit's state, so the common
     case never needs the edit form opened. */
  const NEXT = {
    requested: { to: 'confirmed', label: 'Confirm' },
    confirmed: { to: 'completed', label: 'Mark done' },
  };

  async function render(host) {
    host.innerHTML = `
      <div class="flex justify-between items-center mg-page-head">
        <div>
          <h1 class="banner-title mg-page-title">Bappa / Bhuvaji Padhramni</h1>
          <p class="mg-page-sub">Visits to devotees' homes and shops</p>
        </div>
        <button class="btn btn-primary mg-btn-xs" data-add>${icon('plus','ico-sm')} Visit</button>
      </div>

      <div id="visSummary"></div>

      <div class="btn-row" style="margin:1rem 0 .7rem">
        ${FILTERS.map(([k, label]) => `
          <button type="button" class="btn mg-btn-xs ${state.filter === k ? 'btn-primary' : 'btn-outline'}"
                  data-filter="${attr(k)}">${esc(label)}</button>`).join('')}
      </div>
      <div class="search-bar">${icon('search')}
        <input class="form-input" id="visSearch" placeholder="Search name, mobile, city, address"
               value="${attr(state.search)}" autocomplete="off"></div>
      <div id="visBody">${UI.loading(3)}</div>`;

    host.querySelector('[data-add]').addEventListener('click', () => openForm());
    host.querySelectorAll('[data-filter]').forEach((b) =>
      b.addEventListener('click', () => {
        state.filter = b.getAttribute('data-filter'); state.page = 1; render(host);
      }));
    host.querySelector('#visSearch').addEventListener('input',
      debounce((e) => { state.search = e.target.value.trim(); state.page = 1; load(); }, 280));

    paintSummary();          // its own request: the totals are for the
    await load();            // whole diary, not the current filter
  }

  /* Totals describe the diary as a whole — narrowing the list should
     not change what the strip says the workload is. */
  async function paintSummary() {
    const host = document.getElementById('visSummary');
    if (!host) return;
    let all = [];
    try { all = await API.visits({}); } catch { return; }
    if (!document.getElementById('visSummary')) return;

    const t = all.reduce((a, v) => {
      const w = UI.whenDay(v.visit_date);
      const live = v.status !== 'cancelled' && v.status !== 'completed';
      if (v.status === 'completed') a.done++;
      if (live && w.days === 0) a.today++;
      if (live && w.days > 0 && w.days <= 7) a.week++;
      if (live && v.status === 'requested') a.toConfirm++;
      if (live && w.days < 0) a.overdue++;
      return a;
    }, { today: 0, week: 0, toConfirm: 0, done: 0, overdue: 0 });

    host.innerHTML = `
      <div class="stats-grid">
        <div class="stat"><div class="stat-text">
          <div class="stat-card-title">Today</div>
          <div class="stat-card-value">${esc(UI.num(t.today))}</div>
          <div class="mg-muted-xs">padhramni to make</div></div>
          <span class="stat-ico due">${icon('temple')}</span></div>
        <div class="stat"><div class="stat-text">
          <div class="stat-card-title">Next 7 days</div>
          <div class="stat-card-value">${esc(UI.num(t.week))}</div>
          <div class="mg-muted-xs">after today</div></div>
          <span class="stat-ico people">${icon('calendar')}</span></div>
        <div class="stat"><div class="stat-text">
          <div class="stat-card-title">To confirm</div>
          <div class="stat-card-value" ${t.toConfirm ? 'style="color:var(--warning)"' : ''}>${esc(UI.num(t.toConfirm))}</div>
          <div class="mg-muted-xs">requested, not yet fixed</div></div>
          <span class="stat-ico grace">${icon('user-check')}</span></div>
        <div class="stat"><div class="stat-text">
          <div class="stat-card-title">Completed</div>
          <div class="stat-card-value">${esc(UI.num(t.done))}</div>
          <div class="mg-muted-xs">of ${esc(UI.num(all.length))} on record</div></div>
          <span class="stat-ico rupee">${icon('check')}</span></div>
      </div>
      ${t.overdue ? `<p class="small" style="margin:.6rem 0 0;color:var(--warning)">
        ${icon('alert','ico-sm')} ${esc(UI.num(t.overdue))} padhramni ${t.overdue === 1 ? 'is' : 'are'}
        past ${t.overdue === 1 ? 'its' : 'their'} date and still open — confirm ${t.overdue === 1 ? 'it' : 'them'}
        as done, or move the date.</p>` : ''}`;
  }

  async function load() {
    const body = document.getElementById('visBody');
    if (!body) return;
    body.innerHTML = UI.loading(3);
    try {
      const params = { search: state.search };
      if (state.filter === 'upcoming') params.upcoming = '1';
      else if (state.filter !== 'all') params.status = state.filter;

      state.rows = await API.visits(params);
      if (!state.rows.length) {
        body.innerHTML = UI.empty(
          state.search ? 'No padhramni found'
            : state.filter === 'upcoming' ? 'Nothing coming up' : 'No padhramni',
          state.search ? 'Try another name, number or place.'
            : state.filter === 'upcoming' ? 'Every visit on the books is in the past.'
            : 'Add one to get started.', 'temple');
        return;
      }

      const pg = UI.paginate(state.rows, state.page);
      state.page = pg.page;

      body.innerHTML = `
        <div class="card">
          <div class="card-header">
            <h2>${esc(UI.num(state.rows.length))} padhramni</h2>
            <span class="small muted">${esc((FILTERS.find((f) => f[0] === state.filter) || [])[1] || '')}</span>
          </div>
          <div class="card-body" style="padding:0"><div class="list">
            ${pg.slice.map(rowFor).join('')}
          </div></div>
          ${UI.pager(pg, 'padhramni')}
        </div>`;

      UI.bindExpanders(body);
      UI.bindPager(body, (d) => { state.page = pg.page + d; load(); });
      bindRowActions(body);
    } catch (e) {
      body.innerHTML = UI.errorState(e.message);
    }
  }

  function rowFor(v) {
    const w = UI.whenDay(v.visit_date);
    const open = v.status !== 'completed' && v.status !== 'cancelled';
    const overdue = open && w.days !== null && w.days < 0;
    const next = open ? NEXT[v.status] : null;
    const place = [v.city, v.state && v.state !== 'Gujarat' ? v.state : null].filter(Boolean).join(', ');

    const summary = `
      <div class="row-main">
        <div class="row-title">${esc(v.devotee_name)} ${statusBadge(v.status)}
          ${overdue ? '<span class="badge badge-warn">Overdue</span>' : ''}</div>
        <div class="collect-meta">
          ${v.mobile ? `<span class="is-phone">${icon('phone','ico-sm')} ${esc(v.mobile)}</span>`
                     : `<span class="is-missing">${icon('alert','ico-sm')} No mobile</span>`}
          ${place ? `<span>${esc(place)}</span>` : ''}
          ${v.purpose ? `<span>${esc(v.purpose)}</span>` : ''}
        </div>
      </div>
      <div class="row-end collect-lead">
        <div class="lead-fig when-${attr(overdue ? 'past' : w.tone)}">
          <span class="lead-k">${esc(fmtDate(v.visit_date))}${v.visit_time ? ' · ' + esc(v.visit_time) : ''}</span>
          <span class="lead-v">${esc(w.label)}</span>
        </div>
        ${next ? `<button class="btn btn-primary mg-btn-xs"
                    data-adv="${attr(v.id)}" data-to="${attr(next.to)}">${esc(next.label)}</button>` : ''}
      </div>`;

    const detail = `
      <div class="vis-detail">
        ${v.address ? `<div class="vis-line">${icon('home','ico-sm')}
          <span>${esc(v.address)}</span></div>` : ''}
        <div class="vis-line">${icon('calendar','ico-sm')}
          <span>${esc(fmtDateLong(v.visit_date))}${v.visit_time ? ' at ' + esc(v.visit_time) : ' — time not fixed'}</span></div>
        ${v.purpose ? `<div class="vis-line">${icon('diya','ico-sm')}
          <span>${esc(v.purpose)}</span></div>` : ''}
        <div class="vis-line">${icon('users','ico-sm')}
          <span>${v.escorts && v.escorts.length
            ? 'Escort: ' + v.escorts.map((e) => esc(e.full_name)).join(', ')
            : '<span class="muted">No escort named yet</span>'}</span></div>
        ${v.samaj || v.mul_vatan ? `<div class="vis-line">${icon('temple','ico-sm')}
          <span>${[v.samaj, v.mul_vatan ? 'mul ' + v.mul_vatan : null]
            .filter(Boolean).map(esc).join(' · ')}</span></div>` : ''}
        ${v.notes ? `<div class="vis-line">${icon('book','ico-sm')}
          <span>${esc(v.notes)}</span></div>` : ''}
      </div>
      <div class="more-actions">
        ${open && v.status !== 'completed'
          ? `<button class="btn btn-outline mg-btn-xs" data-adv="${attr(v.id)}" data-to="completed">
               ${icon('check','ico-sm')} Mark done</button>` : ''}
        ${open ? `<button class="btn btn-outline mg-btn-xs" data-adv="${attr(v.id)}" data-to="cancelled">
               ${icon('close','ico-sm')} Cancel visit</button>` : ''}
        <button class="btn btn-outline mg-btn-xs" data-edit="${attr(v.id)}">
          ${icon('edit','ico-sm')} Edit padhramni</button>
        ${v.devotee_id ? `<button class="btn btn-outline mg-btn-xs" data-dev="${attr(v.devotee_id)}">
          ${icon('users','ico-sm')} Devotee</button>` : ''}
      </div>`;

    return UI.expandableRow(summary, detail,
      { itemClass: 'visit-row', label: 'Address, escort and notes' });
  }

  function bindRowActions(body) {
    body.querySelectorAll('[data-adv]').forEach((b) =>
      b.addEventListener('click', async () => {
        const to = b.getAttribute('data-to');
        b.disabled = true;
        try {
          await API.put('/visits/' + b.getAttribute('data-adv'), { status: to });
          toast(to === 'cancelled' ? 'Padhramni cancelled' : `Marked ${to}`, 'ok');
          paintSummary();
          await load();
        } catch (e) { b.disabled = false; toast(e.message, 'err'); }
      }));
    body.querySelectorAll('[data-edit]').forEach((b) =>
      b.addEventListener('click', async () => {
        openForm(await API.get('/visits/' + b.getAttribute('data-edit')));
      }));
    body.querySelectorAll('[data-dev]').forEach((b) =>
      b.addEventListener('click', () => Pages.devotees.openProfile(b.getAttribute('data-dev'))));
  }

  function openForm(existing) {
    const v = existing || {};
    const mainDevotee = v.devotee_id ? { id: v.devotee_id, full_name: v.devotee_name } : null;

    openSheet({
      title: v.id ? 'Padhramni' : 'Add Padhramni',
      body: `
        <form id="visForm" novalidate>
          ${devoteeField('visitor', 'Devotee Being Visited', mainDevotee)}
          ${/* Left blank, these fall back to the devotee's register
                entry, so the placeholder shows what will actually be
                used — fill them in only when this padhramni is at a
                different number or place. */''}
          <div class="form-row">
            <div class="form-group"><label class="form-label" for="f_mobile">Mobile</label>
              <input class="form-input" id="f_mobile" name="mobile" value="${attr(v.mobile || '')}"
                     inputmode="tel" placeholder="${attr(v.devotee_mobile || 'From the register')}"></div>
            <div class="form-group"><label class="form-label" for="f_city">City</label>
              <input class="form-input" id="f_city" name="city" value="${attr(v.city || '')}"
                     placeholder="${attr(v.devotee_city || 'From the register')}"></div>
          </div>
          <div class="form-group"><label class="form-label" for="f_address">Address</label>
            <textarea class="form-textarea" id="f_address" name="address" data-translate rows="2">${esc(v.address || '')}</textarea></div>
          <div class="form-row">
            <div class="form-group"><label class="form-label req" for="f_visit_date">Date</label>
              <input class="form-input" id="f_visit_date" name="visit_date" type="date" value="${attr(v.visit_date || todayISO())}"></div>
            <div class="form-group"><label class="form-label" for="f_visit_time">Time</label>
              <input class="form-input" id="f_visit_time" name="visit_time" type="time" value="${attr(v.visit_time || '')}"></div>
          </div>
          <div class="form-group"><label class="form-label" for="f_purpose">Purpose</label>
            <input class="form-input" id="f_purpose" name="purpose" data-translate value="${attr(v.purpose || '')}" placeholder="Griha shanti, new shop, …"></div>
          <div class="form-group"><label class="form-label" for="f_status">Status</label>
            <select class="form-select" id="f_status" name="status">
              ${STATUSES.map((s) => `<option value="${attr(s)}"${(v.status || 'requested') === s ? ' selected' : ''}>
                ${esc(s.charAt(0).toUpperCase() + s.slice(1))}</option>`).join('')}
            </select></div>
          ${devoteeMultiField('escort', 'Escort — devotees leading this visit', v.escorts || [])}
          <div class="form-group"><label class="form-label" for="f_notes">Note</label>
            <input class="form-input" id="f_notes" name="notes" data-translate value="${attr(v.notes || '')}"></div>
        </form>`,
      footer: `
        ${v.id ? '<button class="btn btn-outline btn-danger" data-del style="color:#fff;background:var(--danger);border:0">Delete</button>' : ''}
        <button class="btn btn-outline" data-sheet-close>Cancel</button>
        <button class="btn btn-primary" id="visSave">${v.id ? 'Save' : 'Add'}</button>`,
      onMount(sheet) {
        bindDevotees(sheet);
        sheet.querySelector('[data-sheet-close]').addEventListener('click', closeSheet);
        const del = sheet.querySelector('[data-del]');
        if (del) del.addEventListener('click', () => {
          UI.confirmSheet({
            title: 'Delete this padhramni?', message: 'This cannot be undone.',
            confirmLabel: 'Delete', danger: true,
            onConfirm: async () => { await API.del('/visits/' + v.id); toast('Deleted', 'ok'); refreshPage(); },
          });
        });
        sheet.querySelector('#visSave').addEventListener('click', async (e) => {
          const form = document.getElementById('visForm');
          clearFieldErrors(form);
          const data = readForm(form);
          const devoteeId = form.querySelector('[name="visitor_id"]').value || null;
          data.devotee_id = devoteeId;
          data.devotee_name = form.querySelector('#f_visitor_q').value.trim();
          data.escort_ids = multiIds(form, 'escort');
          delete data.visitor_id; delete data['escort[]'];

          if (!devoteeId && !data.devotee_name) return showFieldError(form, 'visitor_id', 'Search or add the devotee');
          if (!data.visit_date) return showFieldError(form, 'visit_date', 'Pick a date');

          e.currentTarget.disabled = true;
          try {
            if (v.id) await API.put('/visits/' + v.id, data);
            else await API.post('/visits', data);
            closeSheet(); toast(v.id ? 'Updated' : 'Padhramni added', 'ok'); refreshPage();
          } catch (err) {
            e.currentTarget.disabled = false;
            toast(err.message, 'err');
          }
        });
      },
    });
  }

  global.Pages = global.Pages || {};
  global.Pages.visits = { render, openForm };
})(window);
